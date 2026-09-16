import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { Image, ImageBackground, ImageResizeMode, ImageSourcePropType, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, typography } from '@/theme';

interface PhotoProps {
  url?: string;
  fallback: ImageSourcePropType;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
}

export function NewsPhoto({ url, fallback, style, resizeMode = 'cover' }: PhotoProps) {
  const [failedUrl, setFailedUrl] = useState<string>();

  if (url && failedUrl === url) {
    return (
      <View style={[style as StyleProp<ViewStyle>, styles.unavailable]}>
        <Ionicons color={colors.primary} name="image-outline" size={26} />
        <Text style={styles.unavailableText}>Foto no disponible</Text>
      </View>
    );
  }
  return <Image onError={() => setFailedUrl(url)} resizeMode={resizeMode} source={url ? { uri: url } : fallback} style={style} />;
}

interface BackgroundProps {
  url?: string;
  fallback: ImageSourcePropType;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function NewsPhotoBackground({ url, fallback, style, children }: BackgroundProps) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return (
    <ImageBackground onError={() => setFailedUrl(url)} resizeMode="cover" source={url && failedUrl !== url ? { uri: url } : fallback} style={style}>
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  unavailable: { alignItems: 'center', backgroundColor: colors.softGreen, justifyContent: 'center', overflow: 'hidden' },
  unavailableText: { color: colors.primary, fontFamily: typography.sans, fontSize: 10, fontWeight: '700', marginTop: 5, textAlign: 'center' },
});
