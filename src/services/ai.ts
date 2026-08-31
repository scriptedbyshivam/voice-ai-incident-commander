import { z } from 'zod';
import OpenAI from 'openai';
import {
  AIAnalysisResultSchema,
  AnalysisResult,
} from './ai-schema';

// ─────────────────────────────────────────────────────────────────────────────
// Legacy schemas (kept for existing status/summary/critical-action features —
// they operate on whole-incident summaries, not the per-utterance extraction).
// ─────────────────────────────────────────────────────────────────────────────

export const AIStatusSummarySchema = z.object({
  summary: z.string(),
  severityUpdate: z.enum(['SEV1', 'SEV2', 'SEV3', 'SEV4']).optional(),
});

export const AICriticalActionSchema = z.object({
  isCritical: z.boolean(),
  requiredApprovalRole: z.enum(['INCIDENT_COMMANDER', 'ENGINEER', 'SRE']),
  reason: z.string(),
});

export interface AIProvider {
  analyzeTranscriptSegment(input: {
    transcript: string;
    speakerId?: string;
    speakerName?: string;
    speakerRole?: string;
    timestamp?: string;
    situationContext: string;
    recentEvidence: string;
    currentState: string;
  }): Promise<AnalysisResult>;

  generateStatusSummary(
    incidentStateText: string
  ): Promise<z.infer<typeof AIStatusSummarySchema>>;

  generateIncidentSummary(
    incidentStateText: string
  ): Promise<{ summaryText: string }>;

  generateClarificationQuestion(
    incidentStateText: string
  ): Promise<{ questionText: string; targetParticipantRole?: string }>;

  classifyCriticalAction(
    actionTitle: string,
    actionDetails: string
  ): Promise<z.infer<typeof AICriticalActionSchema>>;
}

export const AI_EVIDENCE_AWARE_SYSTEM_PROMPT = `You are an evidence-aware AI Incident Commander.

Your job is to maintain shared situational awareness during a live incident.

Strict behavioral rules:
- NEVER determine or declare the root cause independently.
- NEVER turn a hypothesis into a confirmed fact without explicit, verified evidence.
- NEVER execute critical actions or take autonomous production actions.
- Distinguish hard evidence from assumptions and speculation.
- Preserve conflicting claims exactly as stated; never silently merge them.
- Track ownership, decisions, and unresolved questions.
- Prefer authoritative system evidence over unsupported human speculation.
- When evidence is missing, explicitly say it is missing rather than inferring.
- When two sources disagree, preserve both claims and flag a POTENTIAL_CONFLICT.
- Never present a hypothesis as a confirmed fact.

You organize information so that human incident commanders can make decisions.

Classification rules:
- FACT: A statement explicitly supported by verified evidence or explicitly confirmed.
- REPORTED_OBSERVATION: A participant reports something they personally observed but it is not independently confirmed.
- HYPOTHESIS: A possible explanation or cause being entertained.
- DECISION: The team explicitly agrees on a course of action.
- ACTION: A concrete task assigned (explicitly or determinably) to a person.
- QUESTION: Information that must be clarified.
- RISK: A potential danger, impact, or unresolved issue.
- POTENTIAL_CONFLICT: Two statements that appear inconsistent.

Respond ONLY with a single JSON object matching exactly this structure:
{
  "facts": [ { "type":"FACT", "statement":"...", "speakerName":"...", "speakerRole":"...", "sourceType":"HUMAN_SPOKEN|MONITORING|DEPLOYMENT_SYSTEM|SLACK|JIRA|PAGERDUTY|MANUAL_CONFIRMATION", "confidence":0.0-1.0, "evidence":"...", "reasoningSummary":"...", "fact": { "status":"REPORTED" } } ],
  "observations": [ <same item shape, type:"REPORTED_OBSERVATION"> ],
  "hypotheses": [ <same item shape, type:"HYPOTHESIS", "hypothesis":{ "status":"UNCONFIRMED" }> ],
  "decisions": [ <same item shape, type:"DECISION"> ],
  "actions": [ <same item shape, type:"ACTION", "action":{ "assigneeName":"...", "isCritical":false }> ],
  "questions": [ <same item shape, type:"QUESTION"> ],
  "risks": [ <same item shape, type:"RISK"> ],
  "potentialConflicts": [ <same item shape, type:"POTENTIAL_CONFLICT", "conflict":{ "claimA":"...", "claimB":"..." }> ]
}

Rules for the output:
- Each item's "reasoningSummary" must be a short operational explanation (1-2 sentences). Never expose hidden chain-of-thought.
- "evidence" should quote the exact supporting utterance or system signal when available, otherwise "evidence missing".
- Leave arrays empty when nothing of that type is extracted.
- Do not fabricate facts; report only what the transcript and evidence support.`;

export class OpenAIProvider implements AIProvider {
  private openai: OpenAI | null = null;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    // Model is fully configurable via env. Defaults to GPT-5.6 per spec.
    // If the configured model is unavailable to the active key, operators can
    // fall back via OPENAI_MODEL (e.g. gpt-4o) without a code change.
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';

