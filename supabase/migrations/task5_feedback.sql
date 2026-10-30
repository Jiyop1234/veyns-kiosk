-- ============================================================================
-- VEYNS TASK 5 — CUSTOMER FEEDBACK, REVIEWS & RATINGS
-- Additive migration: creates NEW tables / functions / bucket only.
-- Does not modify or delete any existing table. Idempotent (safe to re-run).
-- Run once in Supabase Dashboard > SQL Editor. Requires the existing
-- private.is_veyns_staff() function from your main schema.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_posts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,   -- null for guests (private column)
  display_name    text not null check (char_length(btrim(display_name)) between 1 and 60),
  is_guest        boolean not null default true,
  guest_token     text,                                                  -- random per-browser token, used only for rate limiting (private)
  client_ip       text,                                                  -- used only for rate limiting (private)
  submission_key  uuid not null unique,                                  -- idempotency key: double-clicks cannot create duplicates
  rating          smallint not null check (rating between 1 and 5),
  comment         text not null check (char_length(btrim(comment)) between 1 and 1000),
  status          text not null default 'published' check (status in ('published','hidden','pending')),
  created_at      timestamptz not null default now()
);

create table if not exists public.feedback_post_items (
  id                  uuid primary key default gen_random_uuid(),
  post_id             uuid not null references public.feedback_posts(id) on delete cascade,
  menu_item_id        text references public.menu_items(id) on delete set null,  -- real product reference
  item_name_snapshot  text not null check (char_length(btrim(item_name_snapshot)) > 0), -- historical name
  created_at          timestamptz not null default now()
);

create table if not exists public.feedback_photos (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.feedback_posts(id) on delete cascade,
  storage_path  text not null unique,
  mime_type     text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at    timestamptz not null default now()
);

create table if not exists public.feedback_replies (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null unique references public.feedback_posts(id) on delete cascade, -- one official reply per post
  admin_user_id   uuid references auth.users(id) on delete set null,  -- trusted identity, set by trigger from auth.uid()
  body            text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------
create index if not exists feedback_posts_status_created_idx on public.feedback_posts (status, created_at desc, id desc);
create index if not exists feedback_posts_status_rating_created_idx on public.feedback_posts (status, rating, created_at desc, id desc);
create index if not exists feedback_posts_user_idx on public.feedback_posts (user_id);
create index if not exists feedback_posts_guest_token_idx on public.feedback_posts (guest_token, created_at desc);
create index if not exists feedback_posts_client_ip_idx on public.feedback_posts (client_ip, created_at desc);
create index if not exists feedback_post_items_post_idx on public.feedback_post_items (post_id);
create unique index if not exists feedback_post_items_unique_name on public.feedback_post_items (post_id, item_name_snapshot);
create index if not exists feedback_photos_post_idx on public.feedback_photos (post_id);

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------------
-- Max 5 photos per post, enforced in the database itself.
create or replace function private.feedback_photo_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.feedback_photos where post_id = new.post_id) >= 5 then
    raise exception 'A feedback post can have at most 5 photos';
  end if;
  return new;
end $$;
drop trigger if exists trg_feedback_photo_limit on public.feedback_photos;
create trigger trg_feedback_photo_limit before insert on public.feedback_photos
  for each row execute function private.feedback_photo_limit();

-- Admin identity always comes from the session, never from the client.
create or replace function private.feedback_reply_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.admin_user_id := auth.uid();
    new.created_at := now();
  else
    new.admin_user_id := old.admin_user_id;   -- keep original author
    new.post_id := old.post_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_feedback_reply_stamp on public.feedback_replies;
create trigger trg_feedback_reply_stamp before insert or update on public.feedback_replies
  for each row execute function private.feedback_reply_stamp();

-- ---------------------------------------------------------------------------
-- 4. TABLE PRIVILEGES + RLS
-- Private columns (user_id, guest_token, client_ip, admin_user_id) are NOT
-- granted to anon/authenticated, so they can never be read through the API.
-- ---------------------------------------------------------------------------
alter table public.feedback_posts      enable row level security;
alter table public.feedback_post_items enable row level security;
alter table public.feedback_photos     enable row level security;
alter table public.feedback_replies    enable row level security;

revoke all on public.feedback_posts, public.feedback_post_items, public.feedback_photos, public.feedback_replies from anon, authenticated;

grant select (id, display_name, is_guest, rating, comment, status, created_at) on public.feedback_posts to anon, authenticated;
grant update (status) on public.feedback_posts to authenticated;                       -- staff moderation only (RLS enforces)
grant select (id, post_id, menu_item_id, item_name_snapshot) on public.feedback_post_items to anon, authenticated;
grant select (id, post_id, storage_path, mime_type, size_bytes, created_at) on public.feedback_photos to anon, authenticated;
grant select (id, post_id, body, created_at, updated_at) on public.feedback_replies to anon, authenticated;
grant insert (post_id, body), update (body) on public.feedback_replies to authenticated; -- staff only (RLS enforces)

