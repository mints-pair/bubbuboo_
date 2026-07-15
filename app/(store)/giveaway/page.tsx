'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { computeAvailability } from '@/lib/availability';
import { useLang } from '@/lib/lang-context';

export default function GiveawayPage() {
  const supabase = createClient();
  const { t } = useLang();
  const [products, setProducts] = useState<any[]>([]);
  const [heldMap, setHeldMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: p } = await supabase.from('products').select('*').eq('is_giveaway', true).order('created_at', { ascending: false });
    setProducts(p || []);
    const { data: held } = await supabase.rpc('held_stock');
    const map: Record<string, number> = {};
    (held || []).forEach((row: any) => { map[row.product_id] = Number(row.held_qty); });
    setHeldMap(map);
    setLoading(false);
  }

  return (
    <div className="container">
      <h1>{t('giveaway.heading')}</h1>
      <p style={{ color: '#8a8378', marginTop: -6, marginBottom: 20 }}>
        {t('giveaway.subheading')}
      </p>
      {!loading && products.length === 0 ? (
        <p style={{ color: '#9a9490' }}>{t('giveaway.empty')}</p>
      ) : (
        <div className="grid">
          {products.map((p) => {
            const { available, heldAll } = computeAvailability(p.stock, heldMap[p.id] || 0);
            let stockLabel = t('home.stockLeft', { n: available });
            if (p.stock <= 0) stockLabel = t('home.soldOut');
            else if (heldAll) stockLabel = t('home.reserved');
            return (
              <Link key={p.id} href={`/product/${p.id}`} className="p-card">
                <img className="p-thumb" src={p.images?.[0] || ''} alt={p.name} />
                <div className="p-body">
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5, minHeight: 38 }}>{p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="p-price" style={{ color: 'var(--jade)' }}>{t('giveaway.free')}</span>
                    <span style={{ fontSize: 11, color: '#8a8378' }}>
                      {p.shipping_fee > 0 ? t('giveaway.plusShipping', { n: Number(p.shipping_fee).toLocaleString('th-TH') }) : t('giveaway.freeShipping')}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: p.stock <= 0 || heldAll ? 'var(--rose)' : '#8a8a8a', marginTop: 3 }}>
                    {stockLabel}
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
