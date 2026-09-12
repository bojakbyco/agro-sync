# AgroSync

Mobilna PWA dla hodowców bydła — offline-first ewidencja zdarzeń z walidacją formatów ARiMR/IRZplus.

## Funkcje (MVP)

- **Zgłoszenie wycielenia (WYC)** z walidacją urzędową: numer kolczyka `PL` + 12 cyfr, data max 7 dni wstecz, płeć XX/XY
- **mapToArimrPayload()** — mapowanie formularza na oficjalny ładunek JSON (`kodZdarzenia`, `nrZwierzecia`, `nrMatki`, `dataZdarzenia`, `płeć`)
- **Offline-first (Dexie/IndexedDB)** — dokumenty lądują w tabeli `syncQueue` i czekają na sieć
- **Synchronizacja w tle** — `window.addEventListener('online', …)` odpala `syncWithIRZPlus()` (mock-API), kolejka czyści się po potwierdzeniu
- **Skaner html5-qrcode** — odczyt kodu wstawia 14-znakowy numer automatycznie do formularza
- **PWA (vite-plugin-pwa/Workbox)** — installable, działa bez sieci po pierwszym załadowaniu

## Stack

React 19 · TypeScript · Vite · Tailwind 4 · Dexie 4 · html5-qrcode · Zod · Bun

## Uruchomienie

```sh
bun install
bun run dev
```

Testy: `bun test` · Build: `bun run build`

## Deploy

Push na `main` → GitHub Actions (check + test + build) → Dokku (`agro-sync.dev.jakbyco.com`).
