# SafeCity website

Eight-page marketing, trust, and legal website for the SafeCity mobile app.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Routes

- `/` — home
- `/features` — product features
- `/how-it-works` — safety flow
- `/safety` — trust, model limits, and privacy architecture
- `/download` — app availability and setup
- `/feedback` — redirects to the SafeCity Google feedback form
- `/credits` — StackOverHack profiles and the core SafeCity team
- `/privacy` — privacy notice
- `/terms` — terms and conditions
- `/data-rights` — user data controls

APK downloads point to the current Buildshare release. Support can be configured
with `NEXT_PUBLIC_SUPPORT_URL`. The website accurately labels the app as a
pre-release prototype.
