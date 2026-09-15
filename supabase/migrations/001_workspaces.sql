create table if not exists public.workspaces (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspaces_owner_updated_idx
  on public.workspaces (owner_id, updated_at desc);

alter table public.workspaces enable row level security;

create policy "owners can read their workspaces"
  on public.workspaces
  for select
  using (auth.uid() = owner_id);

create policy "owners can insert their workspaces"
  on public.workspaces
  for insert
  with check (auth.uid() = owner_id);

create policy "owners can update their workspaces"
  on public.workspaces
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "owners can delete their workspaces"
  on public.workspaces
  for delete
  using (auth.uid() = owner_id);

revoke all on public.workspaces from anon;
grant select, insert, update, delete on public.workspaces to authenticated;
