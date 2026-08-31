import { z } from 'zod';
import { SourceType } from '@/types/incident';

// ─────────────────────────────────────────────────────────────────────────────
// Extraction item schema
//
// Every item the AI extracts from a transcript segment carries the same
// evidence envelope so that every persisted entity can be traced back to the
// exact utterance, speaker, and time it came from. We NEVER store raw
// chain-of-thought; `reasoningSummary` is a short operational explanation only.
// ─────────────────────────────────────────────────────────────────────────────

export const AnalysisItemSchema = z.object({
  type: z.enum([
    'FACT',
    'REPORTED_OBSERVATION',
    'HYPOTHESIS',
    'DECISION',
    'ACTION',
    'QUESTION',
    'RISK',
    'POTENTIAL_CONFLICT',
  ]),
  statement: z.string().min(1),
  speakerId: z.string().optional(),
  speakerName: z.string().optional(),
  speakerRole: z.string().optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
  sourceType: z
    .enum([
      'HUMAN_SPOKEN',
      'MONITORING',
      'DEPLOYMENT_SYSTEM',
      'SLACK',
      'JIRA',
      'PAGERDUTY',
      'MANUAL_CONFIRMATION',
    ])
    .default('HUMAN_SPOKEN'),
  confidence: z.number().min(0).max(1),
  evidence: z.string().optional(),
  reasoningSummary: z.string().min(1),
});

// Fields relating to a specific entity type. These are optional at the schema
// level because the AI may not populate all of them; the application-level
// state-transition layer resolves them (e.g. resolving assignee names to user
// ids before writing to the database).
export const AnalysisActionFields = z.object({
  assigneeName: z.string().optional(),
  isCritical: z.boolean().default(false),
});

export const AnalysisFactFields = z.object({
  status: z.enum(['CONFIRMED', 'REPORTED', 'UNCONFIRMED', 'CONFLICTING']).default('REPORTED'),
});

export const AnalysisConflictFields = z.object({
  claimA: z.string(),
  claimB: z.string(),
  sourceAEvidence: z.string().optional(),
  sourceBEvidence: z.string().optional(),
});

export const AnalysisHypothesisFields = z.object({
  status: z.enum(['CONFIRMED', 'REPORTED', 'UNCONFIRMED', 'CONFLICTING']).default('UNCONFIRMED'),
});

// Extended per-item union used to carry type-specific fields alongside the
// common envelope. Kept as a refinement on the base schema so that Zod enforces
// the strict output contract while still permitting the extra fields.
export const AnalysisResultItemSchema = AnalysisItemSchema.extend({
  action: AnalysisActionFields.optional(),
  fact: AnalysisFactFields.optional(),
  conflict: AnalysisConflictFields.optional(),
  hypothesis: AnalysisHypothesisFields.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Top-level extraction result — this is what the model must return.
// ─────────────────────────────────────────────────────────────────────────────

export const AIAnalysisResultSchema = z.object({
  facts: z.array(AnalysisResultItemSchema).default([]),
  observations: z.array(AnalysisResultItemSchema).default([]),
  hypotheses: z.array(AnalysisResultItemSchema).default([]),
  decisions: z.array(AnalysisResultItemSchema).default([]),
  actions: z.array(AnalysisResultItemSchema).default([]),
  questions: z.array(AnalysisResultItemSchema).default([]),
  risks: z.array(AnalysisResultItemSchema).default([]),
  potentialConflicts: z.array(AnalysisResultItemSchema).default([]),
});

export type AnalysisItem = z.infer<typeof AnalysisResultItemSchema>;
export type AnalysisResult = z.infer<typeof AIAnalysisResultSchema>;

// A canonical flat, typed representation of an extraction for the state
// transition layer.
export interface NormalizedExtraction {
  type: AnalysisItem['type'];
  statement: string;
  speakerId?: string;
  speakerName?: string;
  speakerRole?: string;
  timestamp?: string;
  sourceType: SourceType;
  confidence: number;
  evidence?: string;
  reasoningSummary: string;
  assigneeName?: string;
  isCritical?: boolean;
  factStatus?: 'CONFIRMED' | 'REPORTED' | 'UNCONFIRMED' | 'CONFLICTING';
  hypothesisStatus?: 'CONFIRMED' | 'REPORTED' | 'UNCONFIRMED' | 'CONFLICTING';
  claimA?: string;
  claimB?: string;
}
