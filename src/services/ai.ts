import { z } from 'zod';
import OpenAI from 'openai';
import {
  AIAnalysisResultSchema,
  AnalysisResult,
} from './ai-schema';

// ─────────────────────────────────────────────────────────────────────────────
// Ollama-compatible AI Provider
// Uses the OpenAI SDK pointed at a local Ollama instance.
// Ollama exposes an OpenAI-compatible /v1/chat/completions endpoint.
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

export class OllamaProvider implements AIProvider {
  private client: OpenAI | null = null;
  private model: string;

  constructor() {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
    this.model = process.env.OLLAMA_MODEL || 'llama3.1';

    // Ollama does not require an API key, but the OpenAI SDK requires one.
    // We pass a dummy key; Ollama ignores it.
    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey: 'ollama',
    });
  }

  private hasClient(): boolean {
    return this.client !== null;
  }

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
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: AI_EVIDENCE_AWARE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(content);
      const result = AIAnalysisResultSchema.parse(parsed);
      return result;
    } catch (error: unknown) {
      console.error('Error calling Ollama analyzeTranscriptSegment:', error instanceof Error ? error.message : error);
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
      const response = await this.client!.chat.completions.create({
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
      const response = await this.client!.chat.completions.create({
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
      return this.getMockClarificationQuestion(incidentStateText);
    }

    const SYSTEM_PROMPT = `You are an incident clarification assistant.

Your job is to identify the single most critical information gap or uncertainty in the incident state and formulate a clarification question.

Rules for the question:
- SHORT: One sentence, under 20 words.
- SPECIFIC: Reference concrete entities (service names, metrics, timestamps).
- ACTIONABLE: Someone can answer it right now with available tools.
- NON-ACCUSATORY: Never blame. Use "Can someone confirm..." not "Why didn't you..."
- ROLE-TARGETED: Suggest who should answer (ENGINEER, SRE, SUPPORT, INCIDENT_COMMANDER).

Respond ONLY with JSON: { "questionText": "...", "targetParticipantRole": "ENGINEER|SRE|SUPPORT|INCIDENT_COMMANDER" }`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Incident State:\n${incidentStateText}` },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      return {
        questionText: parsed.questionText || 'Could someone clarify the current status?',
        targetParticipantRole: parsed.targetParticipantRole,
      };
    } catch (error) {
      console.error('Error generating clarification question:', error);
      return { questionText: 'Can someone confirm the current database status from monitoring?', targetParticipantRole: 'SRE' };
    }
  }

  private getMockClarificationQuestion(
    incidentStateText: string
  ): { questionText: string; targetParticipantRole?: string } {
    const lower = incidentStateText.toLowerCase();

    if (lower.includes('deploy') && lower.includes('error')) {
      return {
        questionText: 'Can someone confirm the exact timing of the deployment relative to the first error?',
        targetParticipantRole: 'ENGINEER',
      };
    }
    if (lower.includes('database') || lower.includes('latency')) {
      return {
        questionText: 'Can someone confirm the current database latency from monitoring dashboards?',
        targetParticipantRole: 'SRE',
      };
    }
    if (lower.includes('conflict') || lower.includes('disagree')) {
      return {
        questionText: 'Can someone verify the database health with monitoring data?',
        targetParticipantRole: 'SRE',
      };
    }
    if (lower.includes('unassigned') || lower.includes('who owns')) {
      return {
        questionText: 'Who will take ownership of the unassigned investigation task?',
        targetParticipantRole: 'INCIDENT_COMMANDER',
      };
    }
    return {
      questionText: 'Can someone confirm the current error rate from monitoring?',
      targetParticipantRole: 'SRE',
    };
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
      const response = await this.client!.chat.completions.create({
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

export const aiProvider = new OllamaProvider();
