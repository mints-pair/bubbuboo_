'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/lib/lang-context';
import { isDiscountLive, isFreeShippingUnconditional, isFreeShippingEnabled, isPromotionLive, discountedPrice, productHasDiscount } from '@/lib/promotion';
import AddToCartBox from './AddToCartBox';

export default function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { t } = useLang();
  const [p, setP] = useState<any>(null);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [eventName, setEventName] = useState('');
  const [promo, setPromo] = useState<any>(null);
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [params.id]);

  async function load() {
    setLoading(true);
    const { data: product } = await supabase.from('products').select('*').eq('id', params.id).single();
    setP(product);
    setSelectedImgIdx(0);
    const memberIds: string[] = (product?.member_ids && product.member_ids.length > 0) ? product.member_ids : (product?.member_id ? [product.member_id] : []);
    const ids = [...memberIds, product?.event_id].filter(Boolean);
    if (ids.length) {
      const { data: cats } = await supabase.from('categories').select('id, name').in('id', ids);
      setMemberNames(memberIds.map((id) => cats?.find((c) => c.id === id)?.name).filter(Boolean) as string[]);
      setEventName(cats?.find((c) => c.id === product?.event_id)?.name || '');
    } else {
      setMemberNames([]);
      setEventName('');
    }
    const { data: promoData } = await supabase.from('promotion').select('*').single();
    setPromo(promoData);
    setLoading(false);
  }

  if (loading) return <div className="container" />;
  if (!p) return <div className="container">{t('product.notFound')}</div>;

  const productDiscounted = productHasDiscount(p.id, promo);
  const freeShipLive = isFreeShippingUnconditional(promo);
  const finalPrice = productDiscounted ? discountedPrice(p.id, p.price, promo) : p.price;

  return (
    <div className="container" style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
        <img
          src={p.images?.[selectedImgIdx] || p.images?.[0] || ''}
          alt={p.name}
          style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 14, background: 'var(--paper-dim)' }}
        />
        {p.images?.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {p.images.map((im: string, i: number) => (
              <img
                key={i}
                src={im}
                onClick={() => setSelectedImgIdx(i)}
                style={{
                  width: 56, height: 56, objectFit: 'cover', borderRadius: 8, cursor: 'pointer',
                  border: i === selectedImgIdx ? '2px solid var(--jade)' : '2px solid transparent',
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 260 }}>
        <h1>{p.name}</h1>
        {(memberNames.length > 0 || eventName) && (
          <div style={{ marginBottom: 8 }}>
            {memberNames.map((name) => (
              <span key={name} style={{ display: 'inline-block', fontSize: 12, background: 'var(--jade-light)', color: 'var(--jade)', padding: '3px 10px', borderRadius: 99, marginRight: 6, marginBottom: 6 }}>
                {name}
              </span>
            ))}
            {eventName && (
              <span style={{ display: 'inline-block', fontSize: 12, background: 'var(--marigold)', color: 'var(--ink)', padding: '3px 10px', borderRadius: 99, marginBottom: 6 }}>
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
        {!p.is_giveaway && !freeShipLive && isFreeShippingEnabled(promo) && (promo.free_shipping_min_amount || 0) > 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--jade)', marginTop: -10, marginBottom: 14 }}>
            {t('product.freeShipThreshold', { n: Number(promo.free_shipping_min_amount).toLocaleString('th-TH') })}
          </p>
        )}
        <p style={{ fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{p.description}</p>
        <AddToCartBox product={p} />
      </div>
    </div>
  );
}
