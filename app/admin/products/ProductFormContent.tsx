'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';
import { compressImageFile, compressImage } from '@/lib/imageCompress';

const emptyDraft = { name: '', description: '', price: '', shippingFee: '', stock: '', tags: '', images: [] as string[], memberIds: [] as string[], eventId: '', isGiveaway: false, isFeatured: false, market: 'gmmtv' as 'gmmtv' | 'dmd' };

export default function ProductFormContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<any[]>([]);
  const [newMemberName, setNewMemberName] = useState({ gmmtv: '', dmd: '' });
  const [newEventName, setNewEventName] = useState({ gmmtv: '', dmd: '' });
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const members = categories.filter((c) => c.type === 'member' && c.market === draft.market);
  const events = categories.filter((c) => c.type === 'event' && c.market === draft.market);

  async function loadCategories() {
    const { data: c } = await supabase.from('categories').select('*').order('name', { ascending: true });
    setCategories(c || []);
  }

  async function loadEditTarget(id: string) {
    const { data: p } = await supabase.from('products').select('*').eq('id', id).single();
    if (!p) return;
    startEdit(p);
  }

  useEffect(() => {
    loadCategories();
    const editId = searchParams.get('edit');
    if (editId) loadEditTarget(editId);
  }, []);

  async function addCategory(type: 'member' | 'event', market: 'gmmtv' | 'dmd', name: string, clear: () => void) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('categories').insert({ name: trimmed, type, market });
    if (error) { alert('เพิ่มไม่สำเร็จ: ' + error.message); return; }
    logAdminAction(`เพิ่ม${type === 'member' ? 'เมมเบอร์' : 'อีเว้นท์'} "${trimmed}" (${market === 'dmd' ? '#ตลาดนัดDMD' : '#ตลาดนัดGMMTV'})`);
    clear();
    loadCategories();
  }

  async function deleteCategory(id: string, name: string, type: 'member' | 'event') {
    if (!confirm(`ลบ "${name}"? สินค้าที่ผูกไว้จะกลายเป็นไม่มี${type === 'member' ? 'เมมเบอร์' : 'อีเว้นท์'} (ไม่ถูกลบ)`)) return;
    await supabase.from('categories').delete().eq('id', id);
    logAdminAction(`ลบ${type === 'member' ? 'เมมเบอร์' : 'อีเว้นท์'} "${name}"`);
    loadCategories();
  }

  async function uploadFiles(files: FileList) {
    setUploading(true);
    const urls: string[] = [];
    for (const rawFile of Array.from(files)) {
      const file = await compressImageFile(rawFile, { maxDim: 1200, quality: 0.8 });
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
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
    setSaving(true);

    // regenerate a small thumbnail (used on listing pages) from whatever
    // the current cover image is — keeps it correct even if images were
    // reordered/removed before saving. If this fails for any reason, we
    // just skip it and the listing falls back to the full-size image.
    let thumbnailUrl: string | null = null;
    if (draft.images.length > 0) {
      try {
        const res = await fetch(draft.images[0]);
        const blob = await res.blob();
        const thumbBlob = await compressImage(blob, { maxDim: 320, quality: 0.7 });
        const path = `products/thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from('shop-images').upload(path, thumbBlob);
        if (!error) {
          const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
          thumbnailUrl = data.publicUrl;
        }
      } catch {
        // ignore — fall back to full image on listing pages
      }
    }

    const payload: any = {
      name: draft.name,
      description: draft.description,
      price: draft.isGiveaway ? 0 : Number(draft.price) || 0,
      shipping_fee: Number(draft.shippingFee) || 0,
      stock: Number(draft.stock) || 0,
      tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
      images: draft.images,
      member_id: draft.memberIds[0] || null,
      member_ids: draft.memberIds,
      event_id: draft.eventId || null,
      is_giveaway: draft.isGiveaway,
      is_featured: draft.isFeatured,
      market: draft.market,
    };
    if (thumbnailUrl) payload.thumbnail_url = thumbnailUrl;
    const wasEditing = !!editingId;
    if (editingId) {
      await supabase.from('products').update(payload).eq('id', editingId);
      logAdminAction(`แก้ไขสินค้า "${payload.name}"`);
    } else {
      await supabase.from('products').insert(payload);
      logAdminAction(`เพิ่มสินค้าใหม่ "${payload.name}"${payload.is_giveaway ? ' (ของแจก)' : ''}`);
    }
    setDraft(emptyDraft);
    setEditingId(null);
    setSaving(false);
    // came here to edit one specific item from the list page -> go back to it
    if (wasEditing) router.push('/admin/products/list');
  }

  function startEdit(p: any) {
    setEditingId(p.id);
    setDraft({
      name: p.name, description: p.description, price: String(p.price), shippingFee: String(p.shipping_fee),
      stock: String(p.stock), tags: (p.tags || []).join(', '), images: p.images || [],
      memberIds: (p.member_ids && p.member_ids.length > 0) ? p.member_ids : (p.member_id ? [p.member_id] : []), eventId: p.event_id || '',
      isGiveaway: !!p.is_giveaway,
      isFeatured: !!p.is_featured,
      market: p.market || 'gmmtv',
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div>
      <div className="card">
        <h3>หมวดหมู่: เมมเบอร์</h3>
        <p style={{ color: '#8a8378', fontSize: 12.5, marginTop: -6, marginBottom: 16 }}>เมมเบอร์ของแต่ละตลาดแยกจากกัน ไม่ปนกัน</p>
        {(['gmmtv', 'dmd'] as const).map((mkt) => {
          const list = categories.filter((c) => c.type === 'member' && c.market === mkt);
          return (
            <div key={mkt} style={{ marginBottom: mkt === 'gmmtv' ? 20 : 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>{mkt === 'gmmtv' ? '#ตลาดนัดGMMTV' : '#ตลาดนัดDMD'}</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  value={newMemberName[mkt]}
                  onChange={(e) => setNewMemberName((v) => ({ ...v, [mkt]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addCategory('member', mkt, newMemberName[mkt], () => setNewMemberName((v) => ({ ...v, [mkt]: '' })))}
                  placeholder="ชื่อเมมเบอร์ใหม่"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 14 }}
                />
                <button className="btn btn-outline" onClick={() => addCategory('member', mkt, newMemberName[mkt], () => setNewMemberName((v) => ({ ...v, [mkt]: '' })))}>เพิ่มเมมเบอร์</button>
              </div>
              {list.length === 0 ? (
                <p style={{ color: '#9a9490', fontSize: 13.5 }}>ยังไม่มีเมมเบอร์ในตลาดนี้</p>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {list.map((c) => (
                    <span key={c.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--jade-light)', color: 'var(--jade)',
                      fontSize: 12.5, fontWeight: 600, padding: '5px 10px', borderRadius: 99,
                    }}>
                      {c.name}
                      <button onClick={() => deleteCategory(c.id, c.name, 'member')} style={{ background: 'none', border: 'none', color: 'var(--jade)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3>หมวดหมู่: อีเว้นท์</h3>
        <p style={{ color: '#8a8378', fontSize: 12.5, marginTop: -6, marginBottom: 16 }}>อีเว้นท์ของแต่ละตลาดแยกจากกัน ไม่ปนกัน</p>
        {(['gmmtv', 'dmd'] as const).map((mkt) => {
          const list = categories.filter((c) => c.type === 'event' && c.market === mkt);
          return (
            <div key={mkt} style={{ marginBottom: mkt === 'gmmtv' ? 20 : 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>{mkt === 'gmmtv' ? '#ตลาดนัดGMMTV' : '#ตลาดนัดDMD'}</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  value={newEventName[mkt]}
                  onChange={(e) => setNewEventName((v) => ({ ...v, [mkt]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addCategory('event', mkt, newEventName[mkt], () => setNewEventName((v) => ({ ...v, [mkt]: '' })))}
                  placeholder="ชื่ออีเว้นท์ใหม่"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 14 }}
                />
                <button className="btn btn-outline" onClick={() => addCategory('event', mkt, newEventName[mkt], () => setNewEventName((v) => ({ ...v, [mkt]: '' })))}>เพิ่มอีเว้นท์</button>
              </div>
              {list.length === 0 ? (
                <p style={{ color: '#9a9490', fontSize: 13.5 }}>ยังไม่มีอีเว้นท์ในตลาดนี้</p>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {list.map((c) => (
                    <span key={c.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--marigold)', color: 'var(--ink)',
                      fontSize: 12.5, fontWeight: 600, padding: '5px 10px', borderRadius: 99,
                    }}>
                      {c.name}
                      <button onClick={() => deleteCategory(c.id, c.name, 'event')} style={{ background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card" ref={formRef}>
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

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.isFeatured}
            onChange={(e) => setDraft({ ...draft, isFeatured: e.target.checked })}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ fontWeight: 600 }}>ปักหมุดเป็นสินค้าแนะนำ (โชว์ในแถบแนะนำหน้าแรก)</span>
        </label>

        <div className="field">
          <label>ลงขายที่ตลาด</label>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="radio" checked={draft.market === 'gmmtv'} onChange={() => setDraft({ ...draft, market: 'gmmtv', memberIds: [], eventId: '' })} />
              <span>#ตลาดนัดGMMTV</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="radio" checked={draft.market === 'dmd'} onChange={() => setDraft({ ...draft, market: 'dmd', memberIds: [], eventId: '' })} />
              <span>#ตลาดนัดDMD</span>
            </label>
          </div>
        </div>

        <div className="field"><label>ชื่อสินค้า</label>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
        <div className="field"><label>รายละเอียดสินค้า</label>
          <textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
        <div className="field-row">
          <div className="field" style={{ flex: 1 }}>
            <label>เมมเบอร์ (เลือกได้มากกว่า 1 คน)</label>
            {members.length === 0 ? (
              <p style={{ color: '#9a9490', fontSize: 13, margin: '6px 0' }}>ยังไม่มีเมมเบอร์ในตลาดนี้</p>
            ) : (
              <div style={{ border: '1.5px solid var(--line)', borderRadius: 9, padding: 10, maxHeight: 160, overflowY: 'auto' }}>
                {members.map((c) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', cursor: 'pointer', fontSize: 13.5 }}>
                    <input
                      type="checkbox"
                      checked={draft.memberIds.includes(c.id)}
                      onChange={(e) => setDraft({
                        ...draft,
                        memberIds: e.target.checked ? [...draft.memberIds, c.id] : draft.memberIds.filter((id) => id !== c.id),
                      })}
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="field" style={{ flex: 1 }}><label>อีเว้นท์</label>
            <select
              value={draft.eventId}
              onChange={(e) => setDraft({ ...draft, eventId: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 14 }}
            >
              <option value="">ไม่มีอีเว้นท์</option>
              {events.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field-row">
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
          <button className="btn btn-primary" disabled={saving} onClick={saveProduct}>{saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</button>
          {editingId && <button className="btn btn-outline" onClick={() => { setEditingId(null); setDraft(emptyDraft); router.push('/admin/products'); }}>ยกเลิก</button>}
        </div>
      </div>
    </div>
  );
}
