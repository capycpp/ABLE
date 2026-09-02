import { handleContentRoutes } from './routes/content';
import { handleAuthRoutes } from './routes/auth';

export async function handleRequest(request: Request, env: any, ctx: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Public content endpoints
  if (path.startsWith('/api/') && (path.startsWith('/api/problems') || path.startsWith('/api/articles') || path.startsWith('/api/contests') || path.startsWith('/api/formulas') || path === '/api/content' || path.startsWith('/api/search') || path.startsWith('/api/recommendations'))) {
    return handleContentRoutes(request, env, ctx);
  }

  // Auth endpoints
  if (path.startsWith('/api/') && (path === '/api/signup' || path === '/api/login' || path === '/api/logout' || path === '/api/me')) {
    return handleAuthRoutes(request, env, ctx);
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}