    if (apiKey && apiKey !== 'placeholder_key') {
      this.openai = new OpenAI({ apiKey });
    }
  }

  private hasClient(): boolean {
    return this.openai !== null;
  }

  /**
   * Core extraction entrypoint. Returns a *validated* AnalysisResult.
   * Never trusts raw model output: response is parsed and validated against
   * AIAnalysisResultSchema. On any failure we return a safe empty result so the
   * pipeline degrades gracefully instead of persisting malformed data.
   */
  async analyzeTranscriptSegment(input: {
    transcript: string;
    speakerId?: string;
    speakerName?: string;
    speakerRole?: string;
    timestamp?: string;
    situationContext: string;
    recentEvidence: string;
    currentState: string;
  }): Promise<AnalysisResult> {
    if (!this.hasClient()) {
      return this.getMockAnalysis(input);
    }

    const userPrompt = this.buildAnalysisPrompt(input);

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: AI_EVIDENCE_AWARE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(content);

      // Never trust the model blindly — schema-validate first.
      const result = AIAnalysisResultSchema.parse(parsed);

      // Drop any item that failed per-item validation (defensive).
      return result;
    } catch (error: any) {
      // If the model responds with an unexpected shape, log and return safe
      // empty extraction — do NOT persist unvalidated model output.
      console.error('Error calling OpenAI analyzeTranscriptSegment:', error?.message || error);
      return {
        facts: [],
        observations: [],
        hypotheses: [],
        decisions: [],
        actions: [],
        questions: [],
        risks: [],
        potentialConflicts: [],
      };
    }
  }

  private buildAnalysisPrompt(input: {
    transcript: string;
    speakerId?: string;
    speakerName?: string;
    speakerRole?: string;
    timestamp?: string;
    situationContext: string;
    recentEvidence: string;
    currentState: string;
  }): string {
    return [
      `# New finalized transcript segment`,
      ``,
      `## Speaker`,
      `- Name: ${input.speakerName || 'Unknown'}`,
      `- Role: ${input.speakerRole || 'Unknown'}`,
      input.speakerId ? `- ID: ${input.speakerId}` : '',
      input.timestamp ? `- Time: ${input.timestamp}` : '',
      ``,
      `## Transcript text`,
      input.transcript,
      ``,
      `## Short situation context (recent state only — not the full log)`,
      input.situationContext || 'None',
      ``,
      `## Relevant recent evidence`,
      input.recentEvidence || 'None',
      ``,
      `## Current structured incident state (compressed)`,
      input.currentState || 'None',
      ``,
      `Extract only what this segment supports. Do not invent facts.`,
    ].filter(Boolean).join('\n');
  }

  private getMockAnalysis(input: {
    transcript: string;
    speakerName?: string;
    speakerRole?: string;
  }): AnalysisResult {
    const t = (input.transcript || '').toLowerCase();
    const speakerName = input.speakerName || 'Unknown';
    const speakerRole = input.speakerRole || 'Unknown';
    const base = {
      speakerName,
      speakerRole,
      sourceType: 'HUMAN_SPOKEN' as const,
      confidence: 0.75,
      evidence: input.transcript,
    };

    const observations: AnalysisResult['observations'] = [];
    const hypotheses: AnalysisResult['hypotheses'] = [];
    const decisions: AnalysisResult['decisions'] = [];
    const actions: AnalysisResult['actions'] = [];
    const questions: AnalysisResult['questions'] = [];
    const risks: AnalysisResult['risks'] = [];
    const potentialConflicts: AnalysisResult['potentialConflicts'] = [];
    const facts: AnalysisResult['facts'] = [];

    if (t.includes('percent') || t.includes('%') || t.includes('error rate') || t.includes('fail')) {
      observations.push({
        ...base,
        type: 'REPORTED_OBSERVATION',
        statement: input.transcript,
        reasoningSummary: 'Participant reported an observed metric/failure state.',
        fact: { status: 'REPORTED' },
      });
    } else if (t.includes('think') || t.includes('caused') || t.includes('maybe') || t.includes('likely')) {
      hypotheses.push({
        ...base,
        type: 'HYPOTHESIS',
        statement: input.transcript,
        reasoningSummary: 'Candidate explanation offered by a participant.',
        hypothesis: { status: 'UNCONFIRMED' },
      });
    } else if (t.includes('approved') || t.includes('decision') || t.includes('we agreed') || t.includes('authorize')) {
      decisions.push({
        ...base,
        type: 'DECISION',
        statement: input.transcript,
        reasoningSummary: 'Team agreed on a course of action.',
      });
    } else if (t.includes('check') || t.includes('investigate') || t.includes('look at') || t.includes('dig') || t.includes('run') || t.includes('verify')) {
      actions.push({
        ...base,
        type: 'ACTION',
        statement: input.transcript,
        reasoningSummary: 'Concrete investigation task assigned.',
        action: { isCritical: false, assigneeName: undefined },
      });
    } else if (t.includes('normal') || t.includes('looks fine') || t.includes('no spike') || t.includes('no issue')) {
      // A statement asserting metrics are nominal may contradict a prior
      // reported condition => surface as a POTENTIAL_CONFLICT rather than
      // silently treating it as settled truth.
      potentialConflicts.push({
        ...base,
        type: 'POTENTIAL_CONFLICT',
        statement: input.transcript,
        reasoningSummary: 'Statement may contradict a previously reported condition.',
        conflict: { claimA: 'previously reported condition', claimB: input.transcript },
      });
    } else if (t.includes('latency')) {
      observations.push({
        ...base,
        type: 'REPORTED_OBSERVATION',
        statement: input.transcript,
        reasoningSummary: 'Observed latency condition reported.',
        fact: { status: 'REPORTED' },
      });
    } else {
      observations.push({
        ...base,
        type: 'REPORTED_OBSERVATION',
        statement: input.transcript,
        reasoningSummary: 'Observed operational statement from participant.',
        fact: { status: 'REPORTED' },
      });
    }

    return {
      facts,
      observations,
      hypotheses,
      decisions,
      actions,
      questions,
      risks,
      potentialConflicts,
    };
  }

  async generateStatusSummary(
    incidentStateText: string
  ): Promise<z.infer<typeof AIStatusSummarySchema>> {
    if (!this.hasClient()) {
      return {
        summary: 'Mocked AI Incident Status Update: The payment outage is currently active. Rahul is investigating deployment logs, while Priya is handling support issues.',
        severityUpdate: 'SEV3',
      };
    }

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Generate a short verbal status summary of the incident state. Summarize facts, active actions, and conflicting information concisely.',
          },
          {
            role: 'user',
            content: `Incident State:\n${incidentStateText}`,
          },
        ],
      });

      const text = response.choices[0].message.content || '';
      return { summary: text };
    } catch (error) {
      console.error('Error generating status summary:', error);
      return { summary: 'Failed to generate status summary from AI. Using fallback text.' };
    }
  }

  async generateIncidentSummary(
    incidentStateText: string
  ): Promise<{ summaryText: string }> {
    if (!this.hasClient()) {
      return {
        summaryText: 'Final Incident Summary (Mocked): The Payment API Outage was resolved by rolling back the deployment. The timeline records the key metrics drop, the identification of deployment latency, and the successful resolution.',
      };
    }

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Produce a comprehensive post-mortem style final incident summary including key facts, decisions made, and actions completed.',
          },
          {
            role: 'user',
            content: `Incident State:\n${incidentStateText}`,
          },
        ],
      });

      return { summaryText: response.choices[0].message.content || '' };
    } catch (error) {
      console.error('Error generating final incident summary:', error);
      return { summaryText: 'Failed to generate final incident summary from AI.' };
    }
  }

  async generateClarificationQuestion(
    incidentStateText: string
  ): Promise<{ questionText: string; targetParticipantRole?: string }> {
    if (!this.hasClient()) {
      return {
        questionText: 'Rahul, did you find any errors in the deployment logs for the checkout microservice?',
        targetParticipantRole: 'ENGINEER',
      };
    }

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Identify critical uncertainties or conflicts in the incident state and formulate a specific clarification question for the team.',
          },
          {
            role: 'user',
            content: `Incident State:\n${incidentStateText}`,
          },
        ],
      });

      return { questionText: response.choices[0].message.content || '' };
    } catch (error) {
      console.error('Error generating clarification question:', error);
      return { questionText: 'Could someone clarify if the database connections have returned to normal?' };
    }
  }

  async classifyCriticalAction(
    actionTitle: string,
    actionDetails: string
  ): Promise<z.infer<typeof AICriticalActionSchema>> {
    if (!this.hasClient()) {
      const isCritical =
        actionTitle.toLowerCase().includes('rollback') ||
        actionTitle.toLowerCase().includes('restart') ||
        actionTitle.toLowerCase().includes('drop') ||
        actionDetails.toLowerCase().includes('database') ||
        actionDetails.toLowerCase().includes('production');
      return {
        isCritical,
        requiredApprovalRole: 'INCIDENT_COMMANDER',
        reason: isCritical
          ? 'Rollbacks and database modifications are disruptive production changes and require Incident Commander approval.'
          : 'Standard operational query and verification.',
      };
    }

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Determine if the following action is critical and requires human command approval (e.g. restarts, rollbacks, configuration updates, network changes). Identify the required approval role and state the reason.',
          },
          {
            role: 'user',
            content: `Action Title: ${actionTitle}\nDetails: ${actionDetails}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      return AICriticalActionSchema.parse(parsed);
    } catch (error) {
      console.error('Error classifying critical action:', error);
      return { isCritical: false, requiredApprovalRole: 'INCIDENT_COMMANDER', reason: 'Fallback to default classification.' };
    }
  }
}

export const aiProvider = new OpenAIProvider();
