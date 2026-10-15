export type UpdateResult = 'ready' | 'none';
interface UpdateAdapter {
 check(): Promise<{isAvailable:boolean;isRollBackToEmbedded?:boolean}>;
 download(): Promise<{isNew:boolean;isRollBackToEmbedded?:boolean}>;
}
// Automatic and manual controls share a check/download. A pending update must
// remain installable even when a new network check says "not available".
export function createUpdateChecker(adapter:UpdateAdapter){
 let inFlight:Promise<UpdateResult>|null=null;
 return (pending=false):Promise<UpdateResult>=>{
  if(pending)return Promise.resolve('ready');
  if(inFlight)return inFlight;
  inFlight=(async():Promise<UpdateResult>=>{
   const available=await adapter.check();
   if(!available.isAvailable&&!available.isRollBackToEmbedded)return 'none';
   const downloaded=await adapter.download();
   return downloaded.isNew||downloaded.isRollBackToEmbedded?'ready':'none';
  })().finally(()=>{inFlight=null;});
  return inFlight;
 };
}
