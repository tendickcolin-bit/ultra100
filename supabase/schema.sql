-- Ultra 100: Konten für Freunde
-- Einmal im Supabase-Dashboard unter "SQL Editor" komplett ausführen.
-- Danach ganz unten die E-Mail-Zeile anpassen und ausführen, damit dein Konto Admin wird.

-- 1) Profile: eine Zeile pro Konto. Freigabe, Funktionen und Vorgaben vom Admin.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  is_admin boolean not null default false,
  approved boolean not null default false,
  features jsonb not null default '{}'::jsonb,   -- z. B. {"formcheck": true}
  assigned jsonb not null default '{}'::jsonb,   -- Vorgaben vom Admin: plan, weight, kcal, protein, u (Zeitstempel)
  created_at timestamptz not null default now()
);

-- 2) App-Daten: der komplette Stand der App pro Konto (Essen, Training, Einstellungen).
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_state enable row level security;

-- Hilfsfunktionen (laufen mit Besitzerrechten, damit die Policies nicht rekursiv werden)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select approved or is_admin from public.profiles where id = auth.uid()), false)
$$;

-- Profile: jeder sieht nur sein eigenes, der Admin sieht alle (aber NICHT deren App-Daten).
drop policy if exists "profil lesen" on public.profiles;
create policy "profil lesen" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
-- Ändern darf nur der Admin (Freigabe, Funktionen, Vorgaben). Den eigenen Namen ändert man über set_my_name().
drop policy if exists "profil admin" on public.profiles;
create policy "profil admin" on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- App-Daten: nur das eigene Konto, und erst nach Freigabe. Auch der Admin kommt nicht an fremde Daten.
drop policy if exists "daten lesen" on public.user_state;
create policy "daten lesen" on public.user_state for select using (user_id = auth.uid());
drop policy if exists "daten anlegen" on public.user_state;
create policy "daten anlegen" on public.user_state for insert with check (user_id = auth.uid() and public.is_approved());
drop policy if exists "daten aendern" on public.user_state;
create policy "daten aendern" on public.user_state for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_approved());
drop policy if exists "daten loeschen" on public.user_state;
create policy "daten loeschen" on public.user_state for delete using (user_id = auth.uid());

-- Neues Konto -> Profil automatisch anlegen
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Eigenen Anzeigenamen ändern (ohne Zugriff auf Freigabe/Admin-Felder)
create or replace function public.set_my_name(n text) returns void
language sql security definer set search_path = public as $$
  update public.profiles set name = left(n, 60) where id = auth.uid()
$$;

-- Eigenes Konto samt allen Daten löschen
create or replace function public.delete_me() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid()
$$;

revoke all on function public.set_my_name(text) from public, anon;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.set_my_name(text) to authenticated;
grant execute on function public.delete_me() to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_state to authenticated;

-- 3) Dich zum Admin machen: erst in der App registrieren, dann diese Zeile mit DEINER E-Mail ausführen.
-- update public.profiles set is_admin = true, approved = true, features = '{"formcheck": true}' where email = 'deine@email.de';
