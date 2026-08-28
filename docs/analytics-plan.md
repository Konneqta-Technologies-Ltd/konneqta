# Analytics & Share-Limit Plan (v2)

> **Purpose:** This document is the durable "memory" of how Konneqta's
> self-hosted analytics, the 25-shares/month limit, and the PostHog product
> analytics work, so future sessions (human or AI) don't have to re-derive the
> design. Update it whenever the event taxonomy, limits, or data flow change.

---

## 1. The 25 Shares / Month Limit

| Rule | Value |
|---|---|
| **Who is limited** | The **owner** sharing their **own** card. Visitors sharing someone else's card are free virality and are NOT counted/limited. |
| **What counts as a share** | All 6 `ShareMenu` actions: `native` (Web Share API), `copy` (Copy Link), `whatsapp`, `telegram`, `sms`, `email`. |
| **Limit per month** | **Free = 25**, **Pro = ∞**, **Exempt = ∞** |
| **Reset window** | **Calendar month** (`from.setDate(1)` in `getMonthlyShareCountWithLimit`). No cron needed. |
| **Scope** | **Per user** (all their cards combined), not per-card. |
| **Enforcement** | **Server-side only** in `app/api/share/route.ts`. The limit check runs before the event is inserted. On 429 the share is blocked and an upgrade prompt is shown. |
| **Source of truth** | `PLAN_LIMITS.maxShares` in `lib/entitlements.ts` + `getMaxShares()`. Count query in `getMonthlyShareCountWithLimit()` (`lib/analytics/queries.ts`). |

---

## 2. Counting Rules (v2 — the truth filter)

All rules are enforced **at WRITE time, server-side**, so the raw table is
already clean and no dashboard query can forget a filter:

| Rule | How |
|---|---|
| **Owner self-views/clicks/downloads never count** | `app/[username]/page.tsx` skips recording when `isOwner`; `/api/track/link-click` and `app/[username]/vcard/route.ts` compare the auth user to `card.owner_id` and skip. |
| **Bots/crawlers never count** | `lib/analytics/bot.ts` (`isBotUserAgent`) — checked before every view/download/click insert. |
| **One view per visitor per session** | `recordProfileViewOnce()` in `lib/analytics/server.ts` — a refresh within the same 30-min session inserts nothing. |
| **QR scans are not double-counted** | A `?src=qr` arrival is ONE `profile_view` with `source='qr'`. The separate `qr_scan` event was removed and legacy rows deleted (migration). Dashboard QR metric = views with `source='qr'`. |
| **Real share-channel attribution** | Every URL built by `ShareMenu` carries `?src=<channel>`; `parseSource()` stores it on the resulting view, so "conversion by channel" compares actual shares → resulting views. |
| **Day buckets are UTC** | `windowStartUtc()` in queries.ts / `to_char(... 'YYYY-MM-DD')` in the RPC. The dashboard footer says so. |
| **Null visitor_ids are not visitors** | Visitor stats only count non-null `visitor_id` rows (no fake "anon" visitor). |

### Sessions & visitor identity

- `kq_vid` cookie (HttpOnly, 1 year) — stable anonymous visitor id.
- `kq_sid` cookie (HttpOnly, **30-minute sliding window**) — created/refreshed by `proxy.ts` on every page request. After 30 min of inactivity it expires → next visit = new session.
- **Unique visitors** = distinct `visitor_id` in the window.
- **Returning visitors** = visitors with **>1 distinct session** in the window.
- Both cookies are **consent-gated**: only set when the `kq_consent` cookie says `accepted` (see §7).

---

## 3. Event Taxonomy (the `analytics_events` table)

One append-only table, `public.analytics_events`. All writes are server-side
via the service-role key (no client INSERT policy exists — RLS only allows
owners to SELECT their own rows).

| `event_type` | Trigger | Key columns |
|---|---|---|
| `profile_view` | `app/[username]/page.tsx` after 404/redirect guards, **owner + bot filtered, session-deduped**, wrapped in `after()`. | `source`, `visitor_id`, `session_id`, `country`, `city` |
| `share` | `app/api/share/route.ts` (POST), after the limit check passes. Owner-only action; always recorded (powers the limit). | `channel`, `visitor_id`, `session_id` |
| `vcard_download` | `app/[username]/vcard/route.ts`, each `.vcf` GET (owner + bot filtered), wrapped in `after()`. | `visitor_id`, `session_id` |
| `link_click` | `POST /api/track/link-click` (sendBeacon from `ProfileCard`). Owner + bot + cross-origin filtered. | `channel` (**the social platform**: whatsapp/instagram/linkedin/…), `visitor_id`, `session_id` |
| `konneqt` | `app/api/konneqts/route.ts` — one event per participant on user-to-user connect, one for the target on guest submissions. | `source` (QR_SCAN/PROFILE_PAGE/…), `visitor_id`, `session_id` |
| ~~`qr_scan`~~ | **Removed (v2).** QR arrivals are `profile_view` with `source='qr'`; legacy rows deleted by `analytics-v2-upgrade.sql`. | — |

### Columns
`id`, `owner_id` (FK profiles), `card_id` (FK cards), `event_type`, `channel`,
`source`, `visitor_id`, `session_id`, `country`, `city`, `created_at`.

### Indexes
- `(owner_id, created_at desc)` — dashboard + limit count
- `(card_id, created_at desc)` — per-card drilldown
- `(owner_id, event_type, created_at desc)` — share-limit hot path + view dedupe check

