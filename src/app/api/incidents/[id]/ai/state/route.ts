import { NextRequest, NextResponse } from 'next/server';
import { aiSpeakerService } from '@/services/aiSpeaker';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Live speaking state for the AI Incident Commander.
 * Polled by the dashboard and voice room so they can show 🟢 Speaking
 * and the transcript of what the AI just said.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    return NextResponse.json(aiSpeakerService.getSession(incidentId));
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch AI speaker state', details: error.message },
      { status: 500 }
    );
  }
}