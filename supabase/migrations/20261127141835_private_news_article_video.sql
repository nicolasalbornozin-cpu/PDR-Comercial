alter table public.news_articles
  add column video_path text
  check (video_path ~ '^articles/[a-z0-9][a-z0-9-]{0,119}\.mp4$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news-videos', 'news-videos', false, 41943040, array['video/mp4']);

create policy news_article_video_staff_read on storage.objects for select to authenticated
  using (
    bucket_id = 'news-videos'
    and (select private.can_read_news())
    and exists (
      select 1 from public.news_articles article
      where article.active and article.video_path = storage.objects.name
    )
  );
