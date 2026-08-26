'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/lib/lang-context';
import { isPromotionLive, isDiscountLive, productHasDiscount, discountedPrice } from '@/lib/promotion';

export default function SalePage() {
  const supabase = createClient();
  const { t } = useLang();
  const [products, setProducts] = useState<any[]>([]);
  const [promo, setPromo] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: p } = await supabase.from('products').select('*').eq('is_giveaway', false).eq('is_hidden', false).gt('stock', 0).order('created_at', { ascending: false });
    setProducts(p || []);
    const { data: promoData } = await supabase.from('promotion').select('*').single();
    setPromo(promoData);
    setLoading(false);
  }

  const discountLive = isDiscountLive(promo);
  const onSale = discountLive ? products.filter((p) => productHasDiscount(p.id, promo)) : [];

  const filtered = query.trim()
    ? onSale.filter((p) => (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(query.trim().toLowerCase()))
    : onSale;

  return (
    <div className="container">
      <h1>ลดราคา</h1>
      {isPromotionLive(promo) && promo?.label && (
        <p style={{ color: 'var(--rose)', fontWeight: 600, marginTop: -6, marginBottom: 8 }}>{promo.label}</p>
      )}
      <p style={{ color: '#8a8378', marginTop: -6, marginBottom: 20 }}>
        รวมสินค้าที่กำลังลดราคาอยู่ตอนนี้จากทั้ง 2 ตลาด (สินค้ายังคงอยู่ในหน้าตลาดหลักตามปกติด้วย)
      </p>

      {!loading && (
        <div style={{ margin: '16px 0 22px' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('home.searchPlaceholder')}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14.5 }}
          />
        </div>
      )}

      {!loading && onSale.length === 0 ? (
        <p style={{ color: '#9a9490' }}>ยังไม่มีสินค้าลดราคาตอนนี้</p>
      ) : !loading && filtered.length === 0 ? (
        <p style={{ color: '#9a9490' }}>{t('home.emptyNoResults')}</p>
      ) : (
        <div className="grid">
          {filtered.map((p) => {
            const finalPrice = discountedPrice(p.id, p.price, promo);
            return (
              <Link key={p.id} href={`/product/${p.id}`} className="p-card">
                <img className="p-thumb" src={p.thumbnail_url || p.images?.[0] || ''} alt={p.name} />
                <div className="p-body">
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5, minHeight: 38 }}>{p.name}</div>
                  <div>
                    <span style={{ fontSize: 12.5, color: '#a89f92', textDecoration: 'line-through', marginRight: 6 }}>฿{Number(p.price).toLocaleString('th-TH')}</span>
                    <span className="p-price">฿{Number(finalPrice).toLocaleString('th-TH')}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#8a8a8a', marginTop: 3 }}>{p.market === 'dmd' ? '#ตลาดนัดDMD' : '#ตลาดนัดGMMTV'}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
