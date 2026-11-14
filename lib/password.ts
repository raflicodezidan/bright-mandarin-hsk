const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 10 karakter acak tanpa karakter yang mudah tertukar (0/O, 1/l/I). */
export function generatePassword(length = 10): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return result;
}
