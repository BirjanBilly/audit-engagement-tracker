-- Audit Engagement Tracker: complete migration-ready schema.
-- API-support tables/functions are created in Act 1 intentionally so the Act 2
-- project migration captures the whole database design and later cutover
-- requires configuration changes only.

create extension if not exists pgcrypto with schema extensions;

create type public.engagement_status as enum (
  'planning',
  'fieldwork',
  'review',
  'complete'
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  fiscal_year_end date,
  created_at timestamptz not null default now(),
  constraint clients_name_not_blank check (length(btrim(name)) > 0),
  constraint clients_country_iso2 check (country is null or country ~ '^[A-Z]{2}$')
);

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  status public.engagement_status not null default 'planning',
  created_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  hours numeric(8, 2) not null,
  entry_date date not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint time_entries_hours_positive check (hours > 0)
);

-- Deterministic import keys are kept outside the required business tables.
create table public.seed_client_keys (
  client_key text primary key,
  client_id uuid not null unique references public.clients(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.seed_import_rows (
  source_row_hash text primary key,
  source_file text not null,
  raw_row jsonb not null,
  issues jsonb not null default '[]'::jsonb,
  outcome text not null,
  source_line integer,
  client_id uuid references public.clients(id) on delete set null,
  engagement_id uuid references public.engagements(id) on delete set null,
  time_entry_id uuid references public.time_entries(id) on delete set null,
  imported_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.api_rate_limit_windows (
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (api_key_id, window_start),
  constraint api_rate_limit_count_nonnegative check (request_count >= 0)
);

create table public.api_idempotency_records (
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  idempotency_key_hash text not null,
  request_hash text not null,
  response_status integer not null,
  response_body jsonb not null,
  time_entry_id uuid references public.time_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (api_key_id, idempotency_key_hash)
);

create index clients_country_idx on public.clients(country);
create index clients_created_at_id_idx on public.clients(created_at, id);
create index engagements_client_id_idx on public.engagements(client_id);
create index engagements_status_created_at_id_idx on public.engagements(status, created_at, id);
create index engagements_created_at_id_idx on public.engagements(created_at, id);
create index time_entries_engagement_id_idx on public.time_entries(engagement_id);
create index time_entries_entry_date_idx on public.time_entries(entry_date);
create index seed_import_rows_outcome_idx on public.seed_import_rows(outcome);
create index api_rate_limit_windows_created_idx on public.api_rate_limit_windows(window_start);
create index api_idempotency_records_created_idx on public.api_idempotency_records(created_at);

alter table public.clients enable row level security;
alter table public.engagements enable row level security;
alter table public.time_entries enable row level security;
alter table public.seed_client_keys enable row level security;
alter table public.seed_import_rows enable row level security;
alter table public.user_preferences enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_rate_limit_windows enable row level security;
alter table public.api_idempotency_records enable row level security;

revoke all on public.clients from anon, authenticated;
revoke all on public.engagements from anon, authenticated;
revoke all on public.time_entries from anon, authenticated;
revoke all on public.seed_client_keys from anon, authenticated;
revoke all on public.seed_import_rows from anon, authenticated;
revoke all on public.user_preferences from anon, authenticated;
revoke all on public.api_keys from anon, authenticated;
revoke all on public.api_rate_limit_windows from anon, authenticated;
revoke all on public.api_idempotency_records from anon, authenticated;

grant select on public.clients to anon;
grant select, insert, update, delete on public.clients, public.engagements, public.time_entries to authenticated;
grant select, insert, update on public.user_preferences to authenticated;

-- The service-role client is server-only and needs explicit table privileges in
-- addition to bypassing RLS. Keeping these grants explicit makes the API
-- dependency visible in the migration.
grant all on public.seed_client_keys, public.seed_import_rows, public.api_keys,
  public.api_rate_limit_windows, public.api_idempotency_records to service_role;
grant select, insert, update, delete on public.clients, public.engagements,
  public.time_entries, public.user_preferences to service_role;

create policy clients_anon_select on public.clients for select to anon using (true);
create policy clients_authenticated_all on public.clients for all to authenticated using (true) with check (true);
create policy engagements_authenticated_all on public.engagements for all to authenticated using (true) with check (true);
create policy time_entries_authenticated_all on public.time_entries for all to authenticated using (true) with check (true);
create policy user_preferences_select_own on public.user_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy user_preferences_insert_own on public.user_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_preferences_update_own on public.user_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Database-atomic fixed-window rate limiting.
create or replace function public.consume_api_rate_limit(
  p_api_key_id uuid,
  p_limit integer default 60
)
returns table (allowed boolean, remaining integer, reset_epoch bigint, observed_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz := date_trunc('minute', clock_timestamp());
  v_count integer;
begin
  if p_limit < 1 then
    raise exception 'rate limit must be positive';
  end if;

  insert into public.api_rate_limit_windows (api_key_id, window_start, request_count)
  values (p_api_key_id, v_window_start, 1)
  on conflict (api_key_id, window_start)
  do update set request_count = public.api_rate_limit_windows.request_count + 1
  returning request_count into v_count;

  delete from public.api_rate_limit_windows
  where api_key_id = p_api_key_id
    and window_start < v_window_start - interval '1 day';

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    extract(epoch from (v_window_start + interval '1 minute'))::bigint,
    v_count;
end;
$$;

-- Stable cursor pagination implemented in SQL.
create or replace function public.list_api_clients(
  p_limit integer,
  p_country text default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (id uuid, name text, country text, fiscal_year_end date, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.name, c.country, c.fiscal_year_end, c.created_at
  from public.clients c
  where (p_country is null or c.country = p_country)
    and (
      p_cursor_created_at is null
      or c.created_at > p_cursor_created_at
      or (c.created_at = p_cursor_created_at and p_cursor_id is not null and c.id > p_cursor_id)
    )
  order by c.created_at asc, c.id asc
  limit p_limit;
$$;

create or replace function public.get_client_summary(p_client_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'client_id', c.id,
    'total_hours', coalesce((
      select sum(te.hours)
      from public.engagements e
      join public.time_entries te on te.engagement_id = e.id
      where e.client_id = c.id
    ), 0),
    'engagement_counts', jsonb_build_object(
      'planning', (select count(*) from public.engagements e where e.client_id = c.id and e.status = 'planning'),
      'fieldwork', (select count(*) from public.engagements e where e.client_id = c.id and e.status = 'fieldwork'),
      'review', (select count(*) from public.engagements e where e.client_id = c.id and e.status = 'review'),
      'complete', (select count(*) from public.engagements e where e.client_id = c.id and e.status = 'complete')
    )
  )
  from public.clients c
  where c.id = p_client_id;
$$;

-- Atomic idempotent time-entry creation.
create or replace function public.create_time_entry_idempotent(
  p_api_key_id uuid,
  p_idempotency_key_hash text,
  p_request_hash text,
  p_engagement_id uuid,
  p_hours numeric,
  p_entry_date date,
  p_description text
)
returns table (outcome text, response_status integer, response_body jsonb, replayed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.api_idempotency_records%rowtype;
  v_entry public.time_entries%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_api_key_id::text || ':' || p_idempotency_key_hash, 0));

  select * into v_existing
  from public.api_idempotency_records
  where api_key_id = p_api_key_id and idempotency_key_hash = p_idempotency_key_hash;

  if found then
    if v_existing.request_hash <> p_request_hash then
      return query select 'conflict', 409, null::jsonb, false;
      return;
    end if;
    return query select 'replayed', v_existing.response_status, v_existing.response_body, true;
    return;
  end if;

  if not exists (select 1 from public.engagements where id = p_engagement_id) then
    return query select 'not_found', 404, null::jsonb, false;
    return;
  end if;

  insert into public.time_entries (engagement_id, hours, entry_date, description)
  values (p_engagement_id, p_hours, p_entry_date, coalesce(p_description, ''))
  returning * into v_entry;

  insert into public.api_idempotency_records (
    api_key_id, idempotency_key_hash, request_hash, response_status, response_body, time_entry_id
  ) values (
    p_api_key_id,
    p_idempotency_key_hash,
    p_request_hash,
    201,
    jsonb_build_object('data', to_jsonb(v_entry)),
    v_entry.id
  );

  return query select 'created', 201, jsonb_build_object('data', to_jsonb(v_entry)), false;
end;
$$;

revoke all on function public.consume_api_rate_limit(uuid, integer) from public, anon, authenticated;
revoke all on function public.list_api_clients(integer, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.get_client_summary(uuid) from public, anon, authenticated;
revoke all on function public.create_time_entry_idempotent(uuid, text, text, uuid, numeric, date, text) from public, anon, authenticated;

grant execute on function public.consume_api_rate_limit(uuid, integer) to service_role;
grant execute on function public.list_api_clients(integer, text, timestamptz, uuid) to service_role;
grant execute on function public.get_client_summary(uuid) to service_role;
grant execute on function public.create_time_entry_idempotent(uuid, text, text, uuid, numeric, date, text) to service_role;
