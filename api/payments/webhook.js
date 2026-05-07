// ============== POST /api/payments/webhook ==============
// Принимает callback от Prodamus после оплаты подписки.
// Документация: https://help.prodamus.ru/payform/integracii/rest-api/instrukciya-rabota-s-rest-api/webhook
//
// Формат запроса от Prodamus:
//   • Content-Type: application/x-www-form-urlencoded
//   • Заголовок Sign — HMAC-SHA256 hex
//   • Body — поля платежа (order_id, sum, payer_email, payment_status, …)
//
// Безопасность:
//   • PRODAMUS_SECRET в env Vercel — без него подделать webhook невозможно
//   • Constant-time HMAC verify через Web Crypto API
//   • Открытый endpoint (без cookie auth), защита через подпись
//
// Опциональные env vars:
//   PRODAMUS_SECRET            — обязательно
//   TELEGRAM_NOTIFY_BOT_TOKEN  — для пуша уведомления в личный TG-чат
//   TELEGRAM_NOTIFY_CHAT_ID    — id чата куда слать уведомления
//   PAYMENTS_KV_URL            — Vercel KV для хранения истории платежей

import { verifyWebhook } from '../../lib/prodamus.js';

export const config = { runtime: 'edge' };

// ─── Парсинг тела запроса (form-urlencoded или JSON) ────────────────────
async function parseBody(request) {
    const ct = (request.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
        try { return await request.json(); } catch { return null; }
    }
    // form-urlencoded — Prodamus умолчанию
    try {
        const text = await request.text();
        const params = new URLSearchParams(text);
        const obj = {};
        for (const [k, v] of params.entries()) obj[k] = v;
        return obj;
    } catch { return null; }
}

// ─── Опциональное уведомление в Telegram ────────────────────────────────
async function notifyTelegram(text) {
    const token = process.env.TELEGRAM_NOTIFY_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_NOTIFY_CHAT_ID;
    if (!token || !chatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }),
        });
    } catch (e) {
        console.warn('TG notify failed:', e);
    }
}

// ─── Главный handler ────────────────────────────────────────────────────
export default async function handler(request) {
    // Метод
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // Конфиг
    const secret = process.env.PRODAMUS_SECRET;
    if (!secret) {
        console.error('PRODAMUS_SECRET не задан в env');
        return new Response('config_missing', { status: 503 });
    }

    // Тело
    const body = await parseBody(request);
    if (!body) {
        return new Response('invalid_body', { status: 400 });
    }

    // Подпись Prodamus — может быть в заголовке Sign или в поле sign
    const signature =
        request.headers.get('sign') ||
        request.headers.get('Sign') ||
        body.sign ||
        '';

    if (!signature) {
        console.warn('webhook без подписи:', JSON.stringify(body).slice(0, 200));
        return new Response('signature_missing', { status: 401 });
    }

    // Проверка HMAC
    let valid = false;
    try {
        valid = await verifyWebhook(body, signature, secret);
    } catch (e) {
        console.error('verifyWebhook error:', e);
        return new Response('verify_error', { status: 500 });
    }

    if (!valid) {
        console.warn('Invalid signature webhook:', JSON.stringify(body).slice(0, 200));
        return new Response('invalid_signature', { status: 401 });
    }

    // ─── Подпись валидна — обрабатываем платёж ─────────────────────────
    const orderId = body.order_id || body.orderId || '';
    const sum = body.sum || body.amount || '0';
    const email = body.payer_email || body.email || '';
    const status = (body.payment_status || body.status || '').toLowerCase();
    const product = body.products && body.products[0] ? body.products[0].name : (body.product_name || '');

    // Лог для отладки (видно в Vercel Logs)
    console.log('[Prodamus] webhook OK', {
        orderId, sum, email, status, product,
        timestamp: new Date().toISOString(),
    });

    // Уведомление админу в Telegram — только при успехе
    if (status === 'success' || status === 'paid') {
        const msg =
            `💰 <b>Новая оплата!</b>\n` +
            `Сумма: <b>${sum} ₽</b>\n` +
            `Email: ${email || '—'}\n` +
            `Order: <code>${orderId}</code>\n` +
            (product ? `Тариф: ${product}\n` : '') +
            `\n<a href="https://aibuhgalter.com/admin">Админка →</a>`;
        await notifyTelegram(msg);
    } else {
        // Лог неудачных тоже — для аналитики
        console.log('[Prodamus] payment status not success:', status);
    }

    // Prodamus ждёт ответ "success" текстом, иначе будет ретрай
    return new Response('success', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
}
