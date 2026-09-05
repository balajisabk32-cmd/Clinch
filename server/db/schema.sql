-- ============================================================
--  DealFlow360 — Full Database Schema + Seed Data
-- ============================================================

-- Drop existing tables (for re-seeding)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS order_tracking CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS quotation_items CASCADE;
DROP TABLE IF EXISTS quotations CASCADE;
DROP TABLE IF EXISTS wishlist_items CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company VARCHAR(200),
  tier VARCHAR(20) DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold')),
  tier_spend NUMERIC(12,2) DEFAULT 0,
  gold_threshold NUMERIC(12,2) DEFAULT 100000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  image_url TEXT,
  base_price NUMERIC(10,2) NOT NULL,
  bronze_price NUMERIC(10,2),
  silver_price NUMERIC(10,2),
  gold_price NUMERIC(10,2),
  rating NUMERIC(3,2) DEFAULT 4.0,
  review_count INT DEFAULT 0,
  stock INT DEFAULT 100,
  is_popular BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCT VARIANTS
-- ============================================================
CREATE TABLE product_variants (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id) ON DELETE CASCADE,
  variant_type VARCHAR(50),
  variant_value VARCHAR(100),
  price_modifier NUMERIC(10,2) DEFAULT 0
);

-- ============================================================
-- PRODUCT REVIEWS
-- ============================================================
CREATE TABLE product_reviews (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id) ON DELETE CASCADE,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  reviewer_name VARCHAR(100),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CART ITEMS
-- ============================================================
CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE CASCADE,
  variant_id INT REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INT DEFAULT 1,
  suggested_discount NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, product_id, variant_id)
);

-- ============================================================
-- WISHLIST ITEMS
-- ============================================================
CREATE TABLE wishlist_items (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);

