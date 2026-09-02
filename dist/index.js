// src/utils/db.ts
async function queryAll(env, sql, params = []) {
  const stmt = env.DB.prepare(sql);
  const res = await stmt.all(...params);
  return res.results || [];
}
async function queryOne(env, sql, params = []) {
  const stmt = env.DB.prepare(sql);
  const res = await stmt.bind(...params).all();
  const rows = res.results || [];
  return rows[0] || null;
}
async function runQuery(env, sql, params = []) {
  const stmt = env.DB.prepare(sql);
  await stmt.bind(...params).run();
  return true;
}

// src/utils/jwt.ts
async function hmacSha256(key, data) {
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return new Uint8Array(sig);
}
function b64url(buf) {
  let s = Array.from(buf).map((b) => String.fromCharCode(b)).join("");
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function utf8ToUint8Array(str) {
  return new TextEncoder().encode(str);
}
async function signJwt(payload, env) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const body = { ...payload, iat: now, exp: now + 60 * 60 * 24 * 7 };
  const headerB = b64url(utf8ToUint8Array(JSON.stringify(header)));
  const bodyB = b64url(utf8ToUint8Array(JSON.stringify(body)));
  const toSign = utf8ToUint8Array(`${headerB}.${bodyB}`);
  const keyData = utf8ToUint8Array(env.JWT_SECRET || "dev-secret");
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await hmacSha256(cryptoKey, toSign);
  const sigB = b64url(sig);
  return `${headerB}.${bodyB}.${sigB}`;
}
async function verifyJwt(token, env) {
  const parts = token.split(".");
  if (parts.length !== 3)
    throw new Error("Invalid token");
  const [headerB, bodyB, sigB] = parts;
  const toSign = utf8ToUint8Array(`${headerB}.${bodyB}`);
  const keyData = utf8ToUint8Array(env.JWT_SECRET || "dev-secret");
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const expected = await crypto.subtle.sign("HMAC", cryptoKey, toSign);
  const sigStr = sigB.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - sigStr.length % 4) % 4);
  const raw = atob(sigStr + pad);
  const sigBytes = new Uint8Array(Array.from(raw).map((c) => c.charCodeAt(0)));
  const expectedBytes = new Uint8Array(expected);
  if (sigBytes.length !== expectedBytes.length)
    throw new Error("Invalid signature");
  for (let i = 0; i < sigBytes.length; i++)
    if (sigBytes[i] !== expectedBytes[i])
      throw new Error("Invalid signature");
  const bodyJson = JSON.parse(decodeURIComponent(escape(atob(bodyB.replace(/-/g, "+").replace(/_/g, "/")))));
  const now = Math.floor(Date.now() / 1e3);
  if (bodyJson.exp && bodyJson.exp < now)
    throw new Error("Token expired");
  return bodyJson;
}

// src/utils/auth.ts
async function getUserFromRequest(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/__able_jwt=([^;]+)/);
  if (!m)
    return null;
  try {
    const payload = await verifyJwt(decodeURIComponent(m[1]), env);
    return payload;
  } catch (e) {
    return null;
  }
}
async function requireAdmin(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user || user.role !== "admin")
    throw new Error("Admin access required");
  return user;
}

// src/utils/password.ts
function utf8ToUint8Array2(s) {
  return new TextEncoder().encode(s);
}
function uint8ArrayToB64(u) {
  let s = String.fromCharCode(...u);
  return btoa(s);
}
function b64ToUint8Array(b) {
  const s = atob(b);
  return new Uint8Array(Array.from(s).map((c) => c.charCodeAt(0)));
}
async function hashPassword(password, saltBytes = 16, iterations = 1e5) {
  const salt = crypto.getRandomValues(new Uint8Array(saltBytes));
  const keyMaterial = await crypto.subtle.importKey("raw", utf8ToUint8Array2(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256);
  const hash = new Uint8Array(derived);
  return `pbkdf2$${iterations}$${uint8ArrayToB64(salt)}$${uint8ArrayToB64(hash)}`;
}
async function verifyPassword(password, stored) {
  try {
    const parts = stored.split("$");
    if (parts[0] !== "pbkdf2")
      return false;
    const iterations = Number(parts[1]);
    const salt = b64ToUint8Array(parts[2]);
    const expected = b64ToUint8Array(parts[3]);
    const keyMaterial = await crypto.subtle.importKey("raw", utf8ToUint8Array2(password), { name: "PBKDF2" }, false, ["deriveBits"]);
    const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, expected.length * 8);
    const hash = new Uint8Array(derived);
    if (hash.length !== expected.length)
      return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++)
      diff |= hash[i] ^ expected[i];
    return diff === 0;
  } catch (e) {
    return false;
  }
}

