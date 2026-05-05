# Everline Barber Dashboard

Dashboard สำหรับดูรายรับรายจ่ายรายวัน รายสัปดาห์ และรายเดือน โดยใช้ SQL database เป็น datasource

```text
วันที่ | รายการ | ราคา | ช่องทาง | ช่าง | หมายเหตุ
```

## ติดตั้งและรัน

1. ติดตั้ง dependencies

```bash
npm install
```

2. สร้าง database/table ด้วยไฟล์ `schema.sql`

```bash
mysql -u root -p < schema.sql
```

3. สร้างไฟล์ `.env` จาก `.env.example` แล้วแก้ค่าการเชื่อมต่อฐานข้อมูล

```text
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=everline_barber
DB_TABLE=transactions
APP_BASE_URL=http://localhost:3000
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
LINE_REDIRECT_URI=http://localhost:3000/auth/line/callback
SESSION_SECRET=change-this-to-a-long-random-string
```

4. ตั้งค่า LINE Login

- สร้าง LINE Login channel ใน LINE Developers Console
- ตั้ง Callback URL เป็น `http://localhost:3000/auth/line/callback` สำหรับเครื่อง local
- นำ Channel ID ใส่ `LINE_CHANNEL_ID`
- นำ Channel secret ใส่ `LINE_CHANNEL_SECRET`
- เปลี่ยน `SESSION_SECRET` เป็นข้อความสุ่มยาว ๆ

5. Build React app

```bash
npm run build
```

6. เปิด server

```bash
npm start
```

แล้วเข้าใช้งานที่ `http://localhost:3000`

ระหว่างพัฒนา frontend สามารถใช้ Vite ได้:

```bash
npm run dev
```

โดยต้องเปิด backend `npm start` ไว้ด้วย เพื่อให้ proxy ไปยัง SQL API และ LINE Login routes

## รูปแบบตาราง SQL

ตารางเริ่มต้นชื่อ `transactions`

```sql
CREATE TABLE transactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  date DATE NOT NULL,
  item VARCHAR(255) NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  payment VARCHAR(80) NOT NULL,
  barber VARCHAR(120) NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);
```

- `date`: วันที่รายการ เช่น `2026-04-29`
- `price`: รายรับเป็นค่าบวก เช่น `300`, รายจ่ายเป็นค่าติดลบ เช่น `-850`
- `payment`: ช่องทางรับ/จ่ายเงิน เช่น `เงินสด`, `โอนเงิน`
- `barber`: ชื่อช่าง หรือ `ร้าน` สำหรับรายจ่ายร้าน

หน้าเว็บจะดึงข้อมูลจาก endpoint `/api/transactions` และ refresh ทุก 30 วินาที

## LINE Login

ระบบบังคับ login ด้วย LINE ก่อนเสมอ

- ถ้ายังไม่ login แล้วเข้า `/` หรือไฟล์หน้าเว็บ จะถูกส่งไป `/login`
- ถ้ายังไม่ login แล้วเรียก `/api/transactions` จะได้ `401 LINE login required`
- หลัง login สำเร็จ ระบบจะเก็บ session ไว้ใน cookie ชื่อ `everline.sid`
- ออกจากระบบได้ด้วย `POST /logout`