-- ============================================================
-- QUOTATIONS
-- ============================================================
CREATE TABLE quotations (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  quote_number VARCHAR(30) UNIQUE NOT NULL,
  status VARCHAR(40) DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','sent','under_negotiation','confirmed','re_entering_approval','fulfillment','delivered')),
  total_amount NUMERIC(12,2) DEFAULT 0,
  discount_applied NUMERIC(5,2) DEFAULT 0,
  rep_notes TEXT,
  discount_request_status VARCHAR(40) DEFAULT NULL,
  requested_discount NUMERIC(5,2) DEFAULT NULL,
  counter_discount NUMERIC(5,2) DEFAULT NULL,
  counter_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QUOTATION LINE ITEMS
-- ============================================================
CREATE TABLE quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INT REFERENCES quotations(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(200),
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  discount_pct NUMERIC(5,2) DEFAULT 0,
  customer_comment TEXT,
  rep_comment TEXT
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  quotation_id INT REFERENCES quotations(id) ON DELETE SET NULL,
  order_number VARCHAR(30) UNIQUE NOT NULL,
  status VARCHAR(30) DEFAULT 'processing'
    CHECK (status IN ('processing','warehouse_assigned','shipped','delivered')),
  warehouse_info JSONB DEFAULT '[]',
  estimated_delivery DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type VARCHAR(30) DEFAULT 'info' CHECK (type IN ('info','success','warning','upgrade')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Customers (password: password123)
INSERT INTO customers (name, email, password_hash, company, tier, tier_spend, gold_threshold) VALUES
('Rajesh Kumar', 'rajesh@acme.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Acme Enterprises Pvt. Ltd.', 'silver', 72000, 100000),
('Priya Sharma', 'priya@techcorp.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'TechCorp Solutions', 'gold', 105000, 100000),
('demo', 'demo@demo.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo Company', 'bronze', 15000, 100000);

-- Products
INSERT INTO products (name, description, category, image_url, base_price, bronze_price, silver_price, gold_price, rating, review_count, stock, is_popular) VALUES
('Logitech MX Keys Business Keyboard',
 'Advanced wireless keyboard designed for business professionals. Multi-device connectivity, backlit keys, and ergonomic design for all-day typing comfort. Compatible with Windows, macOS, and Linux.',
 'Electronics',
 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600',
 8500, 8500, 7650, 6800, 4.5, 128, 50, TRUE),

('Anker 13-in-1 USB-C Hub',
 'The ultimate docking station for your laptop. Includes 4K HDMI, 100W Power Delivery, SD card reader, 3x USB-A 3.0, 2x USB-C, Ethernet, and audio jack — all from a single USB-C port.',
 'Electronics',
 'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=600',
 5200, 5200, 4680, 4160, 4.3, 89, 75, FALSE),

('Sony WH-1000XM5 Noise Cancelling Headphones',
 'Industry-leading noise cancellation with 30-hour battery life. Crystal clear hands-free calling with 4 microphones. Perfect for open offices and remote work environments.',
 'Electronics',
 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
 29000, 29000, 26100, 23200, 4.8, 245, 30, TRUE),

('HP ScanJet Pro 3600 f1',
 'High-speed flatbed and document feeder scanner. Scans up to 40 pages per minute. Perfect for digitizing contracts, invoices, and business documents at scale.',
 'Electronics',
 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600',
 18500, 18500, 16650, 14800, 4.1, 56, 20, FALSE),

('Classmate Premium Notebook Pack (10 pcs)',
 'Pack of 10 premium hardcover notebooks with 200 pages each. Acid-free paper, lay-flat binding, and elastic closure. Ideal for meetings, brainstorming, and field notes.',
 'Office Supplies',
 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600',
 1200, 1200, 1080, 960, 4.2, 312, 200, FALSE),

('Herman Miller Aeron Ergonomic Chair',
 'The gold standard in ergonomic office seating. Fully adjustable lumbar support, tilt mechanism, and breathable mesh back. Designed for 8+ hour workdays. Reduces back pain and improves posture.',
 'Office Supplies',
 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600',
 85000, 85000, 76500, 68000, 4.9, 178, 15, TRUE),

('FlexiSpot E7 Standing Desk Converter',
 'Motorized sit-stand desk converter with dual monitor support. Height adjustable from 70cm to 120cm. Includes USB charging port and integrated cable management system.',
 'Office Supplies',
 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600',
 45000, 45000, 40500, 36000, 4.4, 92, 25, FALSE),

('Honeywell Cut-Resistant Safety Gloves (50 Pack)',
 'Level 5 cut resistance with anti-slip grip coating. Compliant with EN 388:2016 and ANSI/ISEA 105-2016 standards. Suitable for manufacturing, logistics, and construction environments.',
 'Industrial',
 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
 3500, 3500, 3150, 2800, 4.3, 67, 500, FALSE),

('Zebra ZT411 Industrial Label Printer',
 'High-performance thermal transfer and direct thermal label printer. Prints labels up to 168mm wide at 300 dpi. Built-in Ethernet, Wi-Fi, and Bluetooth. Perfect for warehouse and logistics operations.',
 'Industrial',
 'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=600',
 42000, 42000, 37800, 33600, 4.6, 43, 10, TRUE),

('Godrej Interio Heavy-Duty Storage Rack',
 'Industrial-grade steel storage rack with 5-tier adjustable shelving. Supports up to 500kg per shelf. Powder-coated finish for rust resistance. Easy assembly with no tools required.',
 'Industrial',
 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=600',
 12500, 12500, 11250, 10000, 4.0, 134, 40, FALSE);

-- Product Variants
INSERT INTO product_variants (product_id, variant_type, variant_value, price_modifier) VALUES
(1, 'Connectivity', 'Bluetooth Only', 0),
(1, 'Connectivity', 'Bluetooth + USB Receiver', 500),
(5, 'Pack Size', '10 Notebooks', 0),
(5, 'Pack Size', '25 Notebooks', 2500),
(5, 'Pack Size', '50 Notebooks', 4800),
(8, 'Size', 'Small (S)', 0),
(8, 'Size', 'Medium (M)', 0),
(8, 'Size', 'Large (L)', 0),
(8, 'Size', 'X-Large (XL)', 0),
(9, 'Print Resolution', '203 dpi', -5000),
(9, 'Print Resolution', '300 dpi', 0),
(9, 'Print Resolution', '600 dpi', 8000);

-- Product Reviews
INSERT INTO product_reviews (product_id, reviewer_name, rating, comment, created_at) VALUES
(1, 'Amit Verma', 5, 'Excellent keyboard! The backlight is perfect for late-night work. Battery lasts weeks.', NOW() - INTERVAL '10 days'),
(1, 'Sneha Patel', 4, 'Great build quality. Multi-device switching is seamless. Slightly pricey but worth it.', NOW() - INTERVAL '25 days'),
(1, 'Rohit Mehta', 5, 'Best keyboard I have ever used. My productivity has improved significantly.', NOW() - INTERVAL '45 days'),
(3, 'Kavya Singh', 5, 'Noise cancellation is absolutely phenomenal. Can work in a noisy café without any distraction.', NOW() - INTERVAL '5 days'),
(3, 'Vikram Nair', 4, 'Sound quality is top-notch. Battery life is impressive. ANC could be slightly stronger.', NOW() - INTERVAL '20 days'),
(6, 'Deepa Krishnan', 5, 'Transformed my work-from-home setup. Back pain gone after switching to this chair!', NOW() - INTERVAL '15 days'),
(6, 'Suresh Babu', 5, 'Worth every rupee. Premium quality that will last for decades. Highly recommended.', NOW() - INTERVAL '30 days');

-- Quotations for Rajesh (customer_id = 1)
INSERT INTO quotations (customer_id, quote_number, status, total_amount, discount_applied, rep_notes, created_at) VALUES
(1, 'QT-2024-001', 'sent', 45200, 5, 'Hi Rajesh, please review the attached quote for your office expansion requirements.', NOW() - INTERVAL '7 days'),
(1, 'QT-2024-002', 'under_negotiation', 123500, 8, 'We have applied a special Silver tier discount. Please review and let us know if you need further adjustments.', NOW() - INTERVAL '3 days'),
(1, 'QT-2024-003', 'fulfillment', 67800, 10, 'Thank you for confirming! Your order is now in fulfillment.', NOW() - INTERVAL '15 days'),
(1, 'QT-2024-004', 're_entering_approval', 24850, 18, 'Customer requested 18% special volume discount for Q4 engineering expansion. Queued for Senior Sales Manager executive approval.', NOW() - INTERVAL '1 day');

-- Quotation Items for QT-2024-001
INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, discount_pct, rep_comment) VALUES
(1, 1, 'Logitech MX Keys Business Keyboard', 5, 7650, 5, NULL),
(1, 2, 'Anker 13-in-1 USB-C Hub', 3, 4680, 5, NULL),
(1, 5, 'Classmate Premium Notebook Pack (10 pcs)', 10, 1080, 5, NULL);

-- Quotation Items for QT-2024-002
INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, discount_pct, customer_comment, rep_comment) VALUES
(2, 6, 'Herman Miller Aeron Ergonomic Chair', 1, 76500, 8, 'Can we get a better price for 2 units?', 'For 2 units, we can offer 12% discount total.'),
(2, 7, 'FlexiSpot E7 Standing Desk Converter', 1, 40500, 8, NULL, NULL),
(2, 9, 'Zebra ZT411 Industrial Label Printer', 1, 37800, 8, 'Need the 600 dpi version. Is this included?', 'Yes, this quote includes the 300 dpi version. Add ₹8,000 for 600 dpi upgrade.');

-- Quotation Items for QT-2024-003 (confirmed)
INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, discount_pct) VALUES
(3, 8, 'Honeywell Cut-Resistant Safety Gloves (50 Pack)', 10, 3150, 10),
(3, 10, 'Godrej Interio Heavy-Duty Storage Rack', 3, 11250, 10);

-- Quotation Items for QT-2024-004 (waiting for manager approval)
INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, discount_pct, customer_comment, rep_comment) VALUES
(4, 3, 'Dell Precision 7780 Workstation', 5, 2850, 18, 'Require 18% discount for bulk engineering batch', 'Requested discount exceeds standard 10% Silver threshold; routed to Sales Director.'),
(4, 10, 'CrowdStrike Falcon Enterprise Security Platform', 10, 1850, 18, 'Annual multi-endpoint security deployment', 'Awaiting executive discount sign-off.');

