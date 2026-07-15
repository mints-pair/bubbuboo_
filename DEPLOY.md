# วิธี Deploy ตั้งแต่ต้น (ไม่ต้องมีพื้นฐานมาก่อนก็ทำตามได้)

สิ่งที่ต้องใช้ทั้งหมด (ฟรีทุกตัวสำหรับร้านขนาดเล็ก):
- บัญชี GitHub — เก็บโค้ด
- บัญชี Supabase — ฐานข้อมูล + เก็บรูปภาพ + ระบบล็อกอินแอดมิน
- บัญชี Vercel — โฮสต์เว็บให้คนเข้าถึงได้จริง
- บัญชี Telegram — สร้างบอทฟรี ส่งแจ้งเตือนเข้า Telegram แอดมิน

---

## ขั้นตอนที่ 1 — เตรียมโค้ดขึ้น GitHub

1. สร้าง repository ใหม่บน https://github.com (กด New repository ตั้งชื่อ เช่น `my-shop`)
2. แตกไฟล์ zip ที่ได้ ไปเป็นโฟลเดอร์โปรเจกต์ในเครื่อง
3. เปิด terminal ในโฟลเดอร์นั้น แล้วรัน:
   ```bash
   git init
   git add .
   git commit -m "init shop app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/my-shop.git
   git push -u origin main
   ```

## ขั้นตอนที่ 2 — สร้างโปรเจกต์ Supabase (ฐานข้อมูล + ที่เก็บรูป + ล็อกอิน)

1. ไปที่ https://supabase.com สมัคร/ล็อกอิน แล้วกด **New project**
2. ตั้งชื่อโปรเจกต์และรหัสผ่านฐานข้อมูล (เก็บรหัสนี้ไว้ ใช้ไม่บ่อยแต่ควรจด)
3. รอสักครู่จนโปรเจกต์พร้อม แล้วไปที่เมนู **SQL Editor** ทางซ้าย
4. เปิดไฟล์ `supabase/schema.sql` จากโปรเจกต์นี้ **คัดลอกทั้งหมด** วางใน SQL Editor แล้วกด **Run**
   - คำสั่งนี้จะสร้างตารางสินค้า/ออเดอร์/สมาชิก/ตั้งค่าร้าน, ฟังก์ชันรันเลขออเดอร์อัตโนมัติ,
     กฎความปลอดภัย (RLS), และที่เก็บรูปภาพ (`shop-images` bucket) ให้ครบในทีเดียว
5. ไปที่เมนู **Project Settings > API** เก็บค่า 3 ตัวนี้ไว้:
   - `Project URL` → ใช้เป็น `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → ใช้เป็น `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (กดปุ่ม reveal) → ใช้เป็น `SUPABASE_SERVICE_ROLE_KEY`
     ⚠️ **คีย์นี้ห้ามเปิดเผยหรือใส่ในโค้ดฝั่งเบราว์เซอร์เด็ดขาด** ใช้เฉพาะในไฟล์ env ฝั่ง server เท่านั้น

## ขั้นตอนที่ 3 — สร้างบัญชีแอดมิน

1. ใน Supabase ไปที่เมนู **Authentication > Users**
2. กด **Add user** → ใส่อีเมลและรหัสผ่านที่จะใช้ล็อกอินหลังบ้าน (ติ๊ก "Auto Confirm User" ด้วย)
3. จดอีเมล/รหัสผ่านนี้ไว้ — ใช้ล็อกอินที่หน้า `/admin/login` ของเว็บ

## ขั้นตอนที่ 4 — ตั้งค่าไฟล์ environment variables

1. ในโฟลเดอร์โปรเจกต์ คัดลอก `.env.example` เป็น `.env.local`
2. ใส่ค่าจากขั้นตอนที่ 2 ลงไป (ส่วน Telegram ใส่ทีหลังได้ในขั้นตอนที่ 6)
3. ทดสอบรันในเครื่อง:
   ```bash
   npm install
   npm run dev
   ```
   เปิด http://localhost:3000 ควรเห็นหน้าร้าน (ยังไม่มีสินค้า) และ http://localhost:3000/admin/login
   ล็อกอินด้วยอีเมล/รหัสผ่านที่สร้างไว้ แล้วลองเพิ่มสินค้าดู

## ขั้นตอนที่ 5 — Deploy ขึ้น Vercel

1. ไปที่ https://vercel.com สมัคร/ล็อกอินด้วยบัญชี GitHub เดียวกัน
2. กด **Add New... > Project** แล้วเลือก repository `my-shop` ที่ push ไว้
3. ในหน้า Configure Project ก่อนกด Deploy ให้ใส่ **Environment Variables** ทั้งหมดจาก `.env.local`
   (คัดลอกวางทีละตัว: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, และภายหลัง `TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_CHAT_ID`)
4. กด **Deploy** รอสักครู่ จะได้ลิงก์เว็บ เช่น `https://my-shop.vercel.app`
5. (ไม่บังคับ) ต่อโดเมนของตัวเอง: Vercel > โปรเจกต์ > Settings > Domains

