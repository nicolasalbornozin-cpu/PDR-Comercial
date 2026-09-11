import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { galleryImages, newsArticles } from '@/data/mockData';
import { GalleryPhoto, NewsArticle } from '@/types';

import { supabase } from './supabase';

interface NewsRow {
  id: number;
  title: string;
  summary: string;
  body: string;
  image_url: string | null;
  published_at: string;
  featured: boolean;
  category: string;
  event_month: string | null;
  sort_order: number;
}

interface GalleryRow {
  id: number;
  news_article_id: number | null;
  title: string;
  image_url: string;
  sort_order: number;
}

export interface NewsContent {
  articles: NewsArticle[];
  gallery: GalleryPhoto[];
}

export interface NewsArticleChanges {
  title?: string;
  summary?: string;
  body?: string;
  imageUrl?: string;
}

function fallbackContent(): NewsContent {
  return {
    articles: newsArticles,
    gallery: galleryImages.map((image, index) => ({ id: `local-${index}`, title: `Paseo Senior ${index + 1}`, image, sortOrder: index })),
  };
}

function rowToArticle(row: NewsRow): NewsArticle {
  return {
    id: String(row.id),
    title: row.title,
    summary: row.summary,
    body: row.body,
    image: row.category === 'Eventos' ? 'seniorEvent' : row.category === 'Reconocimientos' ? 'gardenTable' : 'park',
    imageUrl: row.image_url ?? undefined,
    date: row.published_at.slice(0, 10),
    featured: row.featured,
    category: row.category,
    eventMonth: row.event_month ?? undefined,
    sortOrder: row.sort_order,
  };
}

function currentMonthStart(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}-01`;
}

async function uploadImage(folder: 'articles' | 'gallery'): Promise<string | null> {
  if (!supabase) throw Error('Supabase no está configurado.');
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (asset.size && asset.size > 10 * 1024 * 1024) throw Error('La foto supera el máximo de 10 MB.');
  const webFile = asset.file;
  const bytes = webFile ? new Uint8Array(await webFile.arrayBuffer()) : await new File(asset.uri).bytes();
  const extension = asset.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const safeName = asset.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'foto';
  const path = `${folder}/${Date.now()}-${safeName}.${extension}`;
  const uploaded = await supabase.storage.from('news-media').upload(path, bytes, {
    contentType: asset.mimeType ?? 'image/jpeg',
    upsert: false,
  });
  if (uploaded.error) throw Error(uploaded.error.message);
  return supabase.storage.from('news-media').getPublicUrl(uploaded.data.path).data.publicUrl;
}

export const newsService = {
  currentMonthStart,

  async getContent(): Promise<NewsContent> {
    if (!supabase) return fallbackContent();
    const [articlesResult, galleryResult] = await Promise.all([
      supabase.from('news_articles').select('id,title,summary,body,image_url,published_at,featured,category,event_month,sort_order').eq('active', true).order('sort_order').order('published_at', { ascending: false }),
      supabase.from('gallery_images').select('id,news_article_id,title,image_url,sort_order').eq('active', true).order('sort_order').order('created_at', { ascending: false }),
    ]);
    let articleRows: NewsRow[];
    // Keep the public feed visible while the news migration is rolling out.
    if (articlesResult.error) {
      const legacy = await supabase.from('news_articles').select('id,title,summary,body,image_url,published_at,featured,category').eq('active', true).order('published_at', { ascending: false });
      if (legacy.error) throw Error(legacy.error.message);
      articleRows = legacy.data.map((row) => ({ ...row, event_month: null, sort_order: 0 })) as NewsRow[];
    } else articleRows = articlesResult.data as NewsRow[];
    if (galleryResult.error) throw Error(galleryResult.error.message);
    const fallback = fallbackContent();
    return {
      articles: articleRows.length ? articleRows.map(rowToArticle) : fallback.articles,
      gallery: galleryResult.data.length
        ? (galleryResult.data as GalleryRow[]).map((row) => ({ id: String(row.id), title: row.title, imageUrl: row.image_url, newsArticleId: row.news_article_id ? String(row.news_article_id) : undefined, sortOrder: row.sort_order }))
        : fallback.gallery,
    };
  },

  async updateArticle(id: string, changes: NewsArticleChanges): Promise<void> {
    if (!supabase || !/^\d+$/.test(id)) throw Error('Esta noticia aún no está habilitada para edición.');
    const payload: Record<string, string> = {};
    if (changes.title !== undefined) payload.title = changes.title.trim();
    if (changes.summary !== undefined) payload.summary = changes.summary.trim();
    if (changes.body !== undefined) payload.body = changes.body.trim();
    if (changes.imageUrl !== undefined) payload.image_url = changes.imageUrl;
    const result = await supabase.from('news_articles').update(payload).eq('id', Number(id));
    if (result.error) throw Error(result.error.message);
  },

  async pickArticleImage(): Promise<string | null> {
    return uploadImage('articles');
  },

  async createCareer(input: { title: string; summary: string; body: string; imageUrl?: string }): Promise<void> {
    if (!supabase) throw Error('Supabase no está configurado.');
    if (!input.title.trim() || !input.summary.trim() || !input.body.trim()) throw Error('Completa el título, resumen y texto de la carrera.');
    const result = await supabase.from('news_articles').insert({
      title: input.title.trim(),
      summary: input.summary.trim(),
      body: input.body.trim(),
      image_url: input.imageUrl ?? null,
      category: 'Carreras',
      event_month: currentMonthStart(),
      featured: false,
      active: true,
      sort_order: 20,
    });
    if (result.error) throw Error(result.error.message);
  },

  async addGalleryPhoto(title: string, newsArticleId?: string): Promise<boolean> {
    if (!supabase) throw Error('Supabase no está configurado.');
    const imageUrl = await uploadImage('gallery');
    if (!imageUrl) return false;
    const result = await supabase.from('gallery_images').insert({
      title: title.trim() || 'Paseo Senior',
      image_url: imageUrl,
      news_article_id: newsArticleId && /^\d+$/.test(newsArticleId) ? Number(newsArticleId) : null,
      sort_order: Date.now(),
      active: true,
    });
    if (result.error) throw Error(result.error.message);
    return true;
  },
};
