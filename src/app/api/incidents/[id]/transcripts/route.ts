import { NextRequest, NextResponse } from 'next/server';
import { incidentService } from '@/services/incident';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const transcripts = await incidentService.getTranscripts(id);
    return NextResponse.json(transcripts);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch transcripts', details: error.message },
      { status: 500 }
    );
  }
}
