/**
 * POST /api/notifications/read — mark one notification (or all) as read.
 *
 * Body: { id?: string, all?: boolean }
 *   - { id }  → mark a single notification read (dropdown/page item tap).
 *   - { all } → mark every unread notification read ("Mark all read").
 *
 * RLS: users can only update their own rows (read_at is the only field the
 * UI ever sends).
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
    const id = typeof body?.id === 'string' ? body.id : null;
    const all = body?.all === true;

    if (!id && !all) {
      return NextResponse.json(
        { error: 'Provide an id or all: true.' },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();
    let query = supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (id) query = query.eq('id', id);

    const { error } = await query;
    if (error) {
      console.warn('[api/notifications/read] update failed:', error.message);
      return NextResponse.json(
        { error: 'Could not mark notifications read.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/notifications/read] error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
