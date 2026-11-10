import { Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '../common/crypto';

/**
 * SMS gateway. SimGate (an Android phone sending real SMS) is the default; SendPK is kept as an alternative.
 * Never logs the code, the message or the API key.
 */
@Injectable()
export class SmsService {
  private log = new Logger('SMS');

  /** `phone` is normalised 923XXXXXXXXX. */
  async send(phone: string, message: string): Promise<boolean> {
    if (process.env.SIMGATE_API_KEY) return this.simgate(phone, message);
    if (process.env.SENDPK_API_KEY || process.env.SENDPK_USERNAME) return this.sendpk(phone, message);
    this.log.warn(`No SMS provider configured; SMS to ${maskPhone(phone)} skipped`);
    return false;
  }

  private async simgate(phone: string, message: string) {
    const url = process.env.SIMGATE_URL || 'https://api.simgate.app/v1/sms/send';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'x-api-key': process.env.SIMGATE_API_KEY!, 'Content-Type': 'application/json' },
        // SimGate expects the local format 03XXXXXXXXX.
        body: JSON.stringify({ deviceId: process.env.SIMGATE_DEVICE_ID, phoneNumber: `0${phone.slice(2)}`, message }),
        signal: AbortSignal.timeout(10_000),
      });
      this.log.log(`SimGate ${maskPhone(phone)} status=${res.status}`);
      return res.ok;
    } catch (e) {
      this.log.warn(`SimGate ${maskPhone(phone)} failed: ${(e as Error).name}`);
      return false;
    }
  }

  private async sendpk(phone: string, message: string) {
    const { SENDPK_API_KEY, SENDPK_USERNAME, SENDPK_PASSWORD, SENDPK_SENDER } = process.env;
    const params = new URLSearchParams({ sender: SENDPK_SENDER || '', mobile: phone, message });
    if (SENDPK_API_KEY) params.set('api_key', SENDPK_API_KEY);
    else {
      params.set('username', SENDPK_USERNAME || '');
      params.set('password', SENDPK_PASSWORD || '');
    }
    try {
      const res = await fetch(`https://sendpk.com/api/sms.php?${params}`, { signal: AbortSignal.timeout(8000) });
      this.log.log(`SendPK ${maskPhone(phone)} status=${res.status}`);
      return res.ok;
    } catch {
      this.log.warn(`SendPK ${maskPhone(phone)} failed`);
      return false;
    }
  }
}
