import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/theme';
import { getInitials } from '@/utils/format';

interface UserAvatarProps {
  name: string;
  size?: number;
  highlighted?: boolean;
}

export function UserAvatar({ name, size = 44, highlighted = false }: UserAvatarProps) {
  return (
    <View
      accessibilityLabel={`Avatar de ${name}`}
      style={[
        styles.avatar,
        { borderRadius: size / 2, height: size, width: size },
        highlighted && styles.highlighted,
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.31 }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', backgroundColor: colors.softGreen, borderColor: colors.surface, borderWidth: 2, justifyContent: 'center' },
  highlighted: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  initials: { color: colors.primary, fontFamily: typography.sans, fontWeight: '800' },
});
