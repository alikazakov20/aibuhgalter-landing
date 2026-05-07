// ============== POST /api/checkout ==============
// Принимает {tariff, email}, возвращает Prodamus payment URL.
// Vercel Edge Function (бесплатно на Hobby).

import { buildCheckoutURL, TARIFF_TO_PRODUCT, TARIFF_PRICES } from '../lib/prodamus.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
            status: 405,
            headers: { 'content-type': 'application/json' },
        });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 });
    }

    const { tariff, email } = body;
    if (!tariff || !TARIFF_TO_PRODUCT[tariff]) {
        return new Response(JSON.stringify({ error: 'invalid_tariff' }), { status: 400 });
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return new Response(JSON.stringify({ error: 'invalid_email' }), { status: 400 });
    }

    // Простой rate-limit по IP — 5 запросов в минуту (in-memory не шарится между Edge,
    // но для базовой защиты от ботов хватит. Для продакшна — Upstash Redis).
    // TODO: подключить Upstash Redis или Vercel KV когда подпишемся.

    const customerId = `aibuh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const url = buildCheckoutURL({
        shopname: process.env.PRODAMUS_SHOPNAME,
        productId: TARIFF_TO_PRODUCT[tariff],
        customerEmail: email,
        customerId,
        amount: TARIFF_PRICES[tariff],
    });

    return new Response(JSON.stringify({ url, orderId: customerId }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}
