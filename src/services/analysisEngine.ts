import prisma from '@/lib/db';
import { aiProvider } from './ai';
import { incidentStateAggregationService } from './aggregation';
import { incidentStateTransitionLayer } from './stateTransition';
import { AnalysisResult, NormalizedExtraction } from './ai-schema';
import { realtimeEventHub } from './eventHub';
import { AnalysisRunSummary } from '@/types/events';

/**
 * Core AI Incident Analysis Engine.
 *
 * analyzeTranscriptSegment() implements the mandated pipeline:
 *
 *  1. receive a finalized transcript segment
 *  2. load relevant incident context (NOT the full raw transcript each time)
 *  3. call OpenAI (model = configurable, default GPT-5.6)
 *  4. validate the response against a strict Zod schema
 *  5. persist extracted entities via the application-level state-transition layer
 *     (the model never touches the DB directly)
 *  6. update the incident timeline
 *  7. emit realtime events
 *
 * The engine is failure-tolerant: any step that fails yields a safe result and
 * never corrupts the incident state.
 */

export interface AnalyzeInput {
  incidentId: string;
  transcript?: string;
  transcriptId?: string;
  speakerName?: string;
  speakerRole?: string;
  speakerId?: string;
  timestamp?: string;
}

export interface AnalyzeResult {
  runId: string;
  incidentId: string;
  ok: boolean;
  error?: string;
  summary?: AnalysisRunSummary;
}

export class IncidentAnalysisEngine {
  /**
   * Main entrypoint. Accepts either a transcript id (loads from DB) or inline
   * text. Orchestrates context load -> AI -> validate -> persist -> timeline ->
   * events.
   */
  async analyzeTranscriptSegment(input: AnalyzeInput): Promise<AnalyzeResult> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      // 1. Resolve the transcript text & speaker identity
      let transcriptText = input.transcript?.trim();
      let speakerName = input.speakerName;
      let speakerRole = input.speakerRole;
      let speakerId = input.speakerId;
      let transcriptTimestamp = input.timestamp;

      const transcriptId = input.transcriptId || null;

      if (!transcriptText && transcriptId) {
        const record = await prisma.transcript.findUnique({ where: { id: transcriptId } });
        if (!record) throw new Error('Transcript not found');
        transcriptText = record.text;
        speakerName = record.speakerName;
        speakerRole = record.speakerRole || undefined;
        speakerId = record.speakerId || undefined;
        transcriptTimestamp = record.createdAt.toISOString();
      }

      if (!transcriptText || transcriptText.length === 0) {
        throw new Error('Empty transcript segment; nothing to analyze');
      }

      // 2. Load relevant incident context (compressed, not the full raw log)
      const state = await incidentStateAggregationService.getIncidentState(input.incidentId);
      if (!state) throw new Error('Incident not found');

      const context = await this.buildSituationContext(input.incidentId);
      const recentEvidence = this.buildRecentEvidence(state);
      const currentState = this.compressState(state);

      // 3. Call AI (returns already-schema-validated result)
      const analysis = await aiProvider.analyzeTranscriptSegment({
        transcript: transcriptText,
        speakerId,
        speakerName,
        speakerRole,
        timestamp: transcriptTimestamp,
        situationContext: context,
        recentEvidence,
        currentState,
      });

      // 4. Normalize the validated result into flat extraction items
      const extras = this.normalize(analysis);

      // 5. Persist via the state-transition layer (model never writes directly)
      const persisted = await incidentStateTransitionLayer.apply(input.incidentId, extras);

      // 6. Update timeline to reflect that analysis completed
      await this.updateTimeline(input.incidentId, transcriptText, persisted.length);

      const summary: AnalysisRunSummary = {
        runId,
        incidentId: input.incidentId,
        transcriptId,
        transcriptText,
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        extractedCounts: {
          facts: analysis.facts.length,
          observations: analysis.observations.length,
          hypotheses: analysis.hypotheses.length,
          decisions: analysis.decisions.length,
          actions: analysis.actions.length,
          questions: analysis.questions.length,
          risks: analysis.risks.length,
          potentialConflicts: analysis.potentialConflicts.length,
        },
        persisted,
        createdAt: new Date().toISOString(),
      };

      // 7. Emit realtime events
      const freshState = await incidentStateAggregationService.getIncidentState(input.incidentId);
      if (freshState) {
        realtimeEventHub.emit('incident.updated', { state: freshState });
      }
      realtimeEventHub.emit('analysis.completed', { incidentId: input.incidentId, summary });

