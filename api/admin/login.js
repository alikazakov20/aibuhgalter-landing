// ============== POST /api/admin/login ==============
// Принимает {pin}, проверяет SHA-256(pin) === ADMIN_PIN_HASH из env,
// при успехе выдаёт HttpOnly-cookie с JWT.

import { sha256Hex, signSession, buildSessionCookie } from '../../lib/admin-auth.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
            status: 405,
            headers: { 'content-type': 'application/json' },
        });
    }

    const expectedHash = process.env.ADMIN_PIN_HASH;
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!expectedHash || !secret) {
        return new Response(JSON.stringify({ error: 'config_missing', hint: 'set ADMIN_PIN_HASH and ADMIN_JWT_SECRET in Vercel env vars' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
        });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    const pin = String(body?.pin || '').trim();
    if (!pin) {
        return new Response(JSON.stringify({ error: 'pin_required' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    // Простая защита от бруса: задержка (Edge не делает rate-limit out of box,
    // но при использовании KV можно добавить per-IP throttling в след. итерации)
    const actualHash = await sha256Hex(pin);

    // Constant-time сравнение
    if (actualHash.length !== expectedHash.length) {
        await new Promise((r) => setTimeout(r, 1000)); // подержим 1 сек чтобы time-attacks не работали
        return new Response(JSON.stringify({ error: 'invalid_pin' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }
    let diff = 0;
    for (let i = 0; i < actualHash.length; i++) {
        diff |= actualHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
    }
    if (diff !== 0) {
        await new Promise((r) => setTimeout(r, 1000));
        return new Response(JSON.stringify({ error: 'invalid_pin' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    const hours = parseInt(process.env.ADMIN_SESSION_HOURS || '24', 10);
    const maxAgeSec = hours * 3600;
    const now = Math.floor(Date.now() / 1000);
    const payload = { sub: 'admin', iat: now, exp: now + maxAgeSec };
    const token = await signSession(payload, secret);

    return new Response(JSON.stringify({ ok: true, expiresAt: payload.exp * 1000 }), {
        status: 200,
        headers: {
            'content-type': 'application/json',
            'set-cookie': buildSessionCookie(token, maxAgeSec),
        },
    });
}
