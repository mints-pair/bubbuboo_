'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';
import { compressImageFile, compressImage } from '@/lib/imageCompress';

export default function ImportProductsPage() {
  const supabase = createClient();
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [log, setLog] = useState<string[]>([]);

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const headers = ['ชื่อสินค้า', 'รายละเอียด', 'ราคา', 'ค่าจัดส่ง', 'สต็อก', 'แท็ก', 'ตลาด', 'เมมเบอร์', 'อีเว้นท์', 'ของแจก', 'ไฟล์รูปภาพ'];
    const example = {
      'ชื่อสินค้า': 'ตัวอย่าง โฟโต้การ์ด Bonnie',
      'รายละเอียด': 'การ์ดสุ่มจากอีเว้นท์ Love Session',
      'ราคา': 250,
      'ค่าจัดส่ง': 30,
      'สต็อก': 5,
      'แท็ก': 'photocard, bonnie',
      'ตลาด': 'gmmtv',
      'เมมเบอร์': 'Bonnie',
      'อีเว้นท์': 'Love Session',
      'ของแจก': 'N',
      'ไฟล์รูปภาพ': 'photo1.jpg, photo2.jpg',
    };
    const ws = XLSX.utils.json_to_sheet([example], { header: headers });
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'สินค้า');
    XLSX.writeFile(wb, 'แม่แบบนำเข้าสินค้า.xlsx');
  }

  async function handleImport() {
    if (!excelFile) { alert('กรุณาเลือกไฟล์ Excel ก่อน'); return; }
    setImporting(true);
    setLog([]);
    const results: string[] = [];

    try {
      const XLSX = await import('xlsx');
      const buf = await excelFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) {
        setLog(['ไม่พบข้อมูลในไฟล์ Excel']);
        setImporting(false);
        return;
      }

      const imageMap = new Map<string, File>();
      for (const f of imageFiles) imageMap.set(f.name.toLowerCase(), f);

      const { data: existingCats } = await supabase.from('categories').select('*');
      const categories: any[] = existingCats || [];

      let successCount = 0;
      setProgress({ done: 0, total: rows.length });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowLabel = `แถว ${i + 2}`;
        try {
          const name = String(row['ชื่อสินค้า'] || '').trim();
          if (!name) { results.push(`${rowLabel}: ข้าม (ไม่มีชื่อสินค้า)`); setLog([...results]); setProgress({ done: i + 1, total: rows.length }); continue; }

          const isGiveaway = String(row['ของแจก'] || '').trim().toUpperCase() === 'Y';
          const price = isGiveaway ? 0 : Number(row['ราคา']) || 0;
          if (!isGiveaway && !price) { results.push(`${rowLabel}: ข้าม "${name}" (ไม่มีราคา)`); setLog([...results]); setProgress({ done: i + 1, total: rows.length }); continue; }

          const market: 'gmmtv' | 'dmd' = String(row['ตลาด'] || 'gmmtv').trim().toLowerCase() === 'dmd' ? 'dmd' : 'gmmtv';
          const description = String(row['รายละเอียด'] || '');
          const shippingFee = Number(row['ค่าจัดส่ง']) || 0;
          const stock = Number(row['สต็อก']) || 0;
          const tags = String(row['แท็ก'] || '').split(',').map((s) => s.trim()).filter(Boolean);

          // resolve (or create) member categories, scoped to this row's market
          const memberNames = String(row['เมมเบอร์'] || '').split(',').map((s) => s.trim()).filter(Boolean);
          const memberIds: string[] = [];
          for (const mn of memberNames) {
            let cat = categories.find((c) => c.type === 'member' && c.market === market && c.name === mn);
            if (!cat) {
              const { data: newCat } = await supabase.from('categories').insert({ name: mn, type: 'member', market }).select().single();
              if (newCat) { categories.push(newCat); cat = newCat; }
            }
            if (cat) memberIds.push(cat.id);
          }

          // resolve (or create) the event category
          const eventName = String(row['อีเว้นท์'] || '').trim();
          let eventId: string | null = null;
          if (eventName) {
            let cat = categories.find((c) => c.type === 'event' && c.market === market && c.name === eventName);
            if (!cat) {
              const { data: newCat } = await supabase.from('categories').insert({ name: eventName, type: 'event', market }).select().single();
              if (newCat) { categories.push(newCat); cat = newCat; }
            }
            if (cat) eventId = cat.id;
          }

          // match + upload images by filename
          const imageFilenames = String(row['ไฟล์รูปภาพ'] || '').split(',').map((s) => s.trim()).filter(Boolean);
          const imageUrls: string[] = [];
          for (const fn of imageFilenames) {
            const file = imageMap.get(fn.toLowerCase());
            if (!file) { results.push(`${rowLabel}: ⚠ ไม่พบไฟล์รูป "${fn}" ในรูปที่เลือกไว้`); continue; }
            const compressed = await compressImageFile(file, { maxDim: 1200, quality: 0.8 });
            const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
            const { error } = await supabase.storage.from('shop-images').upload(path, compressed);
            if (!error) {
              const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
              imageUrls.push(data.publicUrl);
            }
          }

          let thumbnailUrl: string | null = null;
          if (imageUrls.length > 0) {
            try {
              const res = await fetch(imageUrls[0]);
              const blob = await res.blob();
              const thumbBlob = await compressImage(blob, { maxDim: 320, quality: 0.7 });
              const path = `products/thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
              const { error } = await supabase.storage.from('shop-images').upload(path, thumbBlob);
              if (!error) {
                const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
                thumbnailUrl = data.publicUrl;
              }
            } catch {}
          }

          const payload: any = {
            name, description, price, shipping_fee: shippingFee, stock, tags,
            images: imageUrls, member_ids: memberIds, member_id: memberIds[0] || null,
            event_id: eventId, is_giveaway: isGiveaway, market,
          };
          if (thumbnailUrl) payload.thumbnail_url = thumbnailUrl;

          const { error: insErr } = await supabase.from('products').insert(payload);
          if (insErr) results.push(`${rowLabel}: ❌ "${name}" — ${insErr.message}`);
          else { results.push(`${rowLabel}: ✓ เพิ่ม "${name}" สำเร็จ${imageUrls.length ? ` (${imageUrls.length} รูป)` : ' (ไม่มีรูป)'}`); successCount++; }
        } catch (e: any) {
          results.push(`${rowLabel}: ❌ เกิดข้อผิดพลาด — ${e.message}`);
        }
        setLog([...results]);
        setProgress({ done: i + 1, total: rows.length });
      }

      logAdminAction(`นำเข้าสินค้าจาก Excel: สำเร็จ ${successCount}/${rows.length} รายการ`);
    } catch (e: any) {
      results.push(`❌ อ่านไฟล์ Excel ไม่สำเร็จ — ${e.message}`);
      setLog([...results]);
    }
    setImporting(false);
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>นำเข้าสินค้าจาก Excel</h3>
          <Link href="/admin/products/list" className="btn btn-outline" style={{ textDecoration: 'none' }}>← กลับไปรายการสินค้า</Link>
        </div>

        <div style={{ background: 'var(--paper-dim)', borderRadius: 9, padding: '12px 14px', margin: '14px 0', fontSize: 13 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>ขั้นตอน</p>
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li>กด "ดาวน์โหลดแม่แบบ" แล้วกรอกข้อมูลสินค้าในไฟล์ Excel (แถวละ 1 ชิ้น)</li>
            <li>ช่อง "ไฟล์รูปภาพ" ให้ใส่ชื่อไฟล์รูปที่จะอัปโหลด คั่นด้วยจุลภาคถ้ามีหลายรูป เช่น <code>photo1.jpg, photo2.jpg</code> (ตัวพิมพ์เล็ก-ใหญ่ไม่มีผล)</li>
            <li>เลือกไฟล์ Excel ที่กรอกเสร็จแล้ว + เลือกไฟล์รูปทั้งหมดที่อ้างถึงในไฟล์ (เลือกได้พร้อมกันหลายไฟล์)</li>
            <li>กด "เริ่มนำเข้า" ระบบจะจับคู่ชื่อไฟล์รูปกับแต่ละแถวให้อัตโนมัติ</li>
          </ol>
          <p style={{ margin: '10px 0 0', color: '#8a8378' }}>
            เมมเบอร์/อีเว้นท์ที่พิมพ์ในไฟล์ ถ้ายังไม่เคยมีในระบบ จะถูกสร้างขึ้นใหม่ให้อัตโนมัติ (ผูกกับตลาดตามที่ระบุในแถวนั้น)
          </p>
        </div>

        <button className="btn btn-outline" onClick={downloadTemplate}>ดาวน์โหลดแม่แบบ Excel</button>

        <div className="field" style={{ marginTop: 18 }}>
          <label>ไฟล์ Excel ที่กรอกแล้ว</label>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} />
        </div>
        <div className="field">
          <label>รูปภาพทั้งหมด (เลือกได้หลายไฟล์)</label>
          <input type="file" accept="image/*" multiple onChange={(e) => setImageFiles(e.target.files ? Array.from(e.target.files) : [])} />
          {imageFiles.length > 0 && <p style={{ fontSize: 12.5, color: '#8a8378', marginTop: 4 }}>เลือกไว้ {imageFiles.length} ไฟล์</p>}
        </div>

        <button className="btn btn-primary" disabled={importing} onClick={handleImport}>
          {importing ? `กำลังนำเข้า... (${progress.done}/${progress.total})` : 'เริ่มนำเข้า'}
        </button>

        {importing && (
          <div style={{ marginTop: 12, background: 'var(--paper-dim)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${progress.total ? (progress.done / progress.total * 100) : 0}%`, background: 'var(--jade)', height: '100%', transition: 'width .2s' }} />
          </div>
        )}

        {log.length > 0 && (
          <div style={{ marginTop: 14, background: 'var(--paper-dim)', borderRadius: 9, padding: '10px 12px', maxHeight: 280, overflowY: 'auto' }}>
            {log.map((line, i) => (
              <div key={i} style={{ fontSize: 12.5, padding: '3px 0', color: line.startsWith('❌') ? 'var(--rose)' : line.startsWith('⚠') ? '#8A6A2F' : line.startsWith('✓') ? 'var(--jade)' : '#8a8378' }}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
