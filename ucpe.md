

-- ============================================================
-- STEP 1 — users
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id        INT           NOT NULL AUTO_INCREMENT,
    firstName VARCHAR(255)  NOT NULL,
    lastName  VARCHAR(255)  NOT NULL,
    email     VARCHAR(255)  NOT NULL,
    password  VARCHAR(255)  NOT NULL,
    country   VARCHAR(255)  DEFAULT NULL,
    address   VARCHAR(500)  DEFAULT NULL,
    phone     VARCHAR(50)   DEFAULT NULL,
    role      ENUM('client','admin') NOT NULL DEFAULT 'client',
    blocked   TINYINT(1)    NOT NULL DEFAULT 0,
    createdAt DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;



-- ============================================================
-- STEP 2 — categories (self-referencing tree: cat / subcat / subsubcat)
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
    id        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    name      VARCHAR(255)  NOT NULL,
    slug      VARCHAR(255)  NOT NULL,
    parentId  INT UNSIGNED  DEFAULT NULL,
    depth     TINYINT UNSIGNED NOT NULL DEFAULT 0,
    createdAt DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categories_slug (slug),
    KEY idx_categories_parentId (parentId),
    CONSTRAINT fk_categories_parent
        FOREIGN KEY (parentId) REFERENCES categories (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;



-- ============================================================
-- STEP 3 — products
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    title           VARCHAR(500)    NOT NULL,
    slug            VARCHAR(500)    NOT NULL,
    reference       VARCHAR(100)    DEFAULT NULL,
    description     LONGTEXT        DEFAULT NULL,
    price           DECIMAL(10, 2)  DEFAULT NULL,
    originalPrice   DECIMAL(10, 2)  DEFAULT NULL,
    discountPercent TINYINT UNSIGNED NOT NULL DEFAULT 0,
    images          JSON            DEFAULT NULL,
    inStock         TINYINT(1)      NOT NULL DEFAULT 1,
    categoryId      INT UNSIGNED    DEFAULT NULL,
    dimensions      JSON            DEFAULT NULL,
    isInVariant     TINYINT(1)      NOT NULL DEFAULT 0,
    variantId       VARCHAR(100)    DEFAULT NULL,
    createdAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_products_slug (slug),
    KEY idx_products_categoryId (categoryId),
    KEY idx_products_variantId (variantId),
    CONSTRAINT fk_products_category
        FOREIGN KEY (categoryId) REFERENCES categories (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;



-- ============================================================
-- STEP 4 — wishlist_items
-- ============================================================

CREATE TABLE IF NOT EXISTS wishlist_items (
    userId    INT          NOT NULL,
    productId INT UNSIGNED NOT NULL,
    addedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (userId, productId),
    CONSTRAINT fk_wishlist_user    FOREIGN KEY (userId)    REFERENCES users (id)    ON DELETE CASCADE,
    CONSTRAINT fk_wishlist_product FOREIGN KEY (productId) REFERENCES products (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;



-- ============================================================
-- STEP 5 — devis
-- ============================================================

CREATE TABLE IF NOT EXISTS devis (
    id             INT           NOT NULL AUTO_INCREMENT,
    userId         INT           NOT NULL,   -- matches users.id (signed INT)
    items          JSON          NOT NULL,
    message        TEXT          DEFAULT NULL,
    dateEvenement  VARCHAR(20)   DEFAULT NULL,
    nombreJours    SMALLINT      DEFAULT NULL,
    delivery       JSON          DEFAULT NULL,
    pickup         JSON          DEFAULT NULL,
    codePromo      VARCHAR(20)   DEFAULT NULL,
    totalFinal     DECIMAL(10,2) DEFAULT NULL,
    status         ENUM('pending','processing','sent','rejected') DEFAULT 'pending',
    adminNote      TEXT          DEFAULT NULL,
    createdAt      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_userId             (userId),
    INDEX idx_status             (status),
    INDEX idx_createdAt          (createdAt),
    INDEX idx_devis_userId_status      (userId, status),
    INDEX idx_devis_status_createdAt   (status, createdAt),
    CONSTRAINT fk_devis_userId FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;



-- ============================================================
-- STEP 6 — inspirations
-- ============================================================

CREATE TABLE IF NOT EXISTS inspirations (
    id        INT          NOT NULL AUTO_INCREMENT,
    url       VARCHAR(500) NOT NULL,
    filename  VARCHAR(255) NOT NULL,
    alt       VARCHAR(255) DEFAULT NULL,
    createdAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;



-- ============================================================
-- STEP 7 — contact_messages
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_messages (
    id        INT          NOT NULL AUTO_INCREMENT,
    name      VARCHAR(255) NOT NULL,
    email     VARCHAR(255) NOT NULL,
    sujet     VARCHAR(255) NOT NULL,
    message   TEXT         NOT NULL,
    `read`    TINYINT(1)   NOT NULL DEFAULT 0,
    createdAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;