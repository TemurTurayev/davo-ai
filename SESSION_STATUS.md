# TB Control · Session Status (resume context after compaction)

**Date**: 2026-04-28
**Repo**: https://github.com/TemurTurayev/davo-ai
**HEAD**: `fe23946` (synced with remote)
**Project**: TB Control — AI-assisted TB treatment monitoring (Telegram Mini App)
**Team**: MindTech (Темур, Дилшода, Мухаммад, Саида)
**Hackathon**: AI HEALTH 2026, CAU Tashkent

---

## ✅ Что сделано

### Brand & Architecture
- **Name**: TB Control (был Davo-AI → Nafas → TB Control)
- **Telegram bot**: `@tb_control_bot` (id 8554470997, token в `.env` gitignored)
- **Stack**: Next.js 16 + React 19 + Tailwind v4 + next-intl + Telegram WebApp SDK + Zustand
- **3 языка**: uz (primary), ru, en — next-intl, locale-prefix as-needed
- **Architecture**: Telegram Mini App (web-first), bot — тонкий launcher (TBD)
- **Inference**: vast.ai RTX 5090 (Slovenia, $0.589/hr)

### Brand identity (синтез research)
- **Palette**: Teal `#0EA5A4` · Apricot `#F59E5B` · Coral danger `#EF4444` · Mint success `#10B981` · Off-white `#FAFAF7`
- **Typography**: Manrope (heading) + Inter (body) + JetBrains Mono (numerals), 16px+ minimum
- **Glassmorphism**: aurora bg + floating orbs + glass-* utilities (recipe per Apple Health/WHOOP)
- **Tone**: empowering peer (не authoritarian), "Вы"/"Siz", без guilt-trip notifications

### Pages (30 routes built)
```
[locale]/
├── /             → Landing (hero + 4 features + trust badges + 2 CTAs)
├── /onboarding   → 5-step wizard (~90 sec): name → regimen → time → permissions → done
├── /today        → Premium hero glass + progress arc + medication strip + AI insight + 4 quick actions
├── /today/record → 15-sec video capture (MediaRecorder, hold-to-record, progress ring, HapticFeedback)
├── /calendar     → Monthly heatmap (color-coded, NOT streak counter — anti-guilt)
├── /chat         → Side effect constrained tree (K Health pattern: feel/category/describe → AI triage)
├── /learn        → Drug education cards (R/H/Z/E expandable, red flags, miss-dose rules)
├── /achievements → Strava-style milestones (1d/7d/30d/60d/90d/180d) + confetti modal
├── /messages     → Doctor 1-on-1 chat (mock pattern-matched replies, typing indicator)
├── /profile      → Settings + adherence stats + reset
└── /doctor       → Triage dashboard (5 demo patients, filters, risk pills)
```

### Components
- `components/ui/glass-card.tsx` — 5 variants
- `components/ui/button.tsx` — cva variants
- `components/brand/tb-control-logo.tsx` — SVG droplet + pulse
- `components/today/{progress-arc,dose-countdown,medication-strip,ai-insight-card,today-screen,record-screen}.tsx`
- `components/calendar/heatmap-calendar.tsx`
- `components/chat/side-effect-chat.tsx`
- `components/learn/learn-screen.tsx` (4 drugs × 5 sections × 3 langs)
- `components/achievements/achievements-screen.tsx` (6 milestones, modal reveal)
- `components/messages/messages-screen.tsx` (chat UI)
- `components/profile/profile-screen.tsx`
- `components/doctor/doctor-dashboard.tsx`
- `components/layout/tab-bar.tsx`
- `components/onboarding/onboarding-wizard.tsx`
- `components/telegram-init.tsx` (Telegram WebApp ready/expand/theme)

### State
- `lib/store.ts` — Zustand + localStorage persist (profile, doses, sideEffects)
- `lib/telegram.ts` — WebApp SDK helpers (HapticFeedback, MainButton, theme)
- `lib/utils.ts` — treatmentDay, regimenLengthDays, formatDate

### i18n
- `messages/{uz,ru,en}.json` — full dictionaries (brand, common, landing, onboarding, daily, calendar, side_effects, doctor, errors)
- `i18n/{config,request}.ts` — next-intl config

### vast.ai inference
- **YOLO** (port 8004) — fine-tuned `tb_pills_v2/best.pt`, mAP@0.5=0.591
- **Whisper** Large-v3-Turbo (port 8003)
- **Vision** Qwen2.5-VL-7B-AWQ (port 8002, idle 16 GB VRAM)
- **LLM** Qwen2.5-32B-Instruct-AWQ — **STOPPED** (был остановлен для Vision auto-annotation)
- Models в `/workspace/davoai/models/{llm,vision,bge-m3}` (30 GB)
- Auto-annotated 70 → 37 photos via Vision LLM
- Re-trained YOLO v2 with annotated labels (300 epochs requested, early stop epoch 97)

