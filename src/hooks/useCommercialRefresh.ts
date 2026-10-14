import {useCallback,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {AppState} from 'react-native';
import {supabase} from '@/services/supabase';
export function useCommercialRefresh(){
 const [revision,setRevision]=useState(0);
 useFocusEffect(useCallback(()=>{
  const refresh=()=>setRevision(v=>v+1);
  refresh();const listener=AppState.addEventListener('change',state=>{if(state==='active')refresh();});
  const channel=supabase?.channel(`commercial-${Math.random().toString(36).slice(2)}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'platform_settings'},refresh)
   .on('postgres_changes',{event:'*',schema:'public',table:'current_sheet_uploads'},refresh).subscribe();
  return()=>{listener.remove();if(channel)void supabase?.removeChannel(channel);};
 },[]));
 return revision;
}