---

## 4. Dashboard (`/[username]/analytics`, Pro-only)

- **Data source:** `getDashboardData()` calls the **`analytics_dashboard` Postgres RPC** (one round-trip, all aggregation in SQL). If the RPC is missing/errors it falls back to the JS row-fetch functions with identical semantics.
- **Filters (URL-driven):** `?range=7|30|90` days; `?card=<uuid>` per-card filter chips (Pro has up to 3 cards).
- **Stat cards (6):** Views, QR scans, Shares, vCard saves, Link clicks, Konneqts — each with a **±% delta vs the previous same-length window**.
- **Charts:** views area chart; unique/returning visitors; shares by channel (stacked); top traffic sources; **top links clicked**; conversion by share channel (real attribution via `?src=`); country + city bars; **funnel: views → vCard saves → Konneqts**.

### RPC security
`analytics_dashboard(owner, days, card)` EXECUTE is **revoked from
public/anon/authenticated** and granted **only to `service_role`** (the default
PUBLIC grant would let any anon caller read ANY owner's stats).

---

## 5. PostHog product analytics (parallel track)

- **Consent-gated + DNT-respecting** (`PostHogProvider`), like GA and Vercel Analytics.
- **`identify()` on auth** (PostHogProvider effect) merges the anonymous client
  person with the Supabase user id used by server events — real funnels/retention.
- Server events (`lib/posthog.ts captureEvent`, distinctId = Supabase user id):
  `account_deactivated`, `account_deleted`, `account_reactivated`,
  `konneqt_created`, `card_shared`, `payment_completed`.
- Client events (`useTrack`): `user_logged_out`, `profile_link_copied`,
  `contact_saved`, `profile_scanned`.
- Supabase ↔ PostHog data-warehouse sync was started but NOT finished — see
  `posthog-warehouse-report.md` for the manual steps if wanted.

---

## 6. Architecture / Data Flow

```
Visitor views /[username]
  → proxy.ts: kq_vid + kq_sid cookies (consent-gated, 30-min sliding session)
  → page.tsx (server): owner/bot check → after(recordProfileViewOnce)
      → dedupe (visitor+card+session) → insert profile_view

Visitor clicks a social link
  → ProfileCard: navigator.sendBeacon('/api/track/link-click')
  → route: origin/bot/owner checks → insert link_click (channel=platform)

Owner shares
  → ShareMenu builds URL with ?src=<channel> → POST /api/share
  → limit gate → insert share → captureEvent(card_shared)
  → visitor opens the shared URL → profile_view with source=<channel> ✅ attribution

Visitor downloads /vcard
  → vcard/route.ts: owner/bot check → after(recordEvent(vcard_download))

Owner opens /analytics?range=30&card=…
  → getDashboardData → RPC analytics_dashboard (1 call) → Recharts
```

---

## 7. Privacy / Consent (v2)

| Tracker | Gating |
|---|---|
| Google Analytics | `ConsentedGoogleAnalytics` — consent-gated, lazy-loaded. |
| PostHog | `PostHogProvider` — opt-out by default; opt-in on "Accept all". |
| Vercel Analytics | `ConsentedVercelAnalytics` — mounts only on "Accept all". |

---

## 9. Operations

1. **Run the v2 migration:** `supabase/analytics-v2-upgrade.sql` (idempotent). Without it the dashboard silently uses the JS row-fetch fallback and `session_id` stays null (visitor dedupe/returning stats degrade gracefully).
2. **`SUPABASE_SERVICE_ROLE_KEY`** must be set (already required by delete-account).
3. **Cloudflare** injects `cf-ipcountry`/`cf-ipcity` automatically for geo.
4. **Retention (optional):** `select purge_analytics_events();` via service-role, or pg_cron it (see the migration footer). Default cutoff: 24 months.
5. **Existing QR codes** encoded the URL *without* `?src=qr` — old scans still count as views but may show as `source='direct'` until the owner regenerates their QR.
6. **Known limitation:** the link-click beacon is a public endpoint with origin/bot/owner guards but no per-IP rate limit; abuse only inflates the owner's own chart.

---

## 10. Decisions Log

- **Filter at write time, not read time** (owner/bots/dedupe) — the table itself is clean; queries can't forget a filter.
- **Sessions, not raw views** — 30-min sliding `kq_sid` (GA/PostHog-standard) powers dedupe + returning-visitor detection without PII.
- **QR scans = profile_view(source='qr')** — one event per scan; the old duplicate `qr_scan` insert double-counted totals.
- **?src= attribution on shared links** — referer-based "conversion" was fiction (in-app browsers strip it); first-party query params are deterministic.
- **sendBeacon for link clicks** — doesn't delay navigation; redirect-through-server rejected (latency, mailto:/deep-link breakage); PostHog-only rejected (dashboard reads Supabase).
- **RPC aggregation + JS fallback** — one DB round-trip at any scale; degrades gracefully pre-migration.
- **after() for event inserts** — guaranteed delivery in serverless (floating promises can be dropped when a lambda freezes).
- **Consent gates everything that tracks** — including Vercel Analytics and the first-party visitor/session cookies.
- **Not PostHog for the dashboard** — owners see their numbers instantly from our own Supabase table; we control the data.
- **Hard limit, not soft**; **calendar-month reset** (no cron).
