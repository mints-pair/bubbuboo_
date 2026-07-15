'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { computeAvailability } from '@/lib/availability';
import { useLang } from '@/lib/lang-context';
import AddToCartBox from './AddToCartBox';

export default function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { t } = useLang();
  const [p, setP] = useState<any>(null);
  const [available, setAvailable] = useState(0);
  const [heldAll, setHeldAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [params.id]);

  async function load() {
    setLoading(true);
    const { data: product } = await supabase.from('products').select('*').eq('id', params.id).single();
    setP(product);
    if (product) {
      const { data: held } = await supabase.rpc('held_stock');
      const heldQty = (held || []).find((r: any) => r.product_id === product.id)?.held_qty || 0;
      const av = computeAvailability(product.stock, Number(heldQty));
      setAvailable(av.available);
      setHeldAll(av.heldAll);
    }
    setLoading(false);
  }

  if (loading) return <div className="container" />;
  if (!p) return <div className="container">{t('product.notFound')}</div>;

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
        <div style={{ fontSize: 13, color: '#7d7570', marginBottom: 14 }}>{t('product.shippingFee')} ฿{Number(p.shipping_fee).toLocaleString('th-TH')}</div>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{p.description}</p>
        <AddToCartBox product={p} available={available} heldAll={heldAll} />
      </div>
    </div>
  );
}
