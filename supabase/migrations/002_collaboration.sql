create extension if not exists pgcrypto;

create table if not exists public.workspace_members (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  member_email text,
  member_name text,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  token_hash text not null unique,
  role text not null check (role in ('viewer', 'editor')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null
);

alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

create or replace function public.workspace_access_role(target_workspace_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when w.owner_id = auth.uid() then 'owner'
    else (
      select wm.role
      from public.workspace_members wm
      where wm.workspace_id = w.id and wm.user_id = auth.uid()
      limit 1
    )
  end
  from public.workspaces w
  where w.id = target_workspace_id;
$$;

revoke all on function public.workspace_access_role(text) from public;
grant execute on function public.workspace_access_role(text) to authenticated;

create or replace function public.prevent_workspace_owner_change()
returns trigger
language plpgsql
as $$
begin
  if old.owner_id <> new.owner_id then
    raise exception 'workspace ownership transfer is not supported';
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_lock_owner on public.workspaces;
create trigger workspaces_lock_owner
before update on public.workspaces
for each row execute function public.prevent_workspace_owner_change();

drop policy if exists "owners can read their workspaces" on public.workspaces;
drop policy if exists "owners can insert their workspaces" on public.workspaces;
drop policy if exists "owners can update their workspaces" on public.workspaces;
drop policy if exists "owners can delete their workspaces" on public.workspaces;

create policy "members can read accessible workspaces"
  on public.workspaces for select
  using (public.workspace_access_role(id) is not null);

create policy "owners can insert workspaces"
  on public.workspaces for insert
  with check (auth.uid() = owner_id);

create policy "owners and editors can update workspaces"
  on public.workspaces for update
  using (public.workspace_access_role(id) in ('owner', 'editor'))
  with check (public.workspace_access_role(id) in ('owner', 'editor'));

create policy "owners can delete workspaces"
  on public.workspaces for delete
  using (public.workspace_access_role(id) = 'owner');

create policy "members can see workspace membership"
  on public.workspace_members for select
  using (public.workspace_access_role(workspace_id) is not null);

create policy "owners manage workspace membership"
  on public.workspace_members for insert
  with check (public.workspace_access_role(workspace_id) = 'owner');

create policy "owners update workspace membership"
  on public.workspace_members for update
  using (public.workspace_access_role(workspace_id) = 'owner')
  with check (public.workspace_access_role(workspace_id) = 'owner');

create policy "owners remove workspace membership"
  on public.workspace_members for delete
  using (public.workspace_access_role(workspace_id) = 'owner');

create policy "owners can inspect their invites"
  on public.workspace_invites for select
  using (public.workspace_access_role(workspace_id) = 'owner');

create policy "owners can revoke their invites"
  on public.workspace_invites for delete
  using (public.workspace_access_role(workspace_id) = 'owner');

create or replace function public.create_workspace_invite(p_workspace_id text, p_role text default 'viewer')
returns table(token text, expires_at timestamptz, role text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invite_token text;
  expiry timestamptz;
begin
  if public.workspace_access_role(p_workspace_id) <> 'owner' then
    raise exception 'only the workspace owner can create invites';
  end if;
  if p_role not in ('viewer', 'editor') then
    raise exception 'invalid workspace role';
  end if;

  invite_token := encode(gen_random_bytes(24), 'hex');
  expiry := now() + interval '7 days';

  insert into public.workspace_invites (workspace_id, token_hash, role, created_by, expires_at)
  values (p_workspace_id, encode(digest(invite_token, 'sha256'), 'hex'), p_role, auth.uid(), expiry);

  return query select invite_token, expiry, p_role;
end;
$$;

revoke all on function public.create_workspace_invite(text, text) from public;
grant execute on function public.create_workspace_invite(text, text) to authenticated;

create or replace function public.accept_workspace_invite(p_token text)
returns table(workspace_id text, role text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invite public.workspace_invites%rowtype;
  user_email text;
  user_name text;
begin
  if auth.uid() is null then
    raise exception 'sign in before accepting an invite';
  end if;

  select * into invite
  from public.workspace_invites wi
  where wi.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and wi.claimed_at is null
    and wi.expires_at > now()
  for update;

  if invite.id is null then
    raise exception 'invite is invalid, expired, or already used';
  end if;

  select email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1))
  into user_email, user_name
  from auth.users
  where id = auth.uid();

  insert into public.workspace_members (workspace_id, user_id, role, member_email, member_name, added_by)
  values (invite.workspace_id, auth.uid(), invite.role, user_email, user_name, invite.created_by)
  on conflict (workspace_id, user_id)
  do update set role = excluded.role, member_email = excluded.member_email, member_name = excluded.member_name;

  update public.workspace_invites
  set claimed_at = now(), claimed_by = auth.uid()
  where id = invite.id;

  return query select invite.workspace_id, invite.role;
end;
$$;

revoke all on function public.accept_workspace_invite(text) from public;
grant execute on function public.accept_workspace_invite(text) to authenticated;

grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, delete on public.workspace_invites to authenticated;
