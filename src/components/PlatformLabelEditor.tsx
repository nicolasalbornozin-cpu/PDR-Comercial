import {Ionicons} from '@expo/vector-icons';
import {useState} from 'react';
import {KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useAuth} from '@/hooks/useAuth';
import {individualSheetService} from '@/services/individualSheetService';
import {colors,radii,spacing} from '@/theme';
import {AppButton} from './Buttons';
import {FormField} from './FormField';
export function PlatformLabelEditor({id,label,onSaved}:{id:string;label:string;onSaved:(label:string)=>void}){
 const {authenticatedUser}=useAuth();
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(authenticatedUser?.role!=='admin')return null;
 async function save(){setBusy(true);setError('');try{await individualSheetService.setDisplayLabel(id,draft);onSaved(draft.trim());setOpen(false);}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}}
 return <><Pressable accessibilityRole="button" accessibilityLabel={`Editar nombre de ${label}`} hitSlop={10} onPress={()=>{setDraft(label);setError('');setOpen(true);}}><Ionicons name="pencil" size={20} color={colors.goldText}/></Pressable>
  <Modal visible={open} transparent animationType="fade" onRequestClose={()=>{if(!busy)setOpen(false);}}>
   <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={styles.overlay}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.center}>
     <View style={styles.card}><Text style={styles.title}>Nombre visible para todos</Text><FormField icon="calendar-outline" label="Nombre del período" value={draft} onChangeText={setDraft} maxLength={120} autoFocus/>
      {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
      <AppButton label="Guardar nombre" loading={busy} disabled={!draft.trim()} onPress={save}/><AppButton label="Cancelar" variant="secondary" disabled={busy} onPress={()=>setOpen(false)}/>
     </View>
    </ScrollView>
   </KeyboardAvoidingView>
  </Modal>
 </>;
}
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.45)'},center:{flexGrow:1,justifyContent:'center',padding:spacing.xl},card:{backgroundColor:colors.surface,borderRadius:radii.xl,padding:spacing.xl,gap:spacing.lg,width:'100%',maxWidth:540,alignSelf:'center'},title:{fontSize:22,color:colors.primary,fontWeight:'700'},error:{color:colors.danger}});
