-- ============================================================
-- HouseTables — Supabase schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) primary key,
  email text,
  display_name text,
  chips bigint default 100000,
  total_wagered bigint default 0,
  total_won bigint default 0,
  is_admin boolean default false,
  is_banned boolean default false,
  invite_code text unique,
  invited_by uuid references public.profiles(id),
  last_login timestamptz,
  created_at timestamptz default now()
);

-- game_sessions table
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  game text, -- 'blackjack', 'poker', 'roulette'
  chips_wagered bigint default 0,
  chips_won bigint default 0,
  net bigint default 0,
  created_at timestamptz default now()
);

-- invite_rewards table
create table public.invite_rewards (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid references public.profiles(id),
  invitee_id uuid references public.profiles(id),
  reward_chips bigint default 5000,
  granted_at timestamptz default now()
);

-- game_rooms table (tracks active multiplayer sessions for admin spectating)
create table public.game_rooms (
  code text primary key,
  game text not null,
  host_id uuid references public.profiles(id),
  host_name text,
  guest_name text,
  status text default 'waiting',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.game_rooms enable row level security;

create policy "Hosts can manage own rooms" on public.game_rooms
  for all using (auth.uid() = host_id);

create policy "Service role can do everything on rooms" on public.game_rooms
  for all using (auth.role() = 'service_role');

-- friendships table (bidirectional: A→B and B→A both stored)
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  friend_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, friend_id)
);

alter table public.friendships enable row level security;

create policy "Users can view own friendships" on public.friendships
  for select using (auth.uid() = user_id);
create policy "Users can insert own friendships" on public.friendships
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own friendships" on public.friendships
  for delete using (auth.uid() = user_id);
create policy "Service role can do everything on friendships" on public.friendships
  for all using (auth.role() = 'service_role');

-- admin_settings table
create table public.admin_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- insert default settings
insert into public.admin_settings (key, value) values ('refill_enabled', 'true');

-- RLS policies
alter table public.profiles enable row level security;
alter table public.game_sessions enable row level security;
alter table public.invite_rewards enable row level security;
alter table public.admin_settings enable row level security;

create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Users can view own sessions" on public.game_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on public.game_sessions for insert with check (auth.uid() = user_id);

create policy "Users can view own rewards" on public.invite_rewards for select using (auth.uid() = inviter_id or auth.uid() = invitee_id);

create policy "Anyone can read settings" on public.admin_settings for select using (true);

-- Service role bypass (for admin operations via API routes)
-- Admin can read all profiles
create policy "Service role can do everything on profiles" on public.profiles
  for all using (auth.role() = 'service_role');

create policy "Service role can do everything on sessions" on public.game_sessions
  for all using (auth.role() = 'service_role');

create policy "Service role can do everything on rewards" on public.invite_rewards
  for all using (auth.role() = 'service_role');

create policy "Service role can manage settings" on public.admin_settings
  for all using (auth.role() = 'service_role');

-- ============================================================
-- Sports betting tables
-- Run this snippet in Supabase SQL editor to add sports betting
-- ============================================================

create table public.sports_events (
  id uuid default gen_random_uuid() primary key,
  sport text not null,
  title text not null,
  description text,
  options jsonb not null default '[]',
  closes_at timestamptz,
  event_date timestamptz,
  result_option_id text,
  status text not null default 'open',
  created_at timestamptz default now()
);

create table public.sports_bets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  event_id uuid references public.sports_events(id) not null,
  option_id text not null,
  option_label text not null,
  chips_wagered integer not null check (chips_wagered > 0),
  chips_won integer,
  settled boolean default false,
  won boolean,
  created_at timestamptz default now(),
  unique(user_id, event_id)
);

alter table public.sports_events enable row level security;
alter table public.sports_bets enable row level security;

create policy "Sports events public read" on public.sports_events for select using (true);
create policy "Sports bets own read" on public.sports_bets for select using (auth.uid() = user_id);
create policy "Sports bets own insert" on public.sports_bets for insert with check (auth.uid() = user_id);
create policy "Service role manages sports events" on public.sports_events for all using (auth.role() = 'service_role');
create policy "Service role manages sports bets" on public.sports_bets for all using (auth.role() = 'service_role');
