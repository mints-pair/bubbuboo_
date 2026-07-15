# ร้านค้า — Production Starter

Next.js 14 (App Router, TypeScript) + Supabase (Postgres, Auth, Storage) + Telegram Bot API.

This is a real, deployable version of the shop prototype: same features (storefront with
product browsing/search/cart/checkout/QR payment/slip upload/tracking, and an admin
back office with product management, order confirmation, shipping, sales history with a
lock/unlock flow, and a member list) — but backed by an actual database instead of
in-browser storage, with real admin login.

**Read `DEPLOY.md` for the full step-by-step setup — start there.**

## Project structure

```
app/
  (store)/          storefront pages — share header + sidebar layout
    page.tsx           Home
    product/[id]/      Product detail
    cart/              Cart -> contact form -> payment (QR + slip upload)
    tracking/          Order tracking lookup
  admin/             back office (protected by middleware.ts)
    login/
    products/          upload/edit/delete products + shop settings (name, QR image)
    orders/pending/    confirm payment
    orders/ship/       enter tracking number/carrier/date
    orders/history/    shipping + received orders, received = locked until re-auth
    members/           customer list, auto-built when orders are confirmed
  api/
    orders/                       POST create order (atomic order number, stock hold, Telegram alert)
    orders/[orderNumber]/confirm  admin: mark payment confirmed
    orders/[orderNumber]/ship     admin: save tracking info
    orders/[orderNumber]/receive  admin: mark received / edit / revert (from history tab)
    orders/[orderNumber]/lookup   public: tracking lookup (order number + 6-digit code)
    telegram/test                  admin: send a test Telegram push
lib/
  supabase/client.ts   browser client (anon key)
  supabase/server.ts   server client, respects admin's auth session
  supabase/admin.ts    server-only client (service_role key, bypasses RLS)
  cart.ts              localStorage-backed cart
  telegram.ts          Telegram Bot API push helper
supabase/schema.sql    run this once in the Supabase SQL editor
middleware.ts          redirects unauthenticated visitors away from /admin/*
```

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values — see DEPLOY.md
npm run dev
```

Open http://localhost:3000 for the storefront and http://localhost:3000/admin for the
back office.

## Notes / things you'll likely want to change

- **Stock vs. holds.** Submitting a payment slip does **not** deduct stock — it reserves
  ("holds") those units instead. Other visitors see the item as **"ติดจอง"** (on hold) and
  can't add it to their cart while units are held. Stock is only actually deducted when
  the admin confirms the order (`/api/orders/[orderNumber]/confirm`); if a pending order is
  never confirmed, its hold has no expiry in this version — you may want to add an
  admin "reject/cancel" action later that clears the hold for abandoned orders.
- **Order numbering** (`PW-YYMMxxx`) is generated atomically in Postgres (`next_order_number()`
  in `supabase/schema.sql`) at the moment the customer submits their slip — not when the
  admin confirms — so the "pending" status is trackable from the start.
- **Image uploads** (product photos, payment slips) go straight from the browser to a public
  Supabase Storage bucket. That's convenient because customers uploading slips aren't
  logged in, but it does mean anyone with the URL pattern could technically upload junk
  files — fine to start with, but consider adding file-type/size checks or moving uploads
  behind an API route if abuse becomes a concern.
- **Notifications go through a Telegram bot**, not LINE — no business account or
  verification needed, just a personal bot created via @BotFather (see `DEPLOY.md`
  step 6). If you'd rather use LINE, WhatsApp, Discord, or email instead, swap out
  `lib/telegram.ts` for an equivalent helper and call it from the same two spots
  (`app/api/orders/route.ts` and `app/api/telegram/test/route.ts`).
- Stock is decremented per line item in a simple loop, not a single atomic transaction.
  Fine for a small shop; if you expect concurrent buyers racing for the last item, move
  this into a Postgres function with row locking.
