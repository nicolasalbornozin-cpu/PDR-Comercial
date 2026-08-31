import { Ionicons } from '@expo/vector-icons';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, typography } from '@/theme';

interface BrandLogoProps {
  compact?: boolean;
  light?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function BrandLogo({ compact = false, light = false, style }: BrandLogoProps) {
  const color = light ? colors.surface : colors.primary;
  return (
    <View accessibilityLabel="Parque del Recuerdo" style={[styles.container, style]}>
      <View>
        <Text style={[styles.wordmark, compact && styles.wordmarkCompact, { color }]}>PARQUE</Text>
        <Text style={[styles.wordmark, compact && styles.wordmarkCompact, { color }]}>DEL RECUERDO</Text>
      </View>
      <View style={[styles.goldLine, compact && styles.goldLineCompact]} />
      <Ionicons color={color} name="leaf-outline" size={compact ? 20 : 25} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  goldLine: { backgroundColor: colors.gold, height: 38, width: 1 },
  goldLineCompact: { height: 30 },
  wordmark: { fontFamily: typography.sans, fontSize: 13, fontWeight: '500', letterSpacing: -0.4, lineHeight: 13 },
  wordmarkCompact: { fontSize: 11, lineHeight: 11 },
});
