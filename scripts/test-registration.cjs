const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { registrationValidation, isStrongRegistrationPassword } = require('../src/utils/registration.ts');
const { registerAccount, strongPassword } = require('../supabase/functions/register-account/handler.ts');
const rut = '18.541.395-0', password = 'Synthetic!927a'; // Test fixture, never a live credential.
assert.equal(registrationValidation(rut, password, password), null);
assert.match(registrationValidation(rut, password, password + 'x'), /coinciden/);
assert.match(registrationValidation('185413951', password, password), /RUT/);
assert.equal(registrationValidation(rut, 'Password1', 'Password1'), null);
assert.match(registrationValidation(rut, 'Aa1abcd', 'Aa1abcd'), /8 o más/);
for (const value of ['short', 'abcdef123456', 'ABCDEF123456', 'NoNumbersAbc', 'Aa1!' + 'á'.repeat(35), '\ud800Aa1!123456']) {
  assert.equal(isStrongRegistrationPassword(value), false);
}
for (const value of [password, 'Password1', 'NoSymbols1234', 'Aa1' + 'x'.repeat(69), 'Aa1' + 'á'.repeat(34)]) {
  assert.equal(isStrongRegistrationPassword(value), true);
  assert.equal(strongPassword(value), true);
}
(async () => {
  let reserves = 0, creates = 0, releases = 0, attributes;
  const dependencies = {
    reserve: async () => { reserves++; return { ok: true, role: 'seller' }; },
    create: async (input) => { creates++; attributes = input; return { ok: true }; },
    release: async () => { releases++; },
  };
  const input = { rut, password, confirmPassword: password };
  for (const invalid of [{ ...input, role: 'admin' }, { ...input, name: 'Override' }, { ...input, userId: 'existing' }, { ...input, confirmPassword: 'wrong' }, { ...input, password: 'short' }, []]) {
    assert.equal((await registerAccount(invalid, 'fixture-request', 'hash', dependencies)).status, 400);
  }
  assert.equal(reserves, 0);
  const success = await registerAccount(input, 'fixture-request', 'hash', dependencies);
  assert.equal(success.status, 201); assert.equal(success.body.ok, true);
  assert.equal(reserves, 1); assert.equal(creates, 1); assert.equal(releases, 1);
  assert.equal(attributes.email, '185413950@pdr.internal');
  assert.equal(attributes.app_metadata.role, 'seller');
  assert.equal(attributes.app_metadata.roster_registration, 'fixture-request');
  assert.equal(attributes.app_metadata.roster_rut, '185413950');
  assert.equal(attributes.email_confirm, true);
  for (const blocked of [{ error: 'Error al comunicar con el servidor', status: 403 }, { error: 'Ya tiene cuenta', status: 409 }, { error: 'Demasiados intentos', status: 429 }, { ok: true, role: 'admin' }]) {
    await registerAccount(input, 'fixture', 'hash', { ...dependencies, reserve: async () => blocked });
  }
  assert.equal(creates, 1);
  assert.equal((await registerAccount(input, 'fixture', 'hash', { ...dependencies, create: async () => ({ ok: false }) })).status, 409);
  assert.equal(releases, 2);
  await assert.rejects(registerAccount(input, 'fixture', 'hash', { ...dependencies, create: async () => { throw new Error('transport'); } }));
  assert.equal(releases, 3);
  for (const role of ['coordinator', 'sales_manager', 'commercial_manager', 'audiovisual']) {
    assert.equal((await registerAccount(input, 'fixture', 'hash', { ...dependencies, reserve: async () => ({ ok: true, role }) })).status, 201);
    assert.equal(attributes.app_metadata.role, role);
  }
  console.log('PASS: registration validation, 72-byte limit, matching passwords, roster roles only, duplicates/blocked/rate limits, cleanup, no role override.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
