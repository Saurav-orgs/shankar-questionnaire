# Spine Patient Filtering Platform

A pre-consultation triage tool for a senior spine surgeon's clinic. Patients complete a short bilingual questionnaire; the doctor receives a triage verdict and a 30-second summary.

See [plan.md](plan.md) for the full specification, question bank, and clinical rules.

> **Draft clinical logic.** The triage rules have not been reviewed by a clinician. See §2 and §14 of `plan.md`.

## Projects

Three independent projects. There is no workspace or shared package — each owns its own dependencies.

| Directory | What it is | Dev URL |
|---|---|---|
| `api/` | NestJS + Sequelize + PostgreSQL | http://localhost:4000/api |
| `patient-web/` | React + Vite — patient questionnaire, English + हिंदी, mobile-first | http://localhost:5173 |
| `doctor-web/` | React + Vite — doctor dashboard, English, desktop | http://localhost:5176 |

The root `package.json` is only a script runner (`concurrently`), not an npm workspace. Every project can be run entirely on its own.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ running locally, with a database named `spine`

## Setup

```bash
npm run install:all
```

Copy each `.env.example` to `.env` and fill in the values:

```bash
cp api/.env.example api/.env
cp patient-web/.env.example patient-web/.env
cp doctor-web/.env.example doctor-web/.env
```

## Run

All three at once:

```bash
npm run dev
```

Or individually, in separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev:patient
```

```bash
npm run dev:doctor
```

## Database

Migrations and seed run from `api/`:

```bash
npm --prefix api run migrate
```

```bash
npm --prefix api run seed
```

The seed validates the questionnaire before writing — unknown question keys, option codes that do not exist, duplicate rule codes and missing Hindi strings all fail the run rather than reaching the database. It is idempotent; re-running updates questionnaire v1 in place.

Other migration commands: `migrate:pending`, `migrate:status`, `migrate:down`.

## Demo data

With the API running, seed six patients spanning every triage bucket (RED emergency, RED urgent, AMBER, GREY hip, GREY vascular, GREEN):

```bash
python3 scripts/seed-demo-patients.py
```

It drives real assessments through the API — branching, validation and triage all run exactly as for a live patient — and is safe to re-run (it clears the previous demo rows first). Then open the doctor panel at http://localhost:5176 and sign in with `DOCTOR_PANEL_PASSCODE` from `api/.env`.

## Demo flow (what to show)

1. **Patient side** (http://localhost:5173) — start an assessment, switch to हिंदी, answer a few questions. Answer "yes" to the saddle-numbness red flag to trigger the emergency screen.
2. **Doctor side** (http://localhost:5176) — the dashboard sorts every patient by urgency, colour-coded by verdict, emergencies at the top. Open **Sunita Devi** (filled in Hindi): the whole record renders in English, verdict is *Refer elsewhere → Orthopaedics (hip)* — the "unwanted" spine patient correctly filtered out. Record a decision to close the loop.

## Tests

```bash
npm test
```

Runs the evaluator drift check, the API suite, and the patient-web suite. The drift check compares the three duplicated evaluator files between `api/` and `patient-web/`; if they differ it fails before any test runs. After editing the evaluator in `api/`:

```bash
npm run sync:evaluator
```

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness plus database status |
| `GET` | `/api/doctor-profile?lang=` | Doctor card for the landing page |
| `GET` | `/api/questionnaire/active?lang=` | Published schema, localized to `en` or `hi` |
| `POST` | `/api/assessments` | Start one; requires `consent: true` |
| `GET` | `/api/assessments/:token?schema=true` | Current state, progress, next question |
| `PATCH` | `/api/assessments/:token/language` | Switch language mid-flow |
| `PATCH` | `/api/assessments/:token/answers` | Autosave; validates against the schema |
| `POST` | `/api/assessments/:token/submit` | Requires every visible required question |

Patient details and clinical answers go through the same `answers` endpoint. Details are stored in dedicated columns so the doctor panel can sort and search on them; everything else lands in a JSONB blob keyed by question.

Answers are stored as **option codes**, never display strings, so a form completed in Hindi renders in English for the doctor with no translation step.

Changing an answer that hides later questions clears those hidden answers, so a stale branch cannot drive a triage rule the patient no longer qualifies for.

## patient-web

Routes: `/` (landing) → `/consent` → `/a/:token` (the flow controller, which renders whichever screen is next — grouped or single-question, emergency, or the completion screen) → `/emergency` (no token in the URL, by design).

**"Next question" is computed client-side**, not read verbatim from the server's `nextQuestionKey`. Reason: a grouped screen (details/red flags/function) submits every visible field in its section at once, including optional ones left blank — and a blank optional field can't be told apart from "never reached." A naive scan re-offers that same optional field forever and the group screen never advances. The fix (`nextVisibleQuestion` in `patient-web/src/lib/flow.ts`) treats a grouped section as complete once all of its *required* fields are answered, regardless of optional ones — found and fixed by driving a real Hindi assessment through the browser, not by code review.

**Known limitation:** the Back button's history is in-memory only and resets on a page reload. Resuming a saved link always works and lands on the correct next question; only the ability to step back through already-answered screens within that session is lost. Acceptable for the POC; a fix would mean deriving Back purely from answered-question order instead of a client-side stack.

## Verify

```bash
curl -s http://localhost:4000/api/health
```

Expected:

```json
{
  "status": "ok",
  "database": { "connected": true, "name": "spine" }
}
```

Both web apps show the same connectivity check on their home page until Phase 1 lands.

## Notes on ports

`doctor-web` runs on **5176**, not the Vite default of 5174 — 5174 and 5175 were occupied by other projects on the original dev machine. Both web apps use `strictPort: true` so a collision fails loudly instead of silently moving to another port, which would break the API's CORS allowlist in a confusing way.

If you change a web app's port, update the matching `PATIENT_WEB_ORIGIN` / `DOCTOR_WEB_ORIGIN` in `api/.env`.

## Build status

| Phase | Status |
|---|---|
| 0 — Scaffold, DB connection, CORS, health check | ✅ Done |
| 1 — Migrations, models, questionnaire v1 seed | ✅ Done |
| 2 — Questionnaire API + branching evaluator | ✅ Done |
| 3 — patient-web flow | ✅ Done |
| 4 — Rules engine + fixture tests | ✅ Done (32 rule scenarios, one per rule) |
| 5 — AI summary + template fallback | ⚠️ Template only — no Anthropic call yet |
| 6 — doctor-web panel | ✅ Done |
| 7 — Demo readiness | ✅ Done (audit logging now writes on every doctor action) |

**Audit trail:** every doctor login, dashboard view, patient view, and review decision is written to `audit_logs` with IP and user-agent (plan.md §10). Logging is best-effort — a failure is logged but never blocks a doctor action.

**Known remaining gaps** (not blockers for the demo): real AI summary generation (Phase 5 is template-only, the fallback path) and regression tests for the patient-web navigation logic. Security/compliance items (proper auth, DPDP, encryption, retention) are out of POC scope — see plan.md §15.
