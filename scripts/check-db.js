// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const incidents = await prisma.incident.findMany({
    include: {
      facts: true,
      hypotheses: true,
      decisions: true,
      actions: true,
      conflicts: true,
      questions: true,
      participants: { include: { user: true } },
      timeline: true,
    },
  });

  console.log('=== REAL POSTGRESQL DATABASE STATUS ===');
  console.log(`Total Users in DB: ${users.length}`);
  console.log(`Total Incidents in DB: ${incidents.length}`);
  incidents.forEach((inc) => {
    console.log(`\nIncident: "${inc.title}" (ID: ${inc.id})`);
    console.log(`- Severity: ${inc.severity}`);
    console.log(`- Status: ${inc.status}`);
    console.log(`- Facts: ${inc.facts.length}`);
    console.log(`- Hypotheses: ${inc.hypotheses.length}`);
    console.log(`- Decisions: ${inc.decisions.length}`);
    console.log(`- Actions: ${inc.actions.length}`);
    console.log(`- Conflicts: ${inc.conflicts.length}`);
    console.log(`- Questions: ${inc.questions.length}`);
    console.log(`- Timeline Events: ${inc.timeline.length}`);
    console.log(`- Participants: ${inc.participants.map((p) => `${p.user.name} (${p.role})`).join(', ')}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
