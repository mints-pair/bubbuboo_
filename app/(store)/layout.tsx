'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getCart } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/lib/lang-context';
import ContactModal from '@/components/ContactModal';
import LoginModal from '@/components/LoginModal';

export default function StoreLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const supabase = createClient();
  const { lang, setLang, t } = useLang();
  const [cartCount, setCartCount] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [settings, setSettings] = useState<{ store_name?: string; logo_url?: string } | null>(null);

  useEffect(() => {
    const update = () => setCartCount(getCart().reduce((a: number, c: any) => a + c.qty, 0));
    update();
    window.addEventListener('cart-updated', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('cart-updated', update);
      window.removeEventListener('storage', update);
    };
  }, []);

  useEffect(() => {
    supabase.from('settings').select('store_name, logo_url').single().then(({ data }) => setSettings(data));
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="store-header">
        <div className="store-header-inner">
          <Link href="/" className="store-brand">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="logo" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: 'var(--paper-dim)',
                border: '1px dashed var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 8, color: '#b3a98f', flexShrink: 0,
              }}>LOGO</div>
            )}
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19, color: 'var(--ink)' }}>
              {settings?.store_name || 'ร้านค้า'}
            </span>
          </Link>
          <div className="store-header-actions">
            <div style={{ display: 'flex', border: '1.5px solid var(--line)', borderRadius: 9, overflow: 'hidden' }}>
              <button onClick={() => setLang('th')} style={{
                border: 'none', padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: lang === 'th' ? 'var(--plum)' : '#fff', color: lang === 'th' ? '#fff' : 'var(--ink)',
              }}>ไทย</button>
              <button onClick={() => setLang('en')} style={{
                border: 'none', padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: lang === 'en' ? 'var(--plum)' : '#fff', color: lang === 'en' ? '#fff' : 'var(--ink)',
              }}>EN</button>
            </div>
            <button className="btn btn-outline" onClick={() => setContactOpen(true)}>{t('nav.contact')}</button>
            <button className="btn btn-outline" onClick={() => setLoginOpen(true)}>{t('nav.login')}</button>
            <Link href="/cart" className="btn btn-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>
              {t('nav.cart')}{cartCount > 0 ? ` (${cartCount})` : ''}
            </Link>
          </div>
        </div>
      </header>

      <div className="store-body-wrap">
        <nav className="store-sidebar">
          <Link href="/" className="store-sidebar-link" style={{
            background: pathname === '/' ? 'var(--plum)' : 'transparent',
            color: pathname === '/' ? '#fff' : 'var(--ink)',
          }}>{t('nav.home')}</Link>
          <Link href="/tracking" className="store-sidebar-link" style={{
            background: pathname === '/tracking' ? 'var(--plum)' : 'transparent',
            color: pathname === '/tracking' ? '#fff' : 'var(--ink)',
          }}>{t('nav.tracking')}</Link>
        </nav>
        <main className="store-main">{children}</main>
      </div>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  );
}
