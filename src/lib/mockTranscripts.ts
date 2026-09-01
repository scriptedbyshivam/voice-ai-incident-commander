export interface MockTranscriptSegment {
  speaker: string;
  text: string;
  delayMs: number;
}

export const SAMPLE_INCIDENT_SPEECH: MockTranscriptSegment[] = [
  { speaker: 'Rahul (Engineer)', text: 'Payment gateway 504 errors spiking to 45%. Connection pool saturated.', delayMs: 1000 },
  { speaker: 'Priya (Support)', text: 'Customer tickets queue reached 180 pending cases.', delayMs: 4000 },
  { speaker: 'Amit (SRE)', text: 'I am scaling payment-service pods from 4 to 12 replicas now.', delayMs: 8000 },
];

export function getSampleSpeech(): MockTranscriptSegment[] {
  return SAMPLE_INCIDENT_SPEECH;
}
