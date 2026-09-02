const PBKDF2_ITERATIONS = 100_000;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function deriveBits(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
}

/** Stored format: pbkdf2$<saltHex>$<hashHex> */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(password, salt);
  return `pbkdf2$${toHex(salt)}$${toHex(bits)}`;
}

export function isHashedPassword(stored: string): boolean {
  return stored.split('$').length === 3 && stored.startsWith('pbkdf2$');
}

/**
 * Verifies against the pbkdf2$salt$hash format only. Rows written before
 * this format existed store the raw password — check isHashedPassword()
 * first and fall back to a direct compare (see verifyPasswordLegacyAware)
 * so existing accounts aren't locked out the moment this ships.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;

  const salt = fromHex(parts[1]);
  const expectedHex = parts[2];
  const bits = await deriveBits(password, salt);
  const actualHex = toHex(bits);

  if (actualHex.length !== expectedHex.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actualHex.length; i++) {
    mismatch |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Accepts either the new hashed format or a legacy plaintext row, so
 * deploying the hashing change doesn't lock out accounts created before it.
 * Callers should re-hash and persist on a true `legacy` result.
 */
export async function verifyPasswordLegacyAware(password: string, stored: string): Promise<{ valid: boolean; legacy: boolean }> {
  if (isHashedPassword(stored)) {
    return { valid: await verifyPassword(password, stored), legacy: false };
  }
  return { valid: stored === password, legacy: true };
}
