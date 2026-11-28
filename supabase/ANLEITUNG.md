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

## Passwort vergessen per Mail (kostenlos über iCloud)

Der eingebaute Mailversand von Supabase schickt nur an Mitglieder deines Supabase-Teams. Damit deine Freunde den Link zum Zurücksetzen bekommen, verschickt Supabase die Mails über dein iCloud-Postfach (kostenlos, bis etwa 1.000 Mails am Tag).

1. **App-spezifisches Passwort:** account.apple.com › Anmelden und Sicherheit › App-spezifische Passwörter › „+“, Name z. B. „Supabase“. Das Passwort (xxxx-xxxx-xxxx-xxxx) kopieren. Dafür muss die Zwei-Faktor-Authentifizierung an sein.
2. **Supabase:** Authentication › Emails › SMTP Settings › „Enable Custom SMTP“ einschalten:
   - Sender email: deine iCloud-Adresse (genau die, mit der du dich bei Apple anmeldest, oder ein iCloud-Alias)
   - Sender name: Ultra 100
   - Host: `smtp.mail.me.com` · Port: `587`
   - Username: deine iCloud-Adresse · Password: das App-spezifische Passwort
   - Speichern.
3. **Optional, Mail auf Deutsch:** Authentication › Emails › Templates › „Reset Password“. Betreff: `Ultra 100: Passwort zurücksetzen`, Text:
   `<p>Tippe auf den Link, um ein neues Passwort für Ultra 100 festzulegen:</p><p><a href="{{ .ConfirmationURL }}">Neues Passwort festlegen</a></p><p>Wenn du das nicht angefordert hast, ignoriere diese Mail.</p>`
4. Testen: in der App abmelden, „Passwort vergessen?“, Mail öffnen, Link antippen, neues Passwort setzen.

Hinweis: Die Mails kommen dann von deiner iCloud-Adresse, deine Freunde sehen sie als Absender.

## Freischaltung

Neue Konten sehen nach der Registrierung nur die Seite „wartet auf Freischaltung“, die App bleibt gesperrt. Wenn du sie unter Einstellungen › „Freunde verwalten“ freischaltest, erscheint bei ihnen „Freigabe erfolgt“, danach richten sie ihr Profil ein. Sperrst du ein Konto wieder, ist die App für diese Person beim nächsten Öffnen wieder zu.
