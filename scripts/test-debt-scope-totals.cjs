const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:9}}).outputText,f);
const {scopeDebt}=require('../src/utils/teamOverview.ts');
const {mergeHomeTotals}=require('../src/utils/rankingHomeTotals.ts');
const data={profiles:[{id:'m1',role:'sales_manager',active:true,employmentStatus:'active'},{id:'m2',role:'sales_manager',active:true,employmentStatus:'active'}],latestByUser:{m1:{debtSalesCount:81},m2:{debtSalesCount:95},c:{debtSalesCount:25},s:{debtSalesCount:2}}};
assert.equal(scopeDebt([{id:'s'}],data,'c'),25); // Includes historical sales beyond the active roster.
assert.equal(scopeDebt([{id:'s'}],data),176); // Units once; never units plus sellers.
assert.equal(scopeDebt([{id:'s'}],data,'s'),2);
data.latestByUser.c.debtSalesCount=0;
assert.equal(scopeDebt([{id:'s'}],data,'c'),0);
assert.equal(scopeDebt([{id:'s'}],data,'unknown'),2);
assert.equal(scopeDebt([],{profiles:[],latestByUser:{}},'unknown'),undefined);
const workers=[{id:'seller',name:'NINETTE ESPINOZA',role:'seller',team_name:null},{id:'team-atenea',name:'DURAN MAURICIO',role:'coordinator',team_name:'ATENEA',active:false}];
const result=mergeHomeTotals([{worker_id:'seller',source_row:3,metrics:{totalUf:367}}],[{name:'NINETTE ESPINOZA',role:'coordinator',teamName:'ATENEA',row:20,values:{homeMonthlyGrossUf:559.05,homeMonthlyEmittedUf:384.05}}],workers);
assert.deepEqual(result.find(r=>r.worker_id==='seller').metrics,{totalUf:367});
assert.equal(result.find(r=>r.worker_id==='team-atenea').metrics.homeMonthlyGrossUf,559.05);
assert.equal(workers[1].active,false);
console.log('PASS: full-scope debt, zero vs missing, unit totals counted once, team reassignment preserves seller figures and does not activate access.');
