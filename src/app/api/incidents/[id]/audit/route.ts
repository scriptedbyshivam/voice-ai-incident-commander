import { NextRequest, NextResponse } from 'next/server';
import { auditLogService } from '@/services/auditLog';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const logs = await auditLogService.getAuditLogs(id);
    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch audit log history', details: error.message },
      { status: 500 }
    );
  }
}
