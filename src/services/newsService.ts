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

function imageFormat(data: ArrayBuffer): { mime: string; extension: string } | null {
  const bytes = new Uint8Array(data);
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', extension: 'jpg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: 'image/png', extension: 'png' };
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  return null;
}

async function pickImages(multiple: boolean): Promise<DocumentPicker.DocumentPickerAsset[]> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    copyToCacheDirectory: true,
    multiple,
  });
  return picked.canceled ? [] : picked.assets;
}

async function uploadImage(asset: DocumentPicker.DocumentPickerAsset, folder: 'articles' | 'gallery'): Promise<{ url: string; path: string }> {
  if (!supabase) throw Error('Supabase no está configurado.');
  if (asset.size && asset.size > 10 * 1024 * 1024) throw Error('La foto supera el máximo de 10 MB.');
  // Supabase Storage requires an ArrayBuffer on React Native. A typed array
  // can be serialized differently on Android and produce an unreadable image.
  const data = asset.file ? await asset.file.arrayBuffer() : await new File(asset.uri).arrayBuffer();
  const format = imageFormat(data);
  if (!format) throw Error('El archivo no es una imagen JPEG, PNG o WebP válida.');
  if (data.byteLength > 10 * 1024 * 1024) throw Error('La foto supera el máximo de 10 MB.');
  const safeName = asset.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'foto';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeName}.${format.extension}`;
  const uploaded = await supabase.storage.from('news-media').upload(path, data, {
    contentType: format.mime,
    upsert: false,
  });
  if (uploaded.error) throw Error(uploaded.error.message);
  const url = supabase.storage.from('news-media').getPublicUrl(uploaded.data.path).data.publicUrl;
  try {
    const response = await fetch(url);
    if (!response.ok || !imageFormat(await response.arrayBuffer())) throw Error('La imagen no se puede leer después de subirla.');
  } catch (cause) {
    await supabase.storage.from('news-media').remove([uploaded.data.path]);
    throw cause;
  }
  return { url, path: uploaded.data.path };
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
    return {
      articles: articleRows.length ? articleRows.map(rowToArticle) : fallbackContent().articles,
      gallery: (galleryResult.data as GalleryRow[]).map((row) => ({ id: String(row.id), title: row.title, imageUrl: row.image_url, newsArticleId: row.news_article_id ? String(row.news_article_id) : undefined, sortOrder: row.sort_order })),
    };
  },

  async updateArticle(id: string, changes: NewsArticleChanges): Promise<void> {
    if (!supabase || !/^\d+$/.test(id)) throw Error('Esta noticia aún no está habilitada para edición.');
    const payload: Record<string, string> = {};
    if (changes.title !== undefined) payload.title = changes.title.trim();
    if (changes.summary !== undefined) payload.summary = changes.summary.trim();
    if (changes.body !== undefined) payload.body = changes.body.trim();
    if (changes.imageUrl !== undefined) payload.image_url = changes.imageUrl;
    const result = await supabase.from('news_articles').update(payload).eq('id', Number(id)).select('id').single();
    if (result.error) throw Error(result.error.message);
    if (!result.data) throw Error('No se pudo guardar la noticia. Revisa tu sesión de administrador.');
  },

  async pickArticleImage(): Promise<string | null> {
    const assets = await pickImages(false);
    return assets.length ? (await uploadImage(assets[0], 'articles')).url : null;
  },

  async replaceArticleImage(id: string): Promise<string | null> {
    const assets = await pickImages(false);
    if (!assets.length) return null;
    const image = await uploadImage(assets[0], 'articles');
    try {
      await newsService.updateArticle(id, { imageUrl: image.url });
    } catch (cause) {
      await supabase?.storage.from('news-media').remove([image.path]);
      throw cause;
    }
    return image.url;
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

  async addGalleryPhotos(title: string, newsArticleId?: string, onProgress?: (completed: number, total: number) => void): Promise<number> {
    if (!supabase) throw Error('Supabase no está configurado.');
    const assets = await pickImages(true);
    let added = 0;
    const failures: string[] = [];
    onProgress?.(0, assets.length);
    for (const asset of assets) {
      try {
        const image = await uploadImage(asset, 'gallery');
        const result = await supabase.from('gallery_images').insert({
          title: title.trim() || 'Paseo Senior',
          image_url: image.url,
          news_article_id: newsArticleId && /^\d+$/.test(newsArticleId) ? Number(newsArticleId) : null,
          sort_order: Date.now() + added,
          active: true,
        });
        if (result.error) {
          await supabase.storage.from('news-media').remove([image.path]);
          throw Error(result.error.message);
        }
        added += 1;
      } catch (cause) {
        failures.push(`${asset.name}: ${cause instanceof Error ? cause.message : 'No se pudo subir.'}`);
      }
      onProgress?.(added + failures.length, assets.length);
    }
    if (failures.length) throw Error(`Se publicaron ${added} de ${assets.length} fotos. Puedes volver a seleccionar las que fallaron:\n${failures.join('\n')}`);
    return added;
  },

  async deleteGalleryPhoto(photo: GalleryPhoto): Promise<void> {
    if (!supabase || !/^\d+$/.test(photo.id)) throw Error('Esta fotografía no está publicada en Supabase.');
    const result = await supabase.from('gallery_images').delete().eq('id', Number(photo.id));
    if (result.error) throw Error(result.error.message);
    const marker = '/storage/v1/object/public/news-media/';
    const markerIndex = photo.imageUrl?.indexOf(marker) ?? -1;
    if (markerIndex >= 0 && photo.imageUrl) {
      const path = decodeURIComponent(photo.imageUrl.slice(markerIndex + marker.length).split('?')[0]);
      const removed = await supabase.storage.from('news-media').remove([path]);
      if (removed.error) throw Error(`Se quitó la foto de la galería, pero no el archivo: ${removed.error.message}`);
    }
  },
};
