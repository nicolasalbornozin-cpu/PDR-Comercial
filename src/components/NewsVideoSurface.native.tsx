import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import type { NewsVideoSurfaceProps } from './NewsVideoSurface';

export function NewsVideoSurface({ source, preview = false, onReady, onError }: NewsVideoSurfaceProps) {
  const player = useVideoPlayer(source, video => {
    video.muted = preview;
    video.loop = preview;
    video.play();
  });

  useEffect(() => {
    const listener = player.addListener('statusChange', event => {
      if (event.status === 'error') onError();
    });
    if (player.status === 'error') onError();
    return () => listener.remove();
  }, [onError, player]);

  return (
    <VideoView
      player={player}
      nativeControls={!preview}
      allowsVideoFrameAnalysis={false}
      contentFit={preview ? 'cover' : 'contain'}
      surfaceType={preview ? 'textureView' : 'surfaceView'}
      onFirstFrameRender={onReady}
      style={StyleSheet.absoluteFill}
    />
  );
}
