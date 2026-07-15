'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';

const emptyDraft = { name: '', description: '', price: '', shippingFee: '', stock: '', tags: '', images: [] as string[], categoryId: '', isGiveaway: false };

export default function AdminProductsPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [heldMap, setHeldMap] = useState<Record<string, number>>({});

  async function load() {
    const { data: p } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(p || []);
    const { data: c } = await supabase.from('categories').select('*').order('name', { ascending: true });
    setCategories(c || []);
    const { data: held } = await supabase.rpc('held_stock');
    const map: Record<string, number> = {};
    (held || []).forEach((row: any) => { map[row.product_id] = Number(row.held_qty); });
    setHeldMap(map);
  }
  useEffect(() => { load(); }, []);

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const { error } = await supabase.from('categories').insert({ name });
    if (error) { alert('เพิ่มหมวดหมู่ไม่สำเร็จ: ' + error.message); return; }
    logAdminAction(`เพิ่มหมวดหมู่สินค้า "${name}"`);
    setNewCategoryName('');
    load();
  }

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`ลบหมวดหมู่ "${name}"? สินค้าที่อยู่ในหมวดนี้จะกลายเป็นไม่มีหมวดหมู่ (ไม่ถูกลบ)`)) return;
    await supabase.from('categories').delete().eq('id', id);
    logAdminAction(`ลบหมวดหมู่สินค้า "${name}"`);
    load();
  }

  async function uploadFiles(files: FileList) {
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('shop-images').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setDraft((d) => ({ ...d, images: [...d.images, ...urls] }));
    setUploading(false);
  }

  async function saveProduct() {
    if (!draft.name || (!draft.isGiveaway && !draft.price)) { alert('กรุณากรอกชื่อสินค้าและราคา'); return; }
    const payload = {
      name: draft.name,
      description: draft.description,
      price: draft.isGiveaway ? 0 : Number(draft.price) || 0,
      shipping_fee: Number(draft.shippingFee) || 0,
      stock: Number(draft.stock) || 0,
      tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
      images: draft.images,
      category_id: draft.categoryId || null,
      is_giveaway: draft.isGiveaway,
    };
    if (editingId) {
      await supabase.from('products').update(payload).eq('id', editingId);
      logAdminAction(`แก้ไขสินค้า "${payload.name}"`);
    } else {
      await supabase.from('products').insert(payload);
      logAdminAction(`เพิ่มสินค้าใหม่ "${payload.name}"${payload.is_giveaway ? ' (ของแจก)' : ''}`);
    }
    setDraft(emptyDraft);
    setEditingId(null);
    load();
  }

  function startEdit(p: any) {
    setEditingId(p.id);
    setDraft({
      name: p.name, description: p.description, price: String(p.price), shippingFee: String(p.shipping_fee),
      stock: String(p.stock), tags: (p.tags || []).join(', '), images: p.images || [], categoryId: p.category_id || '',
      isGiveaway: !!p.is_giveaway,
    });
  }

  async function deleteProduct(id: string) {
    if (!confirm('ลบสินค้านี้?')) return;
    const p = products.find((x) => x.id === id);
    await supabase.from('products').delete().eq('id', id);
    logAdminAction(`ลบสินค้า "${p?.name || id}"`);
    load();
  }

  function categoryName(id: string | null) {
    return categories.find((c) => c.id === id)?.name || '-';
  }

  return (
    <div>
      <div className="card">
        <h3>หมวดหมู่สินค้า</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="ชื่อหมวดหมู่ใหม่ เช่น เสื้อผ้า"
            style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 14 }}
          />
          <button className="btn btn-outline" onClick={addCategory}>เพิ่มหมวดหมู่</button>
        </div>
        {categories.length === 0 ? (
          <p style={{ color: '#9a9490', fontSize: 13.5 }}>ยังไม่มีหมวดหมู่ — เพิ่มไว้ก่อนเพื่อเลือกใช้ตอนเพิ่มสินค้า</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {categories.map((c) => (
              <span key={c.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--jade-light)', color: 'var(--jade)',
                fontSize: 12.5, fontWeight: 600, padding: '5px 10px', borderRadius: 99,
              }}>
                {c.name}
                <button onClick={() => deleteCategory(c.id, c.name)} style={{ background: 'none', border: 'none', color: 'var(--jade)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>{editingId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.isGiveaway}
            onChange={(e) => setDraft({ ...draft, isGiveaway: e.target.checked, price: e.target.checked ? '0' : draft.price })}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ fontWeight: 600 }}>เป็นของแจก (ราคา 0 บาทอัตโนมัติ — ตั้งค่าจัดส่งเองได้ตามปกติ)</span>
        </label>

        <div className="field"><label>ชื่อสินค้า</label>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
        <div className="field"><label>รายละเอียดสินค้า</label>
          <textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
        <div className="field"><label>หมวดหมู่สินค้า</label>
          <select
            value={draft.categoryId}
            onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 14 }}
          >
            <option value="">ไม่มีหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>ราคา (บาท)</label>
            <input type="number" disabled={draft.isGiveaway} value={draft.isGiveaway ? 0 : draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              style={draft.isGiveaway ? { background: 'var(--paper-dim)', color: '#8a8378' } : undefined} /></div>
          <div className="field" style={{ flex: 1 }}><label>ค่าจัดส่ง (บาท)</label>
            <input type="number" value={draft.shippingFee} onChange={(e) => setDraft({ ...draft, shippingFee: e.target.value })} /></div>
          <div className="field" style={{ flex: 1 }}><label>จำนวนคงเหลือ</label>
            <input type="number" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} /></div>
        </div>
        <div className="field"><label>แท็กสินค้า (คั่นด้วยจุลภาค)</label>
          <input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} /></div>
        <div className="field">
          <label>รูปภาพสินค้า (เพิ่มได้มากกว่า 1 รูป)</label>
          <input type="file" accept="image/*" multiple onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
          {uploading && <p>กำลังอัปโหลด...</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {draft.images.map((im, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={im} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                <button onClick={() => setDraft((d) => ({ ...d, images: d.images.filter((_, idx) => idx !== i) }))}
                  style={{ position: 'absolute', top: -6, right: -6, background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11 }}>×</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={saveProduct}>{editingId ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</button>
          {editingId && <button className="btn btn-outline" onClick={() => { setEditingId(null); setDraft(emptyDraft); }}>ยกเลิก</button>}
        </div>
      </div>

      <div className="card">
        <h3>สินค้าทั้งหมด ({products.length})</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead><tr style={{ textAlign: 'left', color: '#8a8378' }}>
            <th></th><th>ชื่อ</th><th>หมวดหมู่</th><th>ราคา</th><th>คงเหลือ</th><th>จองอยู่</th><th></th>
          </tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td><img src={p.images?.[0] || ''} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} /></td>
                <td>{p.name}{p.is_giveaway && (
                  <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--jade-light)', color: 'var(--jade)', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>ของแจก</span>
                )}</td>
                <td>{categoryName(p.category_id)}</td>
                <td>{p.is_giveaway ? 'ฟรี' : `฿${p.price}`}</td>
                <td>{p.stock}</td>
                <td>{heldMap[p.id] ? `${heldMap[p.id]} ชิ้น (รอคอนเฟิร์ม)` : '-'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12, marginRight: 6 }} onClick={() => startEdit(p)}>แก้ไข</button>
                  <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--rose)' }} onClick={() => deleteProduct(p.id)}>ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
