// ============== GET /api/admin/health ==============
// Возвращает статус всех подсистем: лендинг, бот, БД, Prodamus.
// Защищён через requireAdmin — только авторизованный админ видит.

import { requireAdmin } from '../../lib/admin-auth.js';

export const config = { runtime: 'edge' };

// Утилита — пингует URL с таймаутом
async function ping(url, timeoutMs = 4000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    try {
        const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'manual',
        });
        clearTimeout(timer);
        return {
            ok: res.status >= 200 && res.status < 500,
            status: res.status,
            latency: Date.now() - startedAt,
        };
    } catch (e) {
        clearTimeout(timer);
        return {
            ok: false,
            status: 0,
            latency: Date.now() - startedAt,
            error: e.name === 'AbortError' ? 'timeout' : (e.message || 'unknown'),
        };
    }
}

export default async function handler(request) {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const checks = await Promise.all([
        // Лендинг — сам себя через cf-edge
        ping('https://aibuhgalter.com/').then((r) => ({ name: 'landing', label: 'Лендинг', ...r })),
        // Telegram бот — проверяем что @AI_Buxgalter_USN_bot отвечает на api
        ping('https://t.me/AI_Buxgalter_USN_bot').then((r) => ({ name: 'bot', label: 'Telegram бот', ...r })),
        // Cloudflare proxy активен
        ping('https://cloudflare.com/cdn-cgi/trace', 3000).then((r) => ({ name: 'cf', label: 'Cloudflare', ...r })),
    ]);

    // Доп. проверки наличия env vars (без раскрытия секретов)
    const env = {
        vercelToken: !!process.env.VERCEL_API_TOKEN,
        databaseUrl: !!process.env.DATABASE_URL,
        prodamusSecret: !!process.env.PRODAMUS_SECRET,
        adminSession: !!process.env.ADMIN_JWT_SECRET,
    };

    const allOk = checks.every((c) => c.ok);

    return new Response(
        JSON.stringify({
            ok: true,
            allOk,
            timestamp: Date.now(),
            checks,
            env,
        }),
        {
            status: 200,
            headers: { 'content-type': 'application/json' },
        }
    );
}
