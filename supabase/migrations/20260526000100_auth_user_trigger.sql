-- =====================================================================
-- Auth bridge: keep auth.users <-> public.users in sync.
-- =====================================================================
-- 1. When a new auth.users row is inserted (via Supabase signup), if the
--    raw_user_meta_data contains `handle` and `display_name`, create the
--    matching public.users row. This is a fallback — clients normally
--    call POST /api/auth/init-bootstrap immediately after signup, which
--    does the same thing with collision checking.
-- 2. When an auth.users row is deleted, cascade the public.users delete.
-- =====================================================================

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_handle text;
  v_display_name text;
begin
  v_handle := nullif(lower(coalesce(new.raw_user_meta_data ->> 'handle', '')), '');
  v_display_name := nullif(coalesce(new.raw_user_meta_data ->> 'display_name', ''), '');

  if v_handle is null or v_display_name is null then
    return new;
  end if;

  -- Handle collision: skip silently. The init-bootstrap endpoint will
  -- surface a friendlier error to the client.
  if exists (select 1 from public.users where handle = v_handle) then
    return new;
  end if;

  insert into public.users (auth_user_id, handle, display_name, email)
  values (new.id, v_handle, v_display_name, new.email)
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Auto-delete public.users when auth.users is deleted (GDPR-friendly).
create or replace function public.handle_deleted_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.users where auth_user_id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_deleted_auth_user();
