// Pure, client-safe helper — no server-only imports here.
// available = stock - qty held by pending (unconfirmed) orders.
// heldAll = true when stock > 0 but every unit is currently reserved by
// pending orders (as opposed to truly sold out, i.e. stock itself is 0).
export type Availability = { available: number; heldAll: boolean };

export function computeAvailability(stock: number, held: number): Availability {
  const available = Math.max(0, stock - held);
  const heldAll = stock > 0 && available === 0;
  return { available, heldAll };
}
