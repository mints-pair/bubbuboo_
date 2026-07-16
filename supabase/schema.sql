-- ============================================================
-- SHOP DATABASE SCHEMA
-- Run this whole file once in Supabase Dashboard > SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- products ----------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  price numeric not null default 0,
  shipping_fee numeric not null default 0,
  stock int not null default 0,
  tags text[] not null default '{}',
  images text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- order number counters (one row per YYMM, e.g. '2607') ----------
create table if not exists order_counters (
  yymm text primary key,
  n int not null default 0
);

-- Atomically returns the next order number in the form PW-YYMMxxx
create or replace function next_order_number()
returns text
language plpgsql
as $$
declare
  key text := to_char(now(), 'YYMM');
  seq int;
begin
  insert into order_counters (yymm, n) values (key, 1)
  on conflict (yymm) do update set n = order_counters.n + 1
  returning n into seq;
  return 'PW-' || key || lpad(seq::text, 3, '0');
end;
$$;

-- ---------- orders ----------
create table if not exists orders (
  order_number text primary key,
  status text not null default 'pending', -- pending | confirmed | shipping | received
  items jsonb not null default '[]',
  subtotal numeric not null default 0,
  shipping_fee numeric not null default 0,
  total numeric not null default 0,
  contact jsonb not null default '{}',      -- { xAccount, name, address, phone }
  slip_image text,
  tracking_code text not null,              -- 6-digit code the customer sets
  shipping jsonb,                           -- { trackingNumber, carrier, date }
  created_at timestamptz not null default now()
);

-- ---------- members (auto-created/updated when an order is confirmed) ----------
create table if not exists members (
  phone text primary key,
  name text not null,
  address text not null,
  orders jsonb not null default '[]'        -- [{ orderNumber, total, date }]
);

-- ---------- shop settings (single row) ----------
create table if not exists settings (
  id int primary key default 1,
  store_name text not null default 'ร้านค้า',
  qr_image_url text default '',
  logo_url text default '',
  constraint single_row check (id = 1)
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- Public (anon) can only READ products + settings.
-- Everything else (orders, members, writes) goes through
-- Next.js API routes using the service_role key (server-only),
-- which bypasses RLS entirely — so the policies below only need
-- to cover what the browser is allowed to touch directly.
-- ============================================================
alter table products enable row level security;
alter table settings enable row level security;
alter table orders enable row level security;
alter table members enable row level security;
alter table order_counters enable row level security;

create policy "public read products" on products
  for select using (true);

create policy "public read settings" on settings
  for select using (true);

-- The only way to become "authenticated" in this project is the admin
-- logging in via Supabase Auth (see DEPLOY.md step 4) — there is no public
-- sign-up flow — so "authenticated" here effectively means "is the admin".
create policy "admin manage products" on products
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin manage settings" on settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin read orders" on orders
  for select using (auth.role() = 'authenticated');

create policy "admin update orders" on orders
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin manage members" on members
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- orders INSERT and order_counters: still no public/authenticated policy —
-- order creation always goes through /api/orders using the service_role key,
-- since customers placing orders are never logged in.

-- ============================================================
-- HELD STOCK (reservations)
-- When a customer submits a payment slip, the order sits at status
-- 'pending' — the items are "held" (reserved) but stock is NOT yet
-- deducted. Stock is only actually deducted when the admin confirms.
-- This function safely exposes just { product_id, held_qty } to anyone
-- (including anonymous storefront visitors) without exposing the orders
-- table itself, which stays admin-only under RLS above.
-- ============================================================
create or replace function held_stock()
returns table(product_id uuid, held_qty bigint)
language sql
security definer
set search_path = public
stable
as $$
  select (item->>'productId')::uuid as product_id,
         sum((item->>'qty')::int) as held_qty
  from orders, jsonb_array_elements(items) as item
  where status = 'pending'
  group by (item->>'productId')::uuid;
$$;

grant execute on function held_stock() to anon, authenticated;

-- ============================================================
-- STORAGE: bucket for product photos + payment slips
-- ============================================================
insert into storage.buckets (id, name, public)
values ('shop-images', 'shop-images', true)
on conflict (id) do nothing;

-- Anyone can upload (customers need to upload payment slips without logging in)
-- and anyone can read (product photos need to be publicly visible).
-- If you want to lock this down later, restrict inserts to service_role only
-- and instead upload through an authenticated API route.
create policy "public upload shop-images" on storage.objects
  for insert with check (bucket_id = 'shop-images');

create policy "public read shop-images" on storage.objects
  for select using (bucket_id = 'shop-images');

-- ============================================================
-- ADMIN ACTIVITY LOG
-- Records who (by email) did what, and when. Useful once there's more
-- than one admin account, or just as an audit trail.
-- ============================================================
create table if not exists admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  message text not null,
  created_at timestamptz not null default now()
);
alter table admin_logs enable row level security;

create policy "admin manage logs" on admin_logs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- PROMOTION (single row) — storewide sale settings
-- "active" is a manual master on/off switch. start_at/end_at are optional —
-- if set, the promotion auto-activates/deactivates at those times (on top
-- of "active" still needing to be true). Leave them blank to control
-- purely with the manual switch.
-- ============================================================
create table if not exists promotion (
  id int primary key default 1,
  active boolean not null default false,
  discount_active boolean not null default false,
  discount_percent numeric not null default 0,
  discount_scope text not null default 'all',
  discount_product_ids uuid[] not null default '{}',
  free_shipping_active boolean not null default false,
  label text not null default '',
  start_at timestamptz,
  end_at timestamptz,
  constraint single_row_promo check (id = 1)
);
insert into promotion (id) values (1) on conflict (id) do nothing;

alter table promotion enable row level security;

create policy "public read promotion" on promotion
  for select using (true);

create policy "admin manage promotion" on promotion
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- CATEGORIES
-- ============================================================
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null default 'member' check (type in ('member', 'event')),
  created_at timestamptz not null default now()
);
alter table categories enable row level security;

create policy "public read categories" on categories
  for select using (true);

create policy "admin manage categories" on categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table products add column if not exists category_id uuid references categories(id) on delete set null;
alter table products add column if not exists is_giveaway boolean not null default false;
alter table products add column if not exists member_id uuid references categories(id) on delete set null;
alter table products add column if not exists event_id uuid references categories(id) on delete set null;
