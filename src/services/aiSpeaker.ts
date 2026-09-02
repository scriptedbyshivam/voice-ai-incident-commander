import prisma from '@/lib/db';
import { realtimeEventHub } from './eventHub';
import { ttsProvider } from './tts';
import { incidentStateAggregationService } from './aggregation';
import { IncidentState, AiUtteranceSummary } from '@/types/incident';
import {
  AISpeechTrigger,
  evaluateForSpeech,
  buildStatusRequestIntent,
  buildPeriodicStatusIntent,
  phraseCriticalConfirmation,
} from './aiSpeechEngine';

// ─────────────────────────────────────────────────────────────────────────────
// AI Spoken Participation Service
//
// Bridges the pure speech engine (aiSpeechEngine.ts) to the runtime:
//   - holds the in-memory spoke session (speaking flag, last/prevoius state,
//     cooldowns) per incident
//   - synthesizes speech through the TTSProvider abstraction
//   - persists AiUtterance records (dashboard transcript)
//   - caches synthesized audio for client playback
//   - emits realtime `ai.speaking` events
//
// The AI does NOT speak continuously. evaluateAndSpeak() returns early unless a
// real trigger fired, enough time has passed (cooldown), and the utterance is
// not a repeat of the last thing the AI said.
// ─────────────────────────────────────────────────────────────────────────────

export type UtteranceSummary = AiUtteranceSummary;

export interface SpeechSession {
  incidentId: string;
  speaking: boolean;
  currentText: string | null;
  currentTrigger: AISpeechTrigger | null;
  lastSpokenAt: string | null;
}

interface IncidentRuntime {
  prevState: IncidentState | null;
  lastSpokenText: string | null;
  lastSpokenAtMs: number;
  lastTruncatedKey: Record<string, number>;
  timer: ReturnType<typeof setInterval> | null;
}

const AI_SPEAKER_NAME = 'AI Incident Commander';

// Cooldown between AI utterances — the AI should never talk over people.
const DEFAULT_COOLDOWN_MS = 10_000;
// Time-to-live of the "same utterance" dedupe key.
const DEDUPE_WINDOW_MS = 90_000;

const sessions = new Map<string, SpeechSession>();
const runtimes = new Map<string, IncidentRuntime>();
// utteranceId -> { mimeType, audioContent } (bounded in-memory audio cache)
const audioCache = new Map<string, { mimeType: string; audioContent: string }>();
const AUDIO_CACHE_MAX = 50;

export class AISpeakerService {
  // ─────────────────────────────────────────────────────────────────────────
  // Direct speech — the primitive every other path funnels through.
  // ─────────────────────────────────────────────────────────────────────────

