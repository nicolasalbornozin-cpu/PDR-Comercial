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
      <Ionicons color={color} name="leaf-outline" size={compact ? 21 : 27} />
      <View style={styles.goldLine} />
      <View>
        <Text style={[styles.parque, compact && styles.parqueCompact, { color }]}>PARQUE DEL</Text>
        <Text style={[styles.recuerdo, compact && styles.recuerdoCompact, { color }]}>RECUERDO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  goldLine: { backgroundColor: colors.gold, height: 33, width: 2 },
  parque: { fontFamily: typography.sans, fontSize: 9, fontWeight: '600', letterSpacing: 2.4 },
  parqueCompact: { fontSize: 7, letterSpacing: 1.8 },
  recuerdo: { fontFamily: typography.serif, fontSize: 17, fontWeight: '600', letterSpacing: 0.5, marginTop: -1 },
  recuerdoCompact: { fontSize: 13 },
});
