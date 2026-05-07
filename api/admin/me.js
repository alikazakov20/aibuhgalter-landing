// ============== GET /api/admin/me ==============
// Проверка статуса авторизации. Используется фронтом для решения «показать login или панель».

import { requireAdmin } from '../../lib/admin-auth.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    return new Response(JSON.stringify({
        ok: true,
        sub: auth.payload.sub,
        exp: auth.payload.exp,
    }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}
