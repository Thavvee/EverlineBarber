CREATE DATABASE IF NOT EXISTS everline_barber
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE everline_barber;

CREATE TABLE IF NOT EXISTS transactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  date DATE NOT NULL,
  item VARCHAR(255) NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  payment VARCHAR(80) NOT NULL,
  barber VARCHAR(120) NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_transactions_date (date),
  INDEX idx_transactions_barber (barber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  line_user_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'customer', 'barber') NOT NULL DEFAULT 'customer',
  picture_url VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS worktime (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  time VARCHAR(5) NOT NULL,
  type ENUM('work', 'leave') NOT NULL DEFAULT 'work',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_worktime (user_id, date, time),
  INDEX idx_worktime_user_date (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO users (line_user_id, name, role, picture_url) VALUES
  ('U1234567890', 'Admin Everline', 'admin', NULL),
  ('U0987654321', 'Barber Bank', 'barber', NULL),
  ('U1122334455', 'Customer Noon', 'customer', NULL);

INSERT INTO transactions (date, item, price, payment, barber, note) VALUES
  ('2026-04-23', 'ตัดผมชาย', 300, 'เงินสด', 'ช่างแบงค์', 'ลูกค้าประจำ'),
  ('2026-04-23', 'โกนหนวด', 150, 'โอนเงิน', 'ช่างอาร์ต', ''),
  ('2026-04-24', 'ตัด+สระ', 450, 'โอนเงิน', 'ช่างแบงค์', ''),
  ('2026-04-24', 'แว็กซ์ผม', -320, 'เงินสด', 'ร้าน', 'ซื้อสินค้า'),
  ('2026-04-25', 'ย้อมผม', 1200, 'โอนเงิน', 'ช่างนัท', 'โปรสีเข้ม'),
  ('2026-04-26', 'ตัดผมเด็ก', 250, 'เงินสด', 'ช่างอาร์ต', ''),
  ('2026-04-27', 'ทรีตเมนต์', 700, 'โอนเงิน', 'ช่างนัท', ''),
  ('2026-04-28', 'ตัดผมชาย', 300, 'เงินสด', 'ช่างแบงค์', ''),
  ('2026-04-29', 'ตัด+โกน', 420, 'โอนเงิน', 'ช่างอาร์ต', ''),
  ('2026-04-29', 'ค่าอุปกรณ์', -850, 'โอนเงิน', 'ร้าน', 'รายจ่ายร้าน');
