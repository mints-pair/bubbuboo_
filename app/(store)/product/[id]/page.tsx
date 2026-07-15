import { createServerSupabase } from '@/lib/supabase/server';
import { getHeldStockMap, computeAvailability } from '@/lib/availability';
import AddToCartBox from './AddToCartBox';

export const revalidate = 0;

export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: p } = await supabase.from('products').select('*').eq('id', params.id).single();

  if (!p) return <div className="container">ไม่พบสินค้านี้</div>;

  const heldMap = await getHeldStockMap();
  const { available, heldAll } = computeAvailability(p.stock, heldMap[p.id] || 0);

  return (
    <div className="container" style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
        <img
          src={p.images?.[0] || ''}
          alt={p.name}
          style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 14, background: 'var(--paper-dim)' }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 260 }}>
        <h1>{p.name}</h1>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--rose)', fontWeight: 700 }}>
          ฿{Number(p.price).toLocaleString('th-TH')}
        </div>
        <div style={{ fontSize: 13, color: '#7d7570', marginBottom: 14 }}>ค่าจัดส่ง ฿{Number(p.shipping_fee).toLocaleString('th-TH')}</div>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{p.description}</p>
        <AddToCartBox product={p} available={available} heldAll={heldAll} />
      </div>
    </div>
  );
}
