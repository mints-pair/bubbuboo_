'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getCart } from '@/lib/cart';
import ContactModal from '@/components/ContactModal';
import LoginModal from '@/components/LoginModal';

export default function StoreLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const update = () => setCartCount(getCart().reduce((a, c) => a + c.qty, 0));
    update();
    window.addEventListener('cart-updated', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('cart-updated', update);
      window.removeEventListener('storage', update);
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--paper)', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 22px', position: 'sticky', top: 0, zIndex: 40,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: 'var(--paper-dim)',
            border: '1px dashed var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 8, color: '#b3a98f',
          }}>LOGO</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19, color: 'var(--ink)' }}>ร้านค้า</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => setContactOpen(true)}>Contact us</button>
          <button className="btn btn-outline" onClick={() => setLoginOpen(true)}>เข้าสู่ระบบ</button>
          <Link href="/cart" className="btn btn-outline" style={{ textDecoration: 'none' }}>
            ตะกร้า{cartCount > 0 ? ` (${cartCount})` : ''}
          </Link>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, maxWidth: 1180, margin: '0 auto', width: '100%' }}>
        <nav style={{ width: 180, flexShrink: 0, padding: '26px 14px', borderRight: '1px solid var(--line)' }}>
          <Link href="/" style={{
            display: 'block', padding: '11px 14px', borderRadius: 9, marginBottom: 6, fontSize: 14.5, fontWeight: 500,
            textDecoration: 'none', background: pathname === '/' ? 'var(--plum)' : 'transparent',
            color: pathname === '/' ? '#fff' : 'var(--ink)',
          }}>Home</Link>
          <Link href="/tracking" style={{
            display: 'block', padding: '11px 14px', borderRadius: 9, fontSize: 14.5, fontWeight: 500,
            textDecoration: 'none', background: pathname === '/tracking' ? 'var(--plum)' : 'transparent',
            color: pathname === '/tracking' ? '#fff' : 'var(--ink)',
          }}>Tracking</Link>
        </nav>
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  );
}
