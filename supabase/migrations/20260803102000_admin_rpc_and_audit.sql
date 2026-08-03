begin;

create or replace function public.get_my_admin_profile()
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  location text,
  bio text,
  is_deleted boolean,
  created_at timestamptz,
  email text,
  role text,
  account_status text,
  suspension_reason text,
  suspended_until timestamptz,
  moderation_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  return query
  select p.id, p.display_name, p.avatar_url, p.location, p.bio, p.is_deleted,
    p.created_at, u.email::text, p.role,
    case when p.account_status = 'suspended' and p.suspended_until <= now() then 'active' else p.account_status end,
    p.suspension_reason,
    p.suspended_until, p.moderation_note
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = auth.uid()
    and p.role in ('moderator', 'admin')
    and public.is_account_active(p.id)
    and not p.is_deleted;
end;
$$;

create or replace function public.admin_get_users(
  p_search text default null,
  p_role text default null,
  p_account_status text default null,
  p_reported_only boolean default false,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_offset integer default 0,
  p_limit integer default 25
)
returns table (
  id uuid, display_name text, avatar_url text, location text, bio text,
  is_deleted boolean, created_at timestamptz, email text, role text,
  account_status text, suspension_reason text, suspended_until timestamptz,
  moderation_note text, listings_count bigint, reports_received_count bigint,
  reports_submitted_count bigint, last_activity_at timestamptz, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if p_role is not null and p_role not in ('user', 'moderator', 'admin') then
    raise exception 'Invalid role.' using errcode = '22023';
  end if;
  if p_account_status is not null and p_account_status not in ('active', 'suspended', 'banned') then
    raise exception 'Invalid account status.' using errcode = '22023';
  end if;
  return query
  with user_rows as (
    select p.id, p.display_name, p.avatar_url, p.location, p.bio, p.is_deleted,
      p.created_at, u.email::text, p.role,
      case when p.account_status = 'suspended' and p.suspended_until <= now() then 'active' else p.account_status end as account_status,
      p.suspension_reason, p.suspended_until, p.moderation_note,
      (select count(*) from public.listings l where l.seller_id = p.id) as listings_count,
      (select count(*) from public.reports r left join public.listings rl on rl.id = r.listing_id
        where r.reported_user_id = p.id or rl.seller_id = p.id) as reports_received_count,
      (select count(*) from public.reports r where r.reporter_id = p.id) as reports_submitted_count,
      u.last_sign_in_at as last_activity_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where (p_search is null or p_search = '' or p.display_name ilike '%' || p_search || '%'
      or u.email ilike '%' || p_search || '%' or p.id::text ilike '%' || p_search || '%')
      and (p_role is null or p.role = p_role)
      and (p_account_status is null or
        (case when p.account_status = 'suspended' and p.suspended_until <= now() then 'active' else p.account_status end) = p_account_status)
      and (p_from is null or p.created_at >= p_from)
      and (p_to is null or p.created_at <= p_to)
  ), filtered as (
    select * from user_rows
    where not p_reported_only or reports_received_count > 0
  )
  select f.*, count(*) over() as total_count
  from filtered f
  order by f.created_at desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 100);
end;
$$;

