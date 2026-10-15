const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {createUpdateChecker}=require('../src/utils/updateCheck.ts');
(async()=>{
 let checks=0,downloads=0;
 const checker=createUpdateChecker({async check(){checks++;return {isAvailable:true};},async download(){downloads++;return {isNew:true};}});
 assert.equal(await checker(true),'ready');assert.equal(checks,0);assert.equal(downloads,0);
 const a=checker(),b=checker();assert.equal(a,b);assert.deepEqual(await Promise.all([a,b]),['ready','ready']);assert.equal(checks,1);assert.equal(downloads,1);
 assert.equal(await createUpdateChecker({async check(){return {isAvailable:false};},async download(){throw Error('unneeded');}})(),'none');
 let attempts=0;const retry=createUpdateChecker({async check(){if(++attempts===1)throw Error('offline');return {isAvailable:true};},async download(){return {isNew:true};}});
 await assert.rejects(()=>retry(),/offline/);assert.equal(await retry(),'ready');
 const rollback=createUpdateChecker({async check(){return {isAvailable:false,isRollBackToEmbedded:true};},async download(){return {isNew:false,isRollBackToEmbedded:true};}});
 assert.equal(await rollback(),'ready');
 console.log('PASS: already-downloaded updates remain installable, concurrent checks are deduplicated, offline retry and rollback supported.');
})().catch(e=>{console.error(e);process.exitCode=1;});
