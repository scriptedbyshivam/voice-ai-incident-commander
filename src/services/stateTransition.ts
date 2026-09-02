import prisma from '@/lib/db';
import { EvidenceMetadata } from '@/types/incident';
import { NormalizedExtraction } from './ai-schema';
import { factService } from './fact';
import { hypothesisService } from './hypothesis';
import { decisionService } from './decision';
import { actionsService } from './actions';
import { openQuestionService } from './openQuestion';
import { conflictService } from './conflict';
import { timelineService } from './timeline';
import { aiSpeakerService } from './aiSpeaker';

/**
 * Application-level state-transition layer.
 *
 * The AI model never touches the database. Its output is first schema-validated
 * (in the AI provider) and then passed through this layer, which applies
 * business rules and performs the actual DB writes via the existing domain
 * services. This keeps a strict boundary between "what the model believes"
 * and "what the system records."
 */

export interface EntityWriteResult {
  kind: string;
  entityId?: string;
  skipped?: boolean;
  reason?: string;
}

export class IncidentStateTransitionLayer {
  /**
   * Resolve a speaker/assignee name to a participant (and its user).
   * Returns participantId and userId, or null if not found. Also provides a
   * fallback role based on the speaker's declared role.
   */
  private async resolveParticipant(incidentId: string, name?: string) {
    if (!name) return null;
    const participant = await prisma.participant.findFirst({
      where: {
        incidentId,
        user: { name: { contains: name, mode: 'insensitive' } },
      },
      include: { user: true },
    });
    if (!participant) return null;
    return { participantId: participant.id, userId: participant.userId, role: participant.role };
  }

  /**
   * Build an EvidenceMetadata envelope from a normalized extraction. This is
   * what guarantees every persisted entity is traceable to its source.
   */
  private buildEvidence(
    item: NormalizedExtraction,
    opts?: { verificationStatus?: 'UNVERIFIED' | 'VERIFIED' | 'DISPUTED' }
  ): EvidenceMetadata {
    return {
      sourceType: item.sourceType || 'HUMAN_SPOKEN',
      sourceId: item.speakerId,
      sourceText: item.evidence || item.statement,
      speakerId: item.speakerId || item.speakerName,
      timestamp: item.timestamp || new Date().toISOString(),
      confidence: item.confidence,
      verificationStatus: opts?.verificationStatus || 'UNVERIFIED',
    };
  }

  /**
   * Apply the full set of normalized extractions. Each is routed to the correct
   * persistence path. Returns a summary of what was written/skipped.
   */
  async apply(incidentId: string, extras: NormalizedExtraction[]): Promise<EntityWriteResult[]> {
    const results: EntityWriteResult[] = [];

    for (const item of extras) {
      switch (item.type) {
        case 'FACT':
        case 'REPORTED_OBSERVATION':
          results.push(await this.applyFact(incidentId, item));
          break;
        case 'HYPOTHESIS':
          results.push(await this.applyHypothesis(incidentId, item));
          break;
        case 'DECISION':
          results.push(await this.applyDecision(incidentId, item));
          break;
        case 'ACTION':
          results.push(await this.applyAction(incidentId, item));
          break;
        case 'QUESTION':
          results.push(await this.applyQuestion(incidentId, item));
          break;
        case 'POTENTIAL_CONFLICT':
          results.push(await this.applyConflict(incidentId, item));
          break;
        case 'RISK':
          results.push(await this.applyRisk(incidentId, item));
          break;
        default:
          results.push({
            kind: item.type,
            skipped: true,
            reason: 'Unknown extraction type; nothing persisted.',
          });
      }
    }

    return results;
  }

  private async applyFact(incidentId: string, item: NormalizedExtraction): Promise<EntityWriteResult> {
    const evidence = this.buildEvidence(item);
    // Business rule: the model may label an item a FACT, but unless the evidence
    // is actually verified, the fact service will reject a CONFIRMED status.
    const requestedStatus = item.factStatus || 'REPORTED';
    const status = requestedStatus === 'CONFIRMED' ? 'CONFIRMED' : 'REPORTED';

    const fact = await factService.createFact(
      incidentId,
      titleFrom(item),
      item.statement,
      evidence,
      status as any
    );

    return { kind: item.type, entityId: fact.id };
  }

  private async applyHypothesis(incidentId: string, item: NormalizedExtraction): Promise<EntityWriteResult> {
    const evidence = this.buildEvidence(item);
    // Hypotheses are ALWAYS created unconfirmed — promotion to a confirmed Fact
    // requires explicit, human-verified evidence (handled by verifyHypothesis).
    const hypothesis = await hypothesisService.createHypothesis(
      incidentId,
      titleFrom(item),
      item.statement,
      evidence
    );
    return { kind: item.type, entityId: hypothesis.id };
  }