## ขั้นตอนที่ 6 — ตั้งค่าแจ้งเตือนเข้า Telegram

โปรเจกต์นี้แจ้งเตือนแอดมินเมื่อมีออเดอร์ใหม่ผ่าน **Telegram Bot** — ตั้งค่าง่ายกว่า LINE มาก
เพราะไม่ต้องมี Official Account หรือยืนยันตัวตนธุรกิจใดๆ ใช้เวลาไม่ถึง 5 นาที

1. เปิดแอป Telegram ค้นหา **@BotFather** (บอทตัวจริงของ Telegram เอง) แล้วกด Start
2. พิมพ์คำสั่ง `/newbot` แล้วทำตามขั้นตอน (ตั้งชื่อบอท และ username ที่ลงท้ายด้วย `bot`)
3. เมื่อสร้างเสร็จ BotFather จะส่ง **token** มาให้ (หน้าตาประมาณ `123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   → คัดลอกเก็บไว้ ใช้เป็นค่า `TELEGRAM_BOT_TOKEN`
4. ค้นหาบอทของคุณด้วย username ที่ตั้งไว้ กด **Start** แล้วพิมพ์ข้อความอะไรก็ได้ส่งไปหาบอท 1 ครั้ง
   (ต้องทำขั้นตอนนี้ก่อน ไม่งั้น Telegram จะยังไม่รู้ว่าต้องส่งข้อความหาใคร)
5. เปิดเบราว์เซอร์ไปที่ (แทนที่ `<TOKEN>` ด้วย token จากข้อ 3):
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
   จะเห็น JSON ย้อนกลับมา หาคำว่า `"chat":{"id":` แล้วคัดลอกตัวเลขหลังจากนั้น
   → นี่คือค่า `ADMIN_TELEGRAM_CHAT_ID` (เช่น `123456789`)
6. เพิ่ม `TELEGRAM_BOT_TOKEN` และ `ADMIN_TELEGRAM_CHAT_ID` ใน Vercel > Settings > Environment
   Variables แล้วกด **Redeploy** (Deployments > ... > Redeploy) เพื่อให้ค่าใหม่มีผล
7. ทดสอบ: ล็อกอินหลังบ้านที่เว็บจริง แล้วเปิด `https://<เว็บของคุณ>/api/telegram/test` ใน
   browser เดียวกันที่ล็อกอินไว้ — ถ้าตั้งค่าถูกต้อง จะมีข้อความ "ทดสอบระบบแจ้งเตือน..." เด้งเข้า Telegram ทันที

## ขั้นตอนที่ 7 — ตั้งค่าร้าน

1. เข้า `https://<เว็บของคุณ>/admin/login` ล็อกอิน
2. ไปแท็บ "อัพโหลดสินค้า" → ใส่ชื่อร้าน และลิงก์รูป QR รับเงิน (อัปโหลดรูป QR ไปเก็บที่ไหนก็ได้ที่
   ได้ URL ตรง เช่น อัปโหลดเป็นสินค้าชั่วคราวแล้วคัดลอกลิงก์ หรือใช้ Supabase Storage โดยตรง)
3. เริ่มเพิ่มสินค้าได้เลย

---

## อัปเดตโปรเจกต์ที่ deploy ไปแล้ว

ถ้าเคย deploy ไปแล้วและได้โค้ดเวอร์ชันใหม่มา (เช่น ฟีเจอร์ "จองสินค้า" ที่เพิ่ม
`held_stock()` function) ให้เปิด **Supabase > SQL Editor** แล้วรัน `supabase/schema.sql`
ทั้งไฟล์อีกครั้งได้เลย — ทุกคำสั่งเขียนแบบ `create table if not exists` / `create or replace`
จึงรันซ้ำได้อย่างปลอดภัย ไม่ลบข้อมูลเดิม จากนั้น push โค้ดใหม่ขึ้น GitHub ตามปกติ Vercel
จะ deploy เวอร์ชันใหม่ให้อัตโนมัติ

---

## สรุปสิ่งที่ต้องมี (checklist)

- [ ] บัญชี GitHub + repo ที่ push โค้ดแล้ว
- [ ] โปรเจกต์ Supabase + รัน `supabase/schema.sql` แล้ว
- [ ] ผู้ใช้แอดมิน 1 คนใน Supabase Authentication
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] โปรเจกต์ Vercel เชื่อมกับ repo + ตั้ง environment variables แล้ว deploy สำเร็จ
- [ ] สร้างบอทผ่าน @BotFather ได้ `TELEGRAM_BOT_TOKEN`
- [ ] `ADMIN_TELEGRAM_CHAT_ID` (ได้จากขั้นตอนที่ 6.5)
- [ ] ตั้งชื่อร้าน + QR รับเงินในหน้าแอดมินแล้ว

หลังจากนี้เว็บพร้อมใช้งานจริง — ทุกครั้งที่ push โค้ดใหม่ขึ้น GitHub branch `main`,
Vercel จะ deploy เวอร์ชันใหม่ให้อัตโนมัติ
