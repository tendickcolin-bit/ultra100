/* Supabase-Zugang für Konten und Cloud-Sync.
   Beide Werte stehen im Supabase-Dashboard unter Project Settings › API (bzw. "Data API" und "API Keys").
   Der "anon"/"publishable"-Schlüssel ist öffentlich und darf hier stehen: Die Daten schützt die Row Level Security in der Datenbank.
   NIEMALS den "service_role"/"secret"-Schlüssel hier eintragen.
   Solange beide leer sind, läuft die App wie bisher ohne Konto, nur auf dem Gerät. */
window.U100_CLOUD={
  url:"",
  key:""
};
