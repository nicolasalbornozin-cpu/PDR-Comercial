import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme';

export function NewsDeleteButton({ label, onDelete, onDeleted }: { label: string; onDelete: () => Promise<void>; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remove = async () => {
    setBusy(true);
    try { await onDelete(); setOpen(false); onDeleted?.(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible eliminar.'); }
    finally { setBusy(false); }
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar ${label}`} onPress={event => { event.stopPropagation(); setError(''); setOpen(true); }} style={styles.trash}><Ionicons name="trash-outline" color={colors.surface} size={18}/></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={styles.backdrop}><View style={styles.dialog}>
        <Text style={styles.title}>Eliminar {label}</Text>
        <Text style={styles.copy}>Dejará de aparecer para todos.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable disabled={busy} onPress={() => setOpen(false)} style={styles.cancel}><Text style={styles.copy}>Cancelar</Text></Pressable>
          <Pressable disabled={busy} onPress={() => { void remove(); }} style={styles.remove}>{busy ? <ActivityIndicator color={colors.surface}/> : <Text style={styles.white}>Eliminar</Text>}</Pressable>
        </View>
      </View></View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  trash: { backgroundColor: colors.danger, padding: 10, borderRadius: radii.pill, alignSelf: 'flex-start' },
  backdrop: { flex: 1, backgroundColor: 'rgba(7,30,21,0.65)', justifyContent: 'center', padding: spacing.xl },
  dialog: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl, gap: spacing.md, alignSelf: 'center', width: '100%', maxWidth: 440 },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 23 },
  copy: { color: colors.text, fontFamily: typography.sans, fontSize: 14 },
  actions: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
  cancel: { padding: 12 }, remove: { backgroundColor: colors.danger, padding: 12, borderRadius: radii.md },
  white: { color: colors.surface, fontFamily: typography.sans, fontWeight: '700' }, error: { color: colors.danger },
});
