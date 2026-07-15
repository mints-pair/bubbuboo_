import { createServerSupabase } from '@/lib/supabase/server';
import { getHeldStockMap, computeAvailability } from '@/lib/availability';
import Link from 'next/link';

export const revalidate = 0;

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createServerSupabase();
  const q = searchParams.q?.trim() || '';

  let query = supabase.from('products').select('*').order('created_at', { ascending: false });
  const { data: products } = await query;
  const heldMap = await getHeldStockMap();

  const filtered = q
    ? (products || []).filter((p: any) => {
        const hay = (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : products || [];

  return (
    <div className="container">
      <h1>เลือกช้อปได้เลย</h1>
      <form style={{ margin: '16px 0 22px' }}>
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อสินค้า หรือแท็ก..."
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10,
            border: '1.5px solid var(--line)', fontSize: 14.5,
          }}
        />
      </form>
      {filtered.length === 0 ? (
        <p style={{ color: '#9a9490' }}>{q ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้าในร้าน'}</p>
      ) : (
        <div className="grid">
          {filtered.map((p: any) => {
            const { available, heldAll } = computeAvailability(p.stock, heldMap[p.id] || 0);
            let stockLabel = `เหลือ ${available} ชิ้น`;
            if (p.stock <= 0) stockLabel = 'Sold out';
            else if (heldAll) stockLabel = 'ติดจอง';
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
