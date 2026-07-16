'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { computeAvailability } from '@/lib/availability';
import { useLang } from '@/lib/lang-context';
import { isPromotionLive, isDiscountLive, isFreeShippingLive, discountedPrice, productHasDiscount } from '@/lib/promotion';

export default function MarketPage({ market, heading }: { market: 'gmmtv' | 'dmd'; heading: string }) {
  const supabase = createClient();
  const { t } = useLang();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [heldMap, setHeldMap] = useState<Record<string, number>>({});
  const [promo, setPromo] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [market]);

  async function load() {
    setLoading(true);
    const { data: p } = await supabase.from('products').select('*').eq('is_giveaway', false).eq('market', market).order('created_at', { ascending: false });
    setProducts(p || []);
    const { data: c } = await supabase.from('categories').select('*').order('name', { ascending: true });
    setCategories(c || []);
    const { data: held } = await supabase.rpc('held_stock');
    const map: Record<string, number> = {};
    (held || []).forEach((row: any) => { map[row.product_id] = Number(row.held_qty); });
    setHeldMap(map);
    const { data: promoData } = await supabase.from('promotion').select('*').single();
    setPromo(promoData);
    setLoading(false);
  }

  const members = categories.filter((c) => c.type === 'member');
  const events = categories.filter((c) => c.type === 'event');
  const hasActiveFilter = !!(query.trim() || memberFilter || eventFilter);
  const featuredProducts = products.filter((p) => p.is_featured);

  let filtered = products;
  if (memberFilter) filtered = filtered.filter((p) => p.member_id === memberFilter);
  if (eventFilter) filtered = filtered.filter((p) => p.event_id === eventFilter);
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter((p) => (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q));
  }

  const promoLive = isPromotionLive(promo);
  const discountLive = isDiscountLive(promo);
  const freeShipLive = isFreeShippingLive(promo);

  function renderCard(p: any) {
    const { available, heldAll } = computeAvailability(p.stock, heldMap[p.id] || 0);
    let stockLabel = t('home.stockLeft', { n: available });
    if (p.stock <= 0) stockLabel = t('home.soldOut');
    else if (heldAll) stockLabel = t('home.reserved');
    const productDiscounted = productHasDiscount(p.id, promo);
    const finalPrice = productDiscounted ? discountedPrice(p.id, p.price, promo) : p.price;
    return (
      <Link key={p.id} href={`/product/${p.id}`} className="p-card">
        <img className="p-thumb" src={p.images?.[0] || ''} alt={p.name} />
        <div className="p-body">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5, minHeight: 38 }}>{p.name}</div>
          {productDiscounted ? (
            <div>
              <span style={{ fontSize: 12.5, color: '#a89f92', textDecoration: 'line-through', marginRight: 6 }}>฿{Number(p.price).toLocaleString('th-TH')}</span>
              <span className="p-price">฿{Number(finalPrice).toLocaleString('th-TH')}</span>
            </div>
          ) : (
            <div className="p-price">฿{Number(p.price).toLocaleString('th-TH')}</div>
          )}
          <div style={{ fontSize: 11, color: p.stock <= 0 || heldAll ? 'var(--rose)' : '#8a8a8a', marginTop: 3 }}>
            {stockLabel}{freeShipLive && p.stock > 0 && !heldAll ? ` · ${t('home.freeShippingBadge')}` : ''}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="container">
      {promoLive && (
        <div style={{
          background: 'var(--marigold)', color: 'var(--ink)', borderRadius: 12, padding: '12px 16px',
          fontWeight: 600, fontSize: 14, marginBottom: 18, textAlign: 'center',
        }}>
          {promo.label || (discountLive ? t(promo.discount_scope === 'selected' ? 'home.promoDiscountSelected' : 'home.promoDiscountAll', { n: promo.discount_percent }) : '') || (freeShipLive ? t('home.promoFreeShipping') : t('home.promoGeneric'))}
        </div>
      )}

      {!loading && !hasActiveFilter && featuredProducts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
            <span style={{ color: 'var(--marigold-dark)' }}>★</span> {t('home.featuredHeading')}
          </h2>
          <div className="grid">
            {featuredProducts.map((p) => renderCard(p))}
          </div>
        </div>
      )}

      <h1>{heading}</h1>
      <div style={{ display: 'flex', gap: 10, margin: '16px 0 22px', flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('home.searchPlaceholder')}
          style={{ flex: 1, minWidth: 200, padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14.5 }}
        />
        {members.length > 0 && (
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14.5, background: '#fff' }}
          >
            <option value="">{t('home.allMembers')}</option>
            {members.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        {events.length > 0 && (
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14.5, background: '#fff' }}
          >
            <option value="">{t('home.allEvents')}</option>
            {events.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
      {!loading && filtered.length === 0 ? (
        <p style={{ color: '#9a9490' }}>{hasActiveFilter ? t('home.emptyNoResults') : t('home.emptyNoProducts')}</p>
      ) : (
        <div className="grid">
          {filtered.map((p) => renderCard(p))}
        </div>
      )}
    </div>
  );
}
