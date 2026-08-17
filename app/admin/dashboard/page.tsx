'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function StatCard({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: 'default' | 'rose' | 'jade' | 'marigold' }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    default: { bg: 'var(--paper-dim)', fg: 'var(--ink)' },
    rose: { bg: '#F3E0DC', fg: 'var(--rose)' },
    jade: { bg: 'var(--jade-light)', fg: 'var(--jade)' },
    marigold: { bg: '#F3E4C2', fg: '#8A6A2F' },
  };
  const c = colors[tone || 'default'];
  const inner = (
    <div style={{ background: c.bg, borderRadius: 14, padding: '18px 20px', height: '100%' }}>
      <div style={{ fontSize: 12.5, color: c.fg, opacity: 0.85, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: c.fg }}>{value}</div>
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
  ) : inner;
}

export default function AdminDashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    salesToday: 0, salesMonth: 0, ordersToday: 0,
    pendingCount: 0, shipCount: 0, outOfStockCount: 0,
    activeAuctions: 0,
  });
  const [endingSoonAuctions, setEndingSoonAuctions] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [eventBreakdown, setEventBreakdown] = useState<{ name: string; total: number }[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [{ data: soldOrders }, { count: pendingCount }, { count: shipCount }, { count: outOfStockCount }, { data: activeAuctionsData }, { data: recent }] = await Promise.all([
      supabase.from('orders').select('total, created_at, items').in('status', ['confirmed', 'shipping', 'received']).gte('created_at', startOfMonth),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabase.from('products').select('*', { count: 'exact', head: true }).lte('stock', 0),
      supabase.from('auctions').select('*').eq('status', 'active').order('ends_at', { ascending: true }),
      supabase.from('orders').select('order_number, contact, total, status, created_at').order('created_at', { ascending: false }).limit(6),
    ]);

    const salesToday = (soldOrders || []).filter((o: any) => o.created_at >= startOfDay).reduce((a: number, o: any) => a + Number(o.total), 0);
    const salesMonth = (soldOrders || []).reduce((a: number, o: any) => a + Number(o.total), 0);
    const ordersToday = (soldOrders || []).filter((o: any) => o.created_at >= startOfDay).length;

    const activeAuctions = (activeAuctionsData || []).filter((a: any) => new Date(a.ends_at).getTime() > Date.now());
    const soon = activeAuctions.filter((a: any) => new Date(a.ends_at).getTime() - Date.now() < 24 * 3600 * 1000);

    // sales-by-event breakdown, for this month's confirmed+ orders
    const productIds = Array.from(new Set(
      (soldOrders || []).flatMap((o: any) => (o.items || []).map((it: any) => it.productId).filter(Boolean))
    )) as string[];
    const eventNameByProduct: Record<string, string> = {};
    if (productIds.length) {
      const { data: prods } = await supabase.from('products').select('id, event_id').in('id', productIds);
      const eventIds = Array.from(new Set((prods || []).map((p: any) => p.event_id).filter(Boolean))) as string[];
      const catNameById: Record<string, string> = {};
      if (eventIds.length) {
        const { data: cats } = await supabase.from('categories').select('id, name').in('id', eventIds);
        (cats || []).forEach((c: any) => { catNameById[c.id] = c.name; });
      }
      (prods || []).forEach((p: any) => { eventNameByProduct[p.id] = p.event_id ? (catNameById[p.event_id] || 'ไม่ทราบชื่ออีเว้นท์') : ''; });
    }
    const eventTotals: Record<string, number> = {};
    for (const o of soldOrders || []) {
      for (const it of (o as any).items || []) {
        const revenue = Number(it.price) * Number(it.qty);
        const label = !it.productId ? 'ประมูล / อื่นๆ' : (eventNameByProduct[it.productId] || 'ไม่มีอีเว้นท์');
        eventTotals[label] = (eventTotals[label] || 0) + revenue;
      }
    }
    const breakdown = Object.entries(eventTotals).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }));

    setStats({
      salesToday, salesMonth, ordersToday,
      pendingCount: pendingCount || 0, shipCount: shipCount || 0, outOfStockCount: outOfStockCount || 0,
      activeAuctions: activeAuctions.length,
    });
    setEndingSoonAuctions(soon);
    setRecentOrders(recent || []);
    setEventBreakdown(breakdown);
    setLoading(false);
  }

  const STATUS_LABEL: Record<string, string> = {
    pending: 'รอตรวจสอบสลิป', confirmed: 'รอจัดส่ง', shipping: 'กำลังจัดส่ง', received: 'ได้รับแล้ว', cancelled: 'ถูกปฏิเสธ',
  };

  if (loading) return null;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="ยอดขายวันนี้" value={`฿${stats.salesToday.toLocaleString('th-TH')}`} tone="jade" />
        <StatCard label="ยอดขายเดือนนี้" value={`฿${stats.salesMonth.toLocaleString('th-TH')}`} tone="jade" />
        <StatCard label="ออเดอร์วันนี้" value={stats.ordersToday} />
        <StatCard label="รอตรวจสอบสลิป" value={stats.pendingCount} href="/admin/orders/pending" tone={stats.pendingCount > 0 ? 'rose' : 'default'} />
        <StatCard label="รอจัดส่ง" value={stats.shipCount} href="/admin/orders/ship" tone={stats.shipCount > 0 ? 'marigold' : 'default'} />
        <StatCard label="สินค้าหมดสต็อค" value={stats.outOfStockCount} href="/admin/products/out-of-stock" tone={stats.outOfStockCount > 0 ? 'rose' : 'default'} />
        <StatCard label="ประมูลที่กำลังดำเนินอยู่" value={stats.activeAuctions} href="/admin/auctions" tone="marigold" />
      </div>

      {endingSoonAuctions.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 15 }}>⏰ ประมูลที่ใกล้ปิด (ภายใน 24 ชม.)</h3>
          {endingSoonAuctions.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--line)', fontSize: 13.5 }}>
              <span>{a.name}</span>
              <span style={{ color: '#8a8378' }}>ปิด {new Date(a.ends_at).toLocaleString('th-TH')}</span>
            </div>
          ))}
        </div>
      )}

      {eventBreakdown.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 15 }}>ยอดขายแยกตามอีเว้นท์ (เดือนนี้)</h3>
          {(() => {
            const maxTotal = Math.max(...eventBreakdown.map((e) => e.total));
            return eventBreakdown.map((e) => (
              <div key={e.name} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 5 }}>
                  <span>{e.name}</span>
                  <span style={{ fontWeight: 600 }}>฿{e.total.toLocaleString('th-TH')}</span>
                </div>
                <div style={{ background: 'var(--paper-dim)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${maxTotal ? (e.total / maxTotal * 100) : 0}%`, background: 'var(--jade)', height: '100%' }} />
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      <div className="card">
        <h3 style={{ fontSize: 15 }}>ออเดอร์ล่าสุด</h3>
        {recentOrders.length === 0 ? (
          <p style={{ color: '#9a9490' }}>ยังไม่มีออเดอร์</p>
        ) : (
          recentOrders.map((o) => (
            <div key={o.order_number} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--line)', fontSize: 13.5 }}>
              <span>{o.order_number} — {o.contact?.name}</span>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ color: '#8a8378' }}>฿{Number(o.total).toLocaleString('th-TH')}</span>
                <span style={{
                  fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                  background: o.status === 'pending' ? '#F3E4C2' : o.status === 'cancelled' ? '#F3E0DC' : 'var(--jade-light)',
                  color: o.status === 'pending' ? '#8A6A2F' : o.status === 'cancelled' ? 'var(--rose)' : 'var(--jade)',
                }}>{STATUS_LABEL[o.status] || o.status}</span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