// src/routes/content.ts
async function jsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
function cryptoRandomId(prefix = "r") {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return prefix + "_" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function handleContentRoutes(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const params = url.searchParams;
  if (request.method === "GET" && path === "/api/content") {
    const problems = await queryAll(env, "SELECT id, title, topic, difficulty, source, status FROM problems ORDER BY created_at DESC LIMIT 100");
    const articles = await queryAll(env, "SELECT id, title, excerpt, status FROM articles ORDER BY created_at DESC LIMIT 100");
    const contests = await queryAll(env, "SELECT id, title, year, type, description, status FROM contests ORDER BY year DESC LIMIT 100");
    return new Response(JSON.stringify({ problems, articles, contests }), { headers: { "Content-Type": "application/json" } });
  }
  if (request.method === "GET" && path === "/api/problems") {
    const q = params.get("q") || "";
    const limit = Number(params.get("limit") || "50");
    if (!q) {
      const cacheKey = `problems:list:limit=${limit}`;
      if (env.CACHE) {
        const cached = await env.CACHE.get(cacheKey);
        if (cached)
          return new Response(cached, { headers: { "Content-Type": "application/json" } });
      }
      const results2 = await queryAll(env, `SELECT id, title, topic, difficulty FROM problems ORDER BY created_at DESC LIMIT ?`, [limit]);
      const body = JSON.stringify({ results: results2 });
      if (env.CACHE)
        await env.CACHE.put(cacheKey, body, { expirationTtl: 60 });
      return new Response(body, { headers: { "Content-Type": "application/json" } });
    }
    const results = await queryAll(env, `SELECT p.id, p.title, p.topic, p.difficulty FROM problems p WHERE p.title LIKE '%' || ? || '%' LIMIT ?`, [q, limit]);
    return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
  }
  if (request.method === "GET" && path.startsWith("/api/problems/")) {
    const id = path.split("/").pop();
    const p = await queryOne(env, "SELECT * FROM problems WHERE id = ?", [id]);
    if (!p)
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    const solutions = await queryAll(env, "SELECT id, body, created_by, created_at FROM solutions WHERE problem_id = ? ORDER BY created_at", [id]);
    return new Response(JSON.stringify({ problem: p, solutions }), { headers: { "Content-Type": "application/json" } });
  }
  if (request.method === "GET" && path === "/api/articles") {
    const cacheKey = `articles:list:limit=100`;
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheKey);
      if (cached)
        return new Response(cached, { headers: { "Content-Type": "application/json" } });
    }
    const results = await queryAll(env, "SELECT id, title, excerpt, status FROM articles ORDER BY created_at DESC LIMIT 100");
    const body = JSON.stringify({ results });
    if (env.CACHE)
      await env.CACHE.put(cacheKey, body, { expirationTtl: 60 });
    return new Response(body, { headers: { "Content-Type": "application/json" } });
  }
  if (request.method === "GET" && path === "/api/contests") {
    const cacheKey = `contests:list:limit=100`;
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheKey);
      if (cached)
        return new Response(cached, { headers: { "Content-Type": "application/json" } });
    }
    const results = await queryAll(env, "SELECT id, title, year, type, description, status FROM contests ORDER BY year DESC LIMIT 100");
    const body = JSON.stringify({ results });
    if (env.CACHE)
      await env.CACHE.put(cacheKey, body, { expirationTtl: 60 });
    return new Response(body, { headers: { "Content-Type": "application/json" } });
  }
  const adminMatch = path.match(/^\/api\/admin\/(problems|articles|contests|users)(?:\/(.+))?$/);
  if (adminMatch) {
    try {
      await requireAdmin(request, env);
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    const type = adminMatch[1];
    const itemId = adminMatch[2];
    const table = type;
    if (request.method === "GET" && !itemId) {
      if (type === "users") {
        const rows2 = await queryAll(env, `SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC`);
        return new Response(JSON.stringify(rows2), { headers: { "Content-Type": "application/json" } });
      }
      const rows = await queryAll(env, `SELECT * FROM ${table} ORDER BY created_at DESC`);
      return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });
    }
    if (request.method === "POST") {
      const body = await jsonBody(request);
      const id = cryptoRandomId(type.slice(0, 1));
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      if (type === "problems") {
        await runQuery(env, "INSERT INTO problems (id,title,body,topic,difficulty,source,status,category_id,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", [id, body.title, body.body || null, body.topic || null, body.difficulty || null, body.source || null, body.status || "published", body.category_id || null, body.created_by || null, createdAt]);
        if (env.CACHE)
          await env.CACHE.delete("problems:list:limit=50");
        return new Response(JSON.stringify({ id }), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      if (type === "users") {
        const uid = cryptoRandomId("u");
        const ph = body.password ? await hashPassword(String(body.password)) : null;
        await runQuery(env, "INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)", [uid, body.name || "", body.email || "", ph, body.role || "user", createdAt]);
        return new Response(JSON.stringify({ id: uid }), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      if (type === "articles") {
        await runQuery(env, "INSERT INTO articles (id,title,excerpt,body,category_id,status,created_at) VALUES (?,?,?,?,?,?,?)", [id, body.title, body.excerpt || null, body.body || null, body.category_id || null, body.status || "published", createdAt]);
        if (env.CACHE)
          await env.CACHE.delete("articles:list:limit=100");
        return new Response(JSON.stringify({ id }), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      if (type === "contests") {
        await runQuery(env, "INSERT INTO contests (id,title,year,type,description,status,created_at) VALUES (?,?,?,?,?,?,?)", [id, body.title, body.year || null, body.type || null, body.description || null, body.status || "published", createdAt]);
        if (env.CACHE)
          await env.CACHE.delete("contests:list:limit=100");
        return new Response(JSON.stringify({ id }), { status: 201, headers: { "Content-Type": "application/json" } });
      }
    }
    if (request.method === "PUT" && itemId) {
      const body = await jsonBody(request);
      const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (type === "problems") {
        await runQuery(env, "UPDATE problems SET title=?, body=?, topic=?, difficulty=?, source=?, status=?, category_id=?, updated_at=? WHERE id=?", [body.title, body.body || null, body.topic || null, body.difficulty || null, body.source || null, body.status || null, body.category_id || null, updatedAt, itemId]);
        if (env.CACHE)
          await env.CACHE.delete("problems:list:limit=50");
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }
      if (type === "users") {
        await runQuery(env, "UPDATE users SET name=?, email=?, role=?, updated_at=? WHERE id=?", [body.name || null, body.email || null, body.role || null, updatedAt, itemId]);
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }
      if (type === "articles") {
        await runQuery(env, "UPDATE articles SET title=?, excerpt=?, body=?, category_id=?, status=?, created_at=? WHERE id=?", [body.title, body.excerpt || null, body.body || null, body.category_id || null, body.status || null, updatedAt, itemId]);
        if (env.CACHE)
          await env.CACHE.delete("articles:list:limit=100");
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }
      if (type === "contests") {
        await runQuery(env, "UPDATE contests SET title=?, year=?, type=?, description=?, status=?, created_at=? WHERE id=?", [body.title, body.year || null, body.type || null, body.description || null, body.status || null, updatedAt, itemId]);
        if (env.CACHE)
          await env.CACHE.delete("contests:list:limit=100");
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }
    }
    if (request.method === "DELETE" && itemId) {
      if (type === "users") {
        await runQuery(env, `DELETE FROM users WHERE id = ?`, [itemId]);
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }
      await runQuery(env, `DELETE FROM ${table} WHERE id = ?`, [itemId]);
      if (env.CACHE) {
        await env.CACHE.delete("problems:list:limit=50");
        await env.CACHE.delete("articles:list:limit=100");
        await env.CACHE.delete("contests:list:limit=100");
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    }
  }
  return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
}

// src/routes/auth.ts
async function jsonBody2(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
async function handleAuthRoutes(request, env) {
  const path = new URL(request.url).pathname;
  if (request.method === "GET" && path === "/api/me") {
    const cookie = request.headers.get("Cookie") || "";
    const m = cookie.match(/__able_jwt=([^;]+)/);
    if (!m)
      return new Response(JSON.stringify({ user: null }), { headers: { "Content-Type": "application/json" } });
    try {
      const payload = await verifyJwt(decodeURIComponent(m[1]), env);
      return new Response(JSON.stringify({ user: payload }), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ user: null }), { headers: { "Content-Type": "application/json" } });
    }
  }
  if (request.method === "POST" && path === "/api/signup") {
    const body = await jsonBody2(request);
    if (!body.name || !body.email || !body.password || body.password.length < 8) {
      return new Response(JSON.stringify({ error: "Name, email and a password of at least 8 characters are required." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const email = String(body.email).trim().toLowerCase();
    const existing = await queryOne(env, "SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existing)
      return new Response(JSON.stringify({ error: "An account with this email already exists." }), { status: 409, headers: { "Content-Type": "application/json" } });
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const uid = cryptoRandomId2("u");
    const ph = await hashPassword(String(body.password));
    await runQuery(env, "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)", [uid, String(body.name).slice(0, 80), email, ph, "user", createdAt]);
    const user = { id: uid, name: body.name, email };
    const token = await signJwt(user, env);
    return new Response(JSON.stringify({ user }), { status: 201, headers: { "Content-Type": "application/json", "Set-Cookie": `__able_jwt=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=None; Secure; Max-Age=604800` } });
  }
  if (request.method === "POST" && path === "/api/login") {
    const body = await jsonBody2(request);
    const email = String(body.email || "").toLowerCase();
    const row = await queryOne(env, "SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    if (!row || !row.id)
      return new Response(JSON.stringify({ error: "Invalid email or password." }), { status: 401, headers: { "Content-Type": "application/json" } });
    const stored = row.password_hash || "";
    const ok = await verifyPassword(String(body.password || ""), stored);
    if (!ok)
      return new Response(JSON.stringify({ error: "Invalid email or password." }), { status: 401, headers: { "Content-Type": "application/json" } });
    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    const token = await signJwt(user, env);
    return new Response(JSON.stringify({ user }), { headers: { "Content-Type": "application/json", "Set-Cookie": `__able_jwt=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=None; Secure; Max-Age=604800` } });
  }
  if (request.method === "POST" && path === "/api/logout") {
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", "Set-Cookie": "__able_jwt=; HttpOnly; Path=/; Max-Age=0; SameSite=None; Secure" } });
  }
  return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
}
function cryptoRandomId2(prefix = "r") {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return prefix + "_" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// src/router.ts
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith("/api/") && (path.startsWith("/api/problems") || path.startsWith("/api/articles") || path.startsWith("/api/contests") || path.startsWith("/api/formulas") || path === "/api/content" || path.startsWith("/api/search") || path.startsWith("/api/recommendations"))) {
    return handleContentRoutes(request, env, ctx);
  }
  if (path.startsWith("/api/") && (path === "/api/signup" || path === "/api/login" || path === "/api/logout" || path === "/api/me")) {
    return handleAuthRoutes(request, env, ctx);
  }
  return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
}

// src/index.ts
var src_default = {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || "Server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }
};
export {
  src_default as default
};
