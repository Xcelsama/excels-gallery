-- Excel's Gallery: story posts (up to 20 images) + optional background music
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New
-- query), after 0001 and 0002. It is safe to run more than once.
--
-- Additive only: every existing before/after post keeps working exactly as
-- it does today. Nothing is deleted, and no existing row is rewritten
-- (new columns get defaults, and one NOT NULL is relaxed, see section 1).

-- ============================================================================
-- 1. gallery_projects: post type + music settings
-- ============================================================================

alter table public.gallery_projects
  add column if not exists post_type text not null default 'before_after',
  add column if not exists audio_path text,
  add column if not exists audio_volume numeric(3,2) not null default 0.70,
  add column if not exists audio_loop boolean not null default true,
  add column if not exists audio_autoplay boolean not null default true;

comment on column public.gallery_projects.post_type is
  'before_after (original post type) or story (up to 20 images in gallery_story_images). Defaults to before_after so old rows are unchanged.';
comment on column public.gallery_projects.audio_path is
  'Path of the optional background track inside the story-audio bucket. Null means no music.';
comment on column public.gallery_projects.audio_volume is
  'Default playback volume, 0.00 to 1.00.';
comment on column public.gallery_projects.audio_loop is
  'Whether the background track repeats.';
comment on column public.gallery_projects.audio_autoplay is
  'Whether the viewer tries to start the track by itself (it begins on the visitor''s first tap if the browser blocks that).';

-- A story has no "before" photo. This only relaxes the rule (no data is
-- touched); the check right below keeps it required for before/after posts.
--
-- For story posts, the after_image_url / after_width / after_height /
-- after_blur_data_url columns hold the COVER (the story's first image). That
-- is what lets the gallery grid, the sitemap and the admin list keep working
-- without knowing anything about stories.
alter table public.gallery_projects
  alter column before_image_url drop not null;

-- Postgres has no "ADD CONSTRAINT IF NOT EXISTS", so drop-then-add, the same
-- idiom 0002 uses.
alter table public.gallery_projects
  drop constraint if exists gallery_projects_post_type_check,
  drop constraint if exists gallery_projects_before_required_check,
  drop constraint if exists gallery_projects_audio_volume_check,
  drop constraint if exists gallery_projects_audio_only_story_check;

alter table public.gallery_projects
  add constraint gallery_projects_post_type_check
    check (post_type in ('before_after', 'story')),
  add constraint gallery_projects_before_required_check
    check (post_type = 'story' or before_image_url is not null),
  add constraint gallery_projects_audio_volume_check
    check (audio_volume between 0 and 1),
  add constraint gallery_projects_audio_only_story_check
    check (audio_path is null or post_type = 'story');

-- ============================================================================
-- 2. gallery_story_images: the images of a story, in order
-- ============================================================================

create table if not exists public.gallery_story_images (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.gallery_projects(id) on delete cascade,
  sort_order   smallint not null,
  storage_path text not null,
  width        int not null,
  height       int not null,
  created_at   timestamptz not null default now(),

  -- THE 20-IMAGE LIMIT, enforced by the database itself:
  -- sort_order may only be 0..19, and (project_id, sort_order) is unique,
  -- so one story can never hold more than 20 rows, whatever the app sends.
  constraint gallery_story_images_sort_order_check
    check (sort_order between 0 and 19),
  constraint gallery_story_images_project_order_key
    unique (project_id, sort_order),

  constraint gallery_story_images_width_check
    check (width between 1 and 20000),
  constraint gallery_story_images_height_check
    check (height between 1 and 20000),
  constraint gallery_story_images_path_len_check
    check (char_length(storage_path) between 1 and 300)
);

comment on table public.gallery_story_images is
  'One row per image of a story post. sort_order 0 is the first slide (and the cover). Deleting the post deletes these rows (the files in Storage are removed by the app).';

alter table public.gallery_story_images enable row level security;

-- ============================================================================
-- 3. Row Level Security
-- ============================================================================
-- gallery_projects keeps the policies from 0001 (public read, signed-in
-- admin write). Those already cover the new columns, so nothing to add.
-- Every post is public the moment it is created (there is no draft state in
-- this schema), so "public can read published posts" means: anyone can read.

drop policy if exists "gallery_story_images_public_read" on public.gallery_story_images;
create policy "gallery_story_images_public_read"
  on public.gallery_story_images
  for select
  to anon, authenticated
  using (true);

drop policy if exists "gallery_story_images_admin_insert" on public.gallery_story_images;
create policy "gallery_story_images_admin_insert"
  on public.gallery_story_images
  for insert
  to authenticated
  with check (true);

drop policy if exists "gallery_story_images_admin_update" on public.gallery_story_images;
create policy "gallery_story_images_admin_update"
  on public.gallery_story_images
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "gallery_story_images_admin_delete" on public.gallery_story_images;
create policy "gallery_story_images_admin_delete"
  on public.gallery_story_images
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- 4. Storage
-- ============================================================================

-- 4a. Images. Story images go in the SAME public "gallery" bucket as before/
-- after photos (files are named <post-id>/story-NN-<timestamp>.jpg), so the
-- bucket and its policies from 0001 already cover them. This block only makes
-- sure they exist, without touching them if they do.
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'gallery_bucket_public_read') then
    create policy "gallery_bucket_public_read" on storage.objects
      for select to anon, authenticated using (bucket_id = 'gallery');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'gallery_bucket_admin_insert') then
    create policy "gallery_bucket_admin_insert" on storage.objects
      for insert to authenticated with check (bucket_id = 'gallery');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'gallery_bucket_admin_update') then
    create policy "gallery_bucket_admin_update" on storage.objects
      for update to authenticated using (bucket_id = 'gallery') with check (bucket_id = 'gallery');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'gallery_bucket_admin_delete') then
    create policy "gallery_bucket_admin_delete" on storage.objects
      for delete to authenticated using (bucket_id = 'gallery');
  end if;
