begin;

-- Preserve the exact conversation context for user/chat reports. A message report
-- automatically inherits its conversation through the trigger below.
alter table public.reports
  add column if not exists conversation_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reports_conversation_id_fkey'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports add constraint reports_conversation_id_fkey
      foreign key (conversation_id) references public.conversations(id) on delete restrict;
  end if;
end;
$$;

alter table public.reports drop constraint if exists reports_has_target;
alter table public.reports add constraint reports_has_target check (
  reported_user_id is not null or listing_id is not null or
  listing_image_id is not null or message_id is not null or conversation_id is not null
) not valid;
alter table public.reports validate constraint reports_has_target;

create index if not exists reports_conversation_created_idx
  on public.reports(conversation_id, created_at desc);

create or replace function public.sync_report_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare message_conversation_id uuid;
begin
  if new.message_id is not null then
    select m.conversation_id into message_conversation_id
    from public.messages m where m.id = new.message_id;
    if message_conversation_id is null then
      raise exception 'Reported message was not found.' using errcode = '23503';
    end if;
    if new.conversation_id is not null and new.conversation_id <> message_conversation_id then
      raise exception 'Message and conversation do not match.' using errcode = '23514';
    end if;
    new.conversation_id := message_conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_report_conversation_trigger on public.reports;
create trigger sync_report_conversation_trigger
before insert or update of message_id, conversation_id on public.reports
for each row execute function public.sync_report_conversation();