      return { runId, incidentId: input.incidentId, ok: true, summary };
    } catch (error: any) {
      console.error(`[AnalysisEngine] ${runId} failed:`, error?.message || error);
      realtimeEventHub.emit('analysis.failed', {
        incidentId: input.incidentId,
        error: error?.message || 'Analysis failed',
      });
      return { runId, incidentId: input.incidentId, ok: false, error: error?.message || 'Analysis failed' };
    }
  }

  /**
   * Build a short operational situation context. Per the spec we load a compact
   * snapshot of the most relevant recent facts/hypotheses/decisions/actions
   * rather than re-sending the whole raw transcript.
   */
  private async buildSituationContext(incidentId: string): Promise<string> {
    try {
      const recent = await prisma.transcript.findMany({
        where: { incidentId, isFinal: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      });
      const lines = recent
        .reverse()
        .map((t) => `${t.speakerName}: ${t.text}`)
        .join('\n');
      return lines || 'No prior finalized transcript segments yet.';
    } catch {
      return '';
    }
  }

  private buildRecentEvidence(state: Awaited<ReturnType<typeof incidentStateAggregationService.getIncidentState>>): string {
    if (!state) return 'None';
    const confirmed = state.confirmedFacts.map((f) => `FACT (${f.status}): ${f.title} — ${f.description}`).join('\n');
    const observations = state.reportedObservations
      .map((o) => `OBSERVATION: ${o.title} — ${o.description}`)
      .join('\n');
    const hypotheses = state.hypotheses.map((h) => `HYPOTHESIS (${h.status}): ${h.title}`).join('\n');
    return [confirmed, observations, hypotheses].filter(Boolean).join('\n') || 'None';
  }

  /**
   * Compress the incident state to the essentials the model needs for context.
   * Deliberately excludes raw negotiation text and focuses on structured truths.
   */
  private compressState(state: Awaited<ReturnType<typeof incidentStateAggregationService.getIncidentState>>): string {
    if (!state) return 'None';
    return [
      `Title: ${state.title}`,
      `Status: ${state.currentStatus} | Severity: ${state.severity}`,
      `Participants: ${state.participants.map((p) => `${p.name} (${p.role})`).join(', ')}`,
      `Decisions: ${state.decisions.map((d) => d.title).join(' | ') || 'None'}`,
      `Open questions: ${state.openQuestions.filter((q) => !q.resolved).map((q) => q.title).join(' | ') || 'None'}`,
      `Unresolved conflicts: ${state.conflicts.filter((c) => c.status !== 'RESOLVED').map((c) => c.topic).join(' | ') || 'None'}`,
    ].join('\n');
  }

  /**
   * Flatten a validated AnalysisResult into a canonical list of extraction items
   * that the state-transition layer can persist. Each item is mapped to its
   * bucket plus type-specific fields.
   */
  private normalize(result: AnalysisResult) {
    const items: NormalizedExtraction[] = [];

    for (const it of result.facts) {
      items.push({ ...it, factStatus: it.fact?.status });
    }
    for (const it of result.observations) {
      items.push({ ...it, factStatus: 'REPORTED' });
    }
    for (const it of result.hypotheses) {
      items.push({ ...it, hypothesisStatus: it.hypothesis?.status || 'UNCONFIRMED' });
    }
    for (const it of result.decisions) {
      items.push({ ...it });
    }
    for (const it of result.actions) {
      items.push({
        ...it,
        assigneeName: it.action?.assigneeName,
        isCritical: it.action?.isCritical,
      });
    }
    for (const it of result.questions) {
      items.push({ ...it });
    }
    for (const it of result.risks) {
      items.push({ ...it });
    }
    for (const it of result.potentialConflicts) {
      items.push({
        ...it,
        claimA: it.conflict?.claimA,
        claimB: it.conflict?.claimB,
      });
    }

    return items;
  }

  private async updateTimeline(incidentId: string, text: string, entityCount: number): Promise<void> {
    await prisma.timelineEvent.create({
      data: {
        incidentId,
        eventType: 'AI_ANALYSIS_COMPLETED',
        description: `AI analysis of transcript segment produced ${entityCount} persisted entities. Segment: "${text.slice(0, 140)}${text.length > 140 ? '…' : ''}"`,
        source: {
          sourceType: 'HUMAN_SPOKEN',
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          verificationStatus: 'UNVERIFIED',
        } as any,
        confidence: 1.0,
      },
    });
  }
}

// Local re-export to keep normalize() TypeScript-friendly

export const incidentAnalysisEngine = new IncidentAnalysisEngine();
