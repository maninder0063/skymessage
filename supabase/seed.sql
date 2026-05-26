-- Seed data for local development.
-- Creates two demo users and a few messages so the desktop client has
-- something to show on first unlock.

insert into public.users (id, handle, display_name, email, timezone, theme)
values
    ('11111111-1111-1111-1111-111111111111', 'demo',  'Demo User',  'demo@skymessage.local',  'America/Los_Angeles', 'classic'),
    ('22222222-2222-2222-2222-222222222222', 'alice', 'Alice Park', 'alice@skymessage.local', 'America/Los_Angeles', 'sunset'),
    ('33333333-3333-3333-3333-333333333333', 'bob',   'Bob Singh',  'bob@skymessage.local',   'America/New_York',    'retro')
on conflict (handle) do nothing;

-- A few messages for "demo" from Alice and Bob, all immediately eligible
insert into public.messages (sender_id, sender_display_name, recipient_id, body, scheduled_delivery_at)
values
    ('22222222-2222-2222-2222-222222222222', 'Alice Park',
     '11111111-1111-1111-1111-111111111111', 'Lunch tomorrow?', now() - interval '5 minutes'),
    ('33333333-3333-3333-3333-333333333333', 'Bob Singh',
     '11111111-1111-1111-1111-111111111111', 'deploy survived', now() - interval '2 minutes'),
    ('33333333-3333-3333-3333-333333333333', 'Bob Singh',
     '11111111-1111-1111-1111-111111111111', 'coffee?',         now() - interval '1 minute'),
    -- One scheduled for the future so it should NOT show up yet
    ('22222222-2222-2222-2222-222222222222', 'Alice Park',
     '11111111-1111-1111-1111-111111111111', 'happy birthday!', now() + interval '7 days');
