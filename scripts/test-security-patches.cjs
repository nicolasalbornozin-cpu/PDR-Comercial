const assert = require('node:assert/strict');
const braces = require('braces'), forge = require('node-forge');
assert.deepEqual(braces.expand('src/{a,b}/{1..2}.ts'), ['src/a/1.ts','src/a/2.ts','src/b/1.ts','src/b/2.ts']);
for (const method of ['parse','compile','expand','stringify']) {
  assert.throws(() => braces[method]('{'.repeat(4000)+'a,b'+'}'.repeat(4000)), /safe depth/);
}
let ast = {type:'text',value:'x'};
for(let i=0;i<100;i++) ast={type:'root',nodes:[ast]};
for(const method of ['compile','expand','stringify']) assert.throws(()=>braces[method](ast),/safe depth/);
const cyclic={type:'root',nodes:[]};cyclic.nodes.push(cyclic);
assert.throws(()=>braces.compile(cyclic),/safe depth/);
const keys=forge.pki.rsa.generateKeyPair({bits:1024,e:65537}); // Synthetic test key only.
const md=forge.md.sha256.create().update('synthetic regression test');
const digest=md.digest().getBytes();
assert.equal(keys.publicKey.verify(digest,keys.privateKey.sign(md)),true);
const a=forge.asn1;
const oid=a.create(a.Class.UNIVERSAL,a.Type.OID,false,a.oidToDer(forge.oids.sha256).getBytes());
const nil=()=>a.create(a.Class.UNIVERSAL,a.Type.NULL,false,'');
function signature(elements){
  const info=a.create(a.Class.UNIVERSAL,a.Type.SEQUENCE,true,[
    a.create(a.Class.UNIVERSAL,a.Type.SEQUENCE,true,elements),
    a.create(a.Class.UNIVERSAL,a.Type.OCTETSTRING,false,digest)]);
  return keys.privateKey.sign(a.toDer(info).getBytes(),'NONE');
}
assert.equal(keys.publicKey.verify(digest,signature([oid])),true);
assert.equal(keys.publicKey.verify(digest,signature([oid,nil()])),true);
assert.throws(()=>keys.publicKey.verify(digest,signature([oid,nil(),nil()])),/DigestInfo/);
assert.throws(()=>keys.publicKey.verify(digest,signature([oid,a.create(a.Class.UNIVERSAL,a.Type.INTEGER,false,'\x01')])),/DigestInfo/);
console.log('PASS: bounded brace parsing/AST traversal and strict RSA DigestAlgorithm validation.');