create or replace function public.admin_get_user_by_id(p_user_id uuid)
returns table (
  id uuid, display_name text, avatar_url text, location text, bio text,
  is_deleted boolean, created_at timestamptz, email text, role text,
  account_status text, suspension_reason text, suspended_until timestamptz,
  moderation_note text, listings_count bigint, reports_received_count bigint,
  reports_submitted_count bigint, last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  return query
  select p.id, p.display_name, p.avatar_url, p.location, p.bio, p.is_deleted,
    p.created_at, u.email::text, p.role,
    case when p.account_status = 'suspended' and p.suspended_until <= now() then 'active' else p.account_status end,
    p.suspension_reason,
    p.suspended_until, p.moderation_note,
    (select count(*) from public.listings l where l.seller_id = p.id),
    (select count(*) from public.reports r left join public.listings rl on rl.id = r.listing_id
      where r.reported_user_id = p.id or rl.seller_id = p.id),
    (select count(*) from public.reports r where r.reporter_id = p.id),
    u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user_id;
end;
$$;

create or replace function public.admin_dashboard_statistics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not public.is_admin_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'high_priority_reports', (select count(*) from public.reports where status in ('open', 'under_review') and priority in ('high', 'urgent')),
    'under_review_reports', (select count(*) from public.reports where status = 'under_review'),
    'removed_listings', (select count(*) from public.listings where status = 'removed_by_moderator'),
    'suspended_users', (select count(*) from public.profiles where account_status = 'suspended' and (suspended_until is null or suspended_until > now())),
    'new_users_30d', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'new_listings_30d', (select count(*) from public.listings where created_at >= now() - interval '30 days'),
    'reports_change_7d',
      (select count(*) from public.reports where created_at >= now() - interval '7 days') -
      (select count(*) from public.reports where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'),
    'users_change_30d',
      (select count(*) from public.profiles where created_at >= now() - interval '30 days') -
      (select count(*) from public.profiles where created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'),
    'listings_change_30d',
      (select count(*) from public.listings where created_at >= now() - interval '30 days') -
      (select count(*) from public.listings where created_at >= now() - interval '60 days' and created_at < now() - interval '30 days')
  ) into result;
  return result;
end;
$$;

create or replace function public.perform_moderation_action(
  p_action text,
  p_reason text,
  p_internal_note text default null,
  p_report_id uuid default null,
  p_target_user_id uuid default null,
  p_listing_id uuid default null,
  p_listing_image_id uuid default null,
  p_message_id uuid default null,
  p_suspension_hours integer default null,
  p_new_role text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text := public.current_app_role();
  v_target_user_id uuid := p_target_user_id;
  v_listing_id uuid := p_listing_id;
  v_listing_image_id uuid := p_listing_image_id;
  v_message_id uuid := p_message_id;
  v_previous_status text;
  v_action_id uuid := gen_random_uuid();
  v_target_role text;
  v_metadata jsonb;
begin
  if not public.is_admin_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if p_action not in (
    'dismiss_report', 'mark_under_review', 'hide_image', 'restore_image',
    'remove_listing', 'restore_listing', 'warn_user', 'suspend_user',
    'unsuspend_user', 'ban_user', 'change_user_role', 'resolve_report'
  ) then
    raise exception 'Unsupported moderation action.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A reason of at least three characters is required.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_reason, '')) > 1000 or char_length(coalesce(p_internal_note, '')) > 2000 then
    raise exception 'Reason or internal note is too long.' using errcode = '22023';
  end if;
  if p_action in ('suspend_user', 'unsuspend_user', 'ban_user', 'change_user_role') and v_actor_role <> 'admin' then
    raise exception 'Administrator access required for this action.' using errcode = '42501';
  end if;

  if p_report_id is not null then
    select coalesce(v_target_user_id, r.reported_user_id),
      coalesce(v_listing_id, r.listing_id),
      coalesce(v_listing_image_id, r.listing_image_id),
      coalesce(v_message_id, r.message_id)
    into v_target_user_id, v_listing_id, v_listing_image_id, v_message_id
    from public.reports r where r.id = p_report_id
    for update;
    if not found then raise exception 'Report not found.' using errcode = 'P0002'; end if;
  end if;
  if v_listing_image_id is not null then
    select coalesce(v_listing_id, li.listing_id) into v_listing_id
    from public.listing_images li where li.id = v_listing_image_id;
  end if;
  if v_listing_id is not null and v_target_user_id is null then
    select l.seller_id into v_target_user_id from public.listings l where l.id = v_listing_id;
  end if;

  case p_action
    when 'mark_under_review' then
      if p_report_id is null then raise exception 'Report is required.' using errcode = '22023'; end if;
      update public.reports set status = 'under_review', assigned_admin_id = v_actor,
        reviewed_at = coalesce(reviewed_at, now()), resolved_at = null
      where id = p_report_id;
    when 'dismiss_report' then
      if p_report_id is null then raise exception 'Report is required.' using errcode = '22023'; end if;
      update public.reports set status = 'dismissed', assigned_admin_id = coalesce(assigned_admin_id, v_actor),
        resolution = btrim(p_reason), reviewed_at = coalesce(reviewed_at, now()), resolved_at = now()
      where id = p_report_id;
    when 'resolve_report' then
      if p_report_id is null then raise exception 'Report is required.' using errcode = '22023'; end if;
      update public.reports set status = 'resolved', assigned_admin_id = coalesce(assigned_admin_id, v_actor),
        resolution = btrim(p_reason), reviewed_at = coalesce(reviewed_at, now()), resolved_at = now()
      where id = p_report_id;
    when 'hide_image' then
      if v_listing_image_id is null then raise exception 'Listing image is required.' using errcode = '22023'; end if;
      update public.listing_images set moderation_status = 'hidden' where id = v_listing_image_id;
      if not found then raise exception 'Listing image not found.' using errcode = 'P0002'; end if;
    when 'restore_image' then
      if v_listing_image_id is null then raise exception 'Listing image is required.' using errcode = '22023'; end if;
      update public.listing_images set moderation_status = 'active' where id = v_listing_image_id;
      if not found then raise exception 'Listing image not found.' using errcode = 'P0002'; end if;
    when 'remove_listing' then
      if v_listing_id is null then raise exception 'Listing is required.' using errcode = '22023'; end if;
      select status into v_previous_status from public.listings where id = v_listing_id for update;
      if not found then raise exception 'Listing not found.' using errcode = 'P0002'; end if;
      update public.listings set status = 'removed_by_moderator', updated_at = now() where id = v_listing_id;
    when 'restore_listing' then
      if v_listing_id is null then raise exception 'Listing is required.' using errcode = '22023'; end if;
      select coalesce(ma.metadata->>'previous_status', 'active') into v_previous_status
      from public.moderation_actions ma
      where ma.listing_id = v_listing_id and ma.action = 'remove_listing'
      order by ma.created_at desc limit 1;
      if v_previous_status not in ('active', 'reserved', 'sold', 'archived') then v_previous_status := 'active'; end if;
      update public.listings set status = coalesce(v_previous_status, 'active'), updated_at = now()
      where id = v_listing_id and status = 'removed_by_moderator';
      if not found then raise exception 'Removed listing not found.' using errcode = 'P0002'; end if;
    when 'warn_user' then
      if v_target_user_id is null then raise exception 'Target user is required.' using errcode = '22023'; end if;
    when 'suspend_user' then
      if v_target_user_id is null then raise exception 'Target user is required.' using errcode = '22023'; end if;
      if v_target_user_id = v_actor then raise exception 'You cannot suspend your own account.' using errcode = '42501'; end if;
      if coalesce(p_suspension_hours, 0) not between 1 and 8760 then raise exception 'Suspension duration must be between 1 and 8760 hours.' using errcode = '22023'; end if;
      update public.profiles set account_status = 'suspended', suspension_reason = btrim(p_reason),
        suspended_until = now() + make_interval(hours => p_suspension_hours),
        moderation_note = coalesce(nullif(btrim(p_internal_note), ''), moderation_note)
      where id = v_target_user_id;
      if not found then raise exception 'User not found.' using errcode = 'P0002'; end if;
    when 'unsuspend_user' then
      if v_target_user_id is null then raise exception 'Target user is required.' using errcode = '22023'; end if;
      update public.profiles set account_status = 'active', suspension_reason = null, suspended_until = null,
        moderation_note = coalesce(nullif(btrim(p_internal_note), ''), moderation_note)
      where id = v_target_user_id and account_status = 'suspended';
      if not found then raise exception 'Suspended user not found.' using errcode = 'P0002'; end if;
    when 'ban_user' then
      if v_target_user_id is null then raise exception 'Target user is required.' using errcode = '22023'; end if;
      if v_target_user_id = v_actor then raise exception 'You cannot ban your own account.' using errcode = '42501'; end if;
      select role into v_target_role from public.profiles where id = v_target_user_id for update;
      if v_target_role = 'admin' then raise exception 'Demote the administrator before banning the account.' using errcode = '42501'; end if;
      update public.profiles set account_status = 'banned', suspension_reason = btrim(p_reason),
        suspended_until = null, moderation_note = coalesce(nullif(btrim(p_internal_note), ''), moderation_note)
      where id = v_target_user_id;
    when 'change_user_role' then
      if v_target_user_id is null or p_new_role not in ('user', 'moderator', 'admin') then
        raise exception 'Target user and a valid role are required.' using errcode = '22023';
      end if;
      select role into v_target_role from public.profiles where id = v_target_user_id for update;
      if not found then raise exception 'User not found.' using errcode = 'P0002'; end if;
      if v_target_role = 'admin' and p_new_role <> 'admin'
        and (select count(*) from public.profiles where role = 'admin' and account_status = 'active' and not is_deleted) <= 1 then
        raise exception 'The final active administrator cannot be demoted.' using errcode = '42501';
      end if;
      if p_new_role = 'admin' and not public.is_account_active(v_target_user_id) then
        raise exception 'Only an active account can be promoted to administrator.' using errcode = '42501';
      end if;
      update public.profiles set role = p_new_role where id = v_target_user_id;
  end case;

  if p_report_id is not null and p_action not in ('mark_under_review', 'dismiss_report', 'resolve_report') then
    update public.reports set status = case when status = 'open' then 'under_review' else status end,
      assigned_admin_id = coalesce(assigned_admin_id, v_actor), reviewed_at = coalesce(reviewed_at, now())
    where id = p_report_id;
  end if;

  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'previous_status', case when p_action = 'remove_listing' then v_previous_status else null end,
    'suspension_hours', case when p_action = 'suspend_user' then p_suspension_hours else null end,
    'new_role', case when p_action = 'change_user_role' then p_new_role else null end
  ));

  insert into public.moderation_actions (
    id, report_id, moderator_id, target_user_id, listing_id,
    listing_image_id, message_id, action, reason, internal_note, metadata
  ) values (
    v_action_id, p_report_id, v_actor, v_target_user_id, v_listing_id,
    v_listing_image_id, v_message_id, p_action, btrim(p_reason),
    nullif(btrim(p_internal_note), ''), nullif(v_metadata, '{}'::jsonb)
  );

  if p_action = 'warn_user' then
    insert into public.user_warnings (user_id, moderation_action_id, reason)
    values (v_target_user_id, v_action_id, btrim(p_reason));
  end if;

  return v_action_id;
end;
$$;

revoke all on function public.get_my_admin_profile() from public;
revoke all on function public.admin_get_users(text, text, text, boolean, timestamptz, timestamptz, integer, integer) from public;
revoke all on function public.admin_get_user_by_id(uuid) from public;
revoke all on function public.admin_dashboard_statistics() from public;
revoke all on function public.perform_moderation_action(text, text, text, uuid, uuid, uuid, uuid, uuid, integer, text) from public;
grant execute on function public.get_my_admin_profile() to authenticated;
grant execute on function public.admin_get_users(text, text, text, boolean, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.admin_get_user_by_id(uuid) to authenticated;
grant execute on function public.admin_dashboard_statistics() to authenticated;
grant execute on function public.perform_moderation_action(text, text, text, uuid, uuid, uuid, uuid, uuid, integer, text) to authenticated;

commit;
