import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const actions = await prisma.actionItem.findMany({
      where: { incidentId: id },
      include: { assignee: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(actions);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch action items', details: error.message },
      { status: 500 }
    );
  }
}
