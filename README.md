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

