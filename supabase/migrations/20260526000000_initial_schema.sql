-- =====================================================================
-- SkyMessage initial schema
-- =====================================================================
-- Tables: users, messages, blocked_users, settings, devices, rate_limits
-- All times stored as timestamptz (UTC). Conversions happen in app code.
-- RLS is enabled on every table; the API server uses the service role to
-- bypass RLS when it has its own authorization layer.
-- =====================================================================

create extension if not exists "pgcrypto" with schema public;
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------
create table if not exists public.users (
    id                  uuid primary key default gen_random_uuid(),
    auth_user_id        uuid unique,                              -- maps to auth.users.id
    handle              text unique not null
                        check (handle ~ '^[a-z0-9][a-z0-9_-]{1,29}$'),
    display_name        text not null,
    email               text unique,
    avatar_url          text,
    timezone            text not null default 'UTC',              -- IANA tz, e.g. 'America/Los_Angeles'
    theme               text not null default 'classic'           -- airplane skin
                        check (theme in ('classic','sunset','retro','minimal','birthday')),
    is_admin            boolean not null default false,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists users_handle_trgm_idx on public.users using gin (handle gin_trgm_ops);

-- ---------------------------------------------------------------------
-- MESSAGES
-- ---------------------------------------------------------------------
create table if not exists public.messages (
    id                       uuid primary key default gen_random_uuid(),
    sender_id                uuid references public.users(id) on delete set null,
    sender_display_name      text not null,                       -- snapshot for anonymous + history
    recipient_id             uuid not null references public.users(id) on delete cascade,
    body                     text not null check (char_length(body) between 1 and 80),
    scheduled_delivery_at    timestamptz not null default now(),
    delivered_at             timestamptz,
    read_at                  timestamptz,
    is_anonymous             boolean not null default false,
    sender_ip_hash           text,                                -- sha256(ip+salt), for abuse only
    created_at               timestamptz not null default now()
);

create index if not exists messages_recipient_pending_idx
    on public.messages (recipient_id, scheduled_delivery_at)
    where delivered_at is null;

create index if not exists messages_sender_idx
    on public.messages (sender_id, created_at desc);

create index if not exists messages_recipient_history_idx
    on public.messages (recipient_id, created_at desc);

-- ---------------------------------------------------------------------
-- BLOCKED USERS
-- ---------------------------------------------------------------------
create table if not exists public.blocked_users (
    id                  uuid primary key default gen_random_uuid(),
    blocker_id          uuid not null references public.users(id) on delete cascade,
    blocked_user_id     uuid references public.users(id) on delete cascade,
    blocked_handle      text,                                     -- block by handle for not-yet-registered senders
    blocked_email       text,                                     -- block by email
    reason              text,
    created_at          timestamptz not null default now(),
    constraint blocked_users_has_target check (
        blocked_user_id is not null or blocked_handle is not null or blocked_email is not null
    )
);

create unique index if not exists blocked_users_unique_pair
    on public.blocked_users (blocker_id, coalesce(blocked_user_id::text, ''), coalesce(blocked_handle, ''), coalesce(blocked_email, ''));

-- ---------------------------------------------------------------------
-- SETTINGS  (one row per user)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
    user_id                     uuid primary key references public.users(id) on delete cascade,
    allowed_senders_only        boolean not null default false,
    animations_paused_until     timestamptz,
    quiet_hours_start           smallint check (quiet_hours_start between 0 and 23),
    quiet_hours_end             smallint check (quiet_hours_end between 0 and 23),
    work_hours_start            smallint not null default 9 check (work_hours_start between 0 and 23),
    work_hours_end              smallint not null default 18 check (work_hours_end between 0 and 23),
    max_queue_per_unlock        smallint not null default 5 check (max_queue_per_unlock between 1 and 20),
    profanity_strict            boolean not null default true,
    updated_at                  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- DEVICES  (Electron clients that poll for this user)
-- ---------------------------------------------------------------------
create table if not exists public.devices (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references public.users(id) on delete cascade,
    device_id           text not null,                            -- stable installation id
    platform            text not null check (platform in ('windows','macos','linux')),
    app_version         text,
    last_seen_at        timestamptz not null default now(),
    created_at          timestamptz not null default now(),
    unique (user_id, device_id)
);

create index if not exists devices_user_idx on public.devices (user_id, last_seen_at desc);

-- ---------------------------------------------------------------------
-- RATE LIMITS  (per-sender daily counters)
-- ---------------------------------------------------------------------
create table if not exists public.rate_limits (
    id                  uuid primary key default gen_random_uuid(),
    sender_identifier   text not null,                            -- handle OR ip_hash for anonymous
    recipient_id        uuid not null references public.users(id) on delete cascade,
    day                 date not null default current_date,
    count               integer not null default 0,
    last_sent_at        timestamptz not null default now(),
    unique (sender_identifier, recipient_id, day)
);

create index if not exists rate_limits_lookup_idx
    on public.rate_limits (sender_identifier, recipient_id, day);

-- ---------------------------------------------------------------------
-- AUTO-UPDATE updated_at triggers
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists users_touch_updated on public.users;
create trigger users_touch_updated
    before update on public.users
    for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch_updated on public.settings;
create trigger settings_touch_updated
    before update on public.settings
    for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- AUTO-CREATE settings row when a user is created
-- ---------------------------------------------------------------------
create or replace function public.create_default_settings()
returns trigger language plpgsql as $$
begin
    insert into public.settings (user_id) values (new.id)
    on conflict (user_id) do nothing;
    return new;
end;
$$;

drop trigger if exists users_create_settings on public.users;
create trigger users_create_settings
    after insert on public.users
    for each row execute function public.create_default_settings();

-- ---------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.users          enable row level security;
alter table public.messages       enable row level security;
alter table public.blocked_users  enable row level security;
alter table public.settings       enable row level security;
alter table public.devices        enable row level security;
alter table public.rate_limits    enable row level security;

-- USERS: anyone can read public profile fields, owner can update.
drop policy if exists users_select_public on public.users;
create policy users_select_public on public.users
    for select using (true);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
    for update using (auth.uid() = auth_user_id);

drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users
    for insert with check (auth.uid() = auth_user_id);

-- MESSAGES: recipient sees their own; senders see what they sent.
-- The API server uses service role and applies its own rules.
drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages
    for select using (
        exists (select 1 from public.users u
                where u.id = messages.recipient_id and u.auth_user_id = auth.uid())
        or exists (select 1 from public.users u
                   where u.id = messages.sender_id and u.auth_user_id = auth.uid())
    );

-- SETTINGS: owner only.
drop policy if exists settings_select_own on public.settings;
create policy settings_select_own on public.settings
    for select using (
        exists (select 1 from public.users u
                where u.id = settings.user_id and u.auth_user_id = auth.uid())
    );

drop policy if exists settings_update_own on public.settings;
create policy settings_update_own on public.settings
    for update using (
        exists (select 1 from public.users u
                where u.id = settings.user_id and u.auth_user_id = auth.uid())
    );

-- BLOCKED_USERS: owner only.
drop policy if exists blocked_select_own on public.blocked_users;
create policy blocked_select_own on public.blocked_users
    for select using (
        exists (select 1 from public.users u
                where u.id = blocked_users.blocker_id and u.auth_user_id = auth.uid())
    );

drop policy if exists blocked_modify_own on public.blocked_users;
create policy blocked_modify_own on public.blocked_users
    for all using (
        exists (select 1 from public.users u
                where u.id = blocked_users.blocker_id and u.auth_user_id = auth.uid())
    );

-- DEVICES: owner only.
drop policy if exists devices_select_own on public.devices;
create policy devices_select_own on public.devices
    for select using (
        exists (select 1 from public.users u
                where u.id = devices.user_id and u.auth_user_id = auth.uid())
    );

drop policy if exists devices_modify_own on public.devices;
create policy devices_modify_own on public.devices
    for all using (
        exists (select 1 from public.users u
                where u.id = devices.user_id and u.auth_user_id = auth.uid())
    );

-- RATE_LIMITS: never exposed to client.
-- (No policies = no access from anon/auth roles; service role bypasses RLS.)
