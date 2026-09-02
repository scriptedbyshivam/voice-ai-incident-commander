import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with sample incident data...');

  // Clean old data to allow idempotent seeding
  await prisma.timelineEvent.deleteMany({});
  await prisma.actionItem.deleteMany({});
  await prisma.conflict.deleteMany({});
  await prisma.openQuestion.deleteMany({});
  await prisma.decision.deleteMany({});
  await prisma.hypothesis.deleteMany({});
  await prisma.fact.deleteMany({});
  await prisma.transcript.deleteMany({});
  await prisma.participant.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.incident.deleteMany({});

  // 1. Create Users
  const rahul = await prisma.user.create({
    data: {
      name: 'Rahul',
      email: 'rahul@company.com',
      role: 'ENGINEER',
    },
  });

  const priya = await prisma.user.create({
    data: {
      name: 'Priya',
      email: 'priya@company.com',
      role: 'SUPPORT',
    },
  });

  const amit = await prisma.user.create({
    data: {
      name: 'Amit',
      email: 'amit@company.com',
      role: 'BUSINESS',
    },
  });

  console.log('Users created:', { rahul: rahul.name, priya: priya.name, amit: amit.name });

  // 2. Create Incident
  const incident = await prisma.incident.create({
    data: {
      title: 'Payment API Outage',
      description: 'Spike in checkout errors and credit card processing failure rates.',
      severity: 'SEV1',
      status: 'ACTIVE',
    },
  });

  console.log('Incident created:', incident.title, 'ID:', incident.id);

  // 3. Link Participants
  const partRahul = await prisma.participant.create({
    data: {
      incidentId: incident.id,
      userId: rahul.id,
      role: 'ENGINEER',
    },
  });

  const partPriya = await prisma.participant.create({
    data: {
      incidentId: incident.id,
      userId: priya.id,
      role: 'SUPPORT',
    },
  });

  const partAmit = await prisma.participant.create({
    data: {
      incidentId: incident.id,
      userId: amit.id,
      role: 'BUSINESS',
    },
  });

  console.log('Participants linked to incident');

  // 4. Create Initial Seed Facts
  await prisma.fact.create({
    data: {
      incidentId: incident.id,
      title: 'Checkout Failure Spike',
      description: 'Payment failures increased to 42%',
      status: 'CONFIRMED',
      evidence: {
        sourceType: 'MONITORING',
        sourceId: 'alert-datadog-109',
        sourceText: 'checkout.payment.failure.rate > 40%',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        confidence: 1.0,
        verificationStatus: 'VERIFIED',
      },
    },
  });

  // 5. Create Seed Hypotheses
  await prisma.hypothesis.create({
    data: {
      incidentId: incident.id,
      title: 'Recent Release Regression',
      description: 'Recent deployment may be contributing to failures',
      status: 'REPORTED',
      evidence: {
        sourceType: 'HUMAN_SPOKEN',
        speakerId: partPriya.id,
        sourceText: 'We deployed the new checkout routing rules 10 minutes before the failures spiked.',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        confidence: 0.7,
        verificationStatus: 'UNVERIFIED',
      },
    },
  });

  // 6. Create Seed Conflicts
  await prisma.conflict.create({
    data: {
      incidentId: incident.id,
      topic: 'Database Performance metrics conflict',
      claimA: 'Rahul reports high DB latency of 800ms+ in app server logs.',
      claimB: 'Amit reports database read charts on Grafana look normal (<15ms).',
      sourceA: {
        sourceType: 'HUMAN_SPOKEN',
        speakerId: partRahul.id,
        sourceText: 'I am seeing high database connection latency from app server logs.',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        confidence: 0.85,
        verificationStatus: 'DISPUTED',
      },
      sourceB: {
        sourceType: 'HUMAN_SPOKEN',
        speakerId: partAmit.id,
        sourceText: 'Amit says read graphs look flat on dashboard.',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        confidence: 0.8,
        verificationStatus: 'DISPUTED',
      },
      status: 'UNRESOLVED',
    },
  });

  // 7. Create Seed Actions
  await prisma.actionItem.create({
    data: {
      incidentId: incident.id,
      title: 'Investigate deployment logs',
      description: 'Analyze deployment docker logs for payment-routing microservice',
      status: 'PENDING',
      assigneeId: rahul.id,
      evidence: {
        sourceType: 'MANUAL_CONFIRMATION',
        sourceText: 'Rahul volunteered to review docker logs on SSH session.',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        confidence: 1.0,
        verificationStatus: 'VERIFIED',
      },
    },
  });

  // 8. Create Timeline Events
  await prisma.timelineEvent.create({
    data: {
      incidentId: incident.id,
      eventType: 'INCIDENT_CREATED',
      description: 'Incident declared by system alert: checkout.payment.failure.rate > 40%',
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      source: {
        sourceType: 'MONITORING',
        sourceId: 'alert-datadog-109',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        confidence: 1.0,
        verificationStatus: 'VERIFIED',
      },
    },
  });

  await prisma.timelineEvent.create({
    data: {
      incidentId: incident.id,
      eventType: 'PARTICIPANT_JOINED',
      description: 'Priya (Support) and Rahul (Engineer) joined the live incident voice bridge',
      timestamp: new Date(Date.now() - 40 * 60 * 1000),
      source: {
        sourceType: 'HUMAN_SPOKEN',
        timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        confidence: 1.0,
        verificationStatus: 'VERIFIED',
      },
    },
  });

  await prisma.timelineEvent.create({
    data: {
      incidentId: incident.id,
      eventType: 'FACT',
      description: 'Confirmed Fact: Payment failures peaked at 42%',
      timestamp: new Date(Date.now() - 35 * 60 * 1000),
      source: {
        sourceType: 'MONITORING',
        timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        confidence: 1.0,
        verificationStatus: 'VERIFIED',
      },
    },
  });

  await prisma.timelineEvent.create({
    data: {
      incidentId: incident.id,
      eventType: 'ACTION_ITEM',
      description: 'Action assigned to Rahul: Investigate deployment logs',
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
      source: {
        sourceType: 'MANUAL_CONFIRMATION',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        confidence: 1.0,
        verificationStatus: 'VERIFIED',
      },
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
