const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('src/components/UpdateController.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const jsx=(type,props)=>({type,props:props??{}});
const flush=()=>new Promise(setImmediate);
function harness({pending=false,result='none',os='android',enabled=true,reloadFails=false}={}){
 const state=[],refs=[],effects=[],cleanups=[];let i=0,r=0,ran=false,listener,checks=0,reloads=0;
 const sdk={isEnabled:enabled,useUpdates:()=>({isUpdatePending:pending,isRestarting:false}),async reloadAsync(){reloads++;if(reloadFails)throw Error('private error');}};
 const exports={};vm.runInNewContext(code,{exports,__DEV__:false,require(id){
  if(id==='react')return {useState(initial){const index=i++;if(!(index in state))state[index]=initial;return [state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},useRef(initial){const index=r++;return refs[index]??(refs[index]={current:initial});},useEffect(fn){if(!ran)effects.push(fn);}};
  if(id==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'Fragment'};
  if(id==='react-native')return {Platform:{OS:os},AppState:{addEventListener(event,fn){listener=fn;return {remove(){listener=undefined;}};}},Modal:'Modal',Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{create:x=>x}};
  if(id==='expo-updates')return sdk;
  if(id.includes('appUpdateService'))return {async checkAppUpdate(alreadyReady){checks++;if(result==='offline')throw Error('network');return alreadyReady?'ready':result;}};
  if(id==='./Buttons')return {AppButton:'AppButton'};
  if(id==='@/theme')return {colors:{},radii:{},spacing:{}};throw Error(id);
 }});
 return {render(){i=0;r=0;const tree=exports.UpdateController();if(!ran){ran=true;effects.forEach(fn=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup);});}return tree;},resume(){listener?.('active');},get checks(){return checks;},get reloads(){return reloads;},unmount(){cleanups.forEach(fn=>fn());}};
}
function find(tree,predicate){const matches=[];function walk(n){if(!n)return;if(Array.isArray(n))return n.forEach(walk);if(typeof n==='object'){if(predicate(n))matches.push(n);walk(n.props.children);}}walk(tree);return matches;}
const button=(tree,label)=>find(tree,n=>n.type==='AppButton'&&n.props.label===label)[0];
(async()=>{
 let h=harness({pending:true});let tree=h.render();assert.equal(find(tree,n=>n.type==='Modal')[0].props.visible,true);
 button(tree,'Más tarde').props.onPress();tree=h.render();assert.equal(find(tree,n=>n.type==='Modal')[0].props.visible,false);
 const banner=find(tree,n=>n.type==='Pressable')[0];assert.match(banner.props.accessibilityLabel,/Actualizar ahora/);banner.props.onPress();assert.equal(find(h.render(),n=>n.type==='Modal')[0].props.visible,true);
 button(h.render(),'Más tarde').props.onPress();await flush();h.resume();tree=h.render();assert.equal(find(tree,n=>n.type==='Modal')[0].props.visible,true);h.unmount();
 h=harness({result:'ready'});assert.equal(h.render(),null);await flush();tree=h.render();assert.ok(button(tree,'Actualizar ahora'));assert.equal(h.checks,1);
 button(tree,'Actualizar ahora').props.onPress();await flush();assert.equal(h.reloads,1);h.unmount();
 h=harness({pending:true,reloadFails:true});tree=h.render();button(tree,'Actualizar ahora').props.onPress();await flush();tree=h.render();assert.ok(find(tree,n=>n.props.accessibilityRole==='alert').length);assert.equal(button(tree,'Actualizar ahora').props.disabled,false);h.unmount();
 h=harness({result:'offline'});h.render();await flush();assert.equal(h.render(),null);h.resume();await flush();assert.equal(h.checks,2);h.unmount();
 for(const options of [{os:'web',pending:true},{enabled:false,pending:true}]){h=harness(options);assert.equal(h.render(),null);await flush();assert.equal(h.checks,0);h.unmount();}
 const layout=fs.readFileSync('app/_layout.tsx','utf8');assert.match(layout,/<RootNavigator\s*\/><UpdateController\s*\/>/);assert.equal((layout.match(/<UpdateController\s*\/>/g)??[]).length,1);
 const profile=fs.readFileSync('app/(tabs)/profile.tsx','utf8');assert.ok(profile.indexOf('<AppUpdateStatus/>')<profile.indexOf('<View style={styles.infoCard}>'));
 console.log('PASS: update prompt before auth, pending/download fallback, persistent reminder, every reopen, reload retry, offline and disabled/web safety; Profile update controls near top.');
})().catch(error=>{console.error(error);process.exitCode=1;});
