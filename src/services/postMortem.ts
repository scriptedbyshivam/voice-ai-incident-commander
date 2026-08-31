import { IncidentState } from '@/types/incident';

export interface PostMortemReport {
  incidentId: string;
  title: string;
  severity: string;
  status: string;
  generatedAt: string;
  summaryMarkdown: string;
  metrics: {
    totalDurationMinutes: number;
    confirmedFactsCount: number;
    decisionsCount: number;
    actionItemsCount: number;
    unresolvedRisksCount: number;
  };
}

export class PostMortemService {
  generateMarkdownReport(state: IncidentState): string {
    const durationMins = Math.round(
      (Date.now() - new Date(state.createdAt).getTime()) / (1000 * 60)
    );

    const verifiedFacts = state.facts
      .filter((f) => f.evidence?.verificationStatus === 'VERIFIED')
      .map((f, i) => `${i + 1}. **${f.statement}** *(Confidence: ${Math.round((f.confidence || 1) * 100)}%)*`)
      .join('\n');

    const hypothesesList = state.hypotheses
      .map((h, i) => `${i + 1}. [${h.status}] ${h.statement} - *Status: ${h.status}*`)
      .join('\n');

    const decisionsList = state.decisions
      .map((d, i) => `${i + 1}. **${d.decision}** *(by ${d.decisionMaker || 'Team Consensus'} at ${new Date(d.createdAt).toLocaleTimeString()})*`)
      .join('\n');

    const actionsList = state.actionItems
      .map((a, i) => `${i + 1}. [${a.status}] **${a.task}** - Assignee: @${a.assigneeName || 'Unassigned'}`)
      .join('\n');

    const timelineList = state.timeline
      .map((t) => `- **${new Date(t.eventTime).toLocaleTimeString()}** [${t.eventType}]: ${t.description}`)
      .join('\n');

    return `# Incident Post-Mortem: ${state.title}

## Overview
- **Incident ID:** \`${state.incidentId}\`
- **Severity:** ${state.severity}
- **Current Status:** ${state.currentStatus}
- **Declared At:** ${new Date(state.createdAt).toUTCString()}
- **Duration:** ${durationMins} minutes

---

## Executive Summary
${state.latestSummary?.summaryText || state.description || 'No summary text recorded.'}

---

## Verified Facts
${verifiedFacts || '_No confirmed facts logged._'}

---

## Investigated Hypotheses
${hypothesesList || '_No hypotheses recorded._'}

---

## Key Decisions
${decisionsList || '_No formal decisions recorded._'}

---

## Action Items & Follow-ups
${actionsList || '_No action items logged._'}

---

## Chronological Timeline
${timelineList || '_No timeline events recorded._'}

---
*Report generated automatically by AI Incident Commander.*
`;
  }

  generateReport(state: IncidentState): PostMortemReport {
    const durationMins = Math.max(
      1,
      Math.round((Date.now() - new Date(state.createdAt).getTime()) / (1000 * 60))
    );

    return {
      incidentId: state.incidentId,
      title: state.title,
      severity: state.severity,
      status: state.currentStatus,
      generatedAt: new Date().toISOString(),
      summaryMarkdown: this.generateMarkdownReport(state),
      metrics: {
        totalDurationMinutes: durationMins,
        confirmedFactsCount: state.facts.filter((f) => f.evidence?.verificationStatus === 'VERIFIED').length,
        decisionsCount: state.decisions.length,
        actionItemsCount: state.actionItems.length,
        unresolvedRisksCount: state.unresolvedRisks.length,
      },
    };
  }
}

export const postMortemService = new PostMortemService();
export default postMortemService;
