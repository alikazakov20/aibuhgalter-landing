// ============== Prodamus helpers ==============
// HMAC sign / verify для безопасной коммуникации с Prodamus API.
// Документация: https://help.prodamus.ru/payform/integracii/rest-api

import crypto from 'node:crypto';

/**
 * Генерирует HMAC-SHA256 подпись для payload.
 * Prodamus требует подпись для всех серверных запросов и webhook.
 */
export function signPayload(payload, secret) {
    if (!secret) throw new Error('PRODAMUS_SECRET_KEY не задан');
    const sortedKeys = Object.keys(payload).sort();
    const stringToSign = sortedKeys
        .map((k) => `${k}=${payload[k]}`)
        .join('&');
    return crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');
}

/**
 * Проверяет HMAC подпись пришедшего webhook.
 * @returns {boolean} true если подпись валидна
 */
export function verifyWebhook(body, signatureHeader, secret) {
    if (!secret) throw new Error('PRODAMUS_SECRET_KEY не задан');
    if (!signatureHeader) return false;
    const { sign, ...rest } = body;
    const expected = signPayload(rest, secret);
    // Constant-time сравнение чтобы не было timing attack
    try {
        return crypto.timingSafeEqual(
            Buffer.from(expected, 'hex'),
            Buffer.from(signatureHeader, 'hex')
        );
    } catch {
        return false;
    }
}

/**
 * Формирует подписанный URL для редиректа пользователя на оплату.
 */
export function buildCheckoutURL({ shopname, productId, customerEmail, customerId, amount }) {
    const base = `https://payment.prodamus.ru/${shopname}/form/${productId}`;
    const params = new URLSearchParams({
        customer_email: customerEmail,
        order_id: customerId,
        sum: String(amount),
        currency: 'rub',
        do: 'pay',
        sys: 'aibuhgalter-landing',
    });
    return `${base}?${params.toString()}`;
}

// Маппинг наших внутренних кодов тарифов → Prodamus product IDs
export const TARIFF_TO_PRODUCT = {
    pro_ip: process.env.PRODAMUS_PRODUCT_PRO_IP,
    pro_buh: process.env.PRODAMUS_PRODUCT_PRO_BUH,
    max: process.env.PRODAMUS_PRODUCT_MAX,
};

export const TARIFF_PRICES = {
    pro_ip: 290,
    pro_buh: 990,
    max: 1990,
};
