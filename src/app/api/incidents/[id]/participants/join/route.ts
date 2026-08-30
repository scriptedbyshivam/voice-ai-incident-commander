import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { participantService } from '@/services/participant';

const JoinBridgeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['INCIDENT_COMMANDER', 'ENGINEER', 'SRE', 'SUPPORT', 'PRODUCT', 'BUSINESS', 'OBSERVER']),
  email: z.string().email().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const body = await req.json();
    const validated = JoinBridgeSchema.parse(body);

    const email = validated.email || `${validated.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@company.com`;

    // Find or create User record
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: validated.name },
      create: { email, name: validated.name, role: validated.role },
    });

    // Add as participant to the incident bridge (updates leftAt to null if they rejoin)
    const participant = await participantService.addParticipant(
      incidentId,
      user.id,
      validated.role
    );

    return NextResponse.json({
      userId: user.id,
      participantId: participant.id,
      name: user.name,
      role: participant.role,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to join participant bridge', details: error.message },
      { status: 500 }
    );
  }
}
