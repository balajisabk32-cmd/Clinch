const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'dealflow360.sqlite');
const db = new Database(dbPath);

// Register PostgreSQL compatibility functions
db.function('NOW', () => new Date().toISOString());

// Create schema and seed if not present
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      company TEXT,
      tier TEXT DEFAULT 'bronze',
      tier_spend REAL DEFAULT 0,
      gold_threshold REAL DEFAULT 100000,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT,
      description TEXT,
      category TEXT CHECK(category IN ('Hardware', 'Software')),
      image_url TEXT,
      base_price REAL NOT NULL,
      original_price REAL,
      sale_badge TEXT,
      bronze_price REAL,
      silver_price REAL,
      gold_price REAL,
      rating REAL DEFAULT 4.8,
      review_count INTEGER DEFAULT 0,
      stock INTEGER DEFAULT 100,
      is_popular INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      variant_type TEXT,
      variant_value TEXT,
      price_modifier REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      reviewer_name TEXT,
      rating INTEGER,
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
      quantity INTEGER DEFAULT 1,
      suggested_discount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(customer_id, product_id, variant_id)
    );

    CREATE TABLE IF NOT EXISTS wishlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(customer_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      quote_number TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending_review',
      total_amount REAL DEFAULT 0,
      discount_applied REAL DEFAULT 0,
      rep_notes TEXT,
      discount_request_status TEXT DEFAULT NULL,
      requested_discount REAL DEFAULT NULL,
      counter_discount REAL DEFAULT NULL,
      counter_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      discount_pct REAL DEFAULT 0,
      customer_comment TEXT,
      rep_comment TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
      order_number TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'processing',
      warehouse_info TEXT DEFAULT '[]',
      estimated_delivery TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  try { db.exec("ALTER TABLE quotations ADD COLUMN discount_request_status TEXT DEFAULT NULL"); } catch {}
  try { db.exec("ALTER TABLE quotations ADD COLUMN requested_discount REAL DEFAULT NULL"); } catch {}
  try { db.exec("ALTER TABLE quotations ADD COLUMN counter_discount REAL DEFAULT NULL"); } catch {}
  try { db.exec("ALTER TABLE quotations ADD COLUMN counter_notes TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN assigned_rep_id TEXT DEFAULT NULL"); } catch {}
  try { db.exec("ALTER TABLE quotations ADD COLUMN assigned_rep_id TEXT DEFAULT NULL"); } catch {}
  try { db.exec("ALTER TABLE quotations ADD COLUMN source TEXT DEFAULT 'Rep Created'"); } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS quote_reassignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_ref TEXT NOT NULL,
      customer_id INTEGER,
      old_rep_id TEXT,
      new_rep_id TEXT NOT NULL,
      reassigned_by TEXT NOT NULL,
      permanent_customer_update INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Default permanent account owner assignments for existing customer records
  try {
    db.prepare("UPDATE customers SET assigned_rep_id = 'rep_rao' WHERE email = 'rajesh@acme.com' AND (assigned_rep_id IS NULL OR assigned_rep_id = '')").run();
    db.prepare("UPDATE customers SET assigned_rep_id = 'rep_iyer' WHERE email = 'priya@techcorp.com' AND (assigned_rep_id IS NULL OR assigned_rep_id = '')").run();
    db.prepare("UPDATE quotations SET assigned_rep_id = 'rep_rao', source = 'Customer Request' WHERE assigned_rep_id IS NULL").run();
  } catch (err) {}

  // Check if we need to reset & reseed with Hardware and Software products and sample orders
  const count = db.prepare("SELECT COUNT(*) as cnt FROM products WHERE category IN ('Hardware', 'Software')").get();
  const sampleOrder = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE order_number = 'ORD-2024-002'").get();
  const sampleQuote5 = db.prepare("SELECT COUNT(*) as cnt FROM quotations WHERE quote_number = 'QT-2024-005'").get();
  if (count.cnt < 10 || sampleOrder.cnt === 0 || sampleQuote5.cnt === 0) {
    seedData();
  }
}

