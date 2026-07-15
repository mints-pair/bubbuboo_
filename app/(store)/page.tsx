'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { computeAvailability } from '@/lib/availability';
import { useLang } from '@/lib/lang-context';
import { isPromotionLive, isDiscountLive, isFreeShippingLive, discountedPrice } from '@/lib/promotion';

export default function HomePage() {
  const supabase = createClient();
  const { t } = useLang();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [heldMap, setHeldMap] = useState<Record<string, number>>({});
  const [promo, setPromo] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: p } = await supabase.from('products').select('*').order('created_at', { ascending: false });
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

  let filtered = products;
  if (categoryFilter) filtered = filtered.filter((p) => p.category_id === categoryFilter);
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter((p) => (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q));
  }

  const promoLive = isPromotionLive(promo);
  const discountLive = isDiscountLive(promo);
  const freeShipLive = isFreeShippingLive(promo);

  return (
    <div className="container">
      {promoLive && (
        <div style={{
          background: 'var(--marigold)', color: 'var(--ink)', borderRadius: 12, padding: '12px 16px',
          fontWeight: 600, fontSize: 14, marginBottom: 18, textAlign: 'center',
        }}>
          {promo.label || (discountLive ? `ลดราคาทุกชิ้น ${promo.discount_percent}%` : '') || (freeShipLive ? 'ส่งฟรีทุกออเดอร์วันนี้!' : 'มีโปรโมชั่นพิเศษ')}
        </div>
      )}
      <h1>{t('home.heading')}</h1>
      <div style={{ display: 'flex', gap: 10, margin: '16px 0 22px', flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('home.searchPlaceholder')}
          style={{ flex: 1, minWidth: 200, padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14.5 }}
        />
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14.5, background: '#fff' }}
          >
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
      {!loading && filtered.length === 0 ? (
        <p style={{ color: '#9a9490' }}>{query || categoryFilter ? t('home.emptyNoResults') : t('home.emptyNoProducts')}</p>
      ) : (
        <div className="grid">
          {filtered.map((p) => {
            const { available, heldAll } = computeAvailability(p.stock, heldMap[p.id] || 0);
            let stockLabel = t('home.stockLeft', { n: available });
            if (p.stock <= 0) stockLabel = t('home.soldOut');
            else if (heldAll) stockLabel = t('home.reserved');
            const finalPrice = discountLive ? discountedPrice(p.price, promo) : p.price;
            return (
              <Link key={p.id} href={`/product/${p.id}`} className="p-card">
                <img className="p-thumb" src={p.images?.[0] || ''} alt={p.name} />
                <div className="p-body">
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5, minHeight: 38 }}>{p.name}</div>
                  {discountLive ? (
                    <div>
                      <span style={{ fontSize: 12.5, color: '#a89f92', textDecoration: 'line-through', marginRight: 6 }}>฿{Number(p.price).toLocaleString('th-TH')}</span>
                      <span className="p-price">฿{Number(finalPrice).toLocaleString('th-TH')}</span>
                    </div>
                  ) : (
                    <div className="p-price">฿{Number(p.price).toLocaleString('th-TH')}</div>
                  )}
                  <div style={{ fontSize: 11, color: p.stock <= 0 || heldAll ? 'var(--rose)' : '#8a8a8a', marginTop: 3 }}>
                    {stockLabel}{freeShipLive && p.stock > 0 && !heldAll ? ' · ส่งฟรี' : ''}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
