/**
 * Run once to create all tables.
 * Usage: npm run db:migrate
 */
import 'dotenv/config';
import pool from './connection';
import { logger } from '../utils/logger';

const SQL = `
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  firstName   VARCHAR(100)  NOT NULL,
  lastName    VARCHAR(100)  NOT NULL,
  email       VARCHAR(255)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  country     VARCHAR(100),
  address     TEXT,
  phone       VARCHAR(30),
  role        ENUM('public','client','admin') NOT NULL DEFAULT 'client',
  blocked     TINYINT(1)    NOT NULL DEFAULT 0,
  createdAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(255) NOT NULL,
  slug      VARCHAR(255) NOT NULL UNIQUE,
  createdAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) NOT NULL UNIQUE,
  reference       VARCHAR(100) UNIQUE,
  description     TEXT,
  price           DECIMAL(10,2),
  discountPercent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  images          JSON,
  inStock         TINYINT(1) NOT NULL DEFAULT 1,
  categoryId      INT UNSIGNED,
  dimensions      JSON,
  createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_category
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wishlists (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId    INT UNSIGNED NOT NULL UNIQUE,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wishlist_user
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wishlist_products (
  wishlistId INT UNSIGNED NOT NULL,
  productId  INT UNSIGNED NOT NULL,
  addedAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (wishlistId, productId),
  CONSTRAINT fk_wp_wishlist FOREIGN KEY (wishlistId) REFERENCES wishlists(id)  ON DELETE CASCADE,
  CONSTRAINT fk_wp_product  FOREIGN KEY (productId)  REFERENCES products(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS devis (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId    INT UNSIGNED NOT NULL,
  items     JSON         NOT NULL,
  message   TEXT,
  status    ENUM('pending','processing','sent','rejected') NOT NULL DEFAULT 'pending',
  adminNote TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_devis_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

(async () => {
  const conn = await pool.getConnection();
  try {
    for (const stmt of SQL.split(';').map(s => s.trim()).filter(Boolean)) {
      await conn.query(stmt + ';');
    }
    logger.info('✅  Migration complete');
  } finally {
    conn.release();
    process.exit(0);
  }
})().catch(err => { logger.error(err); process.exit(1); });
