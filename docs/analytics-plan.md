# Analytics & Share-Limit Plan

> **Purpose:** This document is the durable "memory" of how Konneqta's
> self-hosted analytics and the 25-shares/month limit work, so future sessions
> (human or AI) don't have to re-derive the design. Update it whenever the
> event taxonomy, limits, or data flow change.

---

## 1. The 25 Shares / Month Limit

| Rule | Value |
|---|---|
| **Who is limited** | The **owner** sharing their **own** card. Visitors sharing someone else's card are free virality and are NOT counted/limited. |
| **What counts as a share** | All 6 `ShareMenu` actions: `native` (Web Share API), `copy` (Copy Link), `whatsapp`, `telegram`, `sms`, `email`. |
| **Limit per month** | **Free = 25**, **Pro = ∞**, **Exempt = ∞** |
| **Reset window** | **Calendar month** (`date_trunc('month', now())` in SQL). No cron needed. |
| **Scope** | **Per user** (all their cards combined), not per-card. |
| **Enforcement** | **Server-side only** in `app/api/share/route.ts`. The client cannot bypass it — the limit check runs before the event is inserted. On 429 the share is blocked and an upgrade prompt is shown. |
| **Source of truth** | `PLAN_LIMITS.maxShares` in `lib/entitlements.ts` + `getMaxShares()`. Count query in `getMonthlyShareCountWithLimit()` (`lib/analytics/queries.ts`). |

---

## 2. Event Taxonomy (the `analytics_events` table)

One append-only table, `public.analytics_events`. All writes are server-side
via the service-role key (no client INSERT policy exists — RLS only allows
owners to SELECT their own rows).

| `event_type` | Trigger | Key columns |
|---|---|---|
| `profile_view` | Server component `app/[username]/page.tsx`, every render after the 404/redirect guards. Fire-and-forget (`void recordEvent(...)`). | `source`, `visitor_id`, `country`, `city` |
| `share` | API route `app/api/share/route.ts` (POST), after the limit check passes. | `channel` (`whatsapp`/`telegram`/`copy`/`native`/`email`/`sms`) |
| `qr_scan` | (Client, in-app scanner — `QrScanner.tsx`. Printed-QR scans are captured as `profile_view` with `source='qr'`.) | — |
| `vcard_download` | Route `app/[username]/vcard/route.ts`, each `.vcf` GET. | `visitor_id` |

### Columns
`id`, `owner_id` (FK profiles), `card_id` (FK cards), `event_type`, `channel`,
`source`, `visitor_id`, `country`, `city`, `created_at`.

### Indexes
- `(owner_id, created_at desc)` — dashboard + limit count
- `(card_id, created_at desc)` — per-card drilldown
- `(owner_id, event_type, created_at desc)` — share-limit hot path

---

## 3. Metric → Source Map (how each dashboard chart is fed)

| Metric | Where the data comes from |
|---|---|
| **Profile views** | `profile_view` events, daily series (`getDailySeries`) |
| **Share count** | `share` events, daily + by-channel (`getDailySharesByChannel`) + monthly count for the badge |
| **QR scans** | in-app `profile_scanned` (PostHog) + printed-QR scans show as `profile_view` where `source='qr'`. The QR image URL carries `?src=qr` (see `lib/qr.ts`). |
| **vCard downloads** | `vcard_download` events |
| **Top traffic source** | `profile_view.source`, derived from referer header / `?src=` (`lib/analytics/source.ts`) |
| **Conversion by share channel** | `share.channel` vs resulting `profile_view.source` (`getChannelConversion`) |
| **Unique visitors** | `count(distinct visitor_id)` over `profile_view` (`getVisitorStats`) |
| **Returning visitors** | `visitor_id` with >1 event in the window |
| **Geographic distribution** | `country` / `city` columns, populated from Cloudflare `cf-ipcountry` / `cf-ipcity` headers (`lib/analytics/geo.ts`). **No action needed on Cloudflare** — these headers are injected automatically. |

---

## 4. Architecture / Data Flow

```
Visitor views /[username]
  → page.tsx (server) → recordEvent(profile_view) [service-role, fire-and-forget]
  → visitor cookie (kq_vid) set/expanded
  → geo from CF headers

Owner clicks Share
  → ShareMenu.tsx POSTs /api/share { username, channel, cardId }
  → /api/share checks entitlements (maxShares) + counts this month's shares
  → if >= limit && !pro → 429 { blocked: true }
  → else insert share event → return { used, remaining }
  → ShareMenu calls refresh() on ShareCountProvider → badge ticks down live

Visitor downloads /vcard
  → vcard/route.ts → recordEvent(vcard_download)

Owner opens /analytics (Pro-only)
  → page queries analytics_events (service-role) → renders Recharts
```

---

## 5. Key Files

**New:**
- `supabase/analytics-setup.sql` — table + indexes + RLS
- `lib/analytics/server.ts` — `getAdminClient()`, `recordEvent()`
- `lib/analytics/source.ts` — `parseSource()`
- `lib/analytics/geo.ts` — `parseGeo()` (Cloudflare headers)
- `lib/analytics/visitor.ts` — `getOrCreateVisitorId()` (kq_vid cookie)
- `lib/analytics/queries.ts` — all dashboard aggregations + share count
- `app/api/share/route.ts` — POST: limit gate + record
- `app/api/share/count/route.ts` — GET: current month usage (badge)
- `components/analytics/ShareCountProvider.tsx` — context for live badge
- `components/analytics/ShareCounter.tsx` — top-right "12/25" pill
- `components/analytics/Charts.tsx` — Recharts components
- `app/[username]/analytics/page.tsx` — Pro-only dashboard

**Edited:**
- `lib/entitlements.ts` — `maxShares` + `getMaxShares()`
- `components/ShareMenu.tsx` — POST + enforce + refresh
- `app/[username]/page.tsx` — profile_view tracking + ShareCountProvider mount
- `app/[username]/vcard/route.ts` — vcard_download tracking
- `lib/qr.ts` — `?src=qr` baked into QR URL
- `components/ProfileCard.tsx` — pass `isOwner`/`cardId` to ShareMenu
- `components/nav/SideNav.tsx` — Home + Analytics links

---

## 6. Setup / Operations

1. **Run the SQL migration:** `supabase/analytics-setup.sql` (creates the table).
2. **`SUPABASE_SERVICE_ROLE_KEY`** must be set in env (already used by delete-account). Analytics writes rely on it.
3. **Cloudflare** is already fronting the app — `cf-ipcountry`/`cf-ipcity` are auto-injected, so geo works out of the box. If not on CF, geo columns stay null and charts show "Unknown" (nothing breaks).
4. **Existing QR codes** encode the old URL without `?src=qr`. New QR codes (generated after this change) will carry it. Old scans still count as views but may show as `source='direct'` until the user regenerates their QR.

---

## 7. Decisions Log

- **Not PostHog for the dashboard.** PostHog remains wired for product analytics, but the user-facing analytics page reads from our own Supabase table so the owner sees their numbers instantly and we control the data.
- **Visitor identity via cookie, not login.** Anonymous unique/returning visitor counts use a `kq_vid` uuid cookie (1 year, HttpOnly, no PII).
- **Hard limit, not soft.** At 0 remaining the share is blocked with an upgrade prompt.
- **Calendar-month reset** (simplest, no cron).