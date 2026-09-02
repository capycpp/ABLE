// PBKDF2 helpers using Web Crypto for Workers
function utf8ToUint8Array(s: string) { return new TextEncoder().encode(s); }
function uint8ArrayToB64(u: Uint8Array) { let s = String.fromCharCode(...u); return btoa(s); }
function b64ToUint8Array(b: string) { const s = atob(b); return new Uint8Array(Array.from(s).map(c => c.charCodeAt(0))); }

export async function hashPassword(password: string, saltBytes: number = 16, iterations: number = 100_000) {
  const salt = crypto.getRandomValues(new Uint8Array(saltBytes));
  const keyMaterial = await crypto.subtle.importKey('raw', utf8ToUint8Array(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
  const hash = new Uint8Array(derived);
  return `pbkdf2$${iterations}$${uint8ArrayToB64(salt)}$${uint8ArrayToB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  try {
    const parts = stored.split('$');
    if (parts[0] !== 'pbkdf2') return false;
    const iterations = Number(parts[1]);
    const salt = b64ToUint8Array(parts[2]);
    const expected = b64ToUint8Array(parts[3]);
    const keyMaterial = await crypto.subtle.importKey('raw', utf8ToUint8Array(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, expected.length * 8);
    const hash = new Uint8Array(derived);
    if (hash.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ expected[i];
    return diff === 0;
  } catch (e) {
    return false;
  }
}
