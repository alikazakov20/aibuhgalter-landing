// ============== GET /api/bot-health ==============
// Публичный endpoint — проверяет доступность Telegram-бота.
// Используется на лендинге как live-индикатор «бот онлайн».
//
// Если есть TELEGRAM_BOT_TOKEN в env — спрашиваем Bot API getMe (точная проверка).
// Иначе — простой HEAD-запрос на t.me/AI_Buxgalter_USN_bot.
//
// Cache: ответ кэшируется на 60 секунд через Cache-Control,
// чтобы не дёргать Telegram при каждом визите.

export const config = { runtime: 'edge' };

const BOT_USERNAME = 'AI_Buxgalter_USN_bot';

async function checkViaBotAPI(token, timeoutMs = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timer);
        const latency = Date.now() - start;
        if (!res.ok) return { online: false, latency, method: 'bot-api', status: res.status };
        const body = await res.json();
        return {
            online: body && body.ok === true,
            latency,
            method: 'bot-api',
            username: body?.result?.username || BOT_USERNAME,
        };
    } catch (e) {
        clearTimeout(timer);
        return {
            online: false,
            latency: Date.now() - start,
            method: 'bot-api',
            error: e.name === 'AbortError' ? 'timeout' : (e.message || 'unknown'),
        };
    }
}

async function checkViaTmePage(timeoutMs = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();
    try {
        const res = await fetch(`https://t.me/${BOT_USERNAME}`, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'manual',
        });
        clearTimeout(timer);
        return {
            online: res.status >= 200 && res.status < 400,
            latency: Date.now() - start,
            method: 't.me-page',
            status: res.status,
        };
    } catch (e) {
        clearTimeout(timer);
        return {
            online: false,
            latency: Date.now() - start,
            method: 't.me-page',
            error: e.name === 'AbortError' ? 'timeout' : (e.message || 'unknown'),
        };
    }
}

export default async function handler(/* request */) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const result = token
        ? await checkViaBotAPI(token)
        : await checkViaTmePage();

    return new Response(
        JSON.stringify({
            ok: true,
            ...result,
            checkedAt: Date.now(),
        }),
        {
            status: 200,
            headers: {
                'content-type': 'application/json',
                // Кэшируем на 60с на CDN, 30с на клиенте — снижаем нагрузку
                'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=60',
                'access-control-allow-origin': '*',
            },
        }
    );
}
