import { RtcTokenBuilder, RtcRole } from 'agora-token';

export interface AgoraRoomConfig {
  appId: string;
  channelName: string;
  token: string;
  uid: string | number;
}

export class AgoraService {
  private appId: string;
  private appCertificate: string;

  constructor() {
    this.appId = process.env.AGORA_APP_ID || 'mock_agora_app_id';
    this.appCertificate = process.env.AGORA_APP_CERTIFICATE || '';
  }

  /**
   * Generates a secure Agora RTC token for a channel.
   * If AGORA_APP_CERTIFICATE is not configured, returns a mock token.
   */
  async generateRtcToken(
    channelName: string,
    uid: string | number,
    role: 'publisher' | 'subscriber' = 'publisher'
  ): Promise<string> {
    if (!this.appCertificate) {
      // Mock token for development/sandbox mode
      return `mock_token_${channelName}_${uid}_${role}_${Date.now() + 3600 * 1000}`;
    }

    const expirationTimeInSeconds = 3600; // Token valid for 1 hour
    const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    // Handle uid based on type
    if (typeof uid === 'number') {
      return RtcTokenBuilder.buildTokenWithUid(
        this.appId,
        this.appCertificate,
        channelName,
        uid,
        rtcRole,
        expirationTimeInSeconds,
        expirationTimeInSeconds
      );
    } else {
      // If uid is a string (e.g. UUID), use buildTokenWithUserAccount
      return RtcTokenBuilder.buildTokenWithUserAccount(
        this.appId,
        this.appCertificate,
        channelName,
        uid,
        rtcRole,
        expirationTimeInSeconds,
        expirationTimeInSeconds
      );
    }
  }

  async getRoomConfig(channelName: string, userId: string | number): Promise<AgoraRoomConfig> {
    const token = await this.generateRtcToken(channelName, userId, 'publisher');
    return {
      appId: this.appId,
      channelName,
      token,
      uid: userId,
    };
  }
}

export const agoraService = new AgoraService();
export default agoraService;
