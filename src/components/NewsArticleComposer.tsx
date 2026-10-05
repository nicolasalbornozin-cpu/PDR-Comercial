import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NewsEditorInput, NewsEditorModal } from './NewsEditorModal';
import { NewsPhoto } from './NewsPhoto';
import { newsImages } from '@/data/assets';
import { newsService } from '@/services/newsService';
import { colors, radii, typography } from '@/theme';

const categories = ['Novedades', 'Carreras', 'Eventos recientes', 'Reconocimientos', 'Información comercial'];
export function NewsArticleComposer({ category, onClose, onPublished }: { category?: string; onClose: () => void; onPublished: (id: string) => Promise<void> }) {
  const [kind, setKind] = useState(category ?? 'Novedades');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    setBusy(true);
    try { const url = await newsService.pickArticleImage(); if (url) setImageUrl(url); }
    catch (cause) { Alert.alert('No se pudo subir', cause instanceof Error ? cause.message : 'Intenta nuevamente.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try {
      const id = await newsService.createArticle({ title, summary, body, imageUrl, category: kind });
      await onPublished(id);
      onClose();
    } catch (cause) { Alert.alert('No se pudo publicar', cause instanceof Error ? cause.message : 'Intenta nuevamente.'); }
    finally { setBusy(false); }
  };
  return <NewsEditorModal visible onClose={() => { if (!busy) onClose(); }}>
    <View style={styles.heading}><Text style={styles.title}>{category === 'Paseos' ? 'Crear paseo' : 'Crear publicación'}</Text><Pressable accessibilityLabel="Cerrar" disabled={busy} onPress={onClose}><Ionicons name="close" size={24} color={colors.primary}/></Pressable></View>
    {!category ? <View style={styles.categories}>{categories.map(value => <Pressable key={value} onPress={() => setKind(value)} style={[styles.chip, kind === value && styles.selected]}><Text style={[styles.chipText, kind === value && styles.white]}>{value}</Text></Pressable>)}</View> : null}
    <NewsEditorInput accessibilityLabel="Título de la publicación" placeholder="Título" value={title} onChangeText={setTitle} maxLength={180} style={styles.input}/>
    <NewsEditorInput accessibilityLabel="Resumen" placeholder="Resumen breve" value={summary} onChangeText={setSummary} multiline maxLength={2000} style={styles.input}/>
    <NewsEditorInput accessibilityLabel="Descripción" placeholder="Descripción, fechas y detalles" value={body} onChangeText={setBody} multiline maxLength={10000} style={styles.input}/>
    {imageUrl ? <NewsPhoto url={imageUrl} fallback={newsImages.park} resizeMode="contain" style={styles.image}/> : null}
    <Pressable disabled={busy} onPress={() => { void pick(); }} style={styles.secondary}><Ionicons name="image-outline" size={20} color={colors.primary}/><Text style={styles.chipText}>{imageUrl ? 'Cambiar fotografía' : 'Subir fotografía'}</Text></Pressable>
    {imageUrl ? <Pressable disabled={busy} onPress={() => setImageUrl(undefined)} style={styles.secondary}><Ionicons name="trash-outline" size={18} color={colors.danger}/><Text style={styles.chipText}>Quitar fotografía</Text></Pressable> : null}
    <Pressable disabled={busy || !title.trim() || !summary.trim() || !body.trim()} onPress={() => { void save(); }} style={[styles.save, (busy || !title.trim() || !summary.trim() || !body.trim()) && styles.disabled]}>{busy ? <ActivityIndicator color={colors.surface}/> : <Text style={styles.white}>Publicar para todos</Text>}</Pressable>
  </NewsEditorModal>;
}
const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: typography.serif, fontSize: 25, color: colors.primary }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { backgroundColor: colors.softGreen, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.pill }, selected: { backgroundColor: colors.primary },
  chipText: { color: colors.primary, fontFamily: typography.sans, fontSize: 12, fontWeight: '700' }, white: { color: colors.surface, fontFamily: typography.sans, fontWeight: '700' },
  input: { backgroundColor: colors.paleGreen, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: 14, color: colors.text },
  image: { width: '100%', height: 140, borderRadius: radii.md }, secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: radii.md, backgroundColor: colors.softGreen },
  save: { backgroundColor: colors.primary, borderRadius: radii.md, padding: 16, alignItems: 'center' }, disabled: { opacity: 0.5 },
});
