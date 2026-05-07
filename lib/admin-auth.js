// ============== Admin Auth (Edge runtime) ==============
// Server-side проверка PIN + выдача JWT-cookie. Заменяет клиентский PIN-хеш в HTML.
//
// Зависит от env vars (Vercel Dashboard → Project Settings → Environment Variables):
//   ADMIN_PIN_HASH      — SHA-256 hex от твоего PIN (например для 532318: 34b2f1...)
//   ADMIN_JWT_SECRET    — random secret 64+ байт (для подписи cookie). openssl rand -hex 64
//   ADMIN_SESSION_HOURS — срок жизни сессии в часах (default 24)

const encoder = new TextEncoder();

const COOKIE_NAME = 'aibuh_admin';

// ─── HMAC-SHA256 helpers (Web Crypto API) ──────────────────────────────
async function hmacKey(secret) {
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

function bufToBase64Url(buf) {
    const bytes = new Uint8Array(buf);
    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuf(b64) {
    const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = norm + '='.repeat((4 - (norm.length % 4)) % 4);
    const bin = atob(padded);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
}

// ─── SHA-256 строки → hex ──────────────────────────────────────────────
export async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', encoder.encode(str));
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

// ─── JWT sign/verify (HS256) ───────────────────────────────────────────
export async function signSession(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encHeader = bufToBase64Url(encoder.encode(JSON.stringify(header)));
    const encPayload = bufToBase64Url(encoder.encode(JSON.stringify(payload)));
    const data = encHeader + '.' + encPayload;
    const key = await hmacKey(secret);
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return data + '.' + bufToBase64Url(sig);
}

export async function verifySession(token, secret) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encHeader, encPayload, encSig] = parts;
    const data = encHeader + '.' + encPayload;
    const key = await hmacKey(secret);
    let valid;
    try {
        valid = await crypto.subtle.verify('HMAC', key, base64UrlToBuf(encSig), encoder.encode(data));
    } catch {
        return null;
    }
    if (!valid) return null;
    let payload;
    try {
        const decoded = atob(encPayload.replace(/-/g, '+').replace(/_/g, '/'));
        payload = JSON.parse(decoded);
    } catch {
        return null;
    }
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
}

// ─── Cookie helpers ────────────────────────────────────────────────────
export function buildSessionCookie(token, maxAgeSec) {
    const parts = [
        `${COOKIE_NAME}=${token}`,
        'Path=/',
        'HttpOnly',
        'Secure',
        'SameSite=Strict',
        `Max-Age=${maxAgeSec}`,
    ];
    return parts.join('; ');
}

export function buildLogoutCookie() {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function readSessionFromRequest(request) {
    const cookie = request.headers.get('cookie') || '';
    const match = cookie.split(/;\s*/).find((c) => c.startsWith(COOKIE_NAME + '='));
    if (!match) return null;
    return match.slice(COOKIE_NAME.length + 1);
}

// ─── Главный middleware: проверка авторизации в API ─────────────────────
export async function requireAdmin(request) {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
        return { error: new Response(JSON.stringify({ error: 'config_missing' }), { status: 500, headers: { 'content-type': 'application/json' } }) };
    }
    const token = readSessionFromRequest(request);
    if (!token) {
        return { error: new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } }) };
    }
    const payload = await verifySession(token, secret);
    if (!payload) {
        return { error: new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401, headers: { 'content-type': 'application/json' } }) };
    }
    return { payload };
}
