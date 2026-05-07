// ============== Prodamus helpers (Edge runtime compatible) ==============
// HMAC-SHA256 через Web Crypto API (поддерживается в Vercel Edge).
// Документация Prodamus: https://help.prodamus.ru/payform/integracii/rest-api

const encoder = new TextEncoder();

async function getKey(secret) {
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

function bufToHex(buf) {
    return [...new Uint8Array(buf)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function hexToBuf(hex) {
    const len = hex.length / 2;
    const buf = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        buf[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return buf.buffer;
}

/**
 * Генерирует HMAC-SHA256 подпись для payload.
 * Prodamus сортирует ключи по алфавиту и склеивает k=v через &.
 */
export async function signPayload(payload, secret) {
    if (!secret) throw new Error('PRODAMUS_SECRET_KEY не задан');
    const sortedKeys = Object.keys(payload).sort();
    const stringToSign = sortedKeys
        .map((k) => `${k}=${payload[k]}`)
        .join('&');
    const key = await getKey(secret);
    const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
    return bufToHex(sigBuf);
}

/**
 * Проверяет HMAC подпись пришедшего webhook (constant-time).
 */
export async function verifyWebhook(body, signatureHex, secret) {
    if (!secret) throw new Error('PRODAMUS_SECRET_KEY не задан');
    if (!signatureHex || typeof signatureHex !== 'string') return false;
    const { sign, ...rest } = body;
    const sortedKeys = Object.keys(rest).sort();
    const stringToSign = sortedKeys
        .map((k) => `${k}=${rest[k]}`)
        .join('&');
    const key = await getKey(secret);
    let signatureBuf;
    try {
        signatureBuf = hexToBuf(signatureHex);
    } catch {
        return false;
    }
    return crypto.subtle.verify('HMAC', key, signatureBuf, encoder.encode(stringToSign));
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
