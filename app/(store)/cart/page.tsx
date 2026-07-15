'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getCart, removeFromCart, clearCart, CartLine } from '@/lib/cart';
import { useLang } from '@/lib/lang-context';
import { isDiscountLive, isFreeShippingLive, discountedPrice, effectiveShippingFee } from '@/lib/promotion';

type Step = 'cart' | 'payment' | 'done';

export default function CartPage() {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useLang();
  const [step, setStep] = useState<Step>('cart');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [products, setProducts] = useState<Record<string, any>>({});
  const [settings, setSettings] = useState<any>(null);
  const [promo, setPromo] = useState<any>(null);
  const [contact, setContact] = useState({ xAccount: '', name: '', address: '', phone: '' });
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

  useEffect(() => {
    const c = getCart();
    setCart(c);
    if (c.length > 0) {
      supabase.from('products').select('*').in('id', c.map((l) => l.productId)).then(({ data }) => {
        const map: Record<string, any> = {};
        (data || []).forEach((p) => (map[p.id] = p));
        setProducts(map);
      });
    }
    supabase.from('settings').select('*').single().then(({ data }) => setSettings(data));
    supabase.from('promotion').select('*').single().then(({ data }) => setPromo(data));
  }, []);

  const discountLive = isDiscountLive(promo);
  const freeShipLive = isFreeShippingLive(promo);

  const lines = cart.map((l) => ({ ...l, product: products[l.productId] })).filter((l) => l.product);
  const subtotalOriginal = lines.reduce((a: number, l: any) => a + l.product.price * l.qty, 0);
  const subtotal = discountLive
    ? lines.reduce((a: number, l: any) => a + discountedPrice(l.product.price, promo) * l.qty, 0)
    : subtotalOriginal;
  const rawShippingFee = lines.reduce((max: number, l: any) => Math.max(max, l.product.shipping_fee || 0), 0);
  const shippingFee = effectiveShippingFee(rawShippingFee, promo);
  const total = subtotal + shippingFee;

  async function goToPayment() {
    if (!contact.xAccount || !contact.name || !contact.address || !contact.phone) {
      setError(t('cart.errorFillAll'));
      return;
    }
    setError('');
    setStep('payment');
  }

  async function submitPayment() {
    if (!/^\d{6}$/.test(trackingCode)) { setError(t('cart.errorTrackingCode')); return; }
    if (!slipFile) { setError(t('cart.errorSlip')); return; }
    setError('');
    setSubmitting(true);
    try {
      const ext = slipFile.name.split('.').pop();
      const path = `slips/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('shop-images').upload(path, slipFile);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('shop-images').getPublicUrl(path);

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // productId + qty are what matter — the server recomputes prices,
          // shipping, and totals itself from the live product + promotion data.
          items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          contact, trackingCode, slipImage: pub.publicUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'สร้างคำสั่งซื้อไม่สำเร็จ');

      clearCart();
      setOrderNumber(data.orderNumber);
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="container">
        <div className="card">
          <h2>{t('cart.doneTitle')}</h2>
          <p>{t('cart.doneOrderNumber')} <b>{orderNumber}</b></p>
          <p>{t('cart.doneNote')}</p>
          <button className="btn btn-primary" onClick={() => router.push(`/tracking?order=${orderNumber}`)}>{t('cart.goToTracking')}</button>
        </div>
      </div>
    );
  }

  if (lines.length === 0 && step === 'cart') {
    return (
      <div className="container">
        <h1>{t('cart.emptyTitle')}</h1>
        <p>{t('cart.emptyMsg')}</p>
        <button className="btn btn-primary" onClick={() => router.push('/')}>{t('cart.shopNow')}</button>
      </div>
    );
  }

  return (
    <div className="container">
      {step === 'cart' && (
        <>
          <h1>{t('cart.title')}</h1>
          <div className="card">
            {lines.map((l) => {
              const unitPrice = discountLive ? discountedPrice(l.product.price, promo) : l.product.price;
              return (
                <div key={l.productId} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                  <img src={l.product.images?.[0] || ''} style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 8 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{l.product.name}</div>
                    <div style={{ fontSize: 13, color: '#8a8378' }}>
                      {discountLive && <span style={{ textDecoration: 'line-through', marginRight: 6 }}>฿{l.product.price}</span>}
                      ฿{unitPrice} × {l.qty}
                    </div>
                    <button onClick={() => { removeFromCart(l.productId); setCart(getCart()); }} style={{ background: 'none', border: 'none', color: 'var(--rose)', fontSize: 12.5, textDecoration: 'underline' }}>{t('cart.remove')}</button>
                  </div>
                  <div style={{ fontWeight: 600 }}>฿{(unitPrice * l.qty).toLocaleString('th-TH')}</div>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}><span>{t('cart.subtotal')}</span><span>฿{subtotal.toLocaleString('th-TH')}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{t('cart.shippingFee')}</span>
              <span>
                {freeShipLive && rawShippingFee > 0 && <span style={{ textDecoration: 'line-through', color: '#a89f92', marginRight: 6 }}>฿{rawShippingFee.toLocaleString('th-TH')}</span>}
                ฿{shippingFee.toLocaleString('th-TH')}{freeShipLive ? ' (ฟรี!)' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 19, borderTop: '1.5px dashed var(--line)', marginTop: 8, paddingTop: 12 }}><span>{t('cart.total')}</span><span>฿{total.toLocaleString('th-TH')}</span></div>
          </div>

          <div className="card">
            <h3>{t('cart.contactSectionTitle')}</h3>
            <div className="field"><label>{t('cart.xAccountLabel')} <span style={{ color: 'var(--rose)' }}>*</span></label>
              <input required value={contact.xAccount} onChange={(e) => setContact({ ...contact, xAccount: e.target.value })} placeholder="@your_account" /></div>
            <div className="field"><label>{t('cart.nameLabel')} <span style={{ color: 'var(--rose)' }}>*</span></label>
              <input required value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></div>
            <div className="field"><label>{t('cart.addressLabel')} <span style={{ color: 'var(--rose)' }}>*</span></label>
              <textarea required rows={3} value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} /></div>
            <div className="field"><label>{t('cart.phoneLabel')} <span style={{ color: 'var(--rose)' }}>*</span></label>
              <input required value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></div>
            {error && <p style={{ color: 'var(--rose)' }}>{error}</p>}
            <button className="btn btn-primary" onClick={goToPayment}>{t('cart.proceedToPayment')}</button>
          </div>
        </>
      )}

      {step === 'payment' && (
        <>
          <h1>{t('cart.paymentTitle')}</h1>
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 19, marginBottom: 10 }}>{t('cart.amountToPay')}: ฿{total.toLocaleString('th-TH')}</div>
            <div style={{ textAlign: 'center', background: 'var(--paper-dim)', borderRadius: 14, padding: 24 }}>
              {settings?.qr_image_url ? (
                <a href={settings.qr_image_url} target="_blank" rel="noopener">
                  <img src={settings.qr_image_url} style={{ width: 200, height: 200, objectFit: 'contain', background: '#fff', borderRadius: 10, padding: 10, cursor: 'zoom-in' }} />
                </a>
              ) : (
                <p>{t('cart.qrNotSet')}</p>
              )}
            </div>
            {settings?.qr_image_url && (
              <>
                <p style={{ fontSize: 12.5, color: '#8a8378', textAlign: 'center', marginTop: 10 }}>{t('cart.qrCaption')}</p>
                <p style={{ fontSize: 12, color: 'var(--jade)', textAlign: 'center', marginTop: 4 }}>{t('cart.qrTapHint')}</p>
              </>
            )}
            <p style={{ fontSize: 12.5, color: '#8a8378', textAlign: 'center', marginTop: 10 }}>{t('cart.altPaymentNote')}</p>
          </div>
          <div className="card">
            <h3>{t('cart.attachSlipTitle')} <span style={{ color: 'var(--rose)', fontSize: 14 }}>*</span></h3>
            <div className="field"><input required type="file" accept="image/*" onChange={(e) => setSlipFile(e.target.files?.[0] || null)} /></div>
            <div className="field"><label>{t('cart.trackingCodeLabel')} <span style={{ color: 'var(--rose)' }}>*</span></label>
              <input required maxLength={6} value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="เช่น 482913" /></div>
            {error && <p style={{ color: 'var(--rose)' }}>{error}</p>}
            <button className="btn btn-primary" disabled={submitting} onClick={submitPayment}>
              {submitting ? t('cart.submitting') : t('cart.confirmPayment')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
