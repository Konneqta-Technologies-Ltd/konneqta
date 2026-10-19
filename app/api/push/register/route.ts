/**
 * POST /api/push/register — store (or refresh) the MOBILE app's Expo push
 * token for the signed-in user.
 * DELETE /api/push/register — remove it (logout / notifications off).
 *
 * Auth: Bearer token (mobile — this route exists for the native app) or SSR
 * cookies. Writes go through the caller's own session client so RLS scopes
 * every write to their own rows — a user can never register a token onto
 * someone else's account.
 *
 * Body: { token: "ExponentPushToken[/...]", platform: "ios" | "android",
 *         deviceName?: string }
 *
 * Storage: mobile_push_tokens (supabase/mobile-push-setup.sql) — one row per
 * app install, upserted on the globally-unique token.
 */

import { NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/supabase/request-auth';

const MAX_TOKEN_LENGTH = 200;

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const platform = body?.platform === 'ios' || body?.platform === 'android' ? body.platform : null;
    const deviceName =
      typeof body?.deviceName === 'string' ? body.deviceName.slice(0, 120) : null;

    if (!token || token.length > MAX_TOKEN_LENGTH || !platform) {
      return NextResponse.json(
        { error: 'Provide token and platform (ios|android).' },
        { status: 400 },
      );
    }

    // Upsert on the globally-unique token — re-registering the same device
    // just refreshes its row (and re-homes it if the user re-logged-in on a
    // shared device, since the old user's row is unique on the token).
    const { error } = await supabase.from('mobile_push_tokens').upsert(
      {
        user_id: user.id,
        token,
        platform,
        device_name: deviceName,
      },
      { onConflict: 'token' },
    );

    if (error) {
      // Expected pre-migration (mobile-push-setup.sql not run yet).
      console.warn('[push/register] upsert failed (non-fatal):', error.message);
      return NextResponse.json(
        { error: 'Could not save the push token. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[push/register] error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user } = await getUserFromRequest(req);
    if (!user) {
      // Logging out of a session that already died — nothing to clean.
      return NextResponse.json({ ok: true });
    }

    // Token can arrive in the body or the query string (DELETE bodies are
    // occasionally stripped by proxies).
    let token: string | null = null;
    try {
      const body = await req.json();
      token = typeof body?.token === 'string' ? body.token.trim() : null;
    } catch {
      // No/invalid body — fall through to the query string.
    }
    if (!token) {
      token = new URL(req.url).searchParams.get('token');
    }
    if (!token) {
      return NextResponse.json({ error: 'Provide token.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('mobile_push_tokens')
      .delete()
      .eq('token', token);

    if (error) {
      console.warn('[push/register] delete failed (non-fatal):', error.message);
      return NextResponse.json({ error: 'Could not remove the push token.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[push/register] delete error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}