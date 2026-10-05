import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageResizeMode, ImageSourcePropType, ImageStyle, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, typography } from '@/theme';
import { resolveNewsImageUrl } from '@/services/newsService';

interface PhotoProps {
  url?: string;
  fallback: ImageSourcePropType;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
}

export function NewsPhoto(props: PhotoProps) {
  return <PhotoContent key={props.url || 'local'} {...props} />;
}

function PhotoContent({ url, fallback, style, resizeMode = 'cover' }: PhotoProps) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryKey, setRetryKey] = useState('');
  const [authorizedUrl, setAuthorizedUrl] = useState<string>();
  useEffect(() => {
    if (!url) return;
    let active = true;
    setAuthorizedUrl(undefined);
    resolveNewsImageUrl(url).then(next => { if (active) setAuthorizedUrl(next); }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [url, retryKey]);

  useEffect(() => {
    if (status !== 'error' || !url || attempt >= 2) return;
    const timer = setTimeout(() => {
      setRetryKey(String(Date.now()));
      setAttempt((previous) => previous + 1);
      setStatus('loading');
    }, 800 * (attempt + 1));
    return () => clearTimeout(timer);
  }, [attempt, status, url]);

  const uri = authorizedUrl && retryKey ? `${authorizedUrl}${authorizedUrl.includes('?') ? '&' : '?'}pdr_retry=${retryKey}` : authorizedUrl;
  const exhausted = status === 'error' && (!url || attempt >= 2);
  return (
    <View style={[style as StyleProp<ViewStyle>, styles.frame]}>
      {!exhausted && (!url || authorizedUrl) ? (
        <Image
          key={uri || 'local'}
          onError={() => setStatus('error')}
          onLoad={() => setStatus('ready')}
          resizeMethod="resize"
          resizeMode={resizeMode}
          source={uri ? { uri } : fallback}
          style={styles.image}
        />
      ) : null}
      {status !== 'ready' ? (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          {exhausted ? (
            <Pressable
              accessibilityLabel="Reintentar cargar fotografía"
              accessibilityRole="button"
              onPress={(event) => {
                event.stopPropagation();
                setAttempt(0);
                setRetryKey(String(Date.now()));
                setStatus('loading');
              }}
              style={styles.retry}
            >
              <Ionicons color={colors.primary} name="reload-outline" size={24} />
              <Text style={styles.unavailableText}>Toca para cargar la foto</Text>
            </Pressable>
          ) : <ActivityIndicator color={colors.gold} size="small" />}
        </View>
      ) : null}
    </View>
  );
}

interface BackgroundProps {
  url?: string;
  fallback: ImageSourcePropType;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function NewsPhotoBackground({ url, fallback, style, children }: BackgroundProps) {
  return (
    <View style={style}>
      <NewsPhoto fallback={fallback} style={StyleSheet.absoluteFill} url={url} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.softGreen, overflow: 'hidden' },
  image: { position: 'absolute', top: 0, left: 0, height: '100%', width: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  retry: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  unavailableText: { color: colors.primary, fontFamily: typography.sans, fontSize: 10, fontWeight: '700', marginTop: 5, textAlign: 'center' },
});
