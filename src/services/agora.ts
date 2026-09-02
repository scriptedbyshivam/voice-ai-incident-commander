import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { Area } from 'agora-agents';

/** Shared agent UID — the Conversational AI Engine joins RTC as this user. */
export const AGORA_AGENT_UID_DEFAULT = 123456;
export const AGORA_AGENT_UID =
  parseInt(process.env.AGORA_AGENT_UID || '', 10) || AGORA_AGENT_UID_DEFAULT;

/** Maps AGORA_AREA (us|eu|ap|cn) to the Agora Agents SDK area string. */
export function agoraArea(): 'us' | 'eu' | 'ap' | 'cn' {
  const area = (process.env.AGORA_AREA || 'us').toLowerCase();
  return area === 'eu' || area === 'ap' || area === 'cn' ? area : 'us';
}

/** Converts the configurable area string into an Agora Agents API Area value. */
export function agoraAreaToAgentsArea(): Area.US | Area.EU | Area.AP | Area.CN {
  switch (agoraArea()) {
    case 'eu':
      return Area.EU;
    case 'ap':
      return Area.AP;
    case 'cn':
      return Area.CN;
    default:
      return Area.US;
  }
}

export interface AgoraRoomConfig {
  appId: string;
  channelName: string;
  token: string;
  uid: string | number;
  agentUid: number;
}

export class AgoraService {
  readonly appId: string;
  readonly appCertificate: string;

  constructor() {
    this.appId = process.env.AGORA_APP_ID || '';
    this.appCertificate = process.env.AGORA_APP_CERTIFICATE || '';
  }

  /** Returns true only when real Agora credentials are configured. */
  isConfigured(): boolean {
    return !!(this.appId && this.appCertificate && this.appId !== 'placeholder_agora_app_id');
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

  /**
   * Generates a combined RTC + RTM token (buildTokenWithRtm) for a channel.
   * The same token satisfies both the RTC channel join and the RTM login, so
   * the browser can receive agent transcript/state events over RTM.
   */
  async generateRtcRtmToken(
    channelName: string,
    uid: string | number
  ): Promise<string> {
    if (!this.appCertificate) {
      return `mock_token_${channelName}_${uid}_${Date.now() + 3600 * 1000}`;
    }

    const expirationTimeInSeconds = 3600; // Token valid for 1 hour
    return RtcTokenBuilder.buildTokenWithRtm(
      this.appId,
      this.appCertificate,
      channelName,
      String(uid),
      RtcRole.PUBLISHER,
      expirationTimeInSeconds,
      expirationTimeInSeconds
    );
  }

  async getRoomConfig(channelName: string, userId: string | number): Promise<AgoraRoomConfig> {
    const token = await this.generateRtcRtmToken(channelName, userId);
    return {
      appId: this.appId,
      channelName,
      token,
      uid: userId,
      agentUid: AGORA_AGENT_UID,
    };
  }

  /**
   * Generates a dedicated RTM token for an arbitrary RTM user id. Used to give
   * the Commander a fresh, unique RTM identity per connection so a stale
   * server-side RTM session for a reused uid never surfaces as -10027
   * (RTM_ERROR_DUPLICATE_USER_ID).
   */
  async generateRtmToken(channelName: string, uid: string | number): Promise<string> {
    if (!this.appCertificate) {
      return `mock_rtm_token_${channelName}_${uid}_${Date.now() + 3600 * 1000}`;
    }
    const expirationTimeInSeconds = 3600; // Token valid for 1 hour
    return RtcTokenBuilder.buildTokenWithRtm(
      this.appId,
      this.appCertificate,
      channelName,
      String(uid),
      RtcRole.PUBLISHER,
      expirationTimeInSeconds,
      expirationTimeInSeconds
    );
  }
}

export const agoraService = new AgoraService();
export default agoraService;
