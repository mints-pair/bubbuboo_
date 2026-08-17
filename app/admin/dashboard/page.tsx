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

function monthOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    opts.push({ value, label });
  }
  return opts;
}

export default function AdminDashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [stats, setStats] = useState({
    salesToday: 0, ordersToday: 0, salesSelectedMonth: 0,
    pendingCount: 0, shipCount: 0, outOfStockCount: 0,
    activeAuctions: 0,
  });
  const [endingSoonAuctions, setEndingSoonAuctions] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [eventBreakdown, setEventBreakdown] = useState<{ name: string; total: number }[]>([]);

  useEffect(() => { load(); }, [selectedMonth]);

  async function load() {
    setLoading(true);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [y, m] = selectedMonth.split('-').map(Number);
    const monthStart = new Date(y, m - 1, 1).toISOString();
    const monthEnd = new Date(y, m, 1).toISOString();

    const [{ data: todayOrders }, { data: monthOrders }, { count: pendingCount }, { count: shipCount }, { count: outOfStockCount }, { data: activeAuctionsData }, { data: recent }] = await Promise.all([
      supabase.from('orders').select('total').in('status', ['confirmed', 'shipping', 'received']).gte('created_at', startOfDay),
      supabase.from('orders').select('total, created_at, items').in('status', ['confirmed', 'shipping', 'received']).gte('created_at', monthStart).lt('created_at', monthEnd),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabase.from('products').select('*', { count: 'exact', head: true }).lte('stock', 0),
      supabase.from('auctions').select('*').eq('status', 'active').order('ends_at', { ascending: true }),
      supabase.from('orders').select('order_number, contact, total, status, created_at').order('created_at', { ascending: false }).limit(6),
    ]);

    const salesToday = (todayOrders || []).reduce((a: number, o: any) => a + Number(o.total), 0);
    const ordersToday = (todayOrders || []).length;
    const salesSelectedMonth = (monthOrders || []).reduce((a: number, o: any) => a + Number(o.total), 0);

    const activeAuctions = (activeAuctionsData || []).filter((a: any) => new Date(a.ends_at).getTime() > Date.now());
    const soon = activeAuctions.filter((a: any) => new Date(a.ends_at).getTime() - Date.now() < 24 * 3600 * 1000);

    // sales-by-event breakdown for the selected month's confirmed+ orders —
    // regular product items resolve their event via the product's event_id;
    // auction-derived items (productId is null) resolve via the auction's
    // own event_id, tagged onto the order item as auctionId at checkout time
    const productIds = Array.from(new Set(
      (monthOrders || []).flatMap((o: any) => (o.items || []).map((it: any) => it.productId).filter(Boolean))
    )) as string[];
    const auctionIds = Array.from(new Set(
      (monthOrders || []).flatMap((o: any) => (o.items || []).map((it: any) => it.auctionId).filter(Boolean))
    )) as string[];

    const allEventIds = new Set<string>();
    const eventIdByProduct: Record<string, string> = {};
    if (productIds.length) {
      const { data: prods } = await supabase.from('products').select('id, event_id').in('id', productIds);
      (prods || []).forEach((p: any) => { if (p.event_id) { eventIdByProduct[p.id] = p.event_id; allEventIds.add(p.event_id); } });
    }
    const eventIdByAuction: Record<string, string> = {};
    if (auctionIds.length) {
      const { data: aucs } = await supabase.from('auctions').select('id, event_id').in('id', auctionIds);
      (aucs || []).forEach((a: any) => { if (a.event_id) { eventIdByAuction[a.id] = a.event_id; allEventIds.add(a.event_id); } });
    }
    const catNameById: Record<string, string> = {};
    if (allEventIds.size) {
      const { data: cats } = await supabase.from('categories').select('id, name').in('id', Array.from(allEventIds));
      (cats || []).forEach((c: any) => { catNameById[c.id] = c.name; });
    }

    const eventTotals: Record<string, number> = {};
    for (const o of monthOrders || []) {
      for (const it of (o as any).items || []) {
        const revenue = Number(it.price) * Number(it.qty);
        let eventId: string | undefined;
        if (it.productId) eventId = eventIdByProduct[it.productId];
        else if (it.auctionId) eventId = eventIdByAuction[it.auctionId];
        const label = eventId ? (catNameById[eventId] || 'ไม่ทราบชื่ออีเว้นท์') : 'ไม่มีอีเว้นท์';
        eventTotals[label] = (eventTotals[label] || 0) + revenue;
      }
    }
    const breakdown = Object.entries(eventTotals).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }));

    setStats({
      salesToday, ordersToday, salesSelectedMonth,
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

  const selectedMonthLabel = monthOptions().find((o) => o.value === selectedMonth)?.label || selectedMonth;

  if (loading && eventBreakdown.length === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 13.5, background: '#fff' }}
        >
          {monthOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="ยอดขายวันนี้" value={`฿${stats.salesToday.toLocaleString('th-TH')}`} tone="jade" />
        <StatCard label={`ยอดขาย (${selectedMonthLabel})`} value={`฿${stats.salesSelectedMonth.toLocaleString('th-TH')}`} tone="jade" />
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

      <div className="card">
        <h3 style={{ fontSize: 15 }}>ยอดขายแยกตามอีเว้นท์ ({selectedMonthLabel})</h3>
        {eventBreakdown.length === 0 ? (
          <p style={{ color: '#9a9490' }}>ยังไม่มียอดขายในเดือนนี้</p>
        ) : (() => {
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
