
-- Events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  cover_image_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'UTC',
  venue text,
  online_url text,
  capacity integer,
  location text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index events_starts_at_idx on public.events (starts_at);

alter table public.events enable row level security;

create policy "Events are viewable by everyone"
  on public.events for select
  using (true);

create policy "Authenticated users can create events"
  on public.events for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Hosts can update their events"
  on public.events for update
  to authenticated
  using (auth.uid() = created_by);

create policy "Hosts can delete their events"
  on public.events for delete
  to authenticated
  using (auth.uid() = created_by);

-- RSVPs
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index rsvps_user_idx on public.rsvps (user_id);
create index rsvps_event_idx on public.rsvps (event_id);

alter table public.rsvps enable row level security;

create policy "Users can view their own rsvps"
  on public.rsvps for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Hosts can view rsvps for their events"
  on public.rsvps for select
  to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid()));

create policy "Users can create their own rsvps"
  on public.rsvps for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own rsvps"
  on public.rsvps for delete
  to authenticated
  using (auth.uid() = user_id);
