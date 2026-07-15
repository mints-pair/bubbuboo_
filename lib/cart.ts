export type CartLine = { productId: string; qty: number };

const KEY = 'shop_cart_v1';

export function getCart(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCart(cart: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('cart-updated'));
}

export function addToCart(productId: string, qty: number) {
  const cart = getCart();
  const existing = cart.find((c) => c.productId === productId);
  if (existing) existing.qty += qty;
  else cart.push({ productId, qty });
  saveCart(cart);
}

export function removeFromCart(productId: string) {
  saveCart(getCart().filter((c) => c.productId !== productId));
}

export function clearCart() {
  saveCart([]);
}
