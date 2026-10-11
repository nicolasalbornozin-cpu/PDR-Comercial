const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('supabase/functions/admin-users/index.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function requestWithAccess(access, role = 'admin', active = true, authenticated = true) {
  let handler, clients = 0, profileReads = 0;
  const caller = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'synthetic-user' } : null }, error: null }) },
    rpc: async (name) => { assert.equal(name, 'session_access_allowed'); return access; },
  };
  const chain = {
    select() { return this; }, eq() { return this; },
    maybeSingle: async () => ({ data: { id: 'synthetic-user', role, active } }),
  };
  const admin = { from: () => { profileReads++; return chain; } };
  vm.runInNewContext(code, {
    exports: {}, Response, console,
    Deno: { env: { get: () => 'synthetic-config' }, serve: (fn) => { handler = fn; } },
    require: (name) => {
      if (name.startsWith('npm:@supabase/')) return { createClient: () => clients++ === 0 ? caller : admin };
      if (name.endsWith('/cors.ts')) return { corsHeaders: {}, jsonResponse: (body, status = 200) => new Response(JSON.stringify(body), { status }) };
      if (name.endsWith('/rut.ts') || name.includes('edge-runtime')) return {};
      throw Error(`Unexpected import ${name}`);
    },
  });
  // Invalid JSON reaches 400 only after all authorization checks succeed.
  const response = await handler(new Request('https://example.invalid/admin-users', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic' }, body: 'invalid-json',
  }));
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
  console.log('PASS: admin endpoint rejects revoked/unknown access, non-admin and inactive profiles.');
})().catch(error => { console.error(error); process.exitCode = 1; });
