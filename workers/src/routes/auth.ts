import { runQuery, queryOne } from '../utils/db';
import { signJwt, verifyJwt } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';

async function jsonBody(request: Request) {
  try { return await request.json(); } catch { return {}; }
}

export async function handleAuthRoutes(request: Request, env: any) {
  const path = new URL(request.url).pathname;

  if (request.method === 'GET' && path === '/api/me') {
    const cookie = request.headers.get('Cookie') || '';
    const m = cookie.match(/__able_jwt=([^;]+)/);
    if (!m) return new Response(JSON.stringify({ user: null }), { headers: { 'Content-Type': 'application/json' } });
    try {
      const payload = await verifyJwt(decodeURIComponent(m[1]), env);
      return new Response(JSON.stringify({ user: payload }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ user: null }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (request.method === 'POST' && path === '/api/signup') {
    const body = await jsonBody(request);
    if (!body.name || !body.email || !body.password || body.password.length < 8) {
      return new Response(JSON.stringify({ error: 'Name, email and a password of at least 8 characters are required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const email = String(body.email).trim().toLowerCase();
    // ensure unique email
    const existing = await queryOne(env, 'SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing) return new Response(JSON.stringify({ error: 'An account with this email already exists.' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    const createdAt = new Date().toISOString();
    const uid = cryptoRandomId('u');
    const ph = await hashPassword(String(body.password));
    await runQuery(env, 'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)', [uid, String(body.name).slice(0,80), email, ph, 'user', createdAt]);
    const user = { id: uid, name: body.name, email };
    const token = await signJwt(user, env);
    return new Response(JSON.stringify({ user }), { status: 201, headers: { 'Content-Type': 'application/json', 'Set-Cookie': `__able_jwt=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=None; Secure; Max-Age=604800` } });
  }

  if (request.method === 'POST' && path === '/api/login') {
    const body = await jsonBody(request);
    const email = String(body.email || '').toLowerCase();
    const row = await queryOne(env, 'SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (!row || !row.id) return new Response(JSON.stringify({ error: 'Invalid email or password.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    const stored = row.password_hash || '';
    const ok = await verifyPassword(String(body.password || ''), stored);
    if (!ok) return new Response(JSON.stringify({ error: 'Invalid email or password.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    const token = await signJwt(user, env);
    return new Response(JSON.stringify({ user }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': `__able_jwt=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=None; Secure; Max-Age=604800` } });
  }

  if (request.method === 'POST' && path === '/api/logout') {
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': '__able_jwt=; HttpOnly; Path=/; Max-Age=0; SameSite=None; Secure' } });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}

function cryptoRandomId(prefix='r'){
  const b = crypto.getRandomValues(new Uint8Array(8));
  return prefix + '_' + Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');
}
