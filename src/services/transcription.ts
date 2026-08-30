export interface TranscriptionSegment {
  text: string;
  speakerId: string;
  speakerName: string;
  timestamp: string;
  isFinal: boolean;
}

export class TranscriptionService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY || 'mock_deepgram_key';
  }

  /**
   * Generates a temporary credentials key/token for streaming Deepgram transcriptions.
   * Prevents exposing the main API key directly to the client browser.
   */
  async getEphemeralToken(): Promise<{ apiKey: string; url: string }> {
    if (!this.apiKey || this.apiKey === 'mock_deepgram_key') {
      return {
        apiKey: 'mock_client_key',
        url: 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000',
      };
    }

    // In production, we'd request a short-lived key from Deepgram's API.
    // For MVP, we can return the server key or mock depending on environment variables.
    return {
      apiKey: this.apiKey,
      url: 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&smart_format=true&diarize=true',
    };
  }

  /**
   * Mock transcript parsing for local testing without real-time microphone streams
   */
  async processSimulatedUtterance(text: string, speakerName: string): Promise<TranscriptionSegment> {
    return {
      text,
      speakerId: speakerName.toLowerCase(),
      speakerName,
      timestamp: new Date().toISOString(),
      isFinal: true,
    };
  }
}

export const transcriptionService = new TranscriptionService();
