// ============== POST /api/prodamus-webhook ==============
// Принимает webhook от Prodamus о статусе платежа.
// Проверяет HMAC подпись, обновляет БД, шлёт уведомление в Telegram-бот.

import { verifyWebhook } from '../lib/prodamus.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
    if (request.method !== 'POST') {
        return new Response('method not allowed', { status: 405 });
    }

    const rawBody = await request.text();
    let body;
    try {
        body = Object.fromEntries(new URLSearchParams(rawBody));
    } catch {
        return new Response('invalid body', { status: 400 });
    }

    // Проверка подписи — без неё подделать оплату легко
    const signature = request.headers.get('sign') || body.sign;
    if (!verifyWebhook(body, signature, process.env.PRODAMUS_SECRET_KEY)) {
        // TODO: лог в админку для расследования
        return new Response('invalid signature', { status: 401 });
    }

    // Idempotency: payment_id должен быть уникальным
    const paymentId = body.payment_id || body.order_id;
    if (!paymentId) {
        return new Response('missing payment_id', { status: 400 });
    }

    // TODO: запросить БД, проверить idempotency
    // TODO: записать в таблицу payments
    // TODO: апдейтить tier у пользователя в БД (общая с ботом, через DATABASE_URL)
    // TODO: отправить уведомление в TG-бот: «✅ оплата прошла, активирую тариф»
    //   const tgRes = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, ...);

    // Prodamus ожидает текстовый ответ "success" иначе ретраит
    return new Response('success', { status: 200 });
}