function seedData() {
  console.log('🌱 Reseeding SQLite database with Hardware & Software categories...');
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('password123', 10);

  // Clear products, variants, cart, quotes for clean state
  db.pragma('foreign_keys = OFF');
  db.exec(`
    DELETE FROM cart_items;
    DELETE FROM wishlist_items;
    DELETE FROM quotation_items;
    DELETE FROM quotations;
    DELETE FROM orders;
    DELETE FROM product_reviews;
    DELETE FROM product_variants;
    DELETE FROM products;
    DELETE FROM customers;
    DELETE FROM notifications;
    DELETE FROM sqlite_sequence;
  `);

  // Customers
  const insertCustomer = db.prepare('INSERT INTO customers (name, email, password_hash, company, tier, tier_spend, gold_threshold) VALUES (?,?,?,?,?,?,?)');
  insertCustomer.run('Rajesh Kumar', 'rajesh@acme.com', hash, 'Acme Enterprises Pvt. Ltd.', 'silver', 72000, 100000);
  insertCustomer.run('Priya Sharma', 'priya@techcorp.com', hash, 'TechCorp Solutions', 'gold', 105000, 100000);
  insertCustomer.run('demo', 'demo@demo.com', hash, 'Demo Company', 'bronze', 15000, 100000);

  // Products statement
  const insertProduct = db.prepare(`
    INSERT INTO products (
      name, brand, description, category, image_url, base_price, original_price, sale_badge,
      bronze_price, silver_price, gold_price, rating, review_count, stock, is_popular
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  // ==========================================
  // HARDWARE PRODUCTS
  // ==========================================
  insertProduct.run(
    'Apple iPhone 16 Pro 128GB Titanium',
    'Apple',
    'Grade 5 titanium design with Ceramic Shield. A18 Pro chip, 48MP Fusion camera system with 4K 120 fps Dolby Vision recording, and next-gen battery life for enterprise mobile teams.',
    'Hardware',
    'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600',
    1130, 1299, 'Sale 15%',
    1130, 1020, 940, 4.8, 184, 85, 1
  );

  insertProduct.run(
    'Apple AirPods Max Space Gray',
    'Apple',
    'High-fidelity audio with industry-standard Active Noise Cancellation and Transparency mode. Computational audio with H1 chips in each cup for crystal-clear conference calls.',
    'Hardware',
    'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600',
    549, 599, 'Sale 10%',
    549, 499, 449, 4.9, 230, 40, 1
  );

  insertProduct.run(
    'Dell Precision 7780 Workstation',
    'Dell',
    'Intel Core i9-13950HX, 64GB DDR5 ECC RAM, NVIDIA RTX 5000 Ada 16GB GPU, and 2TB NVMe PCIe 4.0 SSD. ISV-certified for CAD, deep learning, and engineering simulations.',
    'Hardware',
    'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600',
    2850, 3199, 'Sale 12%',
    2850, 2590, 2350, 4.7, 76, 30, 1
  );

  insertProduct.run(
    'Logitech MX Keys & Master 3S Enterprise Combo',
    'Logitech',
    'Advanced wireless backlit keyboard paired with 8000 DPI Quiet Click mouse. Multi-OS Flow technology for cross-computer file transfer and typing comfort.',
    'Hardware',
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600',
    219, 269, 'Sale 20%',
    219, 195, 175, 4.9, 412, 120, 1
  );

  insertProduct.run(
    'Sony WH-1000XM5 ANC Headset',
    'Sony',
    'Dual processor noise-cancelling engine with 8 microphones for superior enterprise voice clarity. 30-hour battery life with ultra-fast USB-PD quick charging.',
    'Hardware',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
    399, 449, 'Sale 15%',
    399, 359, 319, 4.8, 520, 65, 1
  );

  insertProduct.run(
    'Cisco Catalyst 9300 48-Port PoE+ Switch',
    'Cisco',
    'Stackable enterprise-class access layer switch with Cisco DNA software subscription. 48 Gigabit Ethernet ports with 437W PoE+ budget for high-density corporate networks.',
    'Hardware',
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600',
    4200, 4800, 'Enterprise',
    4200, 3780, 3450, 4.9, 42, 20, 0
  );

  insertProduct.run(
    'Samsung Odyssey Neo G9 49" Curved Display',
    'Samsung',
    'Quantum Mini-LED 5120x1440 Dual QHD panel with 1000R curvature and 240Hz refresh rate. Replaces dual monitors for financial traders and system administrators.',
    'Hardware',
    'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600',
    1499, 1799, 'Sale 15%',
    1499, 1349, 1220, 4.6, 95, 25, 0
  );

  insertProduct.run(
    'Lenovo ThinkPad P1 Gen 7 Mobile Workstation',
    'Lenovo',
    'Ultra-thin carbon fiber chassis, Intel Core Ultra 9 vPro, 32GB LPDDR5x, and NVIDIA RTX 3000 Ada GPU. Built-in biometric security and MIL-SPEC durability.',
    'Hardware',
    'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=600',
    2450, 2799, 'Sale 10%',
    2450, 2200, 1980, 4.7, 88, 35, 1
  );

  // ==========================================
  // SOFTWARE PRODUCTS
  // ==========================================
  insertProduct.run(
    'Microsoft 365 Enterprise E5 (Annual License)',
    'Microsoft',
    'Comprehensive productivity cloud with advanced security, compliance, voice, and analytical capabilities. Includes full desktop Office suite, Teams Phone, and Power BI Pro.',
    'Software',
    'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=600',
    450, 520, 'Sale 15%',
    450, 405, 360, 4.8, 340, 500, 1
  );

  insertProduct.run(
    'CrowdStrike Falcon Enterprise Security Platform',
    'CrowdStrike',
    'AI-native cloud workload and endpoint protection platform. Real-time threat prevention, automated remediation, and zero-day breach prevention with single lightweight agent.',
    'Software',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600',
    1850, 2100, 'Hot',
    1850, 1665, 1480, 5.0, 112, 300, 1
  );

  insertProduct.run(
    'Oracle Database 23ai Enterprise Cloud Edition',
    'Oracle',
    'Next-generation converged database with AI Vector Search, JSON Relational Duality, and automated in-memory column store for mission-critical transactional and analytical workloads.',
    'Software',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600',
    3500, 3950, 'Enterprise',
    3500, 3150, 2800, 4.7, 64, 150, 0
  );

  insertProduct.run(
    'AWS Cloud Architecture & DevSecOps Suite',
    'AWS',
    'Managed multi-account governance, automated CI/CD security pipelines, and consolidated billing optimization dashboard for enterprise cloud infrastructure.',
    'Software',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600',
    1200, 1400, 'Sale 15%',
    1200, 1080, 960, 4.9, 185, 400, 1
  );

  insertProduct.run(
    'JetBrains All Products Pack Enterprise Subscription',
    'JetBrains',
    'Unlimited team access to 16 professional IDEs including IntelliJ IDEA Ultimate, PyCharm, WebStorm, and ReSharper with team-wide remote development tools.',
    'Software',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600',
    779, 899, 'Sale 12%',
    779, 700, 620, 4.9, 430, 250, 1
  );

  insertProduct.run(
    'VMware vSphere Enterprise Plus Hypervisor',
    'VMware',
    'The foundational private cloud virtualization platform. Dynamic Resource Scheduling (DRS), vMotion, Fault Tolerance, and containerized Kubernetes pod orchestration.',
    'Software',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600',
    2950, 3300, 'Sale 10%',
    2950, 2650, 2360, 4.6, 92, 100, 0
  );

  // Variants
  const insertVariant = db.prepare('INSERT INTO product_variants (product_id, variant_type, variant_value, price_modifier) VALUES (?,?,?,?)');
  insertVariant.run(1, 'Storage', '128GB', 0);
  insertVariant.run(1, 'Storage', '256GB', 100);
  insertVariant.run(1, 'Storage', '512GB', 250);
  insertVariant.run(2, 'Color', 'Space Gray', 0);
  insertVariant.run(2, 'Color', 'Silver', 0);
  insertVariant.run(3, 'RAM', '64GB ECC', 0);
  insertVariant.run(3, 'RAM', '128GB ECC', 600);
  insertVariant.run(9, 'Subscription', '1 Year (10 Users)', 0);
  insertVariant.run(9, 'Subscription', '1 Year (50 Users)', 1800);

  // Reviews
  const insertReview = db.prepare('INSERT INTO product_reviews (product_id, reviewer_name, rating, comment) VALUES (?,?,?,?)');
  insertReview.run(1, 'Amit Verma', 5, 'Exceptional build quality and battery performance. Flawless deployment for our executive team.');
  insertReview.run(1, 'Sneha Patel', 5, 'Superb camera and video conferencing capabilities.');
  insertReview.run(2, 'Vikram Nair', 5, 'Noise cancellation in open office floor is unbeatable.');
  insertReview.run(9, 'David Miller', 5, 'Seamless enterprise deployment. All tools in one centralized security bundle.');
  insertReview.run(10, 'Robert Chen', 5, 'Industry gold standard endpoint detection and zero-day response.');

  // Sample quotations
  const insertQuote = db.prepare(`
    INSERT INTO quotations (
      customer_id, quote_number, status, total_amount, discount_applied, rep_notes,
      discount_request_status, requested_discount, counter_discount, counter_notes
    ) VALUES (?,?,?,?,?,?,?,?,?,?)
  `);
  // QT-2024-001: Manager Approved (State 3 / 4)
  insertQuote.run(1, 'QT-2024-001', 'sent', 4520, 8, 'Hi Rajesh, here is the approved proposal for your workstation and cloud license renewal.', null, null, null, null);

  // QT-2024-002: In Negotiation with counter offer from manager (12% counter offer)
  insertQuote.run(1, 'QT-2024-002', 'under_negotiation', 12350, 10, 'Applied Silver tier bulk pricing for your corporate iPhone and security roll-out.', 'counter_offer', 15, 12, 'Sales Manager can approve a 12% bulk discount for 4x Precision Workstations.');

  // QT-2024-003: Fulfillment (State 6)
  insertQuote.run(1, 'QT-2024-003', 'fulfillment', 6780, 12, 'Quotation confirmed! Warehouse is preparing hardware dispatch.', null, null, null, null);

  // QT-2024-004: Waiting for initial Sales Manager Approval (State 2: Awaiting Sales Manager Approval)
  insertQuote.run(1, 'QT-2024-004', 'pending_review', 24850, 0, 'Quotation submitted for enterprise engineering batch. Awaiting initial Sales Manager commercial sign-off.', null, null, null, null);

  // QT-2024-005: In Negotiation with active discount request (State 4 + Discount Request pending_approval)
  insertQuote.run(1, 'QT-2024-005', 'under_negotiation', 18900, 10, 'Engineering department expansion proposal under commercial discussion.', 'pending_approval', 18, null, null);

  // Quotation items
  const insertItem = db.prepare('INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, discount_pct, customer_comment, rep_comment) VALUES (?,?,?,?,?,?,?,?)');
  insertItem.run(1, 1, 'Apple iPhone 16 Pro 128GB Titanium', 3, 1020, 8, null, null);
  insertItem.run(1, 9, 'Microsoft 365 Enterprise E5 (Annual License)', 5, 405, 8, null, null);
  insertItem.run(2, 3, 'Dell Precision 7780 Workstation', 4, 2590, 10, 'Can we include 3-year ProSupport warranty?', 'Yes, ProSupport Plus is bundled at no extra cost.');
  insertItem.run(3, 10, 'CrowdStrike Falcon Enterprise Security Platform', 4, 1665, 12, null, null);

  // Items for QT-2024-004 (Waiting for initial manager approval)
  insertItem.run(4, 3, 'Dell Precision 7780 Workstation', 5, 2850, 0, null, 'Submitted for Sales Manager commercial sign-off.');
  insertItem.run(4, 10, 'CrowdStrike Falcon Enterprise Security Platform', 10, 1850, 0, null, 'Requires executive discount sign-off.');

  // Items for QT-2024-005 (In negotiation with 18% requested discount)
  insertItem.run(5, 8, 'Lenovo ThinkPad P1 Gen 7 Mobile Workstation', 6, 2450, 10, 'Requested 18% discount for engineering batch', 'Reviewing volume threshold with director.');
  insertItem.run(5, 6, 'Cisco Catalyst 9300 48-Port PoE+ Switch', 2, 4200, 10, null, null);

  // Orders
  const insertOrder = db.prepare('INSERT INTO orders (customer_id, quotation_id, order_number, status, warehouse_info, estimated_delivery) VALUES (?,?,?,?,?,?)');
  insertOrder.run(
    1, 3, 'ORD-2024-001', 'shipped',
    JSON.stringify([{ warehouse: 'Tech Logistics Depot', code: 'TLD-US-EAST', items: ['CrowdStrike Enterprise License Keys'] }]),
    '2026-09-15'
  );

  // Static example order waiting for manager approval
  insertOrder.run(
    1, 4, 'ORD-2024-002', 'pending_approval',
    JSON.stringify([{ warehouse: 'Awaiting Manager Commercial Release', code: 'HOLD-MGR-APPV', items: ['Dell Precision Workstations x5', 'CrowdStrike Enterprise Licenses x10'] }]),
    '2026-09-22'
  );

  // Notifications
  const insertNotif = db.prepare('INSERT INTO notifications (customer_id, message, type, is_read) VALUES (?,?,?,?)');
  insertNotif.run(1, '🎉 Welcome to Silver Tier! 10% auto-discount is applied on all Hardware & Software.', 'upgrade', 0);
  insertNotif.run(1, '📋 Quotation QT-2024-001 is available for your review.', 'info', 0);
  insertNotif.run(1, '👔 Order ORD-2024-002 is currently waiting for Senior Sales Manager approval.', 'warning', 0);
  insertNotif.run(1, '💬 Sales representative replied to your inquiry on QT-2024-002.', 'info', 0);

  db.pragma('foreign_keys = ON');
  console.log('✅ SQLite database reseeding complete!');
}

initDb();

// Transform PostgreSQL queries to SQLite and remap positional parameters
function translateSqlAndParams(sql, params = []) {
  const newParams = [];
  const sanitized = params.map((p) => (p instanceof Date ? p.toISOString() : p));
  let s = sql.replace(/\$(\d+)/g, (_, numStr) => {
    const idx = parseInt(numStr, 10) - 1;
    newParams.push(sanitized[idx]);
    return '?';
  });
  s = s.replace(/\bILIKE\b/gi, 'LIKE');
  s = s.replace(/\bIS\s+NOT\s+DISTINCT\s+FROM\b/gi, 'IS');
  s = s.replace(/::[a-zA-Z0-9_]+/g, '');
  return { sql: s, params: newParams };
}

// Pool adapter implementing pg interface
const sqlitePool = {
  query: async (text, params = []) => {
    const { sql: translated, params: finalParams } = translateSqlAndParams(text, params);
    const trimmed = translated.trim();
    const isSelect = /^(SELECT|WITH)/i.test(trimmed);
    const hasReturning = /\bRETURNING\b/i.test(trimmed);

    try {
      const stmt = db.prepare(translated);
      if (isSelect || hasReturning) {
        const rows = stmt.all(...finalParams);
        for (const row of rows) {
          if (row['COUNT(*)'] !== undefined && row.count === undefined) {
            row.count = row['COUNT(*)'];
          }
        }
        return {
          rows,
          rowCount: rows.length,
        };
      } else {
        const info = stmt.run(...finalParams);
        return {
          rows: [],
          rowCount: info.changes,
          insertId: info.lastInsertRowid,
        };
      }
    } catch (err) {
      console.error('SQLite query error:', err.message, '\nSQL:', translated, '\nParams:', params);
      throw err;
    }
  },

  connect: async () => {
    return {
      query: async (text, params = []) => {
        const trimmed = text.trim().toUpperCase();
        if (trimmed === 'BEGIN') {
          db.exec('BEGIN TRANSACTION');
          return { rows: [], rowCount: 0 };
        }
        if (trimmed === 'COMMIT') {
          db.exec('COMMIT');
          return { rows: [], rowCount: 0 };
        }
        if (trimmed === 'ROLLBACK') {
          try { db.exec('ROLLBACK'); } catch {}
          return { rows: [], rowCount: 0 };
        }
        return sqlitePool.query(text, params);
      },
      release: () => {},
    };
  },
};

module.exports = sqlitePool;
