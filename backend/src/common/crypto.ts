import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export const hmac = (secret: string, v: string) => createHmac('sha256', secret).update(v).digest('hex');

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function encrypt(keyB64: string, plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', Buffer.from(keyB64, 'base64'), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function decrypt(keyB64: string, payload: string) {
  const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const d = createDecipheriv('aes-256-gcm', Buffer.from(keyB64, 'base64'), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

/** 03001234567 / +923001234567 → 923001234567, or null if not a PK mobile. */
export function normalizePhone(raw: string): string | null {
  const v = (raw || '').replace(/[\s-]/g, '');
  const m = v.match(/^(?:\+92|0092|92|0)?(3\d{9})$/);
  return m ? `92${m[1]}` : null;
}

export const maskPhone = (p: string) => `0${p.slice(2, 5)}•••${p.slice(-4)}`;
