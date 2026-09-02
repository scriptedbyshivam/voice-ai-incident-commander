import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiSpeakerService } from '@/services/aiSpeaker';
import { AISpeechTrigger, ALL_TRIGGERS } from '@/services/aiSpeechEngine';

type RouteParams = { params: Promise<{ id: string }> };

const SpeakSchema = z.object({
  text: z.string().min(1).max(2000).optional(),
  mode: z.enum(['speak', 'status', 'evaluate', 'critical']).optional(),
  trigger: z.enum(ALL_TRIGGERS as [AISpeechTrigger, ...AISpeechTrigger[]]).optional(),
  actionTitle: z.string().optional(),
  actionDetails: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const limit = Number(req.nextUrl.searchParams.get('limit') || '15');
    const utterances = await aiSpeakerService.listUtterances(incidentId, limit);
    return NextResponse.json({
      incidentId,
      utterances,
      session: aiSpeakerService.getSession(incidentId),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch AI utterances', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const body = await req.json().catch(() => ({}));
    const validated = SpeakSchema.parse(body || {});

    if (validated.mode === 'status') {
      const utterance = await aiSpeakerService.requestStatus(incidentId);
      return NextResponse.json({ utterance, session: aiSpeakerService.getSession(incidentId) });
    }

    if (validated.mode === 'evaluate') {
      const utterance = await aiSpeakerService.evaluateAndSpeak(incidentId);
      return NextResponse.json({ utterance, session: aiSpeakerService.getSession(incidentId) });
    }

    if (validated.mode === 'critical') {
      const utterance = await aiSpeakerService.notifyCriticalAction(
        incidentId,
        validated.actionTitle || 'an unnamed critical action',
        validated.actionDetails || ''
      );
      return NextResponse.json({ utterance, session: aiSpeakerService.getSession(incidentId) });
    }

    if (!validated.text) {
      return NextResponse.json(
        { error: 'Provide text to speak, or set mode to "status", "evaluate", or "critical".' },
        { status: 400 }
      );
    }

    const utterance = await aiSpeakerService.speak(incidentId, validated.text, {
      trigger: validated.trigger,
    });
    return NextResponse.json({ utterance, session: aiSpeakerService.getSession(incidentId) });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to speak', details: error.message },
      { status: 500 }
    );
  }
}