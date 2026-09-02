import { queryAll, queryOne, runQuery } from '../utils/db';
import { getUserFromRequest, requireAdmin } from '../utils/auth';
import { hashPassword } from '../utils/password';

async function jsonBody(request: Request) {
  try { return await request.json(); } catch { return {}; }
}

function cryptoRandomId(prefix='r'){
  const b = crypto.getRandomValues(new Uint8Array(8));
  return prefix + '_' + Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');
}

export async function handleContentRoutes(request: Request, env: any) {
  const url = new URL(request.url);
  const path = url.pathname;
  const params = url.searchParams;

  if (request.method === 'GET' && path === '/api/content') {
    // Return core content lists (paginated callers should call specific endpoints)
    const problems = await queryAll(env, 'SELECT id, title, topic, difficulty, source, status FROM problems ORDER BY created_at DESC LIMIT 100');
    const articles = await queryAll(env, 'SELECT id, title, excerpt, status FROM articles ORDER BY created_at DESC LIMIT 100');
    const contests = await queryAll(env, 'SELECT id, title, year, type, description, status FROM contests ORDER BY year DESC LIMIT 100');
    return new Response(JSON.stringify({ problems, articles, contests }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'GET' && path === '/api/problems') {
    const q = params.get('q') || '';
    const limit = Number(params.get('limit') || '50');
    // Use KV cache for common list queries (no search)
    if (!q) {
      const cacheKey = `problems:list:limit=${limit}`;
      if (env.CACHE) {
        const cached = await env.CACHE.get(cacheKey);
        if (cached) return new Response(cached, { headers: { 'Content-Type': 'application/json' } });
      }
      const results = await queryAll(env, `SELECT id, title, topic, difficulty FROM problems ORDER BY created_at DESC LIMIT ?`, [limit]);
      const body = JSON.stringify({ results });
      if (env.CACHE) await env.CACHE.put(cacheKey, body, { expirationTtl: 60 });
      return new Response(body, { headers: { 'Content-Type': 'application/json' } });
    }
    // simple LIKE search
    const results = await queryAll(env, `SELECT p.id, p.title, p.topic, p.difficulty FROM problems p WHERE p.title LIKE '%' || ? || '%' LIMIT ?`, [q, limit]);
    return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'GET' && path.startsWith('/api/problems/')) {
    const id = path.split('/').pop();
    const p = await queryOne(env, 'SELECT * FROM problems WHERE id = ?', [id]);
    if (!p) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    const solutions = await queryAll(env, 'SELECT id, body, created_by, created_at FROM solutions WHERE problem_id = ? ORDER BY created_at', [id]);
    return new Response(JSON.stringify({ problem: p, solutions }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'GET' && path === '/api/articles') {
    const cacheKey = `articles:list:limit=100`;
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) return new Response(cached, { headers: { 'Content-Type': 'application/json' } });
    }
    const results = await queryAll(env, 'SELECT id, title, excerpt, status FROM articles ORDER BY created_at DESC LIMIT 100');
    const body = JSON.stringify({ results });
    if (env.CACHE) await env.CACHE.put(cacheKey, body, { expirationTtl: 60 });
    return new Response(body, { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'GET' && path === '/api/contests') {
    const cacheKey = `contests:list:limit=100`;
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) return new Response(cached, { headers: { 'Content-Type': 'application/json' } });
    }
    const results = await queryAll(env, 'SELECT id, title, year, type, description, status FROM contests ORDER BY year DESC LIMIT 100');
    const body = JSON.stringify({ results });
    if (env.CACHE) await env.CACHE.put(cacheKey, body, { expirationTtl: 60 });
    return new Response(body, { headers: { 'Content-Type': 'application/json' } });
  }

  // Admin management endpoints: /api/admin/{problems|articles|contests} and optional id
  const adminMatch = path.match(/^\/api\/admin\/(problems|articles|contests|users)(?:\/(.+))?$/);
  if (adminMatch) {
    try {
      await requireAdmin(request, env);
    } catch (e:any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const type = adminMatch[1];
    const itemId = adminMatch[2];
    const table = type;

    if (request.method === 'GET' && !itemId) {
      if (type === 'users') {
        const rows = await queryAll(env, `SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC`);
        return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
      }
      const rows = await queryAll(env, `SELECT * FROM ${table} ORDER BY created_at DESC`);
      return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'POST') {
      const body = await jsonBody(request);
      const id = cryptoRandomId(type.slice(0,1));
      const createdAt = new Date().toISOString();
      if (type === 'problems') {
        await runQuery(env, 'INSERT INTO problems (id,title,body,topic,difficulty,source,status,category_id,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', [id, body.title, body.body||null, body.topic||null, body.difficulty||null, body.source||null, body.status||'published', body.category_id||null, body.created_by||null, createdAt]);
        // invalidate cache
        if (env.CACHE) await env.CACHE.delete('problems:list:limit=50');
        return new Response(JSON.stringify({ id }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      if (type === 'users') {
        // create user with hashed password
        const uid = cryptoRandomId('u');
        const ph = body.password ? await hashPassword(String(body.password)) : null;
        await runQuery(env, 'INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)', [uid, body.name||'', body.email||'', ph, body.role||'user', createdAt]);
        return new Response(JSON.stringify({ id: uid }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      if (type === 'articles') {
        await runQuery(env, 'INSERT INTO articles (id,title,excerpt,body,category_id,status,created_at) VALUES (?,?,?,?,?,?,?)', [id, body.title, body.excerpt||null, body.body||null, body.category_id||null, body.status||'published', createdAt]);
        if (env.CACHE) await env.CACHE.delete('articles:list:limit=100');
        return new Response(JSON.stringify({ id }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      if (type === 'contests') {
        await runQuery(env, 'INSERT INTO contests (id,title,year,type,description,status,created_at) VALUES (?,?,?,?,?,?,?)', [id, body.title, body.year||null, body.type||null, body.description||null, body.status||'published', createdAt]);
        if (env.CACHE) await env.CACHE.delete('contests:list:limit=100');
        return new Response(JSON.stringify({ id }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (request.method === 'PUT' && itemId) {
      const body = await jsonBody(request);
      const updatedAt = new Date().toISOString();
      if (type === 'problems') {
        await runQuery(env, 'UPDATE problems SET title=?, body=?, topic=?, difficulty=?, source=?, status=?, category_id=?, updated_at=? WHERE id=?', [body.title, body.body||null, body.topic||null, body.difficulty||null, body.source||null, body.status||null, body.category_id||null, updatedAt, itemId]);
        if (env.CACHE) await env.CACHE.delete('problems:list:limit=50');
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (type === 'users') {
        // update user fields (password update not implemented here)
        await runQuery(env, 'UPDATE users SET name=?, email=?, role=?, updated_at=? WHERE id=?', [body.name||null, body.email||null, body.role||null, updatedAt, itemId]);
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (type === 'articles') {
        await runQuery(env, 'UPDATE articles SET title=?, excerpt=?, body=?, category_id=?, status=?, created_at=? WHERE id=?', [body.title, body.excerpt||null, body.body||null, body.category_id||null, body.status||null, updatedAt, itemId]);
        if (env.CACHE) await env.CACHE.delete('articles:list:limit=100');
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (type === 'contests') {
        await runQuery(env, 'UPDATE contests SET title=?, year=?, type=?, description=?, status=?, created_at=? WHERE id=?', [body.title, body.year||null, body.type||null, body.description||null, body.status||null, updatedAt, itemId]);
        if (env.CACHE) await env.CACHE.delete('contests:list:limit=100');
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (request.method === 'DELETE' && itemId) {
      if (type === 'users') {
        await runQuery(env, `DELETE FROM users WHERE id = ?`, [itemId]);
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      await runQuery(env, `DELETE FROM ${table} WHERE id = ?`, [itemId]);
      if (env.CACHE) {
        await env.CACHE.delete('problems:list:limit=50');
        await env.CACHE.delete('articles:list:limit=100');
        await env.CACHE.delete('contests:list:limit=100');
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}