### CI/CD
- GitHub Actions workflows (.github/workflows/{ci,security}.yml)
- Pre-commit hooks (gitleaks, ruff, no-hardcoded-creds)
- pyproject.toml (ruff + pyright + pytest config)
- 30 bot pytest tests pass

### Local dev
- **Server**: http://localhost:3000 running via `pnpm start` (production build)
- All 30 routes return 200 / 307 (uz redirects to default no-prefix)
- Browser open

---

## ⏳ Что осталось

### High priority
- **Polish other screens with glass** (calendar, chat, profile полирован slightly, но можно ярче)
- **Doctor dashboard improvements**: bulk actions, timeline, risk triage AI banner, sparklines
- **Page transitions** (iOS spring `[0.32, 0.72, 0, 1]`)
- **Loading skeletons** for all async data
- **Confetti effect** on successful video record

### Integration (mocks → real)
- Web `record-screen.tsx`: mock upload → real POST к verifier_orchestrator на vast.ai
- Web `side-effect-chat.tsx`: mockTriage → real LLM call
- Web `messages-screen.tsx`: mock doctor reply → real LLM
- Bot simplification: убрать FSM, заменить на `/start` с web_app кнопкой
- Restart LLM 14B AWQ на vast.ai (для chat)

### Deploy & demo
- **Pitch deck update** под TB Control branding (текущий PDF от Davo-AI)
- **Cloudflared tunnel** для Telegram demo (если хотим тестить в Telegram)
- **Vercel deploy** (опционально — пользователь сказал demo will be local)
- **@BotFather** Mini App setup (после deploy)

### From user
- **Real TB pill photos** через TashPMI/диспансер (для production-grade YOLO mAP ≥0.92)

---

## 🔧 Critical commands

### Dashboard
```bash
cd /Users/temur/Desktop/Claude/Hackathon_2/davo-ai/packages/dashboard

# Start prod server
pnpm build && pnpm start

# Dev mode (hot reload)
pnpm dev

# TS check (требует rm -rf .next/types если ругается)
pnpm typecheck
```

### Vast.ai
```bash
ssh vast                      # Slovenia datacenter
tmux ls                       # active inference sessions
nvidia-smi                    # GPU status
bash /workspace/davoai/start_all.sh   # restart all servers
```

### Repository
```bash
git log --oneline | head -10
git status
git push
```

---

## 🎨 Brand quick reference

```css
--color-brand: #0EA5A4;          /* Teal — primary CTA, logo */
--color-brand-dark: #0F766E;     /* Hover */
--color-brand-soft: #CCFBF1;     /* Tint backgrounds */
--color-accent: #F59E5B;         /* Apricot — Uzbek warmth */
--color-success: #10B981;        /* Dose taken */
--color-warning: #F59E0B;        /* Reminders */
--color-danger:  #EF4444;        /* Coral — missed (NOT pure red) */
--color-ink: #0F172A;            /* Body text */
--color-bg-warm: #FAFAF7;        /* Off-white */
```

```ts
font-heading: Manrope (700/800)
font-body:    Inter (400/500/600)
font-mono:    JetBrains Mono (counters)
```

---

## 📊 Commit history (this session)

| SHA | Message |
|-----|---------|
| ccf1aca | feat: initial Davo-AI MVP scaffold |
| ba31f68 | feat(yolo): training pipeline + dataset annotation guide |
| fa51b68 | feat(pitch): Uzbek pitch deck PDF (9 slides) |
| 8e45029 | fix(security): env-var credentials + SECURITY.md |
| db44ebb | chore: pre-commit hooks + ruff format pass |
| 1249fed | ci: GitHub Actions workflows |
| 3b87ad8 | feat(mock): mock inference servers |
| 4e7aa77 | feat: knowledge base + demo video synth + CONTRIBUTING |
| 7993256 | docs: rename DGX Spark → vast.ai RTX 5090 |
| 7ebcfaa | fix(vast): use venv to avoid Debian system pip conflict |
| 3f109c4 | fix(vast): use HF Python API for model download |
| 374f3c7 | fix(lint): rename unused scene_idx → _scene_idx |
| fad4391 | feat(web): Nafas — TB Mini App with patient + doctor flow |
| 96fd42f | chore(brand): rename Nafas → TB Control across dashboard |
| 4db7653 | fix(build): disable experimental typedRoutes |
| **fe23946** | **feat(web): glassmorphism polish + 3 new screens** ← HEAD |

---

## 💡 Resume hints

When restarting context, point me to this file:
> "Read /Users/temur/Desktop/Claude/Hackathon_2/davo-ai/SESSION_STATUS.md and continue from where we stopped."

Important paths:
- Project: `/Users/temur/Desktop/Claude/Hackathon_2/davo-ai/`
- Dashboard: `packages/dashboard/`
- Memory: `/Users/temur/.claude/projects/-Users-temur-Desktop-Claude/memory/project_hackathon.md`
