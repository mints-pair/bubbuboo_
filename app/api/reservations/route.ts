import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

const HOLD_MINUTES = 10;

// Called when a customer clicks through from the cart to the payment step.
// Validates that everything in their cart is still actually available
// (accounting for other people's pending orders AND other active
// reservations), and if so, holds it for this session for 10 minutes.
export async function POST(req: Request) {
  const { sessionId, items } = await req.json().catch(() => ({}));
  if (!sessionId || !items?.length) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const nowIso = new Date().toISOString();
  const productIds = items.map((i: any) => i.productId);

  const [{ data: products }, { data: activeReservations }, { data: pendingOrders }] = await Promise.all([
    supabase.from('products').select('id, name, stock').in('id', productIds),
    supabase.from('cart_reservations').select('product_id, qty, session_id').gt('expires_at', nowIso),
    supabase.from('orders').select('items').eq('status', 'pending'),
  ]);

  // held by OTHER sessions/orders (exclude this session's own existing hold,
  // since we're about to replace it with a fresh one anyway)
  const heldByOthers: Record<string, number> = {};
  for (const r of activeReservations || []) {
    if (r.session_id === sessionId) continue;
    heldByOthers[r.product_id] = (heldByOthers[r.product_id] || 0) + r.qty;
  }
  for (const o of pendingOrders || []) {
    for (const it of o.items as any[]) {
      heldByOthers[it.productId] = (heldByOthers[it.productId] || 0) + it.qty;
    }
  }

  const unavailable: { productId: string; name: string; available: number }[] = [];
  for (const item of items) {
    const p = (products || []).find((x: any) => x.id === item.productId);
    if (!p) { unavailable.push({ productId: item.productId, name: '', available: 0 }); continue; }
    const held = heldByOthers[p.id] || 0;
    const available = Math.max(0, p.stock - held);
    if (item.qty > available) unavailable.push({ productId: p.id, name: p.name, available });
  }

  if (unavailable.length > 0) {
    return NextResponse.json({ error: 'unavailable', items: unavailable }, { status: 409 });
  }

  // replace this session's previous holds with a fresh 10-minute window
  await supabase.from('cart_reservations').delete().eq('session_id', sessionId);
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();
  const rows = items.map((i: any) => ({ session_id: sessionId, product_id: i.productId, qty: i.qty, expires_at: expiresAt }));
  const { error: insErr } = await supabase.from('cart_reservations').insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, expiresAt });
}

// Called if the customer navigates back from payment to cart, so the hold
// doesn't needlessly block others for the remainder of the 10 minutes.
export async function DELETE(req: Request) {
  const { sessionId } = await req.json().catch(() => ({}));
  if (!sessionId) return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  const supabase = createAdminSupabase();
  await supabase.from('cart_reservations').delete().eq('session_id', sessionId);
  return NextResponse.json({ ok: true });
}
