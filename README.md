# Ultra 100

Persönliche Web-App (PWA) für Ernährung und Training auf dem Weg zum 100-km-Lauf am 4. September 2027.

- Essen und Training per Text oder iPhone-Diktat eintragen, lokale Erkennung ohne API-Key
- 34 Nährwerte (alle Vitamine, Mineralstoffe, Omega-3) gegen DGE/EFSA-Ziele und Obergrenzen
- Tägliche Trainingsvorschläge: 41-Wochen-Plan als Orientierung, angepasst an das, was wirklich trainiert wurde
- Über 7.000 Lebensmittel aus dem Bundeslebensmittelschlüssel 4.0 (offline), Markenprodukte und Barcode-Scan über Open Food Facts, eigene Lebensmittel anlegen
- Ohne Konten: Daten bleiben nur im Browser des Geräts (localStorage), Backup per Export
- Mit Konten (Supabase, kostenlos, `config.js` ausgefüllt): Anmeldung, eigene Daten pro Konto in der Cloud (Row Level Security), Admin schaltet Freunde und Funktionen frei. Einrichtung: `supabase/ANLEITUNG.md`

Statische Dateien, keine Build-Schritte. Läuft auf GitHub Pages.

## Datenquellen

- `bls.json`: Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche Nährstoffdatenbank. Karlsruhe. DOI: [10.25826/Data20251217-134202-0](https://doi.org/10.25826/Data20251217-134202-0). Lizenz [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de). Auf die Nährstoffe der App umgerechnet mit `tools/bls_build.py` (Download: https://blsdb.de/download). Selen, Cholin, Polyphenole, Lutein, Lycopin und Kreatin enthält der BLS nicht; die App schätzt sie aus dem ähnlichsten eigenen Lebensmittel.
- Markenprodukte: [Open Food Facts](https://world.openfoodfacts.org) (ODbL).
- `vendor/zxing.min.js`: [ZXing für JavaScript](https://github.com/zxing-js/library) 0.21.3 (MIT), nur geladen, wenn das iPhone keinen eingebauten Barcode-Leser hat.
