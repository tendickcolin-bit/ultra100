# Konten einrichten (einmalig, ca. 10 Minuten)

1. **Projekt anlegen:** supabase.com › New project. Region: Frankfurt (eu-central-1). Passwort für die Datenbank sicher ablegen, die App braucht es nicht.
2. **Datenbank:** links „SQL Editor“ › „New query“, den kompletten Inhalt von `supabase/schema.sql` einfügen, „Run“.
3. **E-Mail-Bestätigung aus:** Authentication › Sign In / Providers › Email › „Confirm email“ ausschalten, speichern.
   Der Gratis-Mailversand von Supabase schickt nur an Mitglieder deines Supabase-Teams, deine Freunde bekämen keine Mail.
   Sicher bleibt es trotzdem: Neue Konten können erst synchronisieren, wenn du sie in der App freischaltest.
4. **Adresse der App:** Authentication › URL Configuration › Site URL = `https://tendickcolin-bit.github.io/ultra100/`
5. **Schlüssel:** Project Settings › API (bzw. „Data API“ und „API Keys“): „Project URL“ und den **anon / publishable** Key in `config.js` eintragen.
   Niemals den service_role / secret Key verwenden.
6. **In der App registrieren**, Daten übernehmen (Backup wird vorher gesichert).
7. **Dich zum Admin machen:** im SQL Editor ausführen (deine E-Mail einsetzen):
   `update public.profiles set is_admin = true, approved = true, features = '{"formcheck": true}' where email = 'deine@email.de';`
8. App neu öffnen. Unter Einstellungen siehst du jetzt „Freunde verwalten“.

Freunde: Link schicken, sie registrieren sich, du tippst bei ihnen auf „Freischalten“.
Hinweis: Ein Gratis-Projekt pausiert nach 7 Tagen ohne Nutzung. Bei täglicher Nutzung passiert das nicht; sonst im Dashboard auf „Restore“.
