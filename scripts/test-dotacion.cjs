const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:9}}).outputText,f);
const {parseIndividualSheet}=require('../src/services/individualSheetParser.ts');
const cell=v=>({v,t:typeof v==='number'?'n':'s'});
const header=['RUT','Nombre','Fecha nac.','Fecha de Ing.','Estado','Rut Sup.','Nombre Coordinador','Rut JV','Nombre Jefe Ventas','Nombre Centro Costo'];
const rows=[header,
 ['12460300-5','JEFE EJEMPLO',30000,44000,'VIGENTE','','','12260875-1','','JEFES DE VENTA'],
 ['18541395-0','COORDINADOR EJEMPLO',30000,44000,'VIGENTE','18541395-0','','12460300-5','','COORDINADORES COMERCIALES'],
 ['19958414-6','VENDEDOR EJEMPLO (01/10/2026)',30000,44000,'LICENCIA','18541395-0','','12460300-5','','VENDEDORES TRADICIONALES']];
const book=name=>({SheetNames:[name],Sheets:{[name]:Object.fromEntries(rows.flatMap((row,i)=>row.map((v,j)=>[String.fromCharCode(65+j)+(i+1),cell(v)])))}});
for(const name of ['Dotacion','DOTACION VIG']){
 const r=parseIndividualSheet(book(name),'dotacion');assert.deepEqual(r.errors,[]);assert.equal(r.records.length,3);
 assert.equal(r.records[2].values.status,'medical_leave');assert.equal(r.records[2].name,'VENDEDOR EJEMPLO');
 assert.deepEqual(Object.keys(r.records[2].values).sort(),['birth_date','coordinator_rut','join_date','manager_rut','status']);
}
rows[3][4]='VACACIONES';assert.equal(parseIndividualSheet(book('Dotacion'),'dotacion').records[2].values.status,'vacation');
rows[3][4]='DESCONOCIDO';assert.ok(parseIndividualSheet(book('Dotacion'),'dotacion').errors.length);
rows[3][4]='VIGENTE';rows.push(rows[3]);assert.ok(parseIndividualSheet(book('Dotacion'),'dotacion').errors.some(e=>e.includes('repetido')));rows.pop();
rows.splice(2,1);assert.ok(parseIndividualSheet(book('Dotacion'),'dotacion').errors.some(e=>e.includes('coordinador ausente')));
console.log('PASS Dotacion: formats, roster statuses, hierarchy, duplicate/unknown rejection and HR-field minimization.');
// New debt extracts do not contain an operation identifier. Same-date sales
// must remain separate; unrelated customer columns must never be transmitted.
const debt={A1:cell('PARQUE'),B1:cell('FECHA CONTRATO'),D1:cell('VALOR VENTA UF')};
for(const r of [2,3])Object.assign(debt,{['B'+r]:cell('01-01-2026'),['D'+r]:cell(100),['E'+r]:cell(r===2?2:'0-8%'),['G'+r]:cell('Mora'),['H'+r]:cell('PRIVATE-CUSTOMER-CONTACT'),['M'+r]:cell('18541395-0'),['N'+r]:cell('PERSONA EJEMPLO')});
const d=parseIndividualSheet({SheetNames:['Carga RBH'],Sheets:{'Carga RBH':debt}},'rbh');
assert.deepEqual(d.errors,[]);assert.equal(d.records[0].values.debtSales,2);assert.equal(d.records[0].values.debtUf,200);
assert.equal(d.records[0].values.debtInstallments,2);assert.equal(d.records[0].values.debtUf08,100);
assert.ok(!JSON.stringify(d.records).includes('PRIVATE-CUSTOMER-CONTACT'));
console.log('PASS debt: new export, two contracts on one date, 0–8% combined, worker aggregates only.');
