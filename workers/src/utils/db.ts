// Minimal D1 helper functions
export async function queryAll(env: any, sql: string, params: any[] = []) {
  const stmt = env.DB.prepare(sql);
  const res = await stmt.all(...params);
  return res.results || [];
}

export async function queryOne(env: any, sql: string, params: any[] = []) {
  const stmt = env.DB.prepare(sql);
  const res = await stmt.bind(...params).all();
  const rows = res.results || [];
  return rows[0] || null;
}

export async function runQuery(env: any, sql: string, params: any[] = []) {
  const stmt = env.DB.prepare(sql);
  await stmt.bind(...params).run();
  return true;
}
