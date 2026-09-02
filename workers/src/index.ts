import { handleRequest } from './router';

export default {
  async fetch(request: Request, env: any, ctx: any) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
};
