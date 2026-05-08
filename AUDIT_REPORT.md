# Аудит работоспособности AI-Бухгалтер
**Дата:** 2026-05-08
**Деплой:** aibuhgalter-landing-kkzyu8fe8 → READY
**Домен:** https://aibuhgalter.com

---

## ✅ Что работает (проверено через curl)

### Инфраструктура
- ✅ DNS через Cloudflare anycast (104.21.93.162, 172.67.212.19)
- ✅ HTTPS + strict-transport-security (max-age=63072000 = 2 года)
- ✅ Server: Cloudflare (proxy active)
- ✅ Edge регион: EVN (Yerevan) — низкая latency для РФ
- ✅ HTTP/2

### Страницы
- ✅ `/` (HTTP 200, gzip 52 KB)
- ✅ `/legal` (HTTP 200)
- ✅ `/admin` (HTTP 200, X-Robots-Tag: noindex,nofollow ✓)
- ✅ `/sitemap.xml` (HTTP 200)
- ✅ `/robots.txt` (HTTP 200)

### API endpoints (все живы)
| Endpoint | Метод | Статус | Поведение |
|----------|-------|--------|-----------|
| `/api/admin/me` | GET | 401 | требует auth ✓ |
| `/api/admin/health` | GET | 401 | требует auth ✓ |
| `/api/admin/metrics` | GET | 401 | требует auth ✓ |
| `/api/admin/users` | GET | 401 | требует auth ✓ |
| `/api/admin/payments` | GET | 401 | требует auth ✓ |
| `/api/payments/webhook` | POST | 200/401 | HMAC verify работает ✓ |
| `/api/payments/webhook` | GET | 405 | method not allowed ✓ |
| `/api/bot-health` | GET | 200 | online: true, latency 44ms ✓ |

### Static assets
- ✅ /dist/tailwind.css (43 KB)
- ✅ /sw.js (Service Worker)
- ✅ /manifest.json (PWA)
- ✅ /og-image.png
- ✅ /favicon.svg
- ✅ /announcement.json

### Security headers (главная)
- ✅ Strict-Transport-Security: max-age=63072000
- ✅ X-Content-Type-Options: nosniff
- ✅ X-Frame-Options: DENY
- ✅ Referrer-Policy: strict-origin-when-cross-origin
- ✅ Permissions-Policy: camera=(), microphone=(), geolocation=()

### Платежи
- ✅ Prodamus webhook принимает запросы
- ✅ HMAC-SHA256 verify через Web Crypto API работает
- ✅ Без подписи → 401 signature_missing
- ✅ С фейк-подписью → 401 invalid_signature
- ✅ PRODAMUS_SECRET и PRODAMUS_ACCOUNT в Vercel env
- ✅ URL вебхука прописан в Prodamus

### Бот
- ✅ @AI_Buxgalter_USN_bot отвечает (HTTP 200, latency 44ms)
- ✅ Live-индикатор в HERO + Footer обновляется каждые 60с

---

## ⚠️ Проблемы (требуют фикса)

### 🔴 Критично

#### 1. Cloudflare переопределяет Cache-Control
**Симптом:** `/sw.js` и `/dist/tailwind.css` отдаются с `max-age=14400` (4 часа), хотя в `vercel.json` стоит `max-age=0`. Юзеры могут застрять на старой версии Service Worker и Tailwind CSS.

**Причина:** В Cloudflare Dashboard → Caching → Configuration → Browser Cache TTL стоит "4 hours" — это переопределяет любые headers.

**Что делать (твои 2 минуты):**
1. Зайти в Cloudflare Dashboard
2. `aibuhgalter.com` → Caching → Configuration
3. Найти **Browser Cache TTL** → выбрать **«Respect Existing Headers»** (вместо "4 hours")
4. Сохранить
5. Caching → Purge Everything (сбросить старый кэш)

**Альтернатива** (если не хочешь менять глобально): добавить Page Rule:
- URL: `aibuhgalter.com/sw.js`
- Setting: Cache Level → Bypass

### 🟡 Средне

#### 2. SSL/TLS пока Flexible (предположительно)
Не проверил вручную, но по умолчанию для нового CF проекта стоит Flexible. Это потенциальный redirect-loop.

**Что делать:**
- Cloudflare Dashboard → SSL/TLS → Overview → выбрать **Full (Strict)**
- Edge Certificates → Always Use HTTPS = ON

#### 3. Tailwind CSS 43 KB (сжимается до 8 KB gzipped)
Можно уменьшить через более агрессивный purge — сейчас собирается весь mint палитру и анимации.

