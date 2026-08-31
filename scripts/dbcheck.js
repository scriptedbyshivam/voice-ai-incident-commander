const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  try {
    const incidents = await p.incident.count();
    console.log('Incidents in DB:', incidents);
    const facts = await p.fact.count();
    console.log('Facts in DB:', facts);
    const transcripts = await p.transcript.count();
    console.log('Transcripts in DB:', transcripts);
    const participants = await p.participant.count();
    console.log('Participants in DB:', participants);
    if (incidents > 0) {
      const first = await p.incident.findFirst({ select: { id: true, title: true, severity: true, currentStatus: true } });
      console.log('First incident:', JSON.stringify(first));
    } else {
      console.log('NO DATA - Database is empty. Need to run: npm run db:seed');
    }
  } catch (e) {
    console.log('DB ERROR:', e.message);
  } finally {
    await p.$disconnect();
  }
}
main();