-- posts
drop policy if exists "feedback_posts public read" on public.feedback_posts;
create policy "feedback_posts public read" on public.feedback_posts
  for select to anon, authenticated using (status = 'published');
drop policy if exists "feedback_posts staff read" on public.feedback_posts;
create policy "feedback_posts staff read" on public.feedback_posts
  for select to authenticated using (private.is_veyns_staff());
drop policy if exists "feedback_posts staff moderate" on public.feedback_posts;
create policy "feedback_posts staff moderate" on public.feedback_posts
  for update to authenticated using (private.is_veyns_staff()) with check (private.is_veyns_staff());
-- NO insert policy: all posts are created through public.submit_feedback()

-- items / photos / replies are visible exactly when their parent post is visible (RLS on posts applies inside the subquery)
drop policy if exists "feedback_items read" on public.feedback_post_items;
create policy "feedback_items read" on public.feedback_post_items
  for select to anon, authenticated using (exists (select 1 from public.feedback_posts p where p.id = post_id));
drop policy if exists "feedback_photos read" on public.feedback_photos;
create policy "feedback_photos read" on public.feedback_photos
  for select to anon, authenticated using (exists (select 1 from public.feedback_posts p where p.id = post_id));
drop policy if exists "feedback_replies read" on public.feedback_replies;
create policy "feedback_replies read" on public.feedback_replies
  for select to anon, authenticated using (exists (select 1 from public.feedback_posts p where p.id = post_id));

drop policy if exists "feedback_replies staff insert" on public.feedback_replies;
create policy "feedback_replies staff insert" on public.feedback_replies
  for insert to authenticated with check (private.is_veyns_staff());
drop policy if exists "feedback_replies staff update" on public.feedback_replies;
create policy "feedback_replies staff update" on public.feedback_replies
  for update to authenticated using (private.is_veyns_staff()) with check (private.is_veyns_staff());

-- ---------------------------------------------------------------------------
-- 5. STORAGE BUCKET (private; images served through short-lived signed URLs)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-images', 'feedback-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Upload only into posts/<submission-uuid>/<file-uuid>.(jpg|png|webp)
drop policy if exists "feedback_img upload" on storage.objects;
create policy "feedback_img upload" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'feedback-images'
    and name ~ '^posts/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

-- Read: only images attached to a post the caller may see (published for public, everything for staff)
drop policy if exists "feedback_img read" on storage.objects;
create policy "feedback_img read" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'feedback-images'
    and exists (select 1 from public.feedback_photos fp where fp.storage_path = name)
  );

-- Staff may see every image in the bucket (including hidden posts and orphans)
drop policy if exists "feedback_img staff read" on storage.objects;
create policy "feedback_img staff read" on storage.objects
  for select to authenticated
  using (bucket_id = 'feedback-images' and private.is_veyns_staff());

-- Staff may delete images (used by the orphan clean-up button)
drop policy if exists "feedback_img staff delete" on storage.objects;
create policy "feedback_img staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'feedback-images' and private.is_veyns_staff());

