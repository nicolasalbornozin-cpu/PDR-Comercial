const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let values=[],cursor=0;
const element=(type,props)=>({type,props:props??{}});
const source=fs.readFileSync('src/components/IndependentSheetUpload.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const titles={dotacion:'Dotacion',production_sellers:'Producción',production_coordinators:'Coordinadores',titanes:'Mora TITANES',rbh:'Mora RBH',msc:'Mora MSC',sauce:'Sauce',ranking_monthly:'Ranking Plataforma'};
const sheets=Object.fromEntries(Object.entries(titles).map(([k,label])=>[k,{label,sheet:'Carga '+k}]));Object.assign(sheets,{category:{sheet:'Carga Catego'},senior:{sheet:'CARGA Senior'}});
const output={};
vm.runInNewContext(code,{exports:output,require(id){
 if(id==='react')return {useState(initial){const i=cursor++;if(!(i in values))values[i]=initial;return [values[i],v=>{values[i]=typeof v==='function'?v(values[i]):v;}];}};
 if(id==='react/jsx-runtime')return {jsx:element,jsxs:element};
 if(id==='react-native')return {Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{create:x=>x}};
 if(id==='expo-document-picker')return {};if(id==='expo-file-system')return {File:class{}};if(id==='./Buttons')return {AppButton:'AppButton'};
 if(id.includes('individualSheetParser'))return {sheetSources:sheets};if(id.includes('individualSheetService'))return {};
 if(id.includes('uploadCampaign'))return {uploadPublicationDates:()=>({start:'2026-10-15',end:'2026-10-15',year:'2026'})};
 if(id==='@/theme')return {colors:{},radii:{},spacing:{}};throw Error(id);
 }});
const render=()=>{cursor=0;return output.IndependentSheetUpload();};
function walk(node,fn){if(node===null||node===undefined||node===false)return;if(Array.isArray(node))return node.forEach(n=>walk(n,fn));fn(node);if(typeof node==='object')walk(node.props.children,fn);}
function text(node){const parts=[];walk(node,n=>{if(typeof n==='string'||typeof n==='number')parts.push(String(n));});return parts.join('');}
for(const label of ['Catego vigente','Catego anterior','Carga Senior vigente','Carga Senior anterior']){
 const screen=render();const found=[];walk(screen,n=>{if(n.type==='Pressable'&&text(n)===label)found.push(n);});assert.equal(found.length,1,label+' visible exactly once');
 found[0].props.onPress();const selected=render();assert.ok(text(selected).includes('Destino: '+label));
 assert.ok(text(selected).includes(label.endsWith('anterior')?'la anterior; la vigente se conserva':'la vigente; la anterior se conserva'));
 const periodInputs=[];walk(selected,n=>{if(n.type==='TextInput')periodInputs.push(n);});assert.equal(periodInputs.length,0);
}
console.log('PASS: rendered upload selector exposes four independent goal destinations, preserves the other slot and has no period/date form.');
