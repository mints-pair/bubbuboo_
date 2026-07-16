'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { computeAvailability } from '@/lib/availability';
import { useLang } from '@/lib/lang-context';
import { isDiscountLive, isFreeShippingLive, discountedPrice, productHasDiscount } from '@/lib/promotion';
import AddToCartBox from './AddToCartBox';

export default function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { t } = useLang();
  const [p, setP] = useState<any>(null);
  const [memberName, setMemberName] = useState('');
  const [eventName, setEventName] = useState('');
  const [available, setAvailable] = useState(0);
  const [heldAll, setHeldAll] = useState(false);
  const [promo, setPromo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [params.id]);

  async function load() {
    setLoading(true);
    const { data: product } = await supabase.from('products').select('*').eq('id', params.id).single();
    setP(product);
    const ids = [product?.member_id, product?.event_id].filter(Boolean);
    if (ids.length) {
      const { data: cats } = await supabase.from('categories').select('id, name').in('id', ids);
      setMemberName(cats?.find((c) => c.id === product?.member_id)?.name || '');
      setEventName(cats?.find((c) => c.id === product?.event_id)?.name || '');
    } else {
      setMemberName('');
      setEventName('');
    }
    if (product) {
      const { data: held } = await supabase.rpc('held_stock');
      const heldQty = (held || []).find((r: any) => r.product_id === product.id)?.held_qty || 0;
      const av = computeAvailability(product.stock, Number(heldQty));
      setAvailable(av.available);
      setHeldAll(av.heldAll);
    }
    const { data: promoData } = await supabase.from('promotion').select('*').single();
    setPromo(promoData);
    setLoading(false);
  }

  if (loading) return <div className="container" />;
  if (!p) return <div className="container">{t('product.notFound')}</div>;

  const productDiscounted = productHasDiscount(p.id, promo);
  const freeShipLive = isFreeShippingLive(promo);
  const finalPrice = productDiscounted ? discountedPrice(p.id, p.price, promo) : p.price;

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
        {(memberName || eventName) && (
          <div style={{ marginBottom: 8 }}>
            {memberName && (
              <span style={{ display: 'inline-block', fontSize: 12, background: 'var(--jade-light)', color: 'var(--jade)', padding: '3px 10px', borderRadius: 99, marginRight: 6 }}>
                {memberName}
              </span>
            )}
            {eventName && (
              <span style={{ display: 'inline-block', fontSize: 12, background: 'var(--marigold)', color: 'var(--ink)', padding: '3px 10px', borderRadius: 99 }}>
                {eventName}
              </span>
            )}
          </div>
        )}
        {p.is_giveaway ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--jade)', fontWeight: 700 }}>{t('product.free')}</span>
            <span style={{ fontSize: 12, background: 'var(--jade-light)', color: 'var(--jade)', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>{t('product.giveawayBadge')}</span>
          </div>
        ) : productDiscounted ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 17, color: '#a89f92', textDecoration: 'line-through' }}>฿{Number(p.price).toLocaleString('th-TH')}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--rose)', fontWeight: 700 }}>
              ฿{Number(finalPrice).toLocaleString('th-TH')}
            </span>
            <span style={{ fontSize: 12, background: 'var(--marigold)', color: 'var(--ink)', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
              -{promo.discount_percent}%
            </span>
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--rose)', fontWeight: 700 }}>
            ฿{Number(p.price).toLocaleString('th-TH')}
          </div>
        )}
        <div style={{ fontSize: 13, color: '#7d7570', marginBottom: 14 }}>
          {p.is_giveaway ? (
            p.shipping_fee > 0
              ? <>{t('product.shippingFee')} ฿{Number(p.shipping_fee).toLocaleString('th-TH')}</>
              : <span style={{ color: 'var(--jade)', fontWeight: 700 }}>{t('product.noShippingFee')}</span>
          ) : freeShipLive ? (
            <>
              <span style={{ textDecoration: 'line-through', color: '#a89f92' }}>{t('product.shippingFee')} ฿{Number(p.shipping_fee).toLocaleString('th-TH')}</span>
              {' '}<span style={{ color: 'var(--jade)', fontWeight: 700 }}>{t('product.freeShippingBadge')}</span>
            </>
          ) : (
            <>{t('product.shippingFee')} ฿{Number(p.shipping_fee).toLocaleString('th-TH')}</>
          )}
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{p.description}</p>
        <AddToCartBox product={p} available={available} heldAll={heldAll} />
      </div>
    </div>
  );
}
