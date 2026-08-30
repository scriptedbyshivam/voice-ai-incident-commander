import { z } from 'zod';
import OpenAI from 'openai';
import { SourceType } from '@/types/incident';

// Zod validation schemas for AI responses
export const AIAnalyzeTranscriptSchema = z.object({
  facts: z.array(z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['CONFIRMED', 'REPORTED', 'UNCONFIRMED', 'CONFLICTING']),
    confidence: z.number().min(0).max(1),
  })),
  hypotheses: z.array(z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['CONFIRMED', 'REPORTED', 'UNCONFIRMED', 'CONFLICTING']),
    confidence: z.number().min(0).max(1),
  })),
  decisions: z.array(z.object({
    title: z.string(),
    description: z.string(),
    decidedBy: z.string(),
  })),
  actions: z.array(z.object({
    title: z.string(),
    description: z.string(),
    assigneeName: z.string().optional(),
    isCritical: z.boolean(),
  })),
  conflicts: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })),
  openQuestions: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
  })),
});

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
  analyzeTranscript(
    transcriptText: string,
    existingContextText?: string
  ): Promise<z.infer<typeof AIAnalyzeTranscriptSchema>>;

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

export class OpenAIProvider implements AIProvider {
  private openai: OpenAI | null = null;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL || 'gpt-4o'; // Use gpt-4o as stable fallback for GPT-5.6

    if (apiKey && apiKey !== 'placeholder_key') {
      this.openai = new OpenAI({ apiKey });
    }
  }

  private hasClient(): boolean {
    return this.openai !== null;
  }

  async analyzeTranscript(
    transcriptText: string,
    existingContextText?: string
  ): Promise<z.infer<typeof AIAnalyzeTranscriptSchema>> {
    if (!this.hasClient()) {
      return this.getMockAnalysis();
    }

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an AI Incident Commander agent. Analyze the transcript segment and extract operational facts, hypotheses, decisions, action items, conflicts, and open questions. Never declare a root cause yourself; organize hypotheses and observations clearly.',
          },
          {
            role: 'user',
            content: `Transcript Segment:\n${transcriptText}\n\nExisting Context:\n${existingContextText || 'None'}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      return AIAnalyzeTranscriptSchema.parse(parsed);
    } catch (error) {
      console.error('Error calling OpenAI analyzeTranscript:', error);
      return this.getMockAnalysis();
    }
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
      return {
        summary: text,
      };
    } catch (error) {
      console.error('Error generating status summary:', error);
      return {
        summary: 'Failed to generate status summary from AI. Using fallback text.',
      };
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

      return {
        summaryText: response.choices[0].message.content || '',
      };
    } catch (error) {
      console.error('Error generating final incident summary:', error);
      return {
        summaryText: 'Failed to generate final incident summary from AI.',
      };
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

      return {
        questionText: response.choices[0].message.content || '',
      };
    } catch (error) {
      console.error('Error generating clarification question:', error);
      return {
        questionText: 'Could someone clarify if the database connections have returned to normal?',
      };
    }
  }

  async classifyCriticalAction(
    actionTitle: string,
    actionDetails: string
  ): Promise<z.infer<typeof AICriticalActionSchema>> {
    if (!this.hasClient()) {
      // Mock classifier: rollback and database restart actions require approvals
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
      return {
        isCritical: false,
        requiredApprovalRole: 'INCIDENT_COMMANDER',
        reason: 'Fallback to default classification.',
      };
    }
  }

  private getMockAnalysis(): z.infer<typeof AIAnalyzeTranscriptSchema> {
    return {
      facts: [
        {
          title: 'Failure rate spike',
          description: 'Payment failure rate is currently at 42%',
          status: 'CONFIRMED',
          confidence: 0.95,
        },
      ],
      hypotheses: [
        {
          title: 'Database connection pool exhaustion',
          description: 'Recent release might have a memory leak or connection leak',
          status: 'REPORTED',
          confidence: 0.7,
        },
      ],
      decisions: [
        {
          title: 'Check deployment logs',
          description: 'Team agreed to look at deployment systems immediately',
          decidedBy: 'Priya',
        },
      ],
      actions: [
        {
          title: 'Investigate deployment logs',
          description: 'Inspect checkouts-service deployment for errors',
          assigneeName: 'Rahul',
          isCritical: false,
        },
      ],
      conflicts: [
        {
          title: 'Database Latency Disagreement',
          description: 'Rahul reports high DB latency while Amit says the internal DB monitoring shows normal performance.',
        },
      ],
      openQuestions: [
        {
          title: 'What was the exact release hash deployed at 23:30?',
          description: 'Need to cross-reference with GitHub repository tags.',
        },
      ],
    };
  }
}

export const aiProvider = new OpenAIProvider();