  async speak(
    incidentId: string,
    text: string,
    opts: { trigger?: AISpeechTrigger; category?: 'ALERT' | 'CONFIRMATION' | 'STATUS_SUMMARY' } = {}
  ): Promise<UtteranceSummary> {
    const trigger = opts.trigger || 'PERIODIC_STATUS';
    const category = opts.category || inferCategory(trigger);

    const snapshot = this.getOrCreateSession(incidentId);

    // 1. Persist the utterance (dashboard transcript source of truth).
    const audio = await this.trySynthesize(text);
    const record = await prisma.aiUtterance.create({
      data: {
        incidentId,
        text,
        trigger,
        category,
        audioUrl: `/api/incidents/${incidentId}/ai/audio/{id}`,
        audioFormat: audio?.format || null,
        durationSeconds: audio?.durationSeconds || null,
        ttsProvider: audio?.ttsProvider || null,
      },
    });

    const utterance: UtteranceSummary = {
      id: record.id,
      text: record.text,
      trigger: trigger,
      category,
      audioUrl: `/api/incidents/${incidentId}/ai/audio/${record.id}`,
      audioFormat: record.audioFormat,
      durationSeconds: record.durationSeconds,
      ttsProvider: record.ttsProvider,
      createdAt: record.createdAt.toISOString(),
    };

    // Fix persisted audioUrl (created with a placeholder {id}).
    await prisma.aiUtterance
      .update({ where: { id: record.id }, data: { audioUrl: utterance.audioUrl } })
      .catch(() => {});

    if (audio) {
      this.cacheAudio(record.id, audio.mimeType, audio.audioContent);
    }

    // 2. Update session state.
    snapshot.speaking = true;
    snapshot.currentText = text;
    snapshot.currentTrigger = trigger;
    snapshot.lastSpokenAt = new Date().toISOString();

    const rt = this.getOrCreateRuntime(incidentId);
    rt.lastSpokenText = text;
    rt.lastSpokenAtMs = Date.now();

    // 3. Emit realtime events so dashboards/voice rooms show 🟢 Speaking.
    realtimeEventHub.emitToIncident(incidentId, 'ai.speaking', {
      speaking: true,
      text,
      audioUrl: utterance.audioUrl,
    });

    // 4. Automatically clear the speaking flag after the estimated duration.
    const durationMs = audio?.durationSeconds
      ? audio.durationSeconds * 1000
      : estimateMs(text);
    setTimeout(() => {
      snapshot.speaking = false;
      realtimeEventHub.emitToIncident(incidentId, 'ai.speaking', {
        speaking: false,
        text,
        audioUrl: null,
      });
    }, Math.min(Math.max(durationMs, 1500), 35_000));

    return utterance;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Trigger evaluation — called after analysis/conflict/state changes.
  //
  // Loads the current state, diffs it against the cached previous state, and
  // speaks ONLY when the pure engine returns a non-null intent and the
  // cooldown/dedupe windows allow it. This guarantees the AI is not chatty.
  // ─────────────────────────────────────────────────────────────────────────

  async evaluateAndSpeak(incidentId: string): Promise<UtteranceSummary | null> {
    const next = await incidentStateAggregationService.getIncidentState(incidentId);
    if (!next) return null;

    const rt = this.getOrCreateRuntime(incidentId);
    const intent = evaluateForSpeech(rt.prevState, next);
    rt.prevState = next;

    if (!intent) return null;

    if (!this.canSpeakNow(incidentId, intent.text)) {
      return null;
    }

    return this.speak(incidentId, intent.text, {
      trigger: intent.trigger,
      category: intent.category,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Explicit status request ("AI, give me a status update.")
  // ─────────────────────────────────────────────────────────────────────────

  async requestStatus(incidentId: string): Promise<UtteranceSummary | null> {
    const state = await incidentStateAggregationService.getIncidentState(incidentId);
    if (!state) return null;
    const intent = buildStatusRequestIntent(state);
    return this.speak(incidentId, intent.text, {
      trigger: intent.trigger,
      category: 'STATUS_SUMMARY',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Critical action confirmation — called when a rollback/restart/… is flagged.
  // ─────────────────────────────────────────────────────────────────────────

  async notifyCriticalAction(incidentId: string, actionTitle: string, actionDetails: string): Promise<UtteranceSummary> {
    return this.speak(incidentId, phraseCriticalConfirmation(actionTitle, actionDetails), {
      trigger: 'CRITICAL_ACTION_CONFIRMATION',
      category: 'ALERT',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Periodic status interval — the AI gives a cadence update.
  // ─────────────────────────────────────────────────────────────────────────

  startPeriodicStatus(incidentId: string, intervalMs?: number): void {
    // Never schedule real timers under jest — they keep the event loop alive
    // and hang the test run.
    if (process.env.NODE_ENV === 'test') return;

    const rt = this.getOrCreateRuntime(incidentId);
    if (rt.timer) return;

    const interval = intervalMs || parseInt(process.env.AI_STATUS_INTERVAL_MS || '', 10) || 300_000;
    if (!(interval > 0)) return;

    rt.timer = setInterval(() => {
      this.periodicStatusTick(incidentId).catch((err) =>
        console.error('[AISpeaker] Periodic status failed:', err)
      );
    }, interval);
  }

  stopPeriodicStatus(incidentId: string): void {
    const rt = runtimes.get(incidentId);
    if (rt?.timer) {
      clearInterval(rt.timer);
      rt.timer = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Session / transcript / audio accessors for routes and the dashboard.
  // ─────────────────────────────────────────────────────────────────────────

  getSession(incidentId: string): SpeechSession {
    return this.getOrCreateSession(incidentId);
  }

  async listUtterances(incidentId: string, limit = 20): Promise<UtteranceSummary[]> {
    const records = await prisma.aiUtterance.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return records.map((r) => ({
      id: r.id,
      text: r.text,
      trigger: normalizeTrigger(r.trigger),
      category: normalizeCategory(r.category),
      audioUrl: r.audioUrl,
      audioFormat: r.audioFormat,
      durationSeconds: r.durationSeconds,
      ttsProvider: r.ttsProvider,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  getAudio(utteranceId: string): { mimeType: string; audioContent: string } | null {
    return audioCache.get(utteranceId) || null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internals
  // ─────────────────────────────────────────────────────────────────────────

  private async periodicStatusTick(incidentId: string): Promise<void> {
    const state = await incidentStateAggregationService.getIncidentState(incidentId);
    if (!state) return;
    const intent = buildPeriodicStatusIntent(state);
    if (!this.canSpeakNow(incidentId, intent.text)) return;
    await this.speak(incidentId, intent.text, {
      trigger: intent.trigger,
      category: 'STATUS_SUMMARY',
    });
  }

  private async trySynthesize(text: string) {
    try {
      const res = await ttsProvider.synthesize(text);
      return { format: res.format, mimeType: res.mimeType, audioContent: res.audioContent, durationSeconds: res.durationSeconds, ttsProvider: ttsProvider.name };
    } catch (err) {
      // TTS failure must never break the speech pipeline; text still persists.
      console.error('[AISpeaker] TTS synthesis failed, using text-only utterance:', (err as Error).message);
      return null;
    }
  }

  private canSpeakNow(incidentId: string, text: string): boolean {
    const rt = this.getOrCreateRuntime(incidentId);
    const now = Date.now();

    // Cooldown — never speak twice within the window.
    if (now - rt.lastSpokenAtMs < DEFAULT_COOLDOWN_MS) {
      return false;
    }

    // Dedupe same/similar text within the window.
    const key = text.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
    const lastKeyTime = rt.lastTruncatedKey[key];
    if (typeof lastKeyTime === 'number' && now - lastKeyTime < DEDUPE_WINDOW_MS) {
      return false;
    }
    rt.lastTruncatedKey[key] = now;

    // Keep the dedupe map bounded.
    const keys = Object.keys(rt.lastTruncatedKey);
    if (keys.length > 50) {
      for (const k of keys.slice(0, keys.length - 30)) delete rt.lastTruncatedKey[k];
    }

    return true;
  }

  private cacheAudio(utteranceId: string, mimeType: string, audioContent: string): void {
    if (audioCache.size >= AUDIO_CACHE_MAX) {
      const oldest = audioCache.keys().next().value;
      if (oldest) audioCache.delete(oldest);
    }
    audioCache.set(utteranceId, { mimeType, audioContent });
  }

  private getOrCreateSession(incidentId: string): SpeechSession {
    let s = sessions.get(incidentId);
    if (!s) {
      s = { incidentId, speaking: false, currentText: null, currentTrigger: null, lastSpokenAt: null };
      sessions.set(incidentId, s);
    }
    return s;
  }

  private getOrCreateRuntime(incidentId: string): IncidentRuntime {
    let rt = runtimes.get(incidentId);
    if (!rt) {
      rt = {
        prevState: null,
        lastSpokenText: null,
        lastSpokenAtMs: 0,
        lastTruncatedKey: {},
        timer: null,
      };
      runtimes.set(incidentId, rt);
    }
    return rt;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function inferCategory(trigger: AISpeechTrigger): 'ALERT' | 'CONFIRMATION' | 'STATUS_SUMMARY' {
  if (trigger === 'PERIODIC_STATUS' || trigger === 'USER_REQUESTED_STATUS') return 'STATUS_SUMMARY';
  if (trigger === 'ACTION_ASSIGNED') return 'CONFIRMATION';
  return 'ALERT';
}

function estimateMs(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1000, Math.round((words / 150) * 60 * 1000));
}

function normalizeTrigger(value: string): AISpeechTrigger {
  const allowed: AISpeechTrigger[] = [
    'CONFLICT_DETECTED', 'DECISION_DISCUSSED', 'ACTION_ASSIGNED',
    'CRITICAL_ACTION_CONFIRMATION', 'INCIDENT_STATE_CHANGE',
    'USER_REQUESTED_STATUS', 'PERIODIC_STATUS',
  ];
  return (allowed as string[]).includes(value) ? (value as AISpeechTrigger) : 'PERIODIC_STATUS';
}

function normalizeCategory(value: string): 'ALERT' | 'CONFIRMATION' | 'STATUS_SUMMARY' {
  if (value === 'ALERT' || value === 'CONFIRMATION' || value === 'STATUS_SUMMARY') return value;
  return 'STATUS_SUMMARY';
}

export const aiSpeakerService = new AISpeakerService();
export { AI_SPEAKER_NAME };
export default aiSpeakerService;