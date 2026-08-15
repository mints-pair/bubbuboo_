'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';

export default function OutOfStockPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restockValues, setRestockValues] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [marketFilter, setMarketFilter] = useState('');

  async function load() {
    const { data: p } = await supabase.from('products').select('*').lte('stock', 0);
    const sorted = (p || []).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    setProducts(sorted);
    const { data: c } = await supabase.from('categories').select('*');
    setCategories(c || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function nameOf(id: string | null) {
    return categories.find((c) => c.id === id)?.name || '-';
  }

  function memberIdsOf(p: any): string[] {
    return (p.member_ids && p.member_ids.length > 0) ? p.member_ids : (p.member_id ? [p.member_id] : []);
  }

  function namesOf(p: any) {
    const ids = memberIdsOf(p);
    if (ids.length === 0) return '-';
    return ids.map((id: string) => categories.find((c) => c.id === id)?.name).filter(Boolean).join(', ') || '-';
  }

  async function restock(p: any) {
    const qty = Number(restockValues[p.id]);
    if (!qty || qty <= 0) { alert('กรุณาใส่จำนวนที่ถูกต้อง (มากกว่า 0)'); return; }
    setSavingId(p.id);
    await supabase.from('products').update({ stock: qty }).eq('id', p.id);
    logAdminAction(`เติมสต็อคสินค้า "${p.name}" เป็น ${qty} ชิ้น`);
    setSavingId(null);
    setRestockValues((v) => { const n = { ...v }; delete n[p.id]; return n; });
    load();
  }

  async function deleteProduct(id: string) {
    if (!confirm('ลบสินค้านี้?')) return;
    const p = products.find((x) => x.id === id);
    await supabase.from('products').delete().eq('id', id);
    logAdminAction(`ลบสินค้า "${p?.name || id}"`);
    load();
  }

  const members = categories.filter((c) => c.type === 'member' && (!marketFilter || c.market === marketFilter));
  const events = categories.filter((c) => c.type === 'event' && (!marketFilter || c.market === marketFilter));

  let filtered = products;
  if (memberFilter) filtered = filtered.filter((p) => memberIdsOf(p).includes(memberFilter));
  if (eventFilter) filtered = filtered.filter((p) => p.event_id === eventFilter);
  if (marketFilter) filtered = filtered.filter((p) => p.market === marketFilter);
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter((p) => (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q));
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>หมดสต็อค ({filtered.length}{filtered.length !== products.length ? ` / ${products.length}` : ''})</h3>
          <Link href="/admin/products/list" className="btn btn-outline" style={{ textDecoration: 'none' }}>← กลับไปรายการสินค้า</Link>
        </div>
        <p style={{ color: '#8a8378', fontSize: 12.5, marginTop: 4, marginBottom: 14 }}>
          สินค้าที่สต็อกเป็น 0 จะย้ายมาอยู่ที่นี่อัตโนมัติ และไม่แสดงในหน้าร้าน — ใส่จำนวนที่เติมแล้วกด "เติมสต็อค" เพื่อให้กลับไปขายได้ตามปกติ
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อสินค้า หรือแท็ก..."
            style={{ flex: 1, minWidth: 200, padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 14 }}
          />
          <select value={marketFilter} onChange={(e) => { setMarketFilter(e.target.value); setMemberFilter(''); setEventFilter(''); }}
            style={{ padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 14, background: '#fff' }}>
            <option value="">ทุกตลาด</option>
            <option value="gmmtv">#ตลาดนัดGMMTV</option>
            <option value="dmd">#ตลาดนัดDMD</option>
          </select>
          {members.length > 0 && (
            <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 14, background: '#fff' }}>
              <option value="">ทุกเมมเบอร์</option>
              {members.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {events.length > 0 && (
            <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 14, background: '#fff' }}>
              <option value="">ทุกอีเว้นท์</option>
              {events.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {(query || memberFilter || eventFilter || marketFilter) && (
            <button className="btn btn-outline" onClick={() => { setQuery(''); setMemberFilter(''); setEventFilter(''); setMarketFilter(''); }}>ล้างตัวกรอง</button>
          )}
        </div>

        {loading ? null : filtered.length === 0 ? (
          <p style={{ color: '#9a9490' }}>{products.length === 0 ? 'ไม่มีสินค้าที่หมดสต็อกตอนนี้ 🎉' : 'ไม่พบสินค้าตามตัวกรองนี้'}</p>
        ) : (
          <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: '#8a8378' }}>
                <th></th><th>ชื่อ</th><th>ตลาด</th><th>เมมเบอร์</th><th>อีเว้นท์</th><th>ราคา</th><th>เติมสต็อค</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td><img src={p.thumbnail_url || p.images?.[0] || ''} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} /></td>
                    <td>{p.name}{p.is_giveaway && (
                      <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--jade-light)', color: 'var(--jade)', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>ของแจก</span>
                    )}{p.is_hidden && (
                      <span style={{ marginLeft: 6, fontSize: 11, background: '#EDEAE4', color: '#8a8378', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>ซ่อนอยู่</span>
                    )}</td>
                    <td style={{ fontSize: 12 }}>{p.market === 'dmd' ? '#DMD' : '#GMMTV'}</td>
                    <td>{namesOf(p)}</td>
                    <td>{nameOf(p.event_id)}</td>
                    <td>{p.is_giveaway ? 'ฟรี' : `฿${p.price}`}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number"
                          min={1}
                          placeholder="จำนวน"
                          value={restockValues[p.id] || ''}
                          onChange={(e) => setRestockValues((v) => ({ ...v, [p.id]: e.target.value }))}
                          style={{ width: 80, padding: '6px 8px', borderRadius: 7, border: '1.5px solid var(--line)', fontSize: 13 }}
                        />
                        <button
                          className="btn btn-primary"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                          disabled={savingId === p.id}
                          onClick={() => restock(p)}
                        >
                          {savingId === p.id ? '...' : 'เติมสต็อค'}
                        </button>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link href={`/admin/products?edit=${p.id}`} className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12, marginRight: 6, textDecoration: 'none', display: 'inline-block' }}>แก้ไข</Link>
                      <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--rose)' }} onClick={() => deleteProduct(p.id)}>ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
