import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NewsEditorInput, NewsEditorModal } from './NewsEditorModal';
import { NewsPhoto } from './NewsPhoto';
import { NewsPhotoViewer } from './NewsPhotoViewer';
import { newsImages } from '@/data/assets';
import { newsService } from '@/services/newsService';
import { colors, radii, spacing, typography } from '@/theme';
import { GalleryPhoto, NewsSection } from '@/types';

export function NewsEventSections({articleId,sections,photos,canEdit,refresh}:{articleId:string;sections:NewsSection[];photos:GalleryPhoto[];canEdit:boolean;refresh:()=>Promise<void>}) {
  const [editor,setEditor]=useState<{id?:string}|null>(null);
  const [title,setTitle]=useState('');const [description,setDescription]=useState('');
  const [busy,setBusy]=useState(false);const [uploading,setUploading]=useState<string>();const [progress,setProgress]=useState('');
  const [viewer,setViewer]=useState<{photos:GalleryPhoto[];index:number}|null>(null);
  const run=async(action:()=>Promise<unknown>)=>{setBusy(true);try{await action();await refresh();}catch(cause){Alert.alert('No se pudo guardar',cause instanceof Error?cause.message:'Intenta nuevamente.');}finally{setBusy(false);}};
  const edit=(section?:NewsSection)=>{setTitle(section?.title??'');setDescription(section?.description??'');setEditor(section?{id:section.id}:{});};
  const remove=(section:NewsSection)=>Alert.alert('Eliminar sección',`«${section.title}» y sus fotos dejarán de aparecer para todos.`,[{text:'Cancelar',style:'cancel'},{text:'Eliminar',style:'destructive',onPress:()=>{void run(()=>newsService.deleteSection(section.id));}}]);
  const removePhoto=(photo:GalleryPhoto)=>Alert.alert('Eliminar fotografía','La foto dejará de aparecer para todos.',[{text:'Cancelar',style:'cancel'},{text:'Eliminar',style:'destructive',onPress:()=>{void run(()=>newsService.deleteGalleryPhoto(photo));}}]);
  const upload=async(section:NewsSection)=>{setUploading(section.id);try{await newsService.addGalleryPhotos(section.title,articleId,(done,total)=>setProgress(`${done} de ${total} fotos`),section.id);}catch(cause){Alert.alert('Fotografías',cause instanceof Error?cause.message:'Intenta nuevamente.');}finally{await refresh();setUploading(undefined);setProgress('');}};
  return <View style={styles.container}>
    <View style={styles.heading}><Text style={styles.title}>Secciones del evento</Text>{canEdit?<Pressable accessibilityLabel="Agregar sección" onPress={()=>edit()} style={styles.action}><Ionicons name="add-circle-outline" size={20} color={colors.primary}/><Text style={styles.actionText}>Agregar sección</Text></Pressable>:null}</View>
    {sections.map(section=>{const gallery=photos.filter(photo=>photo.newsSectionId===section.id);return <View key={section.id} style={styles.card}>
      <View style={styles.heading}><Text style={styles.sectionTitle}>{section.title}</Text>{canEdit?<View style={styles.actions}><Pressable accessibilityLabel={`Editar sección ${section.title}`} disabled={busy} onPress={()=>edit(section)}><Ionicons name="pencil" size={21} color={colors.primary}/></Pressable><Pressable accessibilityLabel={`Eliminar sección ${section.title}`} disabled={busy} onPress={()=>remove(section)}><Ionicons name="trash-outline" size={21} color={colors.danger}/></Pressable></View>:null}</View>
      <Text style={styles.description}>{section.description}</Text>
      <View style={styles.grid}>{gallery.map((photo,index)=><View key={photo.id} style={styles.tile}><Pressable accessibilityLabel={`Ver ${section.title}, foto ${index+1}`} onPress={()=>setViewer({photos:gallery,index})}><NewsPhoto style={styles.photo} resizeMode="contain" fallback={newsImages.park} url={photo.imageUrl}/></Pressable>{canEdit?<Pressable accessibilityLabel={`Eliminar foto ${index+1} de ${section.title}`} disabled={busy} onPress={()=>removePhoto(photo)} style={styles.trash}><Ionicons name="trash-outline" size={18} color={colors.surface}/></Pressable>:null}</View>)}</View>
      {canEdit?<Pressable disabled={Boolean(uploading)} onPress={()=>{void upload(section);}} style={styles.action}>{uploading===section.id?<ActivityIndicator color={colors.primary}/>:<Ionicons name="images-outline" color={colors.primary} size={19}/>}<Text style={styles.actionText}>{uploading===section.id?progress||'Seleccionando fotos…':'Subir fotos'}</Text></Pressable>:!gallery.length?<Text style={styles.description}>Aún no hay fotografías.</Text>:null}
    </View>;})}
    <NewsEditorModal visible={Boolean(editor)} onClose={()=>{if(!busy)setEditor(null);}}>
      <Text style={styles.title}>{editor?.id?'Editar sección':'Nueva sección'}</Text>
      <NewsEditorInput accessibilityLabel="Título de la sección" maxLength={180} placeholder="Título" value={title} onChangeText={setTitle} style={styles.input}/>
      <NewsEditorInput accessibilityLabel="Descripción de la sección" maxLength={10000} placeholder="Descripción" value={description} onChangeText={setDescription} multiline style={styles.input}/>
      <Pressable disabled={busy} onPress={()=>{void run(async()=>{await newsService.saveSection(articleId,title,description,editor?.id);setEditor(null);});}} style={styles.save}>{busy?<ActivityIndicator color={colors.surface}/>:<Text style={styles.saveText}>Guardar para todos</Text>}</Pressable>
      <Pressable disabled={busy} onPress={()=>setEditor(null)} style={styles.action}><Text style={styles.actionText}>Cancelar</Text></Pressable>
    </NewsEditorModal>
    {viewer?<NewsPhotoViewer initialIndex={viewer.index} photos={viewer.photos} onClose={()=>setViewer(null)}/>:null}
  </View>;
}
const styles=StyleSheet.create({container:{gap:spacing.lg},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:spacing.sm,flexWrap:'wrap'},title:{fontFamily:typography.serif,fontSize:23,color:colors.primary},sectionTitle:{fontFamily:typography.serif,fontSize:21,color:colors.primary,flex:1},card:{backgroundColor:colors.surface,borderRadius:radii.lg,padding:spacing.lg,gap:spacing.md,borderWidth:1,borderColor:colors.border},actions:{flexDirection:'row',gap:spacing.lg},action:{flexDirection:'row',alignItems:'center',gap:7,padding:10,backgroundColor:colors.softGreen,borderRadius:radii.pill,alignSelf:'flex-start'},actionText:{fontFamily:typography.sans,fontSize:11,fontWeight:'800',color:colors.primary},description:{fontFamily:typography.sans,fontSize:13,lineHeight:21,color:colors.textMuted},grid:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},tile:{width:'47%',position:'relative',borderRadius:radii.md,overflow:'hidden',backgroundColor:colors.paleGreen},photo:{width:'100%',aspectRatio:1.15},trash:{position:'absolute',right:5,top:5,padding:9,borderRadius:radii.pill,backgroundColor:colors.danger},backdrop:{flex:1,backgroundColor:'rgba(7,30,21,0.6)',justifyContent:'flex-end'},form:{backgroundColor:colors.surface,padding:spacing.xl,gap:spacing.md,borderTopLeftRadius:24,borderTopRightRadius:24},input:{backgroundColor:colors.paleGreen,borderColor:colors.border,borderWidth:1,borderRadius:radii.md,padding:14,color:colors.text},save:{backgroundColor:colors.primary,padding:15,borderRadius:radii.md,alignItems:'center'},saveText:{color:colors.surface,fontWeight:'800',fontFamily:typography.sans}});
