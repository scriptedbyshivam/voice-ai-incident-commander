# AI Incident Commander - Outage MVP

A production-quality operational incident bridge intelligence platform. The AI Incident Commander joins live operational voice channels (via Agora), listens to ongoing conversations, extracts critical information (confirmed facts, hypotheses, decisions, action items, conflicts, and open questions), and builds a structured, evidence-auditable timeline.

---

## Core Safety Principles

1. **No Independent Root Cause**: The AI must organize evidence, list hypotheses, and surface conflicts. It never declares a root cause on its own.
2. **Human in the Loop**: Critical actions (e.g. database pool restarts, rollbacks) are classified as critical by the AI but require explicit authorization from human commanders before execution.

---

## Technology Stack

- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS
- **Database**: PostgreSQL, Prisma ORM
- **AI Integration**: OpenAI SDK (for LLM analysis and TTS synthesis)
- **Audio & Transcription**: Agora RTC, Deepgram STT (e.g., ephemeral token interfaces)
- **Validation**: Zod validation schemas

---

## Folder & Component Structure

- `src/types/`: Shared typings for `IncidentState`, `EvidenceMetadata`, and WebSocket realtime events.
- `src/services/`: Core logic abstractions:
  - `ai.ts`: Abstracted structured LLM operations.
  - `agora.ts`: Token generation.
  - `transcription.ts`: Deepgram STT orchestration.
  - `incident.ts`: State aggregator.
  - `timeline.ts`: Event tracer.
  - `conflict.ts`: Operational discrepancy tracker.
  - `actions.ts`: Action assignments.
  - `approvals.ts`: Incident commander action approvals.
  - `integrations.ts`: Slack, Jira, PagerDuty integration interfaces.
  - `tts.ts`: Voice updates.
- `src/app/api/`: Endpoint definitions for incident details, approvals, participants, and timeline logs.
- `src/app/`: User Interface views.

---

## Setup & Database Configuration

### 1. Prerequisites
- Node.js (v18+)
- Local or cloud PostgreSQL instance

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in the active credentials:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` is set to your active PostgreSQL credentials, e.g.:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/incident_commander?schema=public"
```

### 3. Initialize Database Schema
Run database sync to create the tables, indexes, and enums:
```bash
npm run db:generate
npx prisma db push
```

### 4. Seed the Database
Populate the database with the pre-configured sandbox outage incident ("Payment API Outage"):
```bash
npm run db:seed
```

---

## Development Scripts

The following scripts are configured in `package.json`:

- `npm run dev`: Starts the Next.js development server at `http://localhost:3000`.
- `npm run build`: Compiles the application for production.
- `npm run start`: Runs the production-built bundle.
- `npm run lint`: Validates the codebase using ESLint.
- `npm run typecheck`: Performs static TypeScript validation.
- `npm run test`: Runs the Jest unit test suites for persistence, metrics, and post-mortem generation.
- `npm run db:generate`: Generates local Prisma client interfaces.
- `npm run db:seed`: Feeds mock payment failure outage details to the database.

---

## Architecture & Post-Mortem Features

- **System Architecture**: Detailed architecture diagram and pipeline flow in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Post-Mortem Reports**: Automated Markdown and JSON post-mortem report generation via `/api/incidents/[id]/export`.
- **Live Voice Bridge**: Real-time Agora RTC voice rooms with dynamic audio waveform visualizers and resilient sandbox simulation fallbacks.
- **Incident Scenarios & Fixtures**: Pre-built templates for payment outages, replica lag, and TLS expiry in `src/lib/fixtures.ts`.
- **SLA & Health Metrics**: Triage velocity score, MTTA, and risk calculation helpers in `src/lib/metrics.ts`.

---

## Free Deployment (Vercel + Neon — no credit card)

The app is production-ready for **free tiers**. It uses the official Agora Conversational AI setup (`agora-agents` + `agora-agent-client-toolkit`) with a reseller STT/LLM/TTS pipeline billed to the Agora project, a free cloud LLM for `/analyze`, and browser Web Speech for transcription — so **no separate STT server or paid LLM wallet is required**.

### What to create (all free, no card)

| Service | Purpose | Free tier |
|---|---|---|
| **Vercel** (vercel.com) | Hosts the Next.js web app + API routes | Hobby (free) |
| **Neon** (neon.tech) or **Supabase** | Postgres database | Free (512MB–1GB) |
| **Agora** (console.agora.io) | App ID + Certificate for the AI voice agent | Free signup credits |
| **Groq** (console.groq.com) or **Google Gemini** | Free cloud LLM for facts/hypotheses/decisions/actions | Free API key |

### Step 1 — Database (Neon)
1. Create a Neon project → copy the **connection string** (`postgresql://...?sslmode=require`).
2. Later, after deploying, push the schema: `npx prisma migrate deploy` (or `npx prisma db push`) pointing at the Neon `DATABASE_URL`.

### Step 2 — Agora (for the AI Incident Commander voice agent)
1. Agora Console → create/find a project: note the **App ID** and enable **App Certificate**.
2. Your project needs the **Conversational AI / real-time fabric** feature and an active billing/credit to run the cloud agent (STT/LLM/TTS bills to the Agora project).
3. Set `AGORA_AREA` (`us` / `eu` / `ap`) and `AGORA_AGENT_UID` (`123456` default).

### Step 3 — Free LLM (for `/analyze`)
- **Groq**: sign up at console.groq.com → create an API key.
  - `CLOUD_LLM_BASE_URL=https://api.groq.com/openai/v1`
  - `CLOUD_LLM_MODEL=llama-3.3-70b-versatile`
- Or **Google Gemini**: AI Studio → API key.
  - `CLOUD_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`
  - `CLOUD_LLM_MODEL=gemini-2.0-flash`

### Step 4 — Deploy on Vercel
1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** the repo. Vercel auto-detects Next.js and runs `prisma generate && next build` (see `vercel.json`).
3. Add these **Environment Variables** (Project → Settings → Environment Variables):
   ```
   DATABASE_URL           = <your Neon connection string>
   AGORA_APP_ID           = <Agora App ID>
   AGORA_APP_CERTIFICATE  = <Agora App Certificate>   (server-side only)
   AGORA_AREA             = us
   AGORA_AGENT_UID        = 123456
   CLOUD_LLM_API_KEY      = <Groq or Gemini key>
   CLOUD_LLM_BASE_URL     = https://api.groq.com/openai/v1
   CLOUD_LLM_MODEL        = llama-3.3-70b-versatile
   NEXT_PUBLIC_BASE_URL   = <https://your-app.vercel.app>
   TTS_PROVIDER           = edge            (keyless, free AI speaker)
   ```
4. **Deploy**, then in your terminal run once:
   ```bash
   DATABASE_URL="<your Neon URL>" npx prisma db push
   DATABASE_URL="<your Neon URL>" npx prisma db seed   # optional sample incident
   ```
5. Open the deployed URL, join the room, and press **AI Incident Commander Assistant**.

### Deployment notes / no-cost choices
- **Transcription**: with no `TRANSCRIPTION_WS_URL`, the app auto-uses the browser's **Web Speech API** (free, no server). To keep the standalone WS STT server, deploy it separately (e.g. Render/Railway) and set `TRANSCRIPTION_WS_URL`.
- **AI voice (TTS)**: the cloud agent speaks via Agora-billed reseller TTS; the local speaker can use `TTS_PROVIDER=edge` (keyless) or `ttsai`.
- **Ollama**: leave `OLLAMA_BASE_URL` unset in production — it only runs locally.


