'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addToCart, getCart } from '@/lib/cart';
import { useLang } from '@/lib/lang-context';

export default function AddToCartBox({ product }: { product: any }) {
  const [qty, setQty] = useState(1);
  const [cartQty, setCartQty] = useState(0);
  const router = useRouter();
  const { t } = useLang();

  useEffect(() => {
    const line = getCart().find((c) => c.productId === product.id);
    setCartQty(line?.qty || 0);
  }, [product.id]);

  if (product.stock <= 0) {
    return <button className="btn btn-outline" disabled>{t('product.soldOut')}</button>;
  }

  // Adding to cart only ever checks real stock — a payment-step hold from
  // another shopper never blocks this. Contention (if any) only surfaces
  // later, when this shopper tries to advance to the payment step.
  const max = Math.max(0, product.stock - cartQty);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--line)', borderRadius: 9, overflow: 'hidden' }}>
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 34, height: 34, border: 'none', background: 'var(--paper-dim)' }}>−</button>
          <span style={{ width: 44, textAlign: 'center', display: 'inline-block' }}>{qty}</span>
          <button onClick={() => setQty((q) => Math.min(max, q + 1))} style={{ width: 34, height: 34, border: 'none', background: 'var(--paper-dim)' }}>+</button>
        </div>
        <span style={{ fontSize: 13, color: '#8a8378' }}>{t('product.availableLeft', { n: max })}</span>
      </div>
      <button
        className="btn btn-primary"
        disabled={max <= 0}
        onClick={() => {
          addToCart(product.id, qty);
          router.push('/cart');
        }}
      >
        {t('product.addToCart')}
      </button>
    </div>
  );
}
