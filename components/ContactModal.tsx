'use client';
import { useLang } from '@/lib/lang-context';

export default function ContactModal({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(58,50,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <h3>{t('contactModal.title')}</h3>
        <p style={{ marginBottom: 14 }}>{t('contactModal.desc')}</p>
        <a href="https://x.com/bubbuboo_" target="_blank" rel="noopener" className="btn btn-outline"
          style={{ display: 'block', textDecoration: 'none' }}>
          X &nbsp;·&nbsp; @bubbuboo_
        </a>
        <button className="btn btn-outline" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>{t('contactModal.close')}</button>
      </div>
    </div>
  );
}
