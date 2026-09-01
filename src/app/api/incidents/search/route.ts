import { NextRequest, NextResponse } from 'next/server';
import { incidentSearchService } from '@/services/search';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || undefined;
    const severity = (searchParams.get('severity') as any) || undefined;
    const status = (searchParams.get('status') as any) || undefined;

    const results = await incidentSearchService.searchIncidents({
      query,
      severity,
      status,
    });

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to execute incident search', details: error.message },
      { status: 500 }
    );
  }
}
