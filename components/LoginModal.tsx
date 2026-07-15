'use client';
import Link from 'next/link';

export default function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(58,50,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <h3>เข้าสู่ระบบ</h3>
        <p style={{ marginBottom: 18 }}>ระบบสมัครสมาชิกและเข้าสู่ระบบ จะเปิดให้บริการในอนาคต ขออภัยในความไม่สะดวก</p>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>รับทราบ</button>
        <Link href="/admin/login" style={{ display: 'block', marginTop: 14, fontSize: 12, opacity: 0.5, textDecoration: 'underline', color: 'var(--ink)' }}>
          Admin
        </Link>
      </div>
    </div>
  );
}
