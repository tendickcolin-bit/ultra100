-- Ultra 100: "Passwort vergessen" mit neuem Zufallspasswort per Mail.
-- Einmal im SQL Editor ausführen (ist auch in schema.sql enthalten).
-- Setzt für die E-Mail ein neues Passwort aus 10 Zeichen und legt es kurz in den Nutzer-Metadaten ab,
-- damit die Supabase-Mailvorlage "Reset Password" es mit {{ .Data.temp_pw }} einsetzen kann.
-- Die App löscht es aus den Metadaten, sobald man sich damit anmeldet. Höchstens alle 10 Minuten pro Konto.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.reset_password(p_email text) returns boolean
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  u auth.users;
  chars text := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  pw text := '';
  last timestamptz;
begin
  select * into u from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if not found then return false; end if;
  last := nullif(u.raw_user_meta_data->>'temp_pw_at', '')::timestamptz;
  if last is not null and last > now() - interval '10 minutes' then return false; end if;
  for i in 1..10 loop
    pw := pw || substr(chars, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(chars)), 1);
  end loop;
  update auth.users
     set encrypted_password = extensions.crypt(pw, extensions.gen_salt('bf', 10)),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('temp_pw', pw, 'temp_pw_at', now()),
         updated_at = now()
   where id = u.id;
  return true;
end $$;

revoke all on function public.reset_password(text) from public;
grant execute on function public.reset_password(text) to anon, authenticated;
