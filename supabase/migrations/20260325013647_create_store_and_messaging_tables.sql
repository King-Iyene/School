/*
  # Create Online Store and Messaging Tables

  ## New Tables

  ### Online Store
  - `store_categories` - product categories (uniforms, books, stationery, etc.)
  - `store_products` - products for sale with pricing, stock, and images
  - `store_orders` - orders placed by students/parents
  - `store_order_items` - line items within each order

  ### Messaging
  - `messages` - internal school messaging (inbox/sent)
  - `whatsapp_logs` - WhatsApp message logs (inbound/outbound)

  ## Security
  - RLS enabled on all tables
  - Super admins can manage everything
  - Students and parents can view products and place orders
  - Users can read/send their own messages
*/

-- ─── Store Categories ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE store_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view store categories"
  ON store_categories FOR SELECT
  TO authenticated
  USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Super admins can insert store categories"
  ON store_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Super admins can update store categories"
  ON store_categories FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins can delete store categories"
  ON store_categories FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ─── Store Products ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  category_id  uuid REFERENCES store_categories(id) ON DELETE SET NULL,
  name         text NOT NULL,
  description  text DEFAULT '',
  price        numeric(10,2) NOT NULL DEFAULT 0,
  stock_qty    integer NOT NULL DEFAULT 0,
  image_url    text DEFAULT '',
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active products"
  ON store_products FOR SELECT
  TO authenticated
  USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Super admins can insert products"
  ON store_products FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins can update products"
  ON store_products FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins can delete products"
  ON store_products FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ─── Store Orders ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  ordered_by   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','ready','delivered','cancelled')),
  notes        text DEFAULT '',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE store_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
  ON store_orders FOR SELECT
  TO authenticated
  USING (ordered_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','accountant')));

CREATE POLICY "Users can place orders"
  ON store_orders FOR INSERT
  TO authenticated
  WITH CHECK (ordered_by = auth.uid());

CREATE POLICY "Admins can update order status"
  ON store_orders FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','accountant')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','accountant')));

CREATE POLICY "Admins can delete orders"
  ON store_orders FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ─── Store Order Items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES store_products(id) ON DELETE RESTRICT,
  quantity    integer NOT NULL DEFAULT 1,
  unit_price  numeric(10,2) NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE store_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items of their own orders"
  ON store_order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM store_orders
      WHERE store_orders.id = store_order_items.order_id
      AND (store_orders.ordered_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','accountant')))
    )
  );

CREATE POLICY "Users can insert order items for their own orders"
  ON store_order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM store_orders WHERE id = order_id AND ordered_by = auth.uid())
  );

CREATE POLICY "Admins can delete order items"
  ON store_order_items FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ─── Internal Messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  broadcast    boolean NOT NULL DEFAULT false,
  subject      text NOT NULL DEFAULT '',
  body         text NOT NULL DEFAULT '',
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages they sent or received"
  ON messages FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR broadcast = true
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Authenticated users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Recipients can mark messages as read"
  ON messages FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (recipient_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Senders and admins can delete messages"
  ON messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ─── WhatsApp Logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  contact_name text DEFAULT '',
  message     text NOT NULL,
  direction   text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound')),
  status      text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','failed','received')),
  sent_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and teachers can view WhatsApp logs"
  ON whatsapp_logs FOR SELECT
  TO authenticated
  USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','teacher'))
  );

CREATE POLICY "Admins and teachers can insert WhatsApp logs"
  ON whatsapp_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','teacher'))
  );

CREATE POLICY "Admins can delete WhatsApp logs"
  ON whatsapp_logs FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_store_products_school ON store_products(school_id);
CREATE INDEX IF NOT EXISTS idx_store_products_category ON store_products(category_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_school ON store_orders(school_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_user ON store_orders(ordered_by);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_school ON whatsapp_logs(school_id);

-- ─── Seed default store categories ───────────────────────────────────────────
INSERT INTO store_categories (school_id, name, description)
SELECT (SELECT id FROM schools LIMIT 1), 'Uniforms', 'School uniforms, PE kits and sportswear'
WHERE NOT EXISTS (SELECT 1 FROM store_categories WHERE school_id = (SELECT id FROM schools LIMIT 1) AND name = 'Uniforms');

INSERT INTO store_categories (school_id, name, description)
SELECT (SELECT id FROM schools LIMIT 1), 'Textbooks', 'Approved textbooks and workbooks'
WHERE NOT EXISTS (SELECT 1 FROM store_categories WHERE school_id = (SELECT id FROM schools LIMIT 1) AND name = 'Textbooks');

INSERT INTO store_categories (school_id, name, description)
SELECT (SELECT id FROM schools LIMIT 1), 'Stationery', 'Exercise books, pens, pencils and supplies'
WHERE NOT EXISTS (SELECT 1 FROM store_categories WHERE school_id = (SELECT id FROM schools LIMIT 1) AND name = 'Stationery');

INSERT INTO store_categories (school_id, name, description)
SELECT (SELECT id FROM schools LIMIT 1), 'Sports Equipment', 'Sports gear and equipment'
WHERE NOT EXISTS (SELECT 1 FROM store_categories WHERE school_id = (SELECT id FROM schools LIMIT 1) AND name = 'Sports Equipment');
