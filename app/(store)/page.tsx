'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { computeAvailability } from '@/lib/availability';
import { useLang } from '@/lib/lang-context';

export default function HomePage() {
  const supabase = createClient();
  const { t } = useLang();
  const [products, setProducts] = useState<any[]>([]);
  const [heldMap, setHeldMap] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: p } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(p || []);
    const { data: held } = await supabase.rpc('held_stock');
    const map: Record<string, number> = {};
    (held || []).forEach((row: any) => { map[row.product_id] = Number(row.held_qty); });
    setHeldMap(map);
    setLoading(false);
  }

  const filtered = query.trim()
    ? products.filter((p) => (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(query.trim().toLowerCase()))
    : products;

  return (
    <div className="container">
      <h1>{t('home.heading')}</h1>
      <div style={{ margin: '16px 0 22px' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('home.searchPlaceholder')}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14.5 }}
        />
      </div>
      {!loading && filtered.length === 0 ? (
        <p style={{ color: '#9a9490' }}>{query ? t('home.emptyNoResults') : t('home.emptyNoProducts')}</p>
      ) : (
        <div className="grid">
          {filtered.map((p) => {
            const { available, heldAll } = computeAvailability(p.stock, heldMap[p.id] || 0);
            let stockLabel = t('home.stockLeft', { n: available });
            if (p.stock <= 0) stockLabel = t('home.soldOut');
            else if (heldAll) stockLabel = t('home.reserved');
            return (
              <Link key={p.id} href={`/product/${p.id}`} className="p-card">
                <img className="p-thumb" src={p.images?.[0] || ''} alt={p.name} />
                <div className="p-body">
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5, minHeight: 38 }}>{p.name}</div>
                  <div className="p-price">฿{Number(p.price).toLocaleString('th-TH')}</div>
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
