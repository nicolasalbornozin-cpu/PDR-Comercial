const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), vm = require('node:vm');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, f);
const { displayPersonName } = require('../src/utils/personName.ts');
const { seniorTrips, tripPhotos } = require('../src/utils/newsTrips.ts');
assert.equal(displayPersonName('CAVIERES   PONCE MAURICIO LEONARDO', 'seller'), 'Mauricio Cavieres');
assert.equal(displayPersonName('FONTALVO FAIRUZ MARINA', 'coordinator'), 'Fairuz Fontalvo');
assert.equal(displayPersonName('GABRIEL DE LUCA', 'sales_director'), 'Gabriel De Luca');
assert.equal(displayPersonName('TOMAS ESPINOZA', 'audiovisual'), 'Tomas Espinoza');
assert.equal(displayPersonName(''), '');
const old = { id: '1', title: 'Paseo Senior 2026', category: 'Eventos', date: '2026-09-01' };
const recent = { id: '9', title: 'Paseo de octubre', category: 'Paseos', date: '2026-10-05' };
const event = { id: '5', title: 'Últimos eventos', category: 'Eventos recientes', date: '2026-10-05' };
const articles = [old, recent, event];
const photos = [{ id: 'a' }, { id: 'b', newsArticleId: '1' }, { id: 'c', newsArticleId: '9' }, { id: 'd', newsArticleId: '5' }];
assert.deepEqual(seniorTrips(articles).map(x => x.id), ['9', '1']);
assert.deepEqual(tripPhotos(articles, photos, recent).map(x => x.id), ['c']);
assert.deepEqual(tripPhotos(articles, photos, old).map(x => x.id), ['a', 'b']);
assert.deepEqual(tripPhotos([recent, event], photos, recent).map(x => x.id), ['c']);

// Removing the last publication must not restore seed content, nor leave the
// photographs of archived articles/sections in the public feed.
let rows = { news_articles: [], gallery_images: [], news_sections: [] };
const db = { from(table) {
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, then(resolve) { return Promise.resolve({ data: rows[table], error: null }).then(resolve); } };
  return query;
} };
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/newsService.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports: exportsObject, Date, Intl, Map, Set, Error,
  require(name) {
    if (name === './supabase') return { supabase: db };
    if (name === '../utils/newsMedia') return {};
    if (name === '@/data/mockData') return { newsArticles: [{ id: 'seed' }], galleryImages: [] };
    if (name.startsWith('expo-')) return {};
    throw Error(name);
  },
});
(async () => {
  const empty = await exportsObject.newsService.getContent();
  assert.equal(empty.articles.length, 0);
  rows = {
    news_articles: [{ id: 9, title: 'Paseo', summary: 'Resumen', body: 'Texto', category: 'Paseos', published_at: '2026-10-05T12:00:00Z' }],
    news_sections: [],
    gallery_images: [{ id: 1, news_article_id: 1 }, { id: 2, news_article_id: 9 }, { id: 3, news_article_id: 9, news_section_id: 7 }],
  };
  const feed = await exportsObject.newsService.getContent();
  assert.deepEqual(Array.from(feed.gallery, photo => photo.id), ['2']);
  console.log('PASS: roster greetings, latest trip selection, independent galleries, deleted trips, no resurrected seeds, hidden archived descendants.');
})().catch(error => { console.error(error); process.exitCode = 1; });
