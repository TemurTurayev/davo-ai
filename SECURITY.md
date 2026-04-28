# Security Policy

## Secret management

This project follows **strict no-secrets-in-git** policy:

1. **All secrets** live in `.env` (gitignored) — never `.env.example` (which contains only placeholders)
2. **Docker compose** uses `${VAR:-default}` substitution — no hardcoded credentials
3. **DGX Spark setup** uses `HF_TOKEN` env var, not stored in scripts
4. **Telegram bot token** loaded from env at runtime
5. **Anthropic / OpenAI API keys** — NOT used (local-first stack on DGX Spark)

## Pre-commit checklist

Before any commit:
- [ ] `git diff --staged` — visually scan for tokens, passwords, emails+passwords
- [ ] `grep -i -E "password|secret|token|api_key" $(git diff --staged --name-only)` returns no real values
- [ ] No files matching `.env*` (except `.env.example`)
- [ ] No PEM, private keys, or `.p12` files

## Reporting a vulnerability

If you discover a security issue:
- **DO NOT** open a public GitHub issue
- **DO NOT** post in Telegram
- Email **temurturayev7822@gmail.com** with subject `[SECURITY] davo-ai`

We respond within 48 hours.

## History

### 2026-04-28 · Pre-launch credential cleanup
GitGuardian flagged a hardcoded email + dev placeholder password in
`infra/docker/docker-compose.yml` (pgAdmin debug profile, password `davoai`).

**Action taken**:
- Rewrote git history with `git filter-repo` to remove all traces
- Migrated to `${VAR:-default}` env-var substitution
- Added this `SECURITY.md`
- The leaked password (`davoai`) was a dev placeholder, never used in production

If you cloned the repo before 2026-04-28 03:35 UTC, please:
```bash
git fetch --all
git reset --hard origin/main
```
