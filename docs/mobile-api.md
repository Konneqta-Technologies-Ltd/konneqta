# Konneqta Mobile API

This repo is the **web app**, but its API routes are also the **only backend the
Konneqta mobile app** (Expo / React Native — separate repo) talks to. This doc
records that contract so the mobile-facing pieces here aren't mistaken for dead
code.

## Authentication

`getUserFromRequest()` — `lib/supabase/request-auth.ts` — accepts BOTH client
types on the same route:

1. **`Authorization: Bearer <supabase-access-token>`** — the mobile app
   (native has no cookie jar). The Supabase client is created with the
   caller's token, so **RLS applies as the user**.
2. **SSR session cookies** — the web browser (existing behaviour, unchanged).

Routes decide their own `401` responses; the helper changes nothing about what
each route is allowed to do.

### Routes that accept Bearer (dual-auth)

| Route | Notes |
|---|---|
| `POST /api/konneqts` | Inline dual-client (not via the helper) |
| `GET /api/konneqts/status` | Inline dual-client |
| `POST /api/konneqts/requests/respond` | Via helper |
| `POST /api/payments/create-session` | Via helper; caller's client passed into `createPaymentSession()` |
| `POST /api/promos/redeem` | Via helper |
| `POST /api/feedback` | Via helper |
| `POST /api/deactivate-account` | Via helper |
| `POST /api/delete-account` | Via helper |
| `POST /api/reactivate-account` | Via helper |
| `POST` / `DELETE /api/push/register` | Via helper (mobile-only route, see below) |

## Mobile-only endpoints

### `POST /api/push/register`

Registers (or refreshes) the device's **Expo push token** for the signed-in
user.

- Body: `{ token: "ExponentPushToken[/...]", platform: "ios" | "android", deviceName?: string }`
- `DELETE /api/push/register` removes it (logout / notifications off). The
  token may arrive in the JSON body **or** as `?token=` (DELETE bodies are
  occasionally stripped by proxies).
- Storage: `mobile_push_tokens` — one row per app install, upserted on the
  globally-unique token. Re-registering the same device just refreshes its row
  (and re-homes it if a different user logs in on that device).
- RLS-scoped through the caller's own session — a user can never register a
  token onto someone else's account.

### `POST /api/onboarding/generate-qr`

Bearer-only. Server-side QR generation for the mobile onboarding (the `qrcode`
lib can't render to a canvas in React Native).

- Body: `{ username, cardId }`
- Generates the profile QR for the same canonical URL as web onboarding,
  uploads it to the `qrcodes` bucket under the caller's own path, and stores
  the public URL on the card row.

## Push notifications

`lib/push/server.ts` fans every notification out to **two legs**, in parallel,
both fire-and-forget (the in-app `notifications` row is the source of truth):

1. **Web Push (VAPID)** → browser/PWA `push_subscriptions`. Needs
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`.
2. **Expo Push** → `mobile_push_tokens`. **No server keys** — the token
   encodes the destination project. Chunked 100/request to
   `exp.host/--/api/v2/push/send`.

### Expo payload / deep-link contract

```jsonc
{
  "to": "ExponentPushToken[/...]",
  "title": "...",
  "body": "...",
  "sound": "default",
  "data": {
    "url": "/ada/konneqts",       // web-relative deep link (null → notifications screen)
    "notificationId": "<uuid>",   // in-app row id — tap should mark it read
    "tag": "konneqt_request"      // collapse key
  }
}
```

The `url` is a **web-relative path** (e.g. `/ada`, `/ada/konneqts`). The mobile
app maps it onto its own `konneqta://` scheme when the notification is tapped —
the scheme itself is handled in the mobile repo, never here. Marking the tapped
notification read goes through `POST /api/notifications/read` (the web/PWA
convention appends `?n={id}` to the landing URL and strips it —
`hooks/useNotifications.ts`).

### Token lifecycle

- **Register:** upsert via `POST /api/push/register`.
- **Logout / opt-out:** `DELETE /api/push/register`.
- **Auto-cleanup:** `DeviceNotRegistered` ticket responses delete the row so a
  stale token can't poison every future send (same policy as the web-push 404/410 leg).

## Database

`mobile_push_tokens` — `supabase/mobile-push-setup.sql` (table + RLS policy
`mobile_push_tokens_all_own`). Run it before shipping; the register route
returns `500` with a console warning pre-migration.

> ⚠️ `.gitignore` ignores `/supabase` and `/docs` wholesale. Intentional files
> (all the `supabase/*.sql` setups, `docs/analytics-plan.md`, this doc) are
> **force-added** (`git add -f`) past the rule. If you create a new file in
> either directory, remember to force-add it or it will never be committed.

## Known gaps

- **No Universal Links / App Links**: there is no
  `.well-known/apple-app-site-association` or `assetlinks.json` in this repo.
  Deep links rely solely on the `konneqta://` custom scheme, which fails
  silently if the app isn't installed.
