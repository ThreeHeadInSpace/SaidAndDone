# Said & Done

**Say it once. Get it done.**

Said & Done is a mobile-first progressive web app for capturing tasks, events, and sticky notes — by voice or keyboard — and keeping them visible until they are done. Everything stays on your device.

## Product pitch

Most to-do apps make you *type into boxes*. Said & Done starts from speech: tap the mic, speak naturally in **English or Russian** (“tomorrow at 3 call mom”, “встречу в пятницу в 10”), review the parsed draft, and save. A week picker keeps each day honest; a real completion chart and Summary panel show what you actually finished.

Ideal for: quick capture on the go, bilingual households, and installing on an iPhone Home Screen as a lightweight standalone app.

## Features

- **Onboarding** — first-launch walkthrough (dictate → smart day → Add to Home Screen tip)
- **Tasks** — dated, filtered by selected day, full create / edit / complete / delete
- **Events** — CRUD list for birthdays, meetings, and plans
- **Notes** — colorful sticky board with edit / delete
- **Summary** — live stats from your local data (week done, open, urgent, notes, upcoming events)
- **Week chart** — real completed-task counts (not placeholders)
- **Voice capture** — `SpeechRecognition` / `webkitSpeechRecognition`, recording UI, EN+RU natural-language parse for date / type / time / urgency, review sheet before save, type fallback
- **PWA** — manifest, icons, apple-touch-icon, offline service worker cache

## Local run

```bash
# from repo root
npx --yes serve web -p 4173
# or
python3 -m http.server 4173 --directory web
```

Open http://localhost:4173

> Tip: microphone / speech APIs need a **secure context** (HTTPS or `localhost`).

## Install on iPhone

1. Open the live site (or your local tunnel) in **Safari**.
2. Tap **Share** → **Add to Home Screen**.
3. Confirm the name **Said & Done**.
4. Launch from the Home Screen icon for a standalone, full-screen experience.

Offline: the service worker caches the app shell so previously loaded pages still open without network.

## Walkthrough

1. Finish (or skip) onboarding.
2. Use the **week picker** to select a day — the task list filters to that date.
3. Tap **Add** or **Add a task** to create a dated task with time + urgency.
4. Tap a task title to edit; tap the circle to complete; tap × to delete.
5. Hold the purple **mic** — speak e.g. `urgent buy milk tomorrow at 5` or `заметку подарок для Анны` — stop, review, save.
6. Open **Events** / **Notes** / **Summary** from the bottom nav.
7. Watch the **Completed tasks** chart update as you check things off.

## Safari / speech caveats

- Speech recognition on iOS Safari requires **HTTPS** (or localhost) and an explicit mic permission grant.
- Language follows the browser locale (`ru-RU` vs `en-US`); mixed-language utterances still parse common date/time/urgency phrases in both languages.
- Recognition quality varies by device and network; if speech fails, use **Type instead** on the voice sheet.
- Chrome desktop generally offers more reliable continuous recognition than Safari.

## Deploy

GitHub Pages deploys the `web/` folder from `main` via `.github/workflows/deploy-pages.yml` (or the Pages workflow in `.github/workflows/`). Push to `main` to publish.

## Stack

Static vanilla HTML / CSS / ES modules. No build step. Data in `localStorage` (`said-done-v2`).
