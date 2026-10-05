import { GalleryPhoto, NewsArticle } from '@/types';

export function seniorTrips(articles: NewsArticle[]): NewsArticle[] {
  return articles.filter(article => ['Paseos', 'Eventos'].includes(article.category))
    .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));
}

export function tripPhotos(articles: NewsArticle[], gallery: GalleryPhoto[], trip?: NewsArticle): GalleryPhoto[] {
  if (!trip) return [];
  const legacy = seniorTrips(articles).find(article => article.category === 'Eventos');
  return gallery.filter(photo => photo.newsArticleId === trip.id || (!photo.newsArticleId && trip.id === legacy?.id));
}