end
$$;

-- 4b. Audio: a new public bucket, 15 MB per file, mp3/m4a only.
-- Bucket-level limits are enforced by Supabase Storage itself, so even a
-- hand-made upload request can't exceed them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-audio',
  'story-audio',
  true,
  15728640,
  array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "story_audio_bucket_public_read" on storage.objects;
create policy "story_audio_bucket_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'story-audio');

drop policy if exists "story_audio_bucket_admin_insert" on storage.objects;
create policy "story_audio_bucket_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'story-audio');

drop policy if exists "story_audio_bucket_admin_update" on storage.objects;
create policy "story_audio_bucket_admin_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'story-audio')
  with check (bucket_id = 'story-audio');

drop policy if exists "story_audio_bucket_admin_delete" on storage.objects;
create policy "story_audio_bucket_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'story-audio');

-- ============================================================================
-- Rollback (only if you ever need to undo this migration)
-- ============================================================================
-- Delete any story posts first (Dashboard -> Table editor, or in the admin
-- studio), because before_image_url can't go back to NOT NULL while a story
-- row exists. Then run:
--
--   drop table if exists public.gallery_story_images;
--   alter table public.gallery_projects
--     drop constraint if exists gallery_projects_post_type_check,
--     drop constraint if exists gallery_projects_before_required_check,
--     drop constraint if exists gallery_projects_audio_volume_check,
--     drop constraint if exists gallery_projects_audio_only_story_check,
--     drop column if exists post_type,
--     drop column if exists audio_path,
--     drop column if exists audio_volume,
--     drop column if exists audio_loop,
--     drop column if exists audio_autoplay;
--   alter table public.gallery_projects
--     alter column before_image_url set not null;
--   drop policy if exists "story_audio_bucket_public_read" on storage.objects;
--   drop policy if exists "story_audio_bucket_admin_insert" on storage.objects;
--   drop policy if exists "story_audio_bucket_admin_update" on storage.objects;
--   drop policy if exists "story_audio_bucket_admin_delete" on storage.objects;
--   -- Empty the story-audio bucket in the dashboard, then delete the bucket.
--
-- Before/after posts are never touched by any of the above.
