import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { colors, radii } from '@/theme';

interface ProgressBarProps {
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
}

export function ProgressBar({ progress, color = colors.gold, trackColor = colors.border, height = 8 }: ProgressBarProps) {
  const [animated] = useState(() => new Animated.Value(0));
  const safeProgress = Math.min(Math.max(progress, 0), 1);

  useEffect(() => {
    Animated.timing(animated, { duration: 650, toValue: safeProgress, useNativeDriver: false }).start();
  }, [animated, safeProgress]);

  return (
    <View accessibilityLabel={`${Math.round(safeProgress * 100)}% completado`} style={[styles.track, { backgroundColor: trackColor, height }]}>
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: animated.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radii.pill, overflow: 'hidden', width: '100%' },
  fill: { borderRadius: radii.pill, height: '100%' },
});
