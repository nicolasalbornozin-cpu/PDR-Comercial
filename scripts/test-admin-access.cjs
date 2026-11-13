const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('supabase/functions/admin-users/index.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function requestWithAccess(access, role = 'admin', active = true, authenticated = true, issueCode = false, targetEmail = '123456785@pdr.internal') {
  let handler, clients = 0, profileReads = 0;
  const generated = [], audits = [];
  const caller = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'synthetic-user' } : null }, error: null }) },
    rpc: async (name) => { assert.equal(name, 'session_access_allowed'); return access; },
  };
  const chain = {
    select() { return this; }, eq() { return this; },
    maybeSingle: async () => ({ data: { id: 'synthetic-user', role, active } }),
  };
  const admin = {
    auth: { admin: {
      getUserById: async () => ({ data: { user: { email: targetEmail } }, error: null }),
      generateLink: async (options) => {
        generated.push({ ...options });
        return { data: { properties: { email_otp: '013456' } }, error: null };
      },
    } },
    from(table) {
      if (table === 'admin_audit_logs') return { insert: async row => { audits.push({ ...row }); } };
      profileReads++;
      if (profileReads === 1) return chain;
      return { ...chain, maybeSingle: async () => ({ data: { id: 'target', rut: '123456785', active: true, employment_status: 'active' } }) };
    },
  };
  vm.runInNewContext(code, {
    exports: {}, Response, console,
    Deno: { env: { get: () => 'synthetic-config' }, serve: (fn) => { handler = fn; } },
    require: (name) => {
      if (name.startsWith('npm:@supabase/')) return { createClient: () => clients++ === 0 ? caller : admin };
      if (name.endsWith('/cors.ts')) return { corsHeaders: {}, jsonResponse: (body, status = 200) => new Response(JSON.stringify(body), { status }) };
      if (name.endsWith('/rut.ts')) return { internalEmail: rut => rut + '@pdr.internal', isValidRut: rut => rut === '123456785' };
      if (name.includes('edge-runtime')) return {};
      throw Error(`Unexpected import ${name}`);
    },
  });
  // Invalid JSON reaches 400 only after all authorization checks succeed.
  const response = await handler(new Request('https://example.invalid/admin-users', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic' },
    body: issueCode ? JSON.stringify({ action: 'issueRecoveryCode', userId: 'target' }) : 'invalid-json',
  }));
  if (issueCode) return { status: response.status, body: await response.json(), cache: response.headers.get('Cache-Control'), generated, audits };
  return { status: response.status, profileReads };
}

(async () => {
  for (const access of [{ data: false }, { data: null }, { data: true, error: { message: 'unavailable' } }]) {
    assert.deepEqual(await requestWithAccess(access), { status: 403, profileReads: 0 });
  }
  assert.equal((await requestWithAccess({ data: true }, 'seller')).status, 403);
  assert.equal((await requestWithAccess({ data: true }, 'admin', false)).status, 403);
  assert.equal((await requestWithAccess({ data: true }, 'admin', true, false)).status, 401);
  assert.deepEqual(await requestWithAccess({ data: true }), { status: 400, profileReads: 1 });
  for (const role of ['seller', 'audiovisual']) {
    const denied = await requestWithAccess({ data: true }, role, true, true, true);
    assert.equal(denied.status, 403);
    assert.deepEqual(denied.generated, []);
  }
  const mismatched = await requestWithAccess({ data: true }, 'admin', true, true, true, 'another@pdr.internal');
  assert.equal(mismatched.status, 400);
  assert.deepEqual(mismatched.generated, []);
  const issued = await requestWithAccess({ data: true }, 'admin', true, true, true);
  assert.equal(issued.status, 200);
  assert.equal(issued.cache, 'no-store');
  assert.deepEqual(issued.body, { ok: true, code: '013456' });
  assert.deepEqual(issued.generated, [{ type: 'recovery', email: '123456785@pdr.internal' }]);
  assert.deepEqual(issued.audits, [{ admin_id: 'synthetic-user', action: 'password_recovery_code_issued', target_user_id: 'target' }]);
  console.log('PASS: admin endpoint rejects revoked/unknown access, non-admin and inactive profiles.');
  console.log('PASS: recovery code requires an admin and the matching account, with no secret in audit logs or cache.');
})().catch(error => { console.error(error); process.exitCode = 1; });