-- ---------------------------------------------------------------------------
-- 6. submit_feedback(): the ONLY way to publish a post (guests + customers)
-- ---------------------------------------------------------------------------
create or replace function public.submit_feedback(
  p_submission_key uuid,
  p_rating         integer,
  p_comment        text,
  p_item_ids       text[],
  p_photos         jsonb default '[]'::jsonb,
  p_guest_token    text  default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_name      text := 'Guest';
  v_is_guest  boolean := true;
  v_status    text;
  v_role      text;
  v_comment   text := btrim(coalesce(p_comment, ''));
  v_ip        text;
  v_post      public.feedback_posts%rowtype;
  v_ids       text[];
  v_found     integer;
  v_photo     jsonb;
  v_path      text;
  v_meta      jsonb;
  v_recent    integer;
  v_daily     integer;
  v_token     text := nullif(left(btrim(coalesce(p_guest_token, '')), 64), '');
begin
  if p_submission_key is null then raise exception 'Missing submission key'; end if;

  -- Duplicate click / retry: return the already-saved post
  select * into v_post from public.feedback_posts where submission_key = p_submission_key;
  if found then
    return jsonb_build_object('id', v_post.id, 'created_at', v_post.created_at, 'duplicate', true);
  end if;

  -- Identity (never trusted from the client)
  if v_uid is not null then
    select p.name, p.status, p.role into v_name, v_status, v_role
    from public.profiles p where p.auth_user_id = v_uid limit 1;
    if found then
      if coalesce(v_status, 'ACTIVE') = 'SUSPENDED' then raise exception 'Account is suspended'; end if;
      v_is_guest := false;
      v_name := coalesce(nullif(btrim(v_name), ''), 'Customer');
    else
      v_name := 'Guest';
    end if;
    -- nobody can post under the official admin identity
    if lower(v_name) like '%veyns%admin%' then v_name := 'Customer'; end if;
    v_name := left(v_name, 60);
  end if;

  -- Validation
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Rating must be a whole number from 1 to 5'; end if;
  if v_comment = '' then raise exception 'Written feedback is required'; end if;
  if char_length(coalesce(p_comment, '')) > 1000 then raise exception 'Feedback is limited to 1,000 characters'; end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_item_ids, '{}')) as x where x is not null and btrim(x) <> '';
  if coalesce(array_length(v_ids, 1), 0) < 1 then raise exception 'Select at least one food item'; end if;
  if array_length(v_ids, 1) > 15 then raise exception 'Too many food items selected'; end if;
  select count(*) into v_found from public.menu_items where id = any(v_ids);
  if v_found <> array_length(v_ids, 1) then raise exception 'One or more selected food items do not exist'; end if;

  if jsonb_typeof(coalesce(p_photos, '[]'::jsonb)) <> 'array' then raise exception 'Invalid photo list'; end if;
  if jsonb_array_length(coalesce(p_photos, '[]'::jsonb)) > 5 then raise exception 'A maximum of 5 photos is allowed'; end if;

  -- Rate limiting (per account / per browser token / per IP)
  begin
    v_ip := nullif(btrim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1)), '');
  exception when others then v_ip := null;
  end;

  select count(*) into v_recent from public.feedback_posts
  where created_at > now() - interval '10 minutes'
    and ((v_uid is not null and user_id = v_uid) or (v_token is not null and guest_token = v_token) or (v_ip is not null and client_ip = v_ip));
  if v_recent >= 3 then raise exception 'You are posting too quickly. Please wait a few minutes and try again.'; end if;

  select count(*) into v_daily from public.feedback_posts
  where created_at > now() - interval '24 hours'
    and ((v_uid is not null and user_id = v_uid) or (v_token is not null and guest_token = v_token) or (v_ip is not null and client_ip = v_ip));
  if v_daily >= 15 then raise exception 'Daily feedback limit reached. Please try again tomorrow.'; end if;

  -- Create the post
  begin
    insert into public.feedback_posts (user_id, display_name, is_guest, guest_token, client_ip, submission_key, rating, comment, status)
    values (v_uid, v_name, v_is_guest, v_token, v_ip, p_submission_key, p_rating, v_comment, 'published')
    returning * into v_post;
  exception when unique_violation then
    select * into v_post from public.feedback_posts where submission_key = p_submission_key;
    return jsonb_build_object('id', v_post.id, 'created_at', v_post.created_at, 'duplicate', true);
  end;

  -- Selected food items (real references + historical names)
  insert into public.feedback_post_items (post_id, menu_item_id, item_name_snapshot)
  select v_post.id, m.id, m.name from public.menu_items m where m.id = any(v_ids);

  -- Photos: verified against what really exists in Storage (size / type come from Storage, not the client)
  for v_photo in select * from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) loop
    v_path := v_photo ->> 'path';
    if v_path is null or v_path not like 'posts/' || p_submission_key::text || '/%' then
      raise exception 'Invalid photo reference';
    end if;
    select o.metadata into v_meta from storage.objects o where o.bucket_id = 'feedback-images' and o.name = v_path;
    if v_meta is null then raise exception 'A photo upload is missing. Please try again.'; end if;
    if coalesce((v_meta ->> 'size')::bigint, 0) > 5242880 then raise exception 'A photo exceeds 5 MB'; end if;
    if coalesce(v_meta ->> 'mimetype', '') not in ('image/jpeg','image/png','image/webp') then raise exception 'Unsupported photo format'; end if;
    insert into public.feedback_photos (post_id, storage_path, mime_type, size_bytes)
    values (v_post.id, v_path, v_meta ->> 'mimetype', (v_meta ->> 'size')::bigint);
  end loop;

  return jsonb_build_object('id', v_post.id, 'created_at', v_post.created_at, 'duplicate', false);
end;
$$;
revoke all on function public.submit_feedback(uuid, integer, text, text[], jsonb, text) from public;
grant execute on function public.submit_feedback(uuid, integer, text, text[], jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Rating counts for the filter chips (published posts only)
-- ---------------------------------------------------------------------------
create or replace function public.feedback_rating_counts()
returns table (rating smallint, total bigint)
language sql stable security definer set search_path = ''
as $$
  select p.rating, count(*) from public.feedback_posts p where p.status = 'published' group by p.rating;
$$;
revoke all on function public.feedback_rating_counts() from public;
grant execute on function public.feedback_rating_counts() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Orphaned upload finder (staff only). Images uploaded but never attached
--    to a post (failed/abandoned publish). The dashboard button removes them
--    through the Storage API (deleting storage rows by SQL would leave files behind).
-- ---------------------------------------------------------------------------
create or replace function public.feedback_orphan_images()
returns table (name text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_veyns_staff() then raise exception 'Not authorized'; end if;
  return query
    select o.name from storage.objects o
    where o.bucket_id = 'feedback-images'
      and o.created_at < now() - interval '1 hour'
      and not exists (select 1 from public.feedback_photos fp where fp.storage_path = o.name);
end;
$$;
revoke all on function public.feedback_orphan_images() from public, anon;
grant execute on function public.feedback_orphan_images() to authenticated;

commit;
