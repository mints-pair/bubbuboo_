'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addToCart } from '@/lib/cart';

export default function AddToCartBox({
  product, available, heldAll,
}: { product: any; available: number; heldAll: boolean }) {
  const [qty, setQty] = useState(1);
  const router = useRouter();

  if (product.stock <= 0) {
    return <button className="btn btn-outline" disabled>Sold out</button>;
  }

  if (heldAll) {
    return (
      <div>
        <div className="btn btn-outline" style={{ display: 'inline-block', color: 'var(--rose)', borderColor: 'var(--rose)' }} aria-disabled>
          ติดจอง — สินค้าถูกจองไว้ทั้งหมด
        </div>
        <p style={{ fontSize: 12.5, color: '#8a8378', marginTop: 8 }}>
          สินค้านี้กำลังรอการยืนยันการชำระเงินจากลูกค้าท่านอื่น หากรายการนั้นถูกยกเลิก สินค้าจะกลับมาให้สั่งซื้อได้อีกครั้ง
        </p>
      </div>
    );
  }

  const max = Math.max(0, available);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--line)', borderRadius: 9, overflow: 'hidden' }}>
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 34, height: 34, border: 'none', background: 'var(--paper-dim)' }}>−</button>
          <span style={{ width: 44, textAlign: 'center', display: 'inline-block' }}>{qty}</span>
          <button onClick={() => setQty((q) => Math.min(max, q + 1))} style={{ width: 34, height: 34, border: 'none', background: 'var(--paper-dim)' }}>+</button>
        </div>
        <span style={{ fontSize: 13, color: '#8a8378' }}>เหลือ {max} ชิ้น (พร้อมสั่งซื้อ)</span>
      </div>
      <button
        className="btn btn-primary"
        disabled={max <= 0}
        onClick={() => {
          addToCart(product.id, qty);
          router.push('/cart');
        }}
      >
        ใส่ตะกร้า
      </button>
    </div>
  );
}
