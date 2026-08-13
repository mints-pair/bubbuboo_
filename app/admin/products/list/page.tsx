'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';
import { compressImage } from '@/lib/imageCompress';

export default function AdminProductsListPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [pendingHeldMap, setPendingHeldMap] = useState<Record<string, number>>({});
  const [reservedHeldMap, setReservedHeldMap] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optProgress, setOptProgress] = useState({ done: 0, total: 0 });
  const [optResult, setOptResult] = useState<string | null>(null);

  const members = categories.filter((c) => c.type === 'member');
  const events = categories.filter((c) => c.type === 'event');

  async function load() {
    const { data: p } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(p || []);
    const { data: c } = await supabase.from('categories').select('*').order('name', { ascending: true });
    setCategories(c || []);

    // held by real pending orders (already have a slip submitted — release
    // these via "ปฏิเสธออเดอร์" in the "รอการคอนเฟิร์ม" tab, not here)
    const { data: pendingOrders } = await supabase.from('orders').select('items').eq('status', 'pending');
    const pendingMap: Record<string, number> = {};
    for (const o of pendingOrders || []) {
      for (const it of (o.items as any[]) || []) {
        pendingMap[it.productId] = (pendingMap[it.productId] || 0) + it.qty;
      }
    }
    setPendingHeldMap(pendingMap);

    // held by an active 10-minute payment-step reservation (no order yet —
    // these CAN be cleared early from here)
    const { data: reservations } = await supabase.from('cart_reservations').select('product_id, qty').gt('expires_at', new Date().toISOString());
    const resMap: Record<string, number> = {};
    for (const r of reservations || []) {
      resMap[r.product_id] = (resMap[r.product_id] || 0) + r.qty;
    }
    setReservedHeldMap(resMap);

    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function deleteProduct(id: string) {
    if (!confirm('ลบสินค้านี้?')) return;
    const p = products.find((x) => x.id === id);
    await supabase.from('products').delete().eq('id', id);
    logAdminAction(`ลบสินค้า "${p?.name || id}"`);
    load();
  }

  async function toggleFeatured(p: any) {
    const next = !p.is_featured;
    await supabase.from('products').update({ is_featured: next }).eq('id', p.id);
    logAdminAction(`${next ? 'ปักหมุด' : 'เลิกปักหมุด'}สินค้าแนะนำ "${p.name}"`);
    load();
  }

  async function toggleHidden(p: any) {
    const next = !p.is_hidden;
    await supabase.from('products').update({ is_hidden: next }).eq('id', p.id);
    logAdminAction(`${next ? 'ซ่อน' : 'เลิกซ่อน'}สินค้า "${p.name}" จากหน้าร้าน`);
    load();
  }

  async function clearReservation(p: any) {
    if (!confirm(`ล้างการจอง "${p.name}" ที่กำลังจ่ายเงินอยู่ (ยังไม่มีสลิป)? ใช้เมื่อลูกค้าติดต่อมาว่าไม่เอาแล้วเท่านั้น`)) return;
    setClearingId(p.id);
    await supabase.from('cart_reservations').delete().eq('product_id', p.id);
    logAdminAction(`ล้างการจองสินค้า "${p.name}" (ลูกค้าแจ้งยกเลิกก่อนครบ 10 นาที)`);
    setClearingId(null);
    load();
  }

  async function optimizeAllImages() {
    if (optimizing) return;
    const total = products.reduce((a, p) => a + (p.images?.length || 0), 0);
    if (total === 0) { alert('ไม่มีรูปภาพให้บีบอัด'); return; }
    if (!confirm(`บีบอัดรูปภาพสินค้าทั้งหมด (${total} รูป)? อาจใช้เวลาสักครู่ตามจำนวนรูป`)) return;

    setOptimizing(true);
    setOptResult(null);
    setOptProgress({ done: 0, total });

    let done = 0;
    let savedBytes = 0;
    let changedCount = 0;
    let thumbsCreated = 0;

    for (const p of products) {
      if (!p.images || p.images.length === 0) continue;
      const newImages: string[] = [];
      let productChanged = false;

      for (const url of p.images) {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          // already small enough — not worth re-uploading
          if (blob.size < 250 * 1024) {
            newImages.push(url);
          } else {
            const compressed = await compressImage(blob, { maxDim: 1200, quality: 0.8 });
            if (compressed.size < blob.size * 0.9) {
              const path = `products/opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
              const { error } = await supabase.storage.from('shop-images').upload(path, compressed);
              if (!error) {
                const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
                newImages.push(data.publicUrl);
                savedBytes += blob.size - compressed.size;
                productChanged = true;
              } else {
                newImages.push(url);
              }
            } else {
              newImages.push(url);
            }
          }
        } catch {
          // couldn't fetch (network hiccup etc) — keep the original, don't block the batch
          newImages.push(url);
        }
        done++;
        setOptProgress({ done, total });
      }

      if (productChanged) {
        await supabase.from('products').update({ images: newImages }).eq('id', p.id);
        changedCount++;
      }

      // backfill a small listing thumbnail if this product doesn't have one yet
      if (!p.thumbnail_url && newImages.length > 0) {
        try {
          const coverUrl = newImages[0];
          const res = await fetch(coverUrl);
          const blob = await res.blob();
          const thumbBlob = await compressImage(blob, { maxDim: 320, quality: 0.7 });
          const path = `products/thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const { error } = await supabase.storage.from('shop-images').upload(path, thumbBlob);
          if (!error) {
            const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
            await supabase.from('products').update({ thumbnail_url: data.publicUrl }).eq('id', p.id);
            thumbsCreated++;
          }
        } catch {
          // skip — listing pages fall back to the full image for this product
        }
      }
    }

    const savedMB = (savedBytes / (1024 * 1024)).toFixed(1);
    setOptResult(`เสร็จแล้ว — บีบอัดรูปใน ${changedCount} สินค้า, สร้าง thumbnail ใหม่ ${thumbsCreated} รูป ประหยัดพื้นที่ได้ประมาณ ${savedMB} MB`);
    logAdminAction(`บีบอัดรูปภาพสินค้าทั้งหมด (${changedCount} สินค้า, thumbnail ${thumbsCreated} รูป, ประหยัด ~${savedMB} MB)`);
    setOptimizing(false);
    load();
  }

  function nameOf(id: string | null) {
    return categories.find((c) => c.id === id)?.name || '-';
  }

  let filtered = products.filter((p) => p.stock > 0);
  if (memberFilter) filtered = filtered.filter((p) => p.member_id === memberFilter);
  if (eventFilter) filtered = filtered.filter((p) => p.event_id === eventFilter);
  if (marketFilter) filtered = filtered.filter((p) => p.market === marketFilter);
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter((p) => (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q));
  }
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;

  return (
    <div>
      <div className="card">
        <h3>เพิ่มประสิทธิภาพรูปภาพ</h3>
        <p style={{ color: '#8a8378', fontSize: 13.5, marginTop: -6 }}>
          บีบอัด/ย่อขนาดรูปสินค้าที่มีอยู่แล้วทั้งหมดให้เล็กลง และสร้างรูปตัวอย่างขนาดเล็ก (thumbnail) สำหรับหน้ารายการสินค้าโดยเฉพาะ ช่วยลดการใช้แบนด์วิดท์ (cached egress) ของ Supabase ได้มากกว่าการบีบอัดรูปเดิมเพียงอย่างเดียว โดยไม่กระทบรูปที่ลูกค้าเห็น — รูปที่เพิ่งอัปโหลด/บันทึกสินค้าใหม่ตั้งแต่นี้จะมี thumbnail ให้อัตโนมัติอยู่แล้ว ปุ่มนี้ใช้สำหรับสินค้าเก่าที่เคยเพิ่มไว้ก่อนหน้านี้
        </p>
        {optimizing ? (
          <div>
            <p style={{ fontSize: 13.5, marginBottom: 6 }}>กำลังประมวลผล {optProgress.done} / {optProgress.total} รูป...</p>
            <div style={{ background: 'var(--paper-dim)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
              <div style={{
                width: `${optProgress.total ? (optProgress.done / optProgress.total * 100) : 0}%`,
                background: 'var(--jade)', height: '100%', transition: 'width .2s',
              }} />
            </div>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={optimizeAllImages}>เริ่มบีบอัดรูปภาพทั้งหมด</button>
        )}
        {optResult && !optimizing && <p style={{ color: 'var(--jade)', marginTop: 10, fontSize: 13.5 }}>{optResult}</p>}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>สินค้าที่มีสต็อก ({filtered.length}{query || memberFilter || eventFilter || marketFilter ? ` / ${products.filter((p) => p.stock > 0).length}` : ''})</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {outOfStockCount > 0 && (
              <Link href="/admin/products/out-of-stock" className="btn btn-outline" style={{ textDecoration: 'none', color: 'var(--rose)', borderColor: 'var(--rose)' }}>
                หมดสต็อค ({outOfStockCount})
              </Link>
            )}
            <Link href="/admin/products" className="btn btn-primary" style={{ textDecoration: 'none' }}>+ เพิ่มสินค้าใหม่</Link>
          </div>
        </div>
        <p style={{ color: '#8a8378', fontSize: 12.5, marginTop: 4 }}>สินค้าที่สต็อกหมด (0 ชิ้น) จะไม่แสดงในตารางนี้และไม่โชว์ในหน้าร้าน — ไปดูและเติมสต็อคได้ที่แท็บ "หมดสต็อค"</p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อสินค้า หรือแท็ก..."
            style={{ flex: 1, minWidth: 200, padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 14 }}
          />
          <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)}
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
          <p style={{ color: '#9a9490' }}>ไม่พบสินค้า</p>
        ) : (
          <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: '#8a8378' }}>
                <th></th><th></th><th>ชื่อ</th><th>ตลาด</th><th>เมมเบอร์</th><th>อีเว้นท์</th><th>ราคา</th><th>คงเหลือ</th><th>จองอยู่</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.map((p) => {
                  const pendingQty = pendingHeldMap[p.id] || 0;
                  const reservedQty = reservedHeldMap[p.id] || 0;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td>
                        <button
                          onClick={() => toggleFeatured(p)}
                          title={p.is_featured ? 'เลิกปักหมุดสินค้าแนะนำ' : 'ปักหมุดเป็นสินค้าแนะนำ'}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
                            color: p.is_featured ? 'var(--marigold-dark)' : '#d8d1c2',
                          }}
                        >
                          {p.is_featured ? '★' : '☆'}
                        </button>
                      </td>
                      <td><img src={p.thumbnail_url || p.images?.[0] || ''} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} /></td>
                      <td>{p.name}{p.is_giveaway && (
                        <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--jade-light)', color: 'var(--jade)', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>ของแจก</span>
                      )}{p.is_hidden && (
                        <span style={{ marginLeft: 6, fontSize: 11, background: '#EDEAE4', color: '#8a8378', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>ซ่อนอยู่</span>
                      )}</td>
                      <td style={{ fontSize: 12 }}>{p.market === 'dmd' ? '#DMD' : '#GMMTV'}</td>
                      <td>{nameOf(p.member_id)}</td>
                      <td>{nameOf(p.event_id)}</td>
                      <td>{p.is_giveaway ? 'ฟรี' : `฿${p.price}`}</td>
                      <td>{p.stock}</td>
                      <td>
                        {pendingQty > 0 && <div>{pendingQty} ชิ้น (ออเดอร์รอคอนเฟิร์ม)</div>}
                        {reservedQty > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                            <span>{reservedQty} ชิ้น (กำลังจ่ายเงิน)</span>
                            <button
                              disabled={clearingId === p.id}
                              onClick={() => clearReservation(p)}
                              style={{ background: 'none', border: '1px solid var(--rose)', color: 'var(--rose)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                            >
                              {clearingId === p.id ? '...' : 'ล้างการจอง'}
                            </button>
                          </div>
                        )}
                        {pendingQty === 0 && reservedQty === 0 && '-'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '6px 10px', fontSize: 12, marginRight: 6, color: p.is_hidden ? 'var(--jade)' : undefined, borderColor: p.is_hidden ? 'var(--jade)' : undefined }}
                          onClick={() => toggleHidden(p)}
                        >
                          {p.is_hidden ? 'แสดง' : 'ซ่อน'}
                        </button>
                        <Link href={`/admin/products?edit=${p.id}`} className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12, marginRight: 6, textDecoration: 'none', display: 'inline-block' }}>แก้ไข</Link>
                        <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--rose)' }} onClick={() => deleteProduct(p.id)}>ลบ</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
