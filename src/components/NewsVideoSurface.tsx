import { createElement } from 'react';

export interface NewsVideoSurfaceProps {
  source: string;
  preview?: boolean;
  onReady?: () => void;
  onError: () => void;
}

export function NewsVideoSurface({ source, preview = false, onReady, onError }: NewsVideoSurfaceProps) {
  return createElement('video', {
    src: source,
    autoPlay: true,
    controls: !preview,
    loop: preview,
    muted: preview,
    playsInline: true,
    'aria-hidden': preview || undefined,
    'aria-label': preview ? undefined : 'Video de la actividad',
    onLoadedData: onReady,
    onError,
    style: { display: 'block', width: '100%', height: '100%', objectFit: preview ? 'cover' : 'contain' },
  });
}
