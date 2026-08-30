import { NextRequest, NextResponse } from 'next/server';
import { incidentService } from '@/services/incident';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const summary = await incidentService.generateSummary(id);
    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate incident summary', details: error.message },
      { status: 500 }
    );
  }
}
