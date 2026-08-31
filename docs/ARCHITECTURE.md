# AI Incident Commander - System Architecture

```mermaid
flowchart TB
    subgraph VoiceBridge["Live Voice Incident Room (Agora RTC)"]
        HumanIC["Incident Commander (Human)"]
        Engineer["On-Call Engineers (SRE / Dev)"]
        AgoraChannel["Agora WebRTC Audio Channel"]
        HumanIC <--> AgoraChannel
        Engineer <--> AgoraChannel
    end

    subgraph StreamingPipeline["Streaming STT & Intelligence"]
        AudioFeed["PCM Audio Stream"]
        STT["Deepgram Nova-2 STT WebSocket"]
        LLM["AI Incident Commander Agent (LLM Engine)"]
        AgoraChannel --> AudioFeed --> STT --> LLM
    end

    subgraph StateEngine["Incident State Persistence (PostgreSQL + Prisma)"]
        Facts["Confirmed Facts"]
        Observations["Reported Observations"]
        Hypotheses["Active Hypotheses"]
        Conflicts["Operational Conflicts (Claim A vs B)"]
        Timeline["Chronological Timeline"]
        Actions["Action Items & Status History"]
        Decisions["Key Decisions"]
    end

    subgraph Console["SRE Incident Console (Next.js App Router)"]
        Dashboard["Live Ops Dashboard (/incidents/[id])"]
        VoiceRoom["Live Room UI (/incidents/[id]/room)"]
        Export["Post-Mortem Generator (/api/incidents/[id]/export)"]
    end

    LLM --> Facts
    LLM --> Observations
    LLM --> Hypotheses
    LLM --> Conflicts
    LLM --> Timeline
    LLM --> Actions
    LLM --> Decisions

    StateEngine --> Dashboard
    StateEngine --> VoiceRoom
    StateEngine --> Export
```

---

## Core Safety Principles

1. **AI Never Declares Root Cause**: The AI structures evidence, notes discrepancies, and drafts hypotheses; only human incident commanders can promote a hypothesis to a confirmed fact.
2. **Explicit Verification Model**: Reported observations remain distinct from confirmed facts until explicitly verified by team members.
3. **Audit History Tracking**: Every state transition (Action item status changes, Fact verifications, Conflict resolutions) is appended to an immutable status history and chronological event timeline.
4. **Resilient Sandbox Fallbacks**: If Agora credentials or external STT providers are unconfigured, the system automatically runs in simulated sandbox mode without crashing.
