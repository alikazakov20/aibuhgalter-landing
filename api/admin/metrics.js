// ============== GET /api/admin/metrics ==============
// Метрики для дашборда: визиты, конверсия, MRR, воронка, топ-события, источники.
// Источники данных (по приоритету):
//   1) Vercel Analytics API (если есть VERCEL_API_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID)
//   2) Vercel KV (если есть KV_URL + KV_REST_API_TOKEN — наш собственный трекинг)
//   3) Mock — заглушка с разумными числами для UI до подключения реальных данных

import { requireAdmin } from '../../lib/admin-auth.js';

export const config = { runtime: 'edge' };

// ─── Mock-данные (используются пока нет реального backend) ──────────────
function buildMockMetrics() {
    return {
        kpi: {
            visitsToday: 0,
            visits7d: 0,
            visits30d: 0,
            ctaClicks7d: 0,
            botSubscribers: 0,
            mrr: 0,
            payingUsers: 0,
        },
        funnel: {
            visit: 0,
            calc: 0,
            cta: 0,
            bot: 0,
            paid: 0,
        },
        topEvents: [],
        topSources: [],
    };
}

// ─── Vercel Analytics API (Web Insights) ────────────────────────────────
// Документация: https://vercel.com/docs/observability/web-analytics-api (private)
// Требует Personal Access Token + Team ID + Project ID
async function fetchVercelAnalytics() {
    const token = process.env.VERCEL_API_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;
    const projectId = process.env.VERCEL_PROJECT_ID;
    if (!token || !projectId) return null;

    const teamParam = teamId ? `&teamId=${teamId}` : '';
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const from7d = now - 7 * day;
    const from30d = now - 30 * day;

    // Параллельно тянем разные диапазоны
    const headers = { 'Authorization': `Bearer ${token}` };
    const url = (range) =>
        `https://vercel.com/api/web-analytics/v0/projects/${projectId}/views?from=${range.from}&to=${now}${teamParam}`;

    try {
        const [r7, r30] = await Promise.all([
            fetch(url({ from: from7d }), { headers }).then((r) => r.ok ? r.json() : null),
            fetch(url({ from: from30d }), { headers }).then((r) => r.ok ? r.json() : null),
        ]);

        // Vercel Analytics API возвращает { views: [...], totals: { views, visitors } }
        // Если schema не совпадёт — fallback на null, чтобы упасть на mock
        if (!r7 || !r30) return null;

        return {
            kpi: {
                visitsToday: 0, // нужно добавить отдельный запрос на 1d
                visits7d: r7.totals?.views || 0,
                visits30d: r30.totals?.views || 0,
                ctaClicks7d: 0,
                botSubscribers: 0,
                mrr: 0,
                payingUsers: 0,
            },
            funnel: { visit: r7.totals?.views || 0, calc: 0, cta: 0, bot: 0, paid: 0 },
            topEvents: [],
            topSources: [],
        };
    } catch {
        return null;
    }
}

export default async function handler(request) {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    let data = null;
    let dataSource = 'mock';

    // 1. Пробуем Vercel Analytics
    data = await fetchVercelAnalytics();
    if (data) dataSource = 'vercel-analytics';

    // 2. Fallback — mock
    if (!data) {
        data = buildMockMetrics();
        dataSource = 'mock';
    }

    return new Response(
        JSON.stringify({
            ok: true,
            isMock: dataSource === 'mock',
            dataSource,
            data,
            generatedAt: Date.now(),
        }),
        {
            status: 200,
            headers: {
                'content-type': 'application/json',
                'cache-control': 'private, max-age=30', // короткий кэш — обновление раз в 30с
            },
        }
    );
}
