@echo off
cd /d C:\Users\Shivam Maurya\Desktop\agora
set DEEPGRAM_API_KEY=8a9e2210152381b5ab7d53d0099717635ec9ad7e
set TRANSCRIPTION_WS_PORT=3001
set NEXT_PUBLIC_BASE_URL=http://localhost:3000
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/incident_commander?schema=public
set TTS_PROVIDER=edge
npx ts-node --project tsconfig.server.json src/server/transcription-server.ts
