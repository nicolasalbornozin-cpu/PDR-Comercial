const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real upload service with Storage, picker and database boundaries
// mocked: a six-photo batch, one failed file, and an immediate cover change.
const jpeg = new Uint8Array([255, 216, 255, 224, 0, 0, 0, 0, 0, 0, 0, 0]).buffer;
let assets = [], inserted = [], removed = [], updates = [], denied = false, failName = '';
const storage = {
  upload: async (path, data) => {
    assert.ok(data instanceof ArrayBuffer);
    return path.includes(failName) && failName ? { error: { message: 'fallo simulado' } } : { data: { path } };
  },
  getPublicUrl: (path) => ({ data: { publicUrl: `https://photos.example/${path}` } }),
  remove: async (paths) => { removed.push(...paths); return {}; },
};
const supabase = {
  storage: { from: () => storage },
  from: (table) => ({
    insert: async (row) => { inserted.push({ table, ...row }); return {}; },
    update: (row) => ({ eq: (_, id) => ({ select: () => ({ single: async () => {
      if (denied) return { data: null, error: { message: 'Sin permisos' } };
      updates.push({ id, ...row }); return { data: { id } };
    } }) }) }),
  }),
};
const source = fs.readFileSync(require.resolve('../src/services/newsService.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, {
  exports: exportsObject, ArrayBuffer, Uint8Array, Date, Math, Intl, Error,
  fetch: async () => ({ ok: true, arrayBuffer: async () => jpeg }),
  require: (name) => {
    if (name === 'expo-document-picker') return { getDocumentAsync: async () => ({ canceled: !assets.length, assets }) };
    if (name === 'expo-file-system') return { File: class { async arrayBuffer() { return jpeg; } } };
    if (name === './supabase') return { supabase };
    if (name === '@/data/mockData') return { galleryImages: [], newsArticles: [] };
    throw Error(name);
  },
});
const service = exportsObject.newsService;
const makePhotos = () => Array.from({ length: 6 }, (_, i) => ({ name: `photo-${i + 1}.jpg`, uri: `file://${i}.jpg`, size: 12 }));
(async () => {
  assets = makePhotos();
  const progress = [];
  assert.equal(await service.addGalleryPhotos('Evento', '4', (done, total) => progress.push([done, total])), 6);
  assert.equal(inserted.length, 6);
  assert.ok(inserted.every((row) => row.news_article_id === 4));
  assert.equal(new Set(inserted.map((row) => row.image_url)).size, 6);
  assert.deepEqual(progress.at(-1), [6, 6]);
  inserted = []; failName = 'photo-4';
  await assert.rejects(service.addGalleryPhotos('Evento', '4'), /Se publicaron 5 de 6 fotos/);
  assert.equal(inserted.length, 5);
  assert.ok(inserted.some((row) => row.image_url.includes('photo-6')));
  failName = ''; assets = makePhotos().slice(0, 1);
  const url = await service.replaceArticleImage('4');
  assert.equal(updates.at(-1).image_url, url);
  assert.equal(updates.at(-1).id, 4);
  denied = true;
  await assert.rejects(service.replaceArticleImage('4'), /Sin permisos/);
  assert.equal(removed.length, 1);
  assets = [];
  assert.equal(await service.replaceArticleImage('4'), null);
  assert.equal(await service.addGalleryPhotos('Evento'), 0);
  console.log('PASS: 6 photos, progress, failed fourth photo does not block fifth/sixth, immediate cover persistence, denied update cleanup, cancellation.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
