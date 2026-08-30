import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const timeline = await prisma.timelineEvent.findMany({
      where: { incidentId: id },
      orderBy: { timestamp: 'asc' },
    });
    return NextResponse.json(timeline);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch timeline events', details: error.message },
      { status: 500 }
    );
  }
}
