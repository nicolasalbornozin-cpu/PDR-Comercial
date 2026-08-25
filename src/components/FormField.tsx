import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  error?: string;
  password?: boolean;
}

export function FormField({ label, icon, error, password = false, ...inputProps }: FormFieldProps) {
  const [hidden, setHidden] = useState(password);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, error && styles.fieldError]}>
        <Ionicons color={colors.textMuted} name={icon} size={20} />
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#9AA49D"
          secureTextEntry={password && hidden}
          style={styles.input}
          {...inputProps}
        />
        {password ? (
          <Pressable accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'} hitSlop={10} onPress={() => setHidden((value) => !value)}>
            <Ionicons color={colors.textMuted} name={hidden ? 'eye-outline' : 'eye-off-outline'} size={21} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 7 },
  label: { color: colors.text, fontFamily: typography.sans, fontSize: 13, fontWeight: '700' },
  field: { alignItems: 'center', backgroundColor: colors.paleGreen, borderColor: 'transparent', borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, height: 54, paddingHorizontal: spacing.lg },
  fieldError: { borderColor: colors.danger },
  input: { color: colors.text, flex: 1, fontFamily: typography.sans, fontSize: 15, height: '100%' },
  error: { color: colors.danger, fontFamily: typography.sans, fontSize: 12 },
});
