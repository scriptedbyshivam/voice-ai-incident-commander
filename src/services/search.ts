import prisma from '@/lib/db';
import { Severity, IncidentStatus } from '@/types/incident';

export interface SearchOptions {
  query?: string;
  severity?: Severity;
  status?: IncidentStatus;
}

export class IncidentSearchService {
  async searchIncidents(options: SearchOptions) {
    const { query, severity, status } = options;

    return prisma.incident.findMany({
      where: {
        AND: [
          query
            ? {
                OR: [
                  { title: { contains: query, mode: 'insensitive' } },
                  { description: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {},
          severity ? { severity } : {},
          status ? { status } : {},
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}

export const incidentSearchService = new IncidentSearchService();
export default incidentSearchService;
