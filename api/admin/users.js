// ============== GET /api/admin/users ==============
// Список пользователей бота + email-подписок.
// Источник: Railway PostgreSQL (общая БД с ботом). Если DATABASE_URL нет — mock.
//
// Параметры:
//   ?search=email — фильтр
//   ?limit=50 — кол-во записей (default 50, max 500)
//   ?offset=0 — пагинация

import { requireAdmin } from '../../lib/admin-auth.js';

export const config = { runtime: 'edge' };

function buildMockUsers() {
    return {
        stats: {
            totalBotUsers: 0,
            active7d: 0,
            emailSubs: 0,
            paying: 0,
        },
        rows: [],
    };
}

// Прямое подключение к Postgres из Edge runtime требует @vercel/postgres или
// neon-serverless с fetch driver. Когда подключим — раскомментим импорт.
// Пример:
//   import { neon } from '@neondatabase/serverless';
//   const sql = neon(process.env.DATABASE_URL);
//   const rows = await sql`SELECT id, telegram_id, ... FROM bot_users WHERE ...`;
async function fetchPgUsers(/* search, limit, offset */) {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    // TODO: подключить @neondatabase/serverless когда будет установлен
    return null;
}

export default async function handler(request) {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let data = null;
    let dataSource = 'mock';

    data = await fetchPgUsers(search, limit, offset);
    if (data) dataSource = 'postgres';

    if (!data) {
        data = buildMockUsers();
        dataSource = 'mock';
    }

    return new Response(
        JSON.stringify({
            ok: true,
            isMock: dataSource === 'mock',
            dataSource,
            data,
            params: { search, limit, offset },
            generatedAt: Date.now(),
        }),
        {
            status: 200,
            headers: {
                'content-type': 'application/json',
                'cache-control': 'private, max-age=30',
            },
        }
    );
}
