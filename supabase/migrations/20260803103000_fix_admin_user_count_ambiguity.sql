begin;

-- Qualify reports_received_count so PostgreSQL does not confuse the CTE column
-- with the PL/pgSQL RETURNS TABLE output variable of the same name.
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
    select user_row.*
    from user_rows user_row
    where not p_reported_only or user_row.reports_received_count > 0
  )
  select filtered_row.*, count(*) over() as total_count
  from filtered filtered_row
  order by filtered_row.created_at desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 100);
end;
$$;

revoke all on function public.admin_get_users(
  text, text, text, boolean, timestamptz, timestamptz, integer, integer
) from public;
grant execute on function public.admin_get_users(
  text, text, text, boolean, timestamptz, timestamptz, integer, integer
) to authenticated;

commit;
