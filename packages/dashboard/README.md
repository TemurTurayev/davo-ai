# Davo-AI · Doctor Dashboard

Next.js 16 + React 19 + Tailwind 4. Главная страница — список пациентов с риск-скорами; детали по пациенту; alerts.

## Quick start

```bash
cd packages/dashboard
pnpm install
pnpm dev   # http://localhost:3000
```

Данные тянутся из `/data/synthetic/cohort.json` (синтетика). В продакшне заменить на DB.

## Roadmap

- [ ] Clerk auth (`@clerk/nextjs`)
- [ ] Real-time updates через Supabase Realtime
- [ ] Review queue (видео ожидающие manual проверки)
- [ ] Outreach генератор (LLM-сгенерированные SMS пациентам)
- [ ] FHIR export для интеграции с DMED
