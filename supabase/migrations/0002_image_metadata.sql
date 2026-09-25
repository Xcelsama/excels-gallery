-- Excel's Gallery: image metadata for fast, non-shifting image loading
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New
-- query), or via `supabase db push`, the same way you ran 0001_init.sql.
--
-- Adds the intrinsic pixel dimensions and a tiny blur-up placeholder for
-- each of the two photos on a project. These are captured client-side at
-- upload time (see AdminPostForm.js) and let the public site use
-- next/image's real optimization pipeline (automatic resizing, AVIF/WebP,
-- a reserved aspect ratio so the page doesn't jump while a photo loads,
-- and a blurred preview instead of a blank box). Existing rows published
-- before this migration simply have these columns as null, the site falls
-- back to the original unoptimized rendering for those specific photos
-- rather than guessing at a size.

alter table public.gallery_projects
  add column if not exists before_width int,
  add column if not exists before_height int,
  add column if not exists before_blur_data_url text,
  add column if not exists after_width int,
  add column if not exists after_height int,
  add column if not exists after_blur_data_url text;

comment on column public.gallery_projects.before_width is
  'Intrinsic pixel width of the before photo, read from the file at upload time.';
comment on column public.gallery_projects.before_height is
  'Intrinsic pixel height of the before photo, read from the file at upload time.';
comment on column public.gallery_projects.before_blur_data_url is
  'Tiny base64 data: URL (a ~16px-wide JPEG) used as a next/image blur-up placeholder.';
comment on column public.gallery_projects.after_width is
  'Intrinsic pixel width of the after photo, read from the file at upload time.';
comment on column public.gallery_projects.after_height is
  'Intrinsic pixel height of the after photo, read from the file at upload time.';
comment on column public.gallery_projects.after_blur_data_url is
  'Tiny base64 data: URL (a ~16px-wide JPEG) used as a next/image blur-up placeholder.';

-- Sanity bounds, mirroring the same "trust the client, verify on the
-- server" approach as the rest of this table's constraints. A blur data
-- URL is only ever a few hundred bytes in practice (see readImageMeta in
-- AdminPostForm.js), so 4000 chars comfortably covers it with room to
-- spare while still blocking anything wildly larger from being stored.
--
-- Postgres has no "ADD CONSTRAINT IF NOT EXISTS", so each one is dropped
-- first (a no-op the first time this runs) and re-added, the same
-- drop-then-create idiom 0001_init.sql already uses for its trigger.
alter table public.gallery_projects
  drop constraint if exists gallery_projects_before_width_check,
  drop constraint if exists gallery_projects_before_height_check,
  drop constraint if exists gallery_projects_after_width_check,
  drop constraint if exists gallery_projects_after_height_check,
  drop constraint if exists gallery_projects_before_blur_len_check,
  drop constraint if exists gallery_projects_after_blur_len_check;

alter table public.gallery_projects
  add constraint gallery_projects_before_width_check
    check (before_width is null or before_width between 1 and 20000),
  add constraint gallery_projects_before_height_check
    check (before_height is null or before_height between 1 and 20000),
  add constraint gallery_projects_after_width_check
    check (after_width is null or after_width between 1 and 20000),
  add constraint gallery_projects_after_height_check
    check (after_height is null or after_height between 1 and 20000),
  add constraint gallery_projects_before_blur_len_check
    check (before_blur_data_url is null or char_length(before_blur_data_url) <= 4000),
  add constraint gallery_projects_after_blur_len_check
    check (after_blur_data_url is null or char_length(after_blur_data_url) <= 4000);
