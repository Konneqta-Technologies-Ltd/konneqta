/**
 * POST /api/push/subscribe — save (or refresh) this device's Web Push
 * subscription for the signed-in user.
 * DELETE /api/push/subscribe — remove it (notifications off / logout cleanup).
 *
 * The browser sends its PushSubscription JSON after
 * pushManager.subscribe() succeeds. We upsert on the endpoint (globally
 * unique per browser+device), so re-subscribing just refreshes the keys.
 *
 * RLS note: writes go through the cookie-scoped server client, so users can
 * only ever touch their own rows.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const endpoint =
      typeof body?.endpoint === 'string' ? body.endpoint : null;
    const p256dh =
      typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh : null;
    const auth =
      typeof body?.keys?.auth === 'string' ? body.keys.auth : null;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: 'Invalid subscription payload.' },
        { status: 400 },
      );
    }

    const userAgent =
      typeof req.headers.get('user-agent') === 'string'
        ? req.headers.get('user-agent')?.slice(0, 300) ?? null
        : null;

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' },
      );

    if (error) {
      // 42P01 = undefined_table pre-migration — treat as "not available yet".
      console.warn('[api/push/subscribe] upsert failed:', error.message);
      return NextResponse.json(
        { error: 'Could not save subscription.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/push/subscribe] POST error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const endpoint =
      typeof body?.endpoint === 'string' ? body.endpoint : null;
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing endpoint.' },
        { status: 400 },
      );
    }

    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/push/subscribe] DELETE error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
