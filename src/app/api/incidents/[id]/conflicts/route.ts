import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const conflicts = await prisma.conflict.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(conflicts);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch conflicts', details: error.message },
      { status: 500 }
    );
  }
}