-- Replace the insert policy so a user can only attach a conversation in which
-- they participate, and can only name the other participant as the reported user.
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
      reports.conversation_id is null or exists (
        select 1 from public.conversations c
        where c.id = reports.conversation_id
          and auth.uid() in (c.buyer_id, c.seller_id)
          and (reports.listing_id is null or reports.listing_id = c.listing_id)
          and (
            reports.reported_user_id is null
            or (
              reports.reported_user_id in (c.buyer_id, c.seller_id)
              and reports.reported_user_id <> auth.uid()
            )
          )
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

grant insert (
  reporter_id, reported_user_id, listing_id, listing_image_id,
  message_id, conversation_id, reason, details, priority
) on public.reports to authenticated;

create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null constraint support_cases_user_id_fkey
    references public.profiles(id) on delete restrict,
  subject text not null check (char_length(btrim(subject)) between 3 and 160),
  category text not null check (category in (
    'account', 'listing', 'trade', 'messages', 'technical', 'feedback', 'other'
  )),
  status text not null default 'new' check (status in (
    'new', 'open', 'waiting_for_user', 'resolved', 'closed'
  )),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_admin_id uuid null constraint support_cases_assigned_admin_id_fkey
    references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null constraint support_messages_case_id_fkey
    references public.support_cases(id) on delete restrict,
  sender_id uuid not null constraint support_messages_sender_id_fkey
    references public.profiles(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.support_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null constraint support_case_events_case_id_fkey
    references public.support_cases(id) on delete restrict,
  actor_id uuid not null constraint support_case_events_actor_id_fkey
    references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in (
    'created', 'user_replied', 'staff_replied', 'internal_note',
    'status_changed', 'priority_changed', 'assigned'
  )),
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists support_cases_status_last_message_idx
  on public.support_cases(status, last_message_at desc);
create index if not exists support_cases_user_created_idx
  on public.support_cases(user_id, created_at desc);
create index if not exists support_cases_assigned_status_idx
  on public.support_cases(assigned_admin_id, status, last_message_at desc);
create index if not exists support_messages_case_created_idx
  on public.support_messages(case_id, created_at);
create index if not exists support_case_events_case_created_idx
  on public.support_case_events(case_id, created_at);

alter table public.support_cases enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_case_events enable row level security;

drop policy if exists "Staff can read support cases" on public.support_cases;
create policy "Staff can read support cases" on public.support_cases for select to authenticated
  using (public.is_admin_staff());
drop policy if exists "Users can read own support cases" on public.support_cases;
create policy "Users can read own support cases" on public.support_cases for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Staff can read support messages" on public.support_messages;
create policy "Staff can read support messages" on public.support_messages for select to authenticated
  using (public.is_admin_staff());
drop policy if exists "Users can read own public support messages" on public.support_messages;
create policy "Users can read own public support messages" on public.support_messages for select to authenticated
  using (
    not is_internal and exists (
      select 1 from public.support_cases sc
      where sc.id = case_id and sc.user_id = auth.uid()
    )
  );

drop policy if exists "Staff can read support events" on public.support_case_events;
create policy "Staff can read support events" on public.support_case_events for select to authenticated
  using (public.is_admin_staff());

grant select on public.support_cases, public.support_messages to authenticated;
grant select on public.support_case_events to authenticated;
revoke insert, update, delete on public.support_cases from anon, authenticated;
revoke insert, update, delete on public.support_messages from anon, authenticated;
revoke insert, update, delete on public.support_case_events from anon, authenticated;

drop trigger if exists support_case_events_immutable_trigger on public.support_case_events;
create trigger support_case_events_immutable_trigger
before update or delete on public.support_case_events
for each row execute function public.prevent_audit_mutation();

create or replace function public.create_support_case(
  p_category text,
  p_subject text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_case_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or not public.is_account_active(auth.uid()) then
    raise exception 'An active account is required.' using errcode = '42501';
  end if;
  if p_category not in ('account', 'listing', 'trade', 'messages', 'technical', 'feedback', 'other') then
    raise exception 'Invalid support category.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_subject, ''))) not between 3 and 160 then
    raise exception 'Subject must contain between 3 and 160 characters.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) not between 10 and 5000 then
    raise exception 'Message must contain between 10 and 5000 characters.' using errcode = '22023';
  end if;

  insert into public.support_cases (id, user_id, subject, category)
  values (v_case_id, auth.uid(), btrim(p_subject), p_category);
  insert into public.support_messages (case_id, sender_id, body)
  values (v_case_id, auth.uid(), btrim(p_message));
  insert into public.support_case_events (case_id, actor_id, event_type)
  values (v_case_id, auth.uid(), 'created');
  return v_case_id;
end;
$$;

create or replace function public.reply_to_support_case(
  p_case_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_message_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or not public.is_account_active(auth.uid()) then
    raise exception 'An active account is required.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) not between 1 and 5000 then
    raise exception 'Message must contain between 1 and 5000 characters.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.support_cases sc
    where sc.id = p_case_id and sc.user_id = auth.uid() and sc.status <> 'closed'
  ) then
    raise exception 'Support case not found or closed.' using errcode = '42501';
  end if;

  insert into public.support_messages (id, case_id, sender_id, body)
  values (v_message_id, p_case_id, auth.uid(), btrim(p_message));
  update public.support_cases set
    status = case when status in ('waiting_for_user', 'resolved') then 'open' else status end,
    updated_at = now(), last_message_at = now(), resolved_at = null
  where id = p_case_id;
  insert into public.support_case_events (case_id, actor_id, event_type)
  values (p_case_id, auth.uid(), 'user_replied');
  return v_message_id;
end;
$$;

create or replace function public.admin_reply_support_case(
  p_case_id uuid,
  p_message text,
  p_internal boolean default false,
  p_status text default 'waiting_for_user'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message_id uuid := gen_random_uuid();
  previous_status text;
begin
  if not public.is_admin_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) not between 1 and 5000 then
    raise exception 'Message must contain between 1 and 5000 characters.' using errcode = '22023';
  end if;
  if p_status not in ('new', 'open', 'waiting_for_user', 'resolved', 'closed') then
    raise exception 'Invalid support status.' using errcode = '22023';
  end if;

  select status into previous_status from public.support_cases where id = p_case_id for update;
  if not found then raise exception 'Support case not found.' using errcode = 'P0002'; end if;

  insert into public.support_messages (id, case_id, sender_id, body, is_internal)
  values (v_message_id, p_case_id, auth.uid(), btrim(p_message), p_internal);
  update public.support_cases set
    assigned_admin_id = coalesce(assigned_admin_id, auth.uid()),
    status = case when p_internal then status else p_status end,
    updated_at = now(), last_message_at = now(),
    resolved_at = case
      when not p_internal and p_status in ('resolved', 'closed') then now()
      when not p_internal then null else resolved_at end
  where id = p_case_id;
  insert into public.support_case_events (case_id, actor_id, event_type, metadata)
  values (
    p_case_id, auth.uid(), case when p_internal then 'internal_note' else 'staff_replied' end,
    jsonb_build_object('previous_status', previous_status, 'status', case when p_internal then previous_status else p_status end)
  );
  return v_message_id;
end;
$$;

create or replace function public.admin_update_support_case(
  p_case_id uuid,
  p_status text default null,
  p_priority text default null,
  p_assigned_admin_id uuid default null,
  p_unassign boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_case public.support_cases%rowtype;
begin
  if not public.is_admin_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('new', 'open', 'waiting_for_user', 'resolved', 'closed') then
    raise exception 'Invalid support status.' using errcode = '22023';
  end if;
  if p_priority is not null and p_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Invalid support priority.' using errcode = '22023';
  end if;
  if p_assigned_admin_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = p_assigned_admin_id and p.role in ('moderator', 'admin')
      and public.is_account_active(p.id)
  ) then
    raise exception 'Assigned staff account is invalid.' using errcode = '22023';
  end if;

  select * into current_case from public.support_cases where id = p_case_id for update;
  if not found then raise exception 'Support case not found.' using errcode = 'P0002'; end if;

  update public.support_cases set
    status = coalesce(p_status, status),
    priority = coalesce(p_priority, priority),
    assigned_admin_id = case when p_unassign then null else coalesce(p_assigned_admin_id, assigned_admin_id) end,
    updated_at = now(),
    resolved_at = case
      when p_status in ('resolved', 'closed') then coalesce(resolved_at, now())
      when p_status is not null then null else resolved_at end
  where id = p_case_id;

  if p_status is not null and p_status <> current_case.status then
    insert into public.support_case_events (case_id, actor_id, event_type, metadata)
    values (p_case_id, auth.uid(), 'status_changed', jsonb_build_object('from', current_case.status, 'to', p_status));
  end if;
  if p_priority is not null and p_priority <> current_case.priority then
    insert into public.support_case_events (case_id, actor_id, event_type, metadata)
    values (p_case_id, auth.uid(), 'priority_changed', jsonb_build_object('from', current_case.priority, 'to', p_priority));
  end if;
  if (p_unassign and current_case.assigned_admin_id is not null)
    or (p_assigned_admin_id is not null and p_assigned_admin_id is distinct from current_case.assigned_admin_id) then
    insert into public.support_case_events (case_id, actor_id, event_type, metadata)
    values (p_case_id, auth.uid(), 'assigned', jsonb_build_object('from', current_case.assigned_admin_id, 'to', case when p_unassign then null else p_assigned_admin_id end));
  end if;
end;
$$;

revoke all on function public.create_support_case(text, text, text) from public;
revoke all on function public.reply_to_support_case(uuid, text) from public;
revoke all on function public.admin_reply_support_case(uuid, text, boolean, text) from public;
revoke all on function public.admin_update_support_case(uuid, text, text, uuid, boolean) from public;
grant execute on function public.create_support_case(text, text, text) to authenticated;
grant execute on function public.reply_to_support_case(uuid, text) to authenticated;
grant execute on function public.admin_reply_support_case(uuid, text, boolean, text) to authenticated;
grant execute on function public.admin_update_support_case(uuid, text, text, uuid, boolean) to authenticated;

commit;
