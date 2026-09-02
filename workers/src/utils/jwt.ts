// Simple JWT using HMAC-SHA256 via Web Crypto
async function hmacSha256(key: CryptoKey, data: Uint8Array) {
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return new Uint8Array(sig);
}

function b64url(buf: Uint8Array) {
  let s = Array.from(buf).map(b => String.fromCharCode(b)).join('');
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function utf8ToUint8Array(str: string) {
  return new TextEncoder().encode(str);
}

export async function signJwt(payload: any, env: any) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + 60 * 60 * 24 * 7 };
  const headerB = b64url(utf8ToUint8Array(JSON.stringify(header)));
  const bodyB = b64url(utf8ToUint8Array(JSON.stringify(body)));
  const toSign = utf8ToUint8Array(`${headerB}.${bodyB}`);
  const keyData = utf8ToUint8Array(env.JWT_SECRET || 'dev-secret');
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await hmacSha256(cryptoKey, toSign);
  const sigB = b64url(sig);
  return `${headerB}.${bodyB}.${sigB}`;
}

export async function verifyJwt(token: string, env: any) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [headerB, bodyB, sigB] = parts;
  const toSign = utf8ToUint8Array(`${headerB}.${bodyB}`);
  const keyData = utf8ToUint8Array(env.JWT_SECRET || 'dev-secret');
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const expected = await crypto.subtle.sign('HMAC', cryptoKey, toSign);
  // compare signature bytes
  // Convert provided sig back from base64url
  const sigStr = sigB.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (sigStr.length % 4)) % 4);
  const raw = atob(sigStr + pad);
  const sigBytes = new Uint8Array(Array.from(raw).map(c => c.charCodeAt(0)));
  const expectedBytes = new Uint8Array(expected);
  if (sigBytes.length !== expectedBytes.length) throw new Error('Invalid signature');
  for (let i = 0; i < sigBytes.length; i++) if (sigBytes[i] !== expectedBytes[i]) throw new Error('Invalid signature');
  const bodyJson = JSON.parse(decodeURIComponent(escape(atob(bodyB.replace(/-/g,'+').replace(/_/g,'/')))));
  const now = Math.floor(Date.now() / 1000);
  if (bodyJson.exp && bodyJson.exp < now) throw new Error('Token expired');
  return bodyJson;
}
