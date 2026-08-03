begin;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid()),
    'user'
  );
$$;

create or replace function public.is_admin_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.current_app_role() in ('moderator', 'admin')
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and not p.is_deleted
        and (p.account_status = 'active' or (p.account_status = 'suspended' and p.suspended_until <= now()))
    );
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.current_app_role() = 'admin'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and not p.is_deleted
        and (p.account_status = 'active' or (p.account_status = 'suspended' and p.suspended_until <= now()))
    );
$$;

create or replace function public.is_account_active(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and (
        p.account_status = 'active'
        or (p.account_status = 'suspended' and p.suspended_until <= now())
      )
      and not p.is_deleted
  );
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_admin_staff() from public;
revoke all on function public.is_app_admin() from public;
revoke all on function public.is_account_active(uuid) from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin_staff() to authenticated;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.is_account_active(uuid) to authenticated;

-- Existing mobile profile queries already select this explicit public column set.
-- Switching to column grants prevents role, status and internal notes leaking through
-- a malicious select('*') request.
revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, avatar_url, location, bio, is_deleted, deleted_at, created_at, updated_at)
  on public.profiles to anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, location, bio)
  on public.profiles to authenticated;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_app_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
    or new.account_status is distinct from old.account_status
    or new.suspension_reason is distinct from old.suspension_reason
    or new.suspended_until is distinct from old.suspended_until
    or new.moderation_note is distinct from old.moderation_note then
    raise exception 'Protected profile fields can only be changed by an administrator.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_admin_fields_trigger on public.profiles;
create trigger protect_profile_admin_fields_trigger
before update on public.profiles
for each row execute function public.protect_profile_admin_fields();

create or replace function public.protect_listing_moderation_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin_staff() then return new; end if;
  if old.status in ('hidden', 'removed_by_moderator')
    or new.status in ('hidden', 'removed_by_moderator') then
    raise exception 'Moderator-controlled listing status.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_listing_moderation_status_trigger on public.listings;
create trigger protect_listing_moderation_status_trigger
before update of status on public.listings
for each row execute function public.protect_listing_moderation_status();

create or replace function public.protect_listing_image_moderation_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin_staff() then return new; end if;
  if new.moderation_status is distinct from old.moderation_status then
    raise exception 'Moderator-controlled image status.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_listing_image_moderation_status_trigger on public.listing_images;
create trigger protect_listing_image_moderation_status_trigger
before update of moderation_status on public.listing_images
for each row execute function public.protect_listing_image_moderation_status();

create or replace function public.reject_restricted_user_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_account_active(auth.uid()) and not public.is_admin_staff() then
    raise exception 'Account is not active.' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['listings', 'listing_images', 'messages', 'conversations', 'offers']
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists reject_restricted_user_write_trigger on public.%I', table_name);
      execute format('create trigger reject_restricted_user_write_trigger before insert or update on public.%I for each row execute function public.reject_restricted_user_write()', table_name);
    end if;
  end loop;
end;
$$;

alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.user_warnings enable row level security;
alter table public.listing_images enable row level security;

drop policy if exists "Staff can read reports" on public.reports;
create policy "Staff can read reports" on public.reports for select to authenticated
  using (public.is_admin_staff());
drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports" on public.reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and assigned_admin_id is null
    and status = 'open'
    and resolution is null
    and reviewed_at is null
    and resolved_at is null
    and public.is_account_active(auth.uid())
    and (
      reports.listing_image_id is null or exists (
        select 1 from public.listing_images li
        where li.id = reports.listing_image_id
          and (reports.listing_id is null or li.listing_id = reports.listing_id)
      )
    )
    and (
      reports.message_id is null or exists (
        select 1
        from public.messages m
        join public.conversations c on c.id = m.conversation_id
        where m.id = reports.message_id
          and auth.uid() in (c.buyer_id, c.seller_id)
      )
    )
  );

drop policy if exists "Staff can read moderation actions" on public.moderation_actions;
create policy "Staff can read moderation actions" on public.moderation_actions for select to authenticated
  using (public.is_admin_staff());

drop policy if exists "Staff can read warnings" on public.user_warnings;
create policy "Staff can read warnings" on public.user_warnings for select to authenticated
  using (public.is_admin_staff());
drop policy if exists "Users can read their warnings" on public.user_warnings;
create policy "Users can read their warnings" on public.user_warnings for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Staff can read every listing" on public.listings;
create policy "Staff can read every listing" on public.listings for select to authenticated
  using (public.is_admin_staff());
drop policy if exists "Staff can read every listing image" on public.listing_images;
create policy "Staff can read every listing image" on public.listing_images for select to authenticated
  using (public.is_admin_staff());
drop policy if exists "Hidden listing images stay private" on public.listing_images;
create policy "Hidden listing images stay private" on public.listing_images
  as restrictive for select
  using (moderation_status = 'active' or public.is_admin_staff());

do $$
begin
  if to_regclass('public.messages') is not null then
    execute 'drop policy if exists "Staff can read reported messages" on public.messages';
    execute 'create policy "Staff can read reported messages" on public.messages for select to authenticated using (public.is_admin_staff())';
  end if;
  if to_regclass('public.conversations') is not null then
    execute 'drop policy if exists "Staff can read reported conversations" on public.conversations';
    execute 'create policy "Staff can read reported conversations" on public.conversations for select to authenticated using (public.is_admin_staff())';
  end if;
end;
$$;

grant select on public.reports, public.moderation_actions, public.user_warnings to authenticated;
grant insert (reporter_id, reported_user_id, listing_id, listing_image_id, message_id, reason, details, priority)
  on public.reports to authenticated;
revoke insert, update, delete on public.moderation_actions from anon, authenticated;
revoke update, delete on public.reports from anon, authenticated;
revoke insert, update, delete on public.user_warnings from anon, authenticated;

create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Moderation audit records are immutable.' using errcode = '42501';
end;
$$;

drop trigger if exists moderation_actions_immutable_trigger on public.moderation_actions;
create trigger moderation_actions_immutable_trigger
before update or delete on public.moderation_actions
for each row execute function public.prevent_audit_mutation();

commit;
