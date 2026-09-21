import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { NewsContent, newsService } from '@/services/newsService';
import { supabase } from '@/services/supabase';

const emptyContent: NewsContent = { articles: [], gallery: [] };
let sharedContent = emptyContent;
let requestVersion = 0;
const listeners = new Set<(content: NewsContent) => void>();

export function useNewsContent() {
  const [content, setContent] = useState<NewsContent>(sharedContent);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const version = ++requestVersion;
    try {
      const next = await newsService.getContent();
      if (version !== requestVersion) return;
      sharedContent = next;
      listeners.forEach((listener) => listener(next));
      setError('');
    } catch {
      setError('No fue posible cargar las noticias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    listeners.add(setContent);
    return () => { listeners.delete(setContent); };
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  useEffect(() => {
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    const client = supabase;
    if (!client) return () => appState.remove();
    const channel = client
      .channel(`news-content-live-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_articles' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_images' }, () => { void refresh(); })
      .subscribe();
    return () => { appState.remove(); void client.removeChannel(channel); };
  }, [refresh]);

  return { content, loading, error, refresh };
}
