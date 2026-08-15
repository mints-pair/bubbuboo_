'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getBidSessionId } from '@/lib/auctionSession';
import { compressImageFile } from '@/lib/imageCompress';

type PaymentMethod = 'qr' | 'wise' | 'truewallet';
const TRUEWALLET_SURCHARGE = 20;

export default function AuctionCheckoutPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const router = useRouter();
  const [auction, setAuction] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState('');

  const [contact, setContact] = useState({ xAccount: '', name: '', address: '', phone: '' });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('qr');
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

  useEffect(() => {
    load();
    supabase.from('settings').select('*').single().then(({ data }) => setSettings(data));
  }, []);

  async function load() {
    const { data: a } = await supabase.from('auctions').select('*').eq('id', params.id).single();
    setAuction(a);
    setLoading(false);
    if (!a) return;
    const sessionId = getBidSessionId();
    if (new Date(a.ends_at).getTime() > Date.now()) { setNotAllowed('ประมูลนี้ยังไม่ปิด'); return; }
    if (a.status === 'completed') { setNotAllowed('ชำระเงินสำหรับรายการนี้ไปแล้ว'); return; }
    if (a.status !== 'active') { setNotAllowed('รายการนี้ถูกยกเลิกไปแล้ว'); return; }
    if (!a.current_bid || a.current_bidder_session_id !== sessionId) { setNotAllowed('คุณไม่ใช่ผู้ชนะการประมูลนี้'); return; }
    setContact((c) => ({ ...c, name: a.current_bidder_name || '' }));
  }

  if (loading) return <div className="container" />;
  if (!auction) return <div className="container">ไม่พบรายการประมูลนี้</div>;
  if (notAllowed) return <div className="container"><div className="card">{notAllowed}</div></div>;

  const subtotal = Number(auction.current_bid);
  const shippingFee = Number(auction.shipping_fee) || 0;
  const paymentSurcharge = paymentMethod === 'truewallet' ? TRUEWALLET_SURCHARGE : 0;
  const total = subtotal + shippingFee + paymentSurcharge;

  async function submit() {
    if (!contact.xAccount || !contact.name || !contact.address || !contact.phone) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
    if (!/^\d{6}$/.test(trackingCode)) { setError('กรุณาใส่รหัสติดตามเป็นตัวเลข 6 หลัก'); return; }
    if (!slipFile) { setError('กรุณาแนบรูปสลิปการโอนเงิน'); return; }
    setError('');
    setSubmitting(true);
    try {
      const compressed = await compressImageFile(slipFile, { maxDim: 1400, quality: 0.75 });
      const path = `slips/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: upErr } = await supabase.storage.from('shop-images').upload(path, compressed);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('shop-images').getPublicUrl(path);

      const res = await fetch(`/api/auctions/${params.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: getBidSessionId(), contact, trackingCode, slipImage: pub.publicUrl, paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ชำระเงินไม่สำเร็จ');
      setOrderNumber(data.orderNumber);
    } catch (e: any) {
      setError(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  }

  if (orderNumber) {
    return (
      <div className="container">
        <div className="card">
          <h2>ชำระเงินสำเร็จ</h2>
          <p>เลขออเดอร์ของคุณคือ <b>{orderNumber}</b></p>
          <p>โปรดจดรหัสติดตาม 6 หลักที่ตั้งไว้เก็บคู่กับเลขออเดอร์นี้ เพื่อใช้ตรวจสอบสถานะที่หน้า Tracking</p>
          <button className="btn btn-primary" onClick={() => router.push(`/tracking?order=${orderNumber}`)}>ไปหน้า Tracking</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>ชำระเงินค่าประมูล</h1>
      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <img src={auction.images?.[0] || ''} style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 8 }} />
          <div>
            <div style={{ fontWeight: 600 }}>{auction.name}</div>
            <div style={{ fontSize: 13, color: '#8a8378' }}>ราคาชนะประมูล ฿{subtotal.toLocaleString('th-TH')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>ค่าสินค้า</span><span>฿{subtotal.toLocaleString('th-TH')}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>ค่าจัดส่ง</span><span>฿{shippingFee.toLocaleString('th-TH')}</span></div>
        {paymentSurcharge > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>ค่าธรรมเนียมช่องทางชำระเงิน</span><span>฿{paymentSurcharge.toLocaleString('th-TH')}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 19, borderTop: '1.5px dashed var(--line)', marginTop: 8, paddingTop: 12 }}><span>ยอดรวม</span><span>฿{total.toLocaleString('th-TH')}</span></div>
      </div>

      <div className="card">
        <h3>ข้อมูลติดต่อ &amp; จัดส่ง</h3>
        <div className="field"><label>บัญชี X (Twitter) ที่ติดต่อได้ *</label>
          <input value={contact.xAccount} onChange={(e) => setContact({ ...contact, xAccount: e.target.value })} placeholder="@your_account" /></div>
        <div className="field"><label>ชื่อ-นามสกุลผู้รับ *</label>
          <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></div>
        <div className="field"><label>ที่อยู่จัดส่ง *</label>
          <textarea rows={3} value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} /></div>
        <div className="field"><label>เบอร์โทรศัพท์ *</label>
          <input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></div>

        <div className="field">
          <label>ช่องทางชำระเงิน</label>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="radio" checked={paymentMethod === 'qr'} onChange={() => setPaymentMethod('qr')} /><span>QR พร้อมเพย์</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="radio" checked={paymentMethod === 'wise'} onChange={() => setPaymentMethod('wise')} /><span>Wise</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="radio" checked={paymentMethod === 'truewallet'} onChange={() => setPaymentMethod('truewallet')} /><span>TrueWallet (+฿{TRUEWALLET_SURCHARGE})</span>
            </label>
          </div>
        </div>

        <div style={{ textAlign: 'center', background: 'var(--paper-dim)', borderRadius: 14, padding: 24, marginBottom: 14 }}>
          {settings?.qr_image_url ? (
            <a href={settings.qr_image_url} target="_blank" rel="noopener">
              <img src={settings.qr_image_url} style={{ width: 180, height: 180, objectFit: 'contain', background: '#fff', borderRadius: 10, padding: 10, cursor: 'zoom-in' }} />
            </a>
          ) : (
            <p>ยังไม่ได้ตั้งค่า QR ร้าน</p>
          )}
          {paymentMethod === 'wise' && <p style={{ fontSize: 13, color: 'var(--rose)', marginTop: 10, fontWeight: 600 }}>สำหรับ Wise กรุณาติดต่อแอดมินทาง X เพื่อขอข้อมูลบัญชีก่อนโอน</p>}
        </div>

        <div className="field"><label>แนบสลิปการโอนเงิน *</label>
          <input type="file" accept="image/*" onChange={(e) => setSlipFile(e.target.files?.[0] || null)} /></div>
        <div className="field"><label>ตั้งรหัสติดตามพัสดุ 6 หลัก *</label>
          <input maxLength={6} value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="เช่น 482913" /></div>

        {error && <p style={{ color: 'var(--rose)' }}>{error}</p>}
        <button className="btn btn-primary" disabled={submitting} onClick={submit}>
          {submitting ? 'กำลังส่ง...' : 'ยืนยันการชำระเงิน'}
        </button>
      </div>
    </div>
  );
}
