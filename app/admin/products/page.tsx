'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const emptyDraft = { name: '', description: '', price: '', shippingFee: '', stock: '', tags: '', images: [] as string[] };

export default function AdminProductsPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [heldMap, setHeldMap] = useState<Record<string, number>>({});

  async function load() {
    const { data: p } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(p || []);
    const { data: s } = await supabase.from('settings').select('*').single();
    setSettings(s);
    const { data: held } = await supabase.rpc('held_stock');
    const map: Record<string, number> = {};
    (held || []).forEach((row: any) => { map[row.product_id] = Number(row.held_qty); });
    setHeldMap(map);
  }
  useEffect(() => { load(); }, []);

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

  const [uploadingQr, setUploadingQr] = useState(false);
  async function uploadQr(file: File) {
    setUploadingQr(true);
    const ext = file.name.split('.').pop();
    const path = `settings/qr-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('shop-images').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
      setSettings((s: any) => ({ ...s, qr_image_url: data.publicUrl }));
    } else {
      alert('อัปโหลดไม่สำเร็จ: ' + error.message);
    }
    setUploadingQr(false);
  }

  async function saveSettings() {
    await supabase.from('settings').update({
      store_name: settings.store_name,
      qr_image_url: settings.qr_image_url,
    }).eq('id', 1);
    alert('บันทึกการตั้งค่าแล้ว');
  }

  async function saveProduct() {
    if (!draft.name || !draft.price) { alert('กรุณากรอกชื่อสินค้าและราคา'); return; }
    const payload = {
      name: draft.name,
      description: draft.description,
      price: Number(draft.price) || 0,
      shipping_fee: Number(draft.shippingFee) || 0,
      stock: Number(draft.stock) || 0,
      tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
      images: draft.images,
    };
    if (editingId) {
      await supabase.from('products').update(payload).eq('id', editingId);
    } else {
      await supabase.from('products').insert(payload);
    }
    setDraft(emptyDraft);
    setEditingId(null);
    load();
  }

  function startEdit(p: any) {
    setEditingId(p.id);
    setDraft({
      name: p.name, description: p.description, price: String(p.price), shippingFee: String(p.shipping_fee),
      stock: String(p.stock), tags: (p.tags || []).join(', '), images: p.images || [],
    });
  }

  async function deleteProduct(id: string) {
    if (!confirm('ลบสินค้านี้?')) return;
    await supabase.from('products').delete().eq('id', id);
    load();
  }

  return (
    <div>
      {settings && (
        <div className="card">
          <h3>ตั้งค่าร้าน</h3>
          <div className="field"><label>ชื่อร้าน</label>
            <input value={settings.store_name} onChange={(e) => setSettings({ ...settings, store_name: e.target.value })} /></div>
          <div className="field">
            <label>รูป QR รับเงิน (พร้อมเพย์)</label>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadQr(e.target.files[0])} />
            {uploadingQr && <p>กำลังอัปโหลด...</p>}
            {settings.qr_image_url && (
              <img src={settings.qr_image_url} style={{ width: 140, height: 140, objectFit: 'contain', background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 8, marginTop: 10 }} />
            )}
          </div>
          <button className="btn btn-outline" onClick={saveSettings}>บันทึกการตั้งค่า</button>
        </div>
      )}

      <div className="card">
        <h3>{editingId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
        <div className="field"><label>ชื่อสินค้า</label>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
        <div className="field"><label>รายละเอียดสินค้า</label>
          <textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>ราคา (บาท)</label>
            <input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></div>
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
            <th></th><th>ชื่อ</th><th>ราคา</th><th>คงเหลือ</th><th>จองอยู่</th><th></th>
          </tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td><img src={p.images?.[0] || ''} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} /></td>
                <td>{p.name}</td>
                <td>฿{p.price}</td>
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
