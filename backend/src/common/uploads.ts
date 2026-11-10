import sharp from 'sharp';
import { badRequest } from './errors';

/** Detects the real image type from magic bytes (never trusts client mime/extension). */
export function sniffImage(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'image/png';
  throw badRequest('BAD_FILE', 'Only JPEG or PNG images are allowed');
}

/** Magic-byte check, then re-encode as JPEG: strips EXIF/GPS and any payload hidden in the file. */
export async function cleanImage(buf: Buffer): Promise<{ mime: string; data: Uint8Array<ArrayBuffer>; size: number }> {
  sniffImage(buf);
  try {
    const out = await sharp(buf).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    return { mime: 'image/jpeg', data: new Uint8Array(out), size: out.length };
  } catch {
    throw badRequest('BAD_FILE', 'Image could not be read');
  }
}

export function sniffAudio(buf: Buffer): string {
  if (buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'audio/webm';
  if (buf.subarray(0, 4).toString('latin1') === 'OggS') return 'audio/ogg';
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') return 'audio/mp4';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF') return 'audio/wav';
  if (buf.subarray(0, 3).toString('latin1') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
    return 'audio/mpeg';
  }
  throw badRequest('BAD_FILE', 'Unsupported audio format');
}

export const IMAGE_MAX = 5 * 1024 * 1024;
export const AUDIO_MAX = 2 * 1024 * 1024;