  private async applyDecision(incidentId: string, item: NormalizedExtraction): Promise<EntityWriteResult> {
    const evidence = this.buildEvidence(item);
    const decision = await decisionService.recordDecision(
      incidentId,
      titleFrom(item),
      item.statement,
      item.speakerName || 'Unknown',
      evidence
    );
    return { kind: item.type, entityId: decision.id };
  }

  private async applyAction(incidentId: string, item: NormalizedExtraction): Promise<EntityWriteResult> {
    const evidence = this.buildEvidence(item);
    const resolved = await this.resolveParticipant(incidentId, item.assigneeName || item.speakerName);

    const action = await actionsService.createAction(
      incidentId,
      titleFrom(item),
      item.statement,
      evidence,
      resolved?.userId || undefined
    );

    // Classify criticality (rollbacks, DB restarts, destructive production
    // changes) — we NEVER execute critical actions autonomously; disruptive
    // actions are surfaced for human approval. Investigation/read-only tasks
    // (e.g. "check the deployment logs") are NOT critical.
    const statement = item.statement.toLowerCase();
    const isCritical =
      item.isCritical === true ||
      statement.includes('rollback') ||
      statement.includes('restart') ||
      statement.includes('drop table') ||
      statement.includes('terminate') ||
      statement.includes('scale down') ||
      statement.includes('force failover') ||
      statement.includes('delete') ||
      statement.includes('shut down');

    if (isCritical) {
      await this.flagCriticalAction(incidentId, action.id, action.title, item.statement);
    }

    return { kind: item.type, entityId: action.id };
  }

  private async flagCriticalAction(
    incidentId: string,
    actionId: string,
    title: string,
    details: string
  ): Promise<void> {
    // Never execute; only surface for explicit human approval.
    await prisma.approvalRequest.create({
      data: {
        incidentId,
        actionId,
        actionTitle: title,
        actionDetails: details,
        requestedBy: 'AI Incident Commander (Recommendation)',
        status: 'PENDING',
        evidence: {
          sourceType: 'HUMAN_SPOKEN',
          sourceText: details,
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          verificationStatus: 'UNVERIFIED',
        } as any,
      },
    });

    // Mark the linked action as requiring approval so its status machine is
    // gated until a human grants permission.
    await prisma.actionItem.update({
      where: { id: actionId },
      data: { requiresApproval: true },
    });

    await timelineService.addEvent(
      incidentId,
      'CRITICAL_ACTION_FLAGGED',
      `Critical action surfaced for human approval (not executed): "${title}".`,
      {
        sourceType: 'HUMAN_SPOKEN',
        sourceText: details,
        timestamp: new Date().toISOString(),
        confidence: 1.0,
        verificationStatus: 'UNVERIFIED',
      },
      `ActionItem:${actionId}`,
      1.0,
      new Date()
    );

    // AI spoken participation — a critical action now requires human approval.
    aiSpeakerService
      .notifyCriticalAction(incidentId, title, details)
      .catch((err) => console.warn('[StateTransition] AI critical-action speech failed:', err.message));
  }

  private async applyQuestion(incidentId: string, item: NormalizedExtraction): Promise<EntityWriteResult> {
    const evidence = this.buildEvidence(item);
    const question = await openQuestionService.askQuestion(
      incidentId,
      titleFrom(item),
      item.statement,
      evidence
    );
    return { kind: item.type, entityId: question.id };
  }

  private async applyConflict(incidentId: string, item: NormalizedExtraction): Promise<EntityWriteResult> {
    const evidenceA = this.buildEvidence(item);
    const evidenceB: EvidenceMetadata = {
      ...evidenceA,
      sourceText: item.claimB || item.evidence,
    };

    const conflict = await conflictService.detectAndRecord(
      incidentId,
      titleFrom(item),
      item.claimA || item.statement,
      item.claimB || item.statement,
      evidenceA,
      evidenceB
    );
    return { kind: item.type, entityId: conflict.id };
  }

  private async applyRisk(incidentId: string, item: NormalizedExtraction): Promise<EntityWriteResult> {
    const evidence = this.buildEvidence(item);
    // Risks are represented as timeline events + an open question for tracking.
    await timelineService.addEvent(
      incidentId,
      'RISK',
      `Risk identified: ${item.reasoningSummary || item.statement}`,
      evidence,
      undefined,
      item.confidence,
      new Date()
    );

    const question = await openQuestionService.askQuestion(
      incidentId,
      titleFrom(item),
      `${item.statement} (risk requiring attention)`,
      evidence
    );

    return { kind: item.type, entityId: question.id };
  }
}

function titleFrom(item: NormalizedExtraction): string {
  const text = item.statement.trim();
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

export const incidentStateTransitionLayer = new IncidentStateTransitionLayer();
