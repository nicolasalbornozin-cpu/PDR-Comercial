begin;

alter table public.news_articles
  add column if not exists event_month date,
  add column if not exists sort_order integer not null default 0;

grant insert, update, delete on table public.news_articles to authenticated;
grant insert, update, delete on table public.gallery_images to authenticated;
grant usage, select on sequence public.news_articles_id_seq to authenticated;
grant usage, select on sequence public.gallery_images_id_seq to authenticated;

drop policy if exists news_articles_admin_insert on public.news_articles;
drop policy if exists news_articles_admin_update on public.news_articles;
drop policy if exists news_articles_admin_delete on public.news_articles;
drop policy if exists gallery_images_admin_insert on public.gallery_images;
drop policy if exists gallery_images_admin_update on public.gallery_images;
drop policy if exists gallery_images_admin_delete on public.gallery_images;

create policy news_articles_admin_insert
on public.news_articles for insert to authenticated
with check ((select private.is_admin()));

create policy news_articles_admin_update
on public.news_articles for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy news_articles_admin_delete
on public.news_articles for delete to authenticated
using ((select private.is_admin()));

create policy gallery_images_admin_insert
on public.gallery_images for insert to authenticated
with check ((select private.is_admin()));

create policy gallery_images_admin_update
on public.gallery_images for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy gallery_images_admin_delete
on public.gallery_images for delete to authenticated
using ((select private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'news-media',
  'news-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists news_media_admin_insert on storage.objects;
drop policy if exists news_media_admin_update on storage.objects;
drop policy if exists news_media_admin_delete on storage.objects;

create policy news_media_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'news-media' and (select private.is_admin()));

create policy news_media_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'news-media' and (select private.is_admin()))
with check (bucket_id = 'news-media' and (select private.is_admin()));

create policy news_media_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'news-media' and (select private.is_admin()));

do $$
begin
  alter publication supabase_realtime add table public.news_articles;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.gallery_images;
exception when duplicate_object then
  null;
end $$;

update public.news_articles
set
  title = 'Paseo Senior 2026',
  summary = 'Revisa las fotos y novedades del evento.',
  body = 'Una jornada para celebrar el compromiso, la excelencia y los logros de nuestros equipos comerciales.',
  category = 'Eventos',
  featured = true,
  event_month = null,
  sort_order = 10
where lower(title) = lower('Bienvenidos a PDR Comercial');

insert into public.news_articles
  (title, summary, body, category, featured, active, published_at, event_month, sort_order)
select
  seed.title,
  seed.summary,
  seed.body,
  seed.category,
  seed.featured,
  true,
  seed.published_at,
  seed.event_month,
  seed.sort_order
from (
  values
    ('Paseo Senior 2026', 'Revisa las fotos y novedades del evento.', 'Una jornada para celebrar el compromiso, la excelencia y los logros de nuestros equipos comerciales.', 'Eventos', true, '2026-09-10T12:00:00-03:00'::timestamptz, null::date, 10),
    ('Nueva carrera activa', 'Revisa la nueva carrera comercial del mes.', 'La nueva carrera comercial ya está disponible. Revisa sus metas, período de evaluación y requisitos.', 'Carreras', false, '2026-09-09T12:00:00-03:00'::timestamptz, '2026-09-01'::date, 20),
    ('Ganadores del mes', 'Conoce a quienes destacaron por sus resultados.', 'Celebramos a los ejecutivos que alcanzaron resultados sobresalientes y mantuvieron una gestión comercial de calidad.', 'Reconocimientos', false, '2026-09-08T12:00:00-03:00'::timestamptz, null::date, 30),
    ('Categorización agosto', 'Fechas, requisitos y avances de la categorización.', 'Revisa el período comercial, tus requisitos y el avance necesario para alcanzar la siguiente categoría.', 'Información comercial', false, '2026-09-07T12:00:00-03:00'::timestamptz, null::date, 40)
) as seed(title, summary, body, category, featured, published_at, event_month, sort_order)
where not exists (
  select 1 from public.news_articles current_article
  where lower(current_article.title) = lower(seed.title)
);

commit;
