const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {displayPersonName}=require('../src/utils/personName.ts');
const {parseRankingCancellations}=require('../src/services/individualSheetParser.ts');
const {canonicalCancellationRows}=require('../src/utils/cancellationRows.ts');
const {daysWithoutSale}=require('../src/utils/commercialRules.ts');
assert.equal(displayPersonName({name:'APELLIDO SEGUNDO NOMBRE OTRO',role:'seller',displayName:'Nombre Otro Apellido'}),'Nombre Otro Apellido');
assert.equal(displayPersonName({name:'APELLIDO SEGUNDO NOMBRE OTRO',role:'seller'}),'Nombre Apellido');
assert.equal(displayPersonName({name:'Persona Admin',role:'admin'}),'Persona Admin');
assert.equal(displayPersonName({name:'legacy',displayName:'María Del Carmen Muñoz'}),'María Del Carmen Muñoz');
const cell=v=>({v,t:typeof v==='number'?'n':'s'});
const sheet={G1:cell('RUT vendedor'),M1:cell('Ejecutivo'),N1:cell('Última venta'),
 D2:cell(300),G2:cell('20127679-9'),H2:cell('Persona Prueba'),K2:cell('ene-26'),
 M2:cell('Persona Sin Anulaciones'),N2:cell('2026-10-12'),M3:cell('Persona Sin Ventas'),N3:cell('Sin ventas')};
const book={SheetNames:['anulaciones'],Sheets:{anulaciones:sheet}};
let parsed=parseRankingCancellations(book,{start:'2026-01-01',end:'2026-12-31'});
assert.deepEqual(parsed.errors,[]);
assert.equal(parsed.records.find(r=>r.rut==='201276799').values.cancellationUf,300);
assert.equal(parsed.records.find(r=>r.name==='Persona Sin Anulaciones').values.lastSaleDate,'2026-10-12');
assert.equal(parsed.records.find(r=>r.name==='Persona Sin Anulaciones').values.cancellationUf,0);
assert.equal(parsed.records.find(r=>r.name==='Persona Sin Ventas').values.daysWithoutSaleText,'Sin ventas');
assert.equal(daysWithoutSale('2026-10-12',new Date('2026-10-14T12:00:00Z')),2);
assert.equal(daysWithoutSale(undefined),null); // Do not invent zero days for no sale history.
sheet.N3={t:'e',v:42};
parsed=parseRankingCancellations(book,{start:'2026-01-01',end:'2026-12-31'});
assert.equal(parsed.records.find(r=>r.name==='Persona Sin Ventas').values.daysWithoutSaleText,'Sin fecha de última venta');
const merged=canonicalCancellationRows([
 {worker_id:'worker',source_row:1,metrics:{cancellationUf:300}},
 {worker_id:'worker',source_row:2,metrics:{cancellationUf:0,daysWithoutSaleText:'Sin ventas'}},
]);
assert.equal(merged[0].metrics.cancellationUf,300);assert.equal(merged[0].metrics.daysWithoutSaleText,'Sin ventas');
assert.ok(!JSON.stringify(parsed.records).includes('PARQUE'));
console.log('PASS: confirmed names are not inverted; last-sale table is independent of annulments; never sold and unknown dates remain distinct.');
