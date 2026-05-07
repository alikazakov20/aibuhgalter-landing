// ============== GET /api/admin/payments ==============
// Список платежей через Prodamus. Источник: Prodamus API (когда будет подключён).
// Пока возвращает mock + структуру под Prodamus REST API.
//
// Документация Prodamus API:
//   https://help.prodamus.ru/payform/rest-api

import { requireAdmin } from '../../lib/admin-auth.js';

export const config = { runtime: 'edge' };

function buildMockPayments() {
    return {
        stats: {
            mrr: 0,
            transactions7d: 0,
            transactions30d: 0,
            avgCheck: 0,
            refunds: 0,
        },
        recent: [],
    };
}

// ─── Prodamus API ───────────────────────────────────────────────────────
// Платежи получаем через GET-запрос к Prodamus REST.
// Авторизация: HMAC-SHA256 от тела запроса с секретным ключом.
async function fetchProdamusPayments(/* limit */) {
    const token = process.env.PRODAMUS_TOKEN;
    const secret = process.env.PRODAMUS_SECRET;
    const account = process.env.PRODAMUS_ACCOUNT; // имя личного кабинета

    if (!token || !secret || !account) return null;

    // TODO: подключить когда будет токен — сейчас возвращаем null чтобы не делать
    // запрос с фейковым токеном.
    // Пример URL: https://${account}.payform.ru/rest/getPayments
    return null;
}

export default async function handler(request) {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    let data = null;
    let dataSource = 'mock';

    data = await fetchProdamusPayments();
    if (data) dataSource = 'prodamus';

    if (!data) {
        data = buildMockPayments();
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
                'cache-control': 'private, max-age=30',
            },
        }
    );
}
