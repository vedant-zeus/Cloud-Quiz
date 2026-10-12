import crypto from 'crypto';

const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRoomCode(length = 6): string {
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS[randomBytes[i] % CODE_CHARS.length];
  }
  return result;
}
