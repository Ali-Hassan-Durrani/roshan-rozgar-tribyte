import { Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '../common/crypto';

/** SendPK adapter. Never logs the code or the URL (it contains the key). */
@Injectable()
export class SmsService {
  private log = new Logger('SMS');

  async send(phone: string, message: string): Promise<boolean> {
    const { SENDPK_API_KEY, SENDPK_USERNAME, SENDPK_PASSWORD, SENDPK_SENDER } = process.env;
    const params = new URLSearchParams({ sender: SENDPK_SENDER || '', mobile: phone, message });
    if (SENDPK_API_KEY) params.set('api_key', SENDPK_API_KEY);
    else if (SENDPK_USERNAME && SENDPK_PASSWORD) {
      params.set('username', SENDPK_USERNAME);
      params.set('password', SENDPK_PASSWORD);
    } else {
      this.log.warn(`SendPK not configured; SMS to ${maskPhone(phone)} skipped`);
      return false;
    }
    try {
      const res = await fetch(`https://sendpk.com/api/sms.php?${params}`, { signal: AbortSignal.timeout(8000) });
      this.log.log(`SMS ${maskPhone(phone)} status=${res.status}`);
      return res.ok;
    } catch {
      this.log.warn(`SMS ${maskPhone(phone)} failed`);
      return false;
    }
  }
}
