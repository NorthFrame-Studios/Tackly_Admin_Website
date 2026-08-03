begin;

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists role text not null default 'user',
  add column if not exists account_status text not null default 'active',
  add column if not exists suspension_reason text null,
  add column if not exists suspended_until timestamptz null,
  add column if not exists moderation_note text null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'moderator', 'admin')) not valid;
alter table public.profiles validate constraint profiles_role_check;

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'suspended', 'banned')) not valid;
alter table public.profiles validate constraint profiles_account_status_check;

-- The mobile schema already uses active, reserved, sold and archived. Expand its
-- existing status check without renaming or deleting any rows.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.listings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.listings drop constraint %I', constraint_row.conname);
  end loop;
end;
$$;

alter table public.listings add constraint listings_status_check_admin
  check (status in (
    'active', 'reserved', 'sold', 'archived', 'hidden',
    'removed_by_moderator', 'deleted_by_owner'
  )) not valid;
alter table public.listings validate constraint listings_status_check_admin;

alter table public.listing_images
  add column if not exists moderation_status text not null default 'active';
alter table public.listing_images drop constraint if exists listing_images_moderation_status_check;
alter table public.listing_images add constraint listing_images_moderation_status_check
  check (moderation_status in ('active', 'hidden', 'removed')) not valid;
alter table public.listing_images validate constraint listing_images_moderation_status_check;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null constraint reports_reporter_id_fkey
    references public.profiles(id) on delete restrict,
  reported_user_id uuid null constraint reports_reported_user_id_fkey
    references public.profiles(id) on delete restrict,
  listing_id uuid null constraint reports_listing_id_fkey
    references public.listings(id) on delete restrict,
  listing_image_id uuid null constraint reports_listing_image_id_fkey
    references public.listing_images(id) on delete restrict,
  message_id uuid null constraint reports_message_id_fkey
    references public.messages(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 2 and 200),
  details text null check (details is null or char_length(details) <= 4000),
  status text not null default 'open' check (
    status in ('open', 'under_review', 'resolved', 'dismissed')
  ),
  priority text not null default 'normal' check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  priority_rank smallint generated always as (
    case priority when 'urgent' then 4 when 'high' then 3 when 'normal' then 2 else 1 end
  ) stored,
  assigned_admin_id uuid null constraint reports_assigned_admin_id_fkey
    references public.profiles(id) on delete set null,
  resolution text null check (resolution is null or char_length(resolution) <= 2000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  resolved_at timestamptz null,
  constraint reports_has_target check (
    reported_user_id is not null or listing_id is not null or
    listing_image_id is not null or message_id is not null
  )
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid null constraint moderation_actions_report_id_fkey
    references public.reports(id) on delete set null,
  moderator_id uuid not null constraint moderation_actions_moderator_id_fkey
    references public.profiles(id) on delete restrict,
  target_user_id uuid null constraint moderation_actions_target_user_id_fkey
    references public.profiles(id) on delete set null,
  listing_id uuid null constraint moderation_actions_listing_id_fkey
    references public.listings(id) on delete set null,
  listing_image_id uuid null constraint moderation_actions_listing_image_id_fkey
    references public.listing_images(id) on delete set null,
  message_id uuid null constraint moderation_actions_message_id_fkey
    references public.messages(id) on delete set null,
  action text not null check (action in (
    'dismiss_report', 'mark_under_review', 'hide_image', 'restore_image',
    'remove_listing', 'restore_listing', 'warn_user', 'suspend_user',
    'unsuspend_user', 'ban_user', 'change_user_role', 'resolve_report'
  )),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  internal_note text null check (internal_note is null or char_length(internal_note) <= 2000),
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  moderation_action_id uuid not null unique references public.moderation_actions(id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz null
);

create index if not exists reports_status_priority_created_idx
  on public.reports(status, priority_rank desc, created_at desc);
create index if not exists reports_reporter_created_idx on public.reports(reporter_id, created_at desc);
create index if not exists reports_reported_user_created_idx on public.reports(reported_user_id, created_at desc);
create index if not exists reports_listing_created_idx on public.reports(listing_id, created_at desc);
create index if not exists reports_assigned_created_idx on public.reports(assigned_admin_id, created_at desc);
create index if not exists moderation_actions_created_idx on public.moderation_actions(created_at desc);
create index if not exists moderation_actions_moderator_idx on public.moderation_actions(moderator_id, created_at desc);
create index if not exists moderation_actions_target_user_idx on public.moderation_actions(target_user_id, created_at desc);
create index if not exists moderation_actions_listing_idx on public.moderation_actions(listing_id, created_at desc);
create index if not exists listing_images_moderation_status_idx on public.listing_images(moderation_status, listing_id);
create index if not exists profiles_admin_role_status_idx on public.profiles(role, account_status);
create index if not exists user_warnings_user_created_idx on public.user_warnings(user_id, created_at desc);

comment on column public.profiles.moderation_note is
  'Private staff-only note. Access is only exposed through protected admin RPC functions.';
comment on table public.moderation_actions is
  'Append-only moderation audit history. UPDATE and DELETE are rejected by trigger.';

commit;
