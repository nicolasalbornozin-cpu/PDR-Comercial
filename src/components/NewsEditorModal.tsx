import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

const FocusEditor = createContext<(input: TextInput | null) => void>(() => undefined);

// The entire form remains scrollable above the keyboard, including Android Modals.
export function NewsEditorModal({ visible, onClose, children }: PropsWithChildren<{ visible: boolean; onClose: () => void }>) {
  const scroll = useRef<ScrollView>(null);
  const focused = useRef<TextInput | null>(null);
  const reveal = useCallback(() => {
    if (Platform.OS !== 'web' && focused.current) scroll.current?.scrollResponderScrollNativeHandleToKeyboard(focused.current, 24, true);
  }, []);
  const focus = useCallback((input: TextInput | null) => { focused.current = input; requestAnimationFrame(reveal); }, [reveal]);
  useEffect(() => {
    if (!visible) { focused.current = null; return; }
    const listener = Keyboard.addListener('keyboardDidShow', reveal);
    return () => listener.remove();
  }, [visible, reveal]);
  return <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safe}>
        <ScrollView ref={scroll} style={styles.card} contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <FocusEditor.Provider value={focus}>{children}</FocusEditor.Provider>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}

export function NewsEditorInput({ onFocus, multiline, style, ...props }: TextInputProps) {
  const input = useRef<TextInput>(null);
  const focus = useContext(FocusEditor);
  return <TextInput {...props} ref={input} multiline={multiline} scrollEnabled={multiline}
    onFocus={event => { focus(input.current); onFocus?.(event); }}
    style={[style, multiline && styles.multiline]} />;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,30,21,0.58)' },
  safe: { flex: 1, justifyContent: 'flex-end' },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '95%', flexGrow: 0 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  // Bounded multiline fields scroll the caret internally for long descriptions.
  multiline: { height: 140, maxHeight: 140, textAlignVertical: 'top' },
});
