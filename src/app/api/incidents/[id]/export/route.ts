import { NextRequest, NextResponse } from 'next/server';
import { incidentService } from '@/services/incident';
import { postMortemService } from '@/services/postMortem';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';

    const incidentState = await incidentService.getIncident(id);
    if (!incidentState) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const report = postMortemService.generateReport(incidentState);

    if (format === 'markdown' || format === 'md') {
      return new NextResponse(report.summaryMarkdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="incident-${id}-postmortem.md"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate export report', details: error.message },
      { status: 500 }
    );
  }
}