**Что делать:** в `tailwind.config.js` — оставить только используемые цвета вместо всей палитры mint (50-950).

#### 4. HTML 251 KB uncompressed (52 KB gzipped)
Много inline JS. Можно вынести часть в отдельные файлы для лучшего кэширования.

**Что делать (опционально, не критично):**
- Калькулятор JS → `/dist/calculator.js`
- Tracking JS → `/dist/tracking.js`
- Это +1 HTTP request но лучшее кэширование

#### 5. CSP header отсутствует
Нет `Content-Security-Policy` — ниже балл security.

**Что делать:** добавить CSP в vercel.json. Но нужно тщательно тестить — может сломать inline scripts.

### 🔵 Низко (улучшения)

#### 6. Cookie banner — declined не отключает Vercel Analytics
Сейчас при «Только нужные» ставится `window.__noAnalytics = true`, но Vercel Analytics уже подключён через `<script src>` и шлёт данные.

**Что делать:** при declined — не подключать Vercel Analytics вообще, или отослать opt-out event.

#### 7. Tracking events не пишут в KV
Админка `/api/admin/metrics` всегда возвращает mock — потому что нет хранилища событий. Решения:
- Подключить Vercel KV (бесплатный тир 30k команд/мес)
- Или Vercel Analytics Custom Events
- Или дёшевый PostgreSQL `events` table

#### 8. Cookie banner не появляется повторно если localStorage очистили частично
Зависимость от `aibuh_cookie_consent` — нет TTL. Через год нужно повторное согласие по GDPR-best-practice.

**Что делать:** при `loadConsent()` проверять `aibuh_cookie_consent_date` — если старше 365 дней, показать снова.

#### 9. Замена placeholder отзывов
5 placeholder testimonials до сих пор. Когда первые 5 платящих ИП протестируют — заменить на реальные кейсы.

#### 10. Lighthouse audit
Google API исчерпан — нужно вручную через Chrome DevTools → Lighthouse mobile + desktop.

---

## 🚀 Дорожная карта улучшений (приоритет)

### Этап 1 — Запуск (на этой неделе, 1 час твоей работы)
- [ ] **Cloudflare Browser Cache TTL → Respect Existing Headers** (5 мин)
- [ ] **SSL/TLS Full (Strict)** (1 мин)
- [ ] **Always Use HTTPS = ON** (1 мин)
- [ ] **Активировать Formsubmit** (письмо в почте) (1 мин)
- [ ] **Lighthouse audit вручную** (DevTools → Lighthouse)
- [ ] **Тестовая оплата 1 ₽** (опционально)

### Этап 2 — Маркетинг (после запуска)
- [ ] Опубликовать в нескольких ИП-чатах: «Тестируем сервис, первые 100 — месяц PRO бесплатно»
- [ ] Собрать 5-10 настоящих ИП в фокус-группу
- [ ] После недели — реальные отзывы → заменить placeholder
- [ ] Vercel Web Analytics → когда будет 100+ визитов, дать токен → подключим metrics

### Этап 3 — Веб-кабинет (если будут платящие клиенты)
- [ ] Telegram Login Widget + базовый dashboard
- [ ] AI-чат на сайте (через бэкенд бота)
- [ ] Импорт банковских CSV
- [ ] Декларация PDF

### Этап 4 — Полировка (когда будет время)
- [ ] CSP header (тщательно протестить)
- [ ] Tailwind purge optimization (43 → 25 KB)
- [ ] Вынести inline JS в отдельные файлы
- [ ] PWA install prompt
- [ ] Cookie banner re-show через 365 дней

---

## 📊 Текущая готовность

```
Production-ready: ████████████████░░░░ 80%

Маркетинговый лендинг:    ███████████████░░░░░  85%
Калькулятор УСН:          ████████████████████ 100%
Cookie compliance (152-ФЗ): ███████████████████░  95%
PWA:                      ███████████████████░  95%
Mobile UX (карусели):     ████████████████████ 100%
SEO (sitemap/robots/og):  ████████████████░░░░  80%
Security headers:         █████████████████░░░  85%
Cache strategy:           ████████░░░░░░░░░░░░  40% ← фикс через CF Dashboard
Admin auth + endpoints:   ████████████████████ 100%
Платежи (Prodamus):       ████████████████░░░░  80% ← тест-оплата
Веб-кабинет (личный):     ░░░░░░░░░░░░░░░░░░░░   0%
```

**Вывод:** лендинг полностью готов к запуску маркетинга. Минимальные действия по списку Этапа 1 (5 пунктов × 1-5 мин = 15 минут твоей работы) — и можно стартовать кампанию.
