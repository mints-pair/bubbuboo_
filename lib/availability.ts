import { createServerSupabase } from '@/lib/supabase/server';

export type Availability = { available: number; heldAll: boolean };

// available = stock - qty held by pending (unconfirmed) orders.
// heldAll = true when stock > 0 but every unit is currently reserved by
// pending orders (as opposed to truly sold out, i.e. stock itself is 0).
export async function getHeldStockMap(): Promise<Record<string, number>> {
  const supabase = createServerSupabase();
  const { data } = await supabase.rpc('held_stock');
  const map: Record<string, number> = {};
  (data || []).forEach((row: any) => { map[row.product_id] = Number(row.held_qty); });
  return map;
}

export function computeAvailability(stock: number, held: number): Availability {
  const available = Math.max(0, stock - held);
  const heldAll = stock > 0 && available === 0;
  return { available, heldAll };
}
