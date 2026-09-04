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
  /** Human-readable label of the provider/model actually in use (for diagnostics). */
  getModelInfo(): { provider: string; model: string };

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

  /** Generate a short spoken reply to an operator's prompt, grounded on incident state. */
  replyToPrompt(prompt: string, incidentStateText: string): Promise<string>;
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
  // Cloud free-tier provider (OpenAI-compatible, e.g. Groq / Google Gemini
  // OpenAI-compat endpoint). Reaches the app from any serverless host, so the
  // analysis pipeline works in production WITHOUT a local Ollama. Configure via
  // CLOUD_LLM_API_KEY / CLOUD_LLM_BASE_URL / CLOUD_LLM_MODEL.
  private cloudClient: OpenAI | null = null;
  private cloudModel = 'llama-3.3-70b-versatile';
  private cloudName = 'CloudLLM';
  // Primary provider (OpenAI-compatible remote, e.g. a router).
  private primaryClient: OpenAI | null = null;
  private primaryModel = 'gpt-4o-mini';
  private primaryName = 'OpenAI';
  // Fallback provider (local Ollama). Used only in local dev; absent in the cloud.
  private fallbackClient: OpenAI | null = null;
  private fallbackModel: string;
  private providerName: string;
  private model: string;

  constructor() {
    const cloudKey = process.env.CLOUD_LLM_API_KEY || '';
    const cloudBaseUrl = process.env.CLOUD_LLM_BASE_URL || 'https://api.groq.com/openai/v1';
    const openaiKey = process.env.OPENAI_API_KEY || '';
    const openaiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';

    // Free cloud LLM (highest priority) — works in production/serverless.
    if (cloudKey && cloudKey !== 'placeholder_cloud_llm_key') {
      this.cloudClient = new OpenAI({ baseURL: cloudBaseUrl, apiKey: cloudKey });
      this.cloudModel = process.env.CLOUD_LLM_MODEL || this.cloudModel;
      this.cloudName = process.env.CLOUD_LLM_NAME || 'CloudLLM';
      this.providerName = this.cloudName;
      this.model = this.cloudModel;
      this.fallbackModel = process.env.OLLAMA_MODEL || 'llama3.1';
      console.log(`[AI] Using free cloud LLM (${this.cloudName}, model: ${this.model})`);
      if (process.env.OLLAMA_BASE_URL) {
        this.fallbackClient = new OpenAI({ baseURL: ollamaBaseUrl, apiKey: 'ollama' });
      }
      return;
    }

    this.fallbackModel = process.env.OLLAMA_MODEL || 'llama3.1';
    this.fallbackClient = new OpenAI({ baseURL: ollamaBaseUrl, apiKey: 'ollama' });
    console.log('[AI] Ollama fallback armed (model: ' + this.fallbackModel + ')');

    if (openaiKey && openaiKey !== 'placeholder_openai_key') {
      this.primaryClient = new OpenAI({ baseURL: openaiBaseUrl, apiKey: openaiKey });
      this.primaryModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      this.primaryName = 'OpenAI';
      this.providerName = 'OpenAI';
      this.model = this.primaryModel;
      console.log('[AI] Using OpenAI API (model: ' + this.model + ', fallback: Ollama)');
    } else {
      this.providerName = 'Ollama';
      this.model = this.fallbackModel;
      console.log('[AI] Using Ollama (model: ' + this.model + ')');
    }
  }

  private hasClient(): boolean {
    return this.cloudClient !== null || this.primaryClient !== null;
  }

  getModelInfo(): { provider: string; model: string } {
    if (this.cloudClient) {
      return { provider: this.cloudName, model: this.cloudModel };
    }
    if (this.primaryClient) {
      return { provider: this.primaryName, model: this.primaryModel };
    }
    return { provider: 'Ollama', model: this.fallbackModel };
  }

  /**
   * Calls the Ollama (or fallback) client for a chat completion, first WITH
   * `response_format` then without it (some providers reject the option).
   */
  private async fallbackChatJsonWithModel(model: string, client: OpenAI, messages: { role: string; content: string }[]): Promise<string> {
    const base = { model, messages: messages as any[] };
    try {
      const res = await client.chat.completions.create({ ...base, response_format: { type: 'json_object' } });
      return res.choices[0]?.message?.content || '{}';
    } catch {
      try {
        const res = await client.chat.completions.create(base as any);
        return res.choices[0]?.message?.content || '{}';
      } catch {
        throw new Error('Chat completion failed on both JSON and plain paths.');
      }
    }
  }

  /**
   * Runs the completion against the available clients in priority order
   * (cloud LLM → primary → local Ollama). On ANY failure (network, TLS, auth,
   * wallet, timeout) it transparently falls through so the AI Incident
   * Commander stays functional even when a provider is down.
   */
  private async chatJson(messages: { role: string; content: string }[]): Promise<string> {
    const clients: { client: OpenAI; model: string; name: string }[] = [];
    if (this.cloudClient) clients.push({ client: this.cloudClient, model: this.cloudModel, name: this.cloudName });
    if (this.primaryClient) clients.push({ client: this.primaryClient, model: this.primaryModel, name: this.primaryName });
    if (this.fallbackClient) clients.push({ client: this.fallbackClient, model: this.fallbackModel, name: 'Ollama' });

    let lastError: unknown = null;
    for (const c of clients) {
      try {
        return await this.fallbackChatJsonWithModel(c.model, c.client, messages);
      } catch (err) {
        lastError = err;
        if (c.name !== 'Ollama') {
          console.warn(`[AI] Provider (${c.name}) failed; trying next:`, err instanceof Error ? err.message : err);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('No AI provider returned a response.');
  }

  /**
   * Non-JSON chat completion with the same cloud→primary→Ollama fallback as
   * chatJson. Returns the raw assistant text.
   */
  private async chatText(messages: { role: string; content: string }[]): Promise<string> {
    const clients: { client: OpenAI; model: string; name: string }[] = [];
    if (this.cloudClient) clients.push({ client: this.cloudClient, model: this.cloudModel, name: this.cloudName });
    if (this.primaryClient) clients.push({ client: this.primaryClient, model: this.primaryModel, name: this.primaryName });
    if (this.fallbackClient) clients.push({ client: this.fallbackClient, model: this.fallbackModel, name: 'Ollama' });

    let lastError: unknown = null;
    for (const c of clients) {
      try {
        const res = await c.client.chat.completions.create({ model: c.model, messages: messages as any[] });
        return res.choices[0]?.message?.content || '';
      } catch (err) {
        lastError = err;
        if (c.name !== 'Ollama') {
          console.warn(`[AI] Provider (${c.name}) failed; trying next:`, err instanceof Error ? err.message : err);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('No AI provider returned a response.');
  }

  /**
   * For non-JSON chat calls (status summaries, prompt replies, etc.) that use
   * `this.client` directly, keep a property named `client` pointing at the
   * primary (or fallback) so existing call sites compile and behave well.
   */
  private get client(): OpenAI | null {
    if (this.cloudClient) return this.cloudClient;
    if (this.primaryClient) return this.primaryClient;
    return this.fallbackClient;
  }

  private set client(_value: OpenAI | null) {
    // Read-only compatibility accessor.
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
      const content = await this.chatJson([
        { role: 'system', content: AI_EVIDENCE_AWARE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);
      const parsed = sanitizeAnalysis(safeParseJson(content));
      const result = AIAnalysisResultSchema.parse(parsed);
      return result;
    } catch (error: unknown) {
      console.error(`Error calling ${this.providerName} analyzeTranscriptSegment:`, error instanceof Error ? error.message : error);
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
      const text = await this.chatText([
        {
          role: 'system',
          content: 'Generate a short verbal status summary of the incident state. Summarize facts, active actions, and conflicting information concisely.',
        },
        {
          role: 'user',
          content: `Incident State:\n${incidentStateText}`,
        },
      ]);

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
      const summaryText = await this.chatText([
        {
          role: 'system',
          content: 'Produce a comprehensive post-mortem style final incident summary including key facts, decisions made, and actions completed.',
        },
        {
          role: 'user',
          content: `Incident State:\n${incidentStateText}`,
        },
      ]);

      return { summaryText };
    } catch (error) {
      console.error('Error generating final incident summary:', error);
      return { summaryText: 'Failed to generate final incident summary from AI.' };
    }
  }

  async replyToPrompt(prompt: string, incidentStateText: string): Promise<string> {
    if (!this.hasClient()) {
      return `This is the AI Incident Commander. Here is my reading of the current state: ${incidentStateText}`;
    }

    try {
      return (await this.chatText([
        {
          role: 'system',
          content:
            'You are the AI Incident Commander speaking aloud to an operator over a bridge. Answer their question concisely and conversationally, using the incident state as your source of truth. Reply in 2 to 4 short sentences, spoken-style, without markdown, headers, bullet points, or JSON.',
        },
        {
          role: 'user',
          content: `Incident State:\n${incidentStateText}\n\nOperator question: ${prompt}`,
        },
      ])).trim();
    } catch (error) {
      console.error('Error generating prompt reply:', error);
      return 'I could not reach the language model right now. Please try again in a moment.';
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
      const content = await this.chatJson([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Incident State:\n${incidentStateText}` },
      ]);
      const parsed = safeParseJson(content);
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
      const content = await this.chatJson([
        {
          role: 'system',
          content: 'Determine if the following action is critical and requires human command approval (e.g. restarts, rollbacks, configuration updates, network changes). Identify the required approval role and state the reason.',
        },
        {
          role: 'user',
          content: `Action Title: ${actionTitle}\nDetails: ${actionDetails}`,
        },
      ]);

      const parsed = safeParseJson(content);
      return AICriticalActionSchema.parse(parsed);
    } catch (error) {
      console.error('Error classifying critical action:', error);
      return { isCritical: false, requiredApprovalRole: 'INCIDENT_COMMANDER', reason: 'Fallback to default classification.' };
    }
  }
}

const VALID_SOURCE_TYPES = [
  'HUMAN_SPOKEN',
  'MONITORING',
  'DEPLOYMENT_SYSTEM',
  'SLACK',
  'JIRA',
  'PAGERDUTY',
  'MANUAL_CONFIRMATION',
] as const;

const VALID_FACT_STATUSES = ['CONFIRMED', 'REPORTED', 'UNCONFIRMED', 'CONFLICTING'] as const;

/**
 * Parses a raw LLM completion that may wrap valid JSON inside prose, markdown
 * fences, or trailing commentary. Falls back to extracting the first balanced
 * JSON object/array found. Returns {} when nothing parseable exists.
 */
function safeParseJson(content: string): any {
  if (!content) return {};
  const trimmed = content.trim();
  // Try a strict parse first.
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  // Strip markdown fences.
  const fenced = trimmed.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(fenced);
  } catch {
    /* fall through */
  }
  // Extract the first {...} or [...] block (balanced scan).
  const startMatch = fenced.search(/\{|\[/);
  if (startMatch === -1) return {};
  const open = fenced[startMatch];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startMatch; i < fenced.length; i++) {
    const ch = fenced[i];
    if (inString) {
      if (escape) { escape = false; }
      else if (ch === '\\') { escape = true; }
      else if (ch === '"') { inString = false; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(fenced.slice(startMatch, i + 1));
        } catch {
          return {};
        }
      }
    }
  }
  return {};
}

/**
 * Coerces imperfect LLM JSON into something the strict Zod analysis schema will
 * accept. Smaller local models (e.g. llama3.1 via Ollama) often emit slightly
 * off values (wrong enum casing, missing fields, non-numeric confidence), which
 * previously caused the whole segment to be dropped. Sanitizing is low-risk:
 * it only normalizes known enums/required fields to safe defaults and never
 * fabricates the core `statement`.
 */
function sanitizeAnalysis(raw: any): any {
  if (!raw || typeof raw !== 'object') {
    return {
      facts: [], observations: [], hypotheses: [], decisions: [],
      actions: [], questions: [], risks: [], potentialConflicts: [],
    };
  }

  const normalizeItem = (item: any): any => {
    if (!item || typeof item !== 'object') return null;
    const out: any = { ...item };

    if (!VALID_SOURCE_TYPES.includes(out.sourceType)) {
      out.sourceType = 'HUMAN_SPOKEN';
    }
    if (typeof out.confidence !== 'number' || Number.isNaN(out.confidence)) {
      out.confidence = 0.7;
    } else {
      out.confidence = Math.min(1, Math.max(0, out.confidence));
    }
    if (typeof out.statement !== 'string' || !out.statement.trim()) {
      out.statement = typeof raw?.statement === 'string' ? raw.statement : 'Extracted item';
    }
    if (typeof out.reasoningSummary !== 'string' || !out.reasoningSummary.trim()) {
      out.reasoningSummary = 'Extracted from a live incident transcript segment.';
    }
    if (out.fact && !VALID_FACT_STATUSES.includes(out.fact.status)) {
      out.fact = { ...out.fact, status: 'REPORTED' };
    }
    if (out.hypothesis && !VALID_FACT_STATUSES.includes(out.hypothesis.status)) {
      out.hypothesis = { ...out.hypothesis, status: 'UNCONFIRMED' };
    }
    return out;
  };

  const sanitizeArray = (arr: any): any[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeItem).filter(Boolean);
  };

  const topKeys: (keyof any)[] = ['facts', 'observations', 'hypotheses', 'decisions', 'actions', 'questions', 'risks', 'potentialConflicts'];
  const result: any = {};
  for (const key of topKeys) {
    result[key] = sanitizeArray(raw[key]);
  }
  return result;
}

export const aiProvider = new OllamaProvider();
