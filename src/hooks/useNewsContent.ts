import { useCallback, useEffect, useState } from 'react';

import { NewsContent, newsService } from '@/services/newsService';
import { supabase } from '@/services/supabase';

const emptyContent: NewsContent = { articles: [], gallery: [] };

export function useNewsContent() {
  const [content, setContent] = useState<NewsContent>(emptyContent);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const next = await newsService.getContent();
      setContent(next);
      setError('');
    } catch {
      setError('No fue posible cargar las noticias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => { void refresh(); }, 0);
    const client = supabase;
    if (!client) return () => clearTimeout(initialLoad);
    const channel = client
      .channel(`news-content-live-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_articles' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_images' }, () => { void refresh(); })
      .subscribe();
    return () => { clearTimeout(initialLoad); void client.removeChannel(channel); };
  }, [refresh]);

  return { content, loading, error, refresh };
}
