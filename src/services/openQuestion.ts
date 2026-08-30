import prisma from '@/lib/db';
import { EvidenceMetadata } from '@/types/incident';

export class OpenQuestionService {
  async askQuestion(
    incidentId: string,
    title: string,
    description: string,
    evidence: EvidenceMetadata
  ) {
    const question = await prisma.openQuestion.create({
      data: {
        incidentId,
        title,
        description,
        resolved: false,
        evidence: evidence as any,
      },
    });

    // Record on timeline
    await prisma.timelineEvent.create({
      data: {
        incidentId,
        eventType: 'OPEN_QUESTION',
        description: `Open Question Raised: "${title}"`,
        source: evidence as any,
        relatedEntity: `OpenQuestion:${question.id}`,
        confidence: evidence.confidence,
      },
    });

    return question;
  }

  async answerQuestion(
    questionId: string,
    answerText: string,
    responderName: string
  ) {
    const question = await prisma.openQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new Error('Question not found');
    }

    const currentEvidence = question.evidence as unknown as EvidenceMetadata;
    const updatedEvidence: EvidenceMetadata = {
      ...currentEvidence,
      verificationStatus: 'VERIFIED',
      confidence: 1.0,
      timestamp: new Date().toISOString(),
      sourceText: `Question: ${question.title} | Answer by ${responderName}: ${answerText}`,
    };

    const updated = await prisma.openQuestion.update({
      where: { id: questionId },
      data: {
        resolved: true,
        description: `${question.description || ''} [Answered by ${responderName}: ${answerText}]`,
        evidence: updatedEvidence as any,
      },
    });

    // Record on timeline
    await prisma.timelineEvent.create({
      data: {
        incidentId: question.incidentId,
        eventType: 'QUESTION_RESOLVED',
        description: `Question "${question.title}" answered by ${responderName}: "${answerText}"`,
        source: updatedEvidence as any,
        relatedEntity: `OpenQuestion:${questionId}`,
        confidence: 1.0,
      },
    });

    return updated;
  }

  async getQuestions(incidentId: string) {
    return prisma.openQuestion.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const openQuestionService = new OpenQuestionService();
