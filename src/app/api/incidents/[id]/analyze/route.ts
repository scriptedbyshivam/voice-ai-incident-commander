import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { incidentAnalysisEngine } from '@/services/analysisEngine';

type RouteParams = { params: Promise<{ id: string }> };

const AnalyzeSegmentSchema = z.object({
  transcriptId: z.string().optional(),
  transcript: z.string().optional(),
  speakerName: z.string().optional(),
  speakerRole: z.string().optional(),
  speakerId: z.string().optional(),
  timestamp: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const body = await req.json();
    const validated = AnalyzeSegmentSchema.parse(body || {});

    if (!validated.transcriptId && !validated.transcript) {
      return NextResponse.json(
        { error: 'Either transcriptId or transcript must be provided.' },
        { status: 400 }
      );
    }

    const result = await incidentAnalysisEngine.analyzeTranscriptSegment({
      incidentId,
      transcriptId: validated.transcriptId,
      transcript: validated.transcript,
      speakerName: validated.speakerName,
      speakerRole: validated.speakerRole,
      speakerId: validated.speakerId,
      timestamp: validated.timestamp,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', errors: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to run analysis', details: error.message },
      { status: 500 }
    );
  }
}
