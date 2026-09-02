import { NextRequest, NextResponse } from 'next/server';
import { aiSpeakerService } from '@/services/aiSpeaker';

type RouteParams = { params: Promise<{ id: string; utteranceId: string }> };

/**
 * Serves the synthesized audio bytes for a single AI utterance (base64 in
 * memory, converted to a binary response). Used by the voice room to inject
 * the AI's audio into the Agora channel and by the dashboard to replay it.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { utteranceId } = await params;
    const cached = aiSpeakerService.getAudio(utteranceId);

    if (!cached) {
      return NextResponse.json(
        { error: 'Audio no longer cached or TTS was not available for this utterance.' },
        { status: 404 }
      );
    }

    const binary = Buffer.from(cached.audioContent, 'base64');
    return new NextResponse(binary, {
      headers: {
        'Content-Type': cached.mimeType,
        'Content-Length': String(binary.length),
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch AI audio', details: error.message },
      { status: 500 }
    );
  }
}