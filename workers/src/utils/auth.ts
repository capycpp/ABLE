import { verifyJwt } from './jwt';

export async function getUserFromRequest(request: Request, env: any) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/__able_jwt=([^;]+)/);
  if (!m) return null;
  try {
    const payload = await verifyJwt(decodeURIComponent(m[1]), env);
    return payload;
  } catch (e) {
    return null;
  }
}

export async function requireAdmin(request: Request, env: any) {
  const user = await getUserFromRequest(request, env);
  if (!user || user.role !== 'admin') throw new Error('Admin access required');
  return user;
}