-- Orders
INSERT INTO orders (customer_id, quotation_id, order_number, status, warehouse_info, estimated_delivery, created_at) VALUES
(1, 3, 'ORD-2024-001', 'shipped',
 '[{"warehouse": "Mumbai Central Warehouse", "code": "MUM-WH-001", "items": ["Safety Gloves x10"]}, {"warehouse": "Pune Distribution Hub", "code": "PUN-WH-002", "items": ["Storage Rack x3"]}]'::jsonb,
 NOW() + INTERVAL '3 days', NOW() - INTERVAL '12 days'),
(1, 4, 'ORD-2024-002', 'pending_approval',
 '[{"warehouse": "Awaiting Manager Commercial Release", "code": "HOLD-MGR-APPV", "items": ["Dell Precision Workstations x5", "CrowdStrike Enterprise Licenses x10"]}]'::jsonb,
 NOW() + INTERVAL '7 days', NOW() - INTERVAL '1 day');

-- Notifications for Rajesh
INSERT INTO notifications (customer_id, message, type, is_read, created_at) VALUES
(1, '🎉 You have been upgraded to Silver Tier! Enjoy 10% off on all products.', 'upgrade', FALSE, NOW() - INTERVAL '20 days'),
(1, '📋 Your quotation QT-2024-001 has been sent by your sales rep. Review it now.', 'info', FALSE, NOW() - INTERVAL '7 days'),
(1, '💬 Your sales rep responded to your negotiation on QT-2024-002.', 'info', FALSE, NOW() - INTERVAL '1 day'),
(1, '👔 Order ORD-2024-002 is currently waiting for Senior Sales Manager approval.', 'warning', FALSE, NOW() - INTERVAL '12 hours'),
(1, '🚚 Your order ORD-2024-001 has been shipped! Track it in My Orders.', 'success', FALSE, NOW() - INTERVAL '5 days'),
(1, '🏆 You are ₹28,000 away from reaching Gold Tier! Keep ordering to unlock exclusive pricing.', 'upgrade', FALSE, NOW() - INTERVAL '10 days');

