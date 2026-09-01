/*
  # Inventory Management Tables

  ## New Tables

  1. `inventory_categories` - Item classification (Stationery, Furniture, Electronics, etc.)
  2. `inventory_stores` - Storage locations/warehouses
  3. `suppliers` - Vendor/supplier records
  4. `inventory_items` - Master item catalog with current stock levels
  5. `item_receives` - Stock incoming records (purchase from supplier)
  6. `item_sells` - Stock outgoing via sale
  7. `item_issues` - Stock issued internally to staff/students

  ## Security
  - RLS enabled on all tables
  - Super admin and accountant can manage inventory
  - All authenticated school members can view
*/

-- Item Categories
CREATE TABLE IF NOT EXISTS inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view inventory categories"
  ON inventory_categories FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert inventory categories"
  ON inventory_categories FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can update inventory categories"
  ON inventory_categories FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can delete inventory categories"
  ON inventory_categories FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Inventory Stores / Warehouses
CREATE TABLE IF NOT EXISTS inventory_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text DEFAULT '',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view stores"
  ON inventory_stores FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert stores"
  ON inventory_stores FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can update stores"
  ON inventory_stores FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can delete stores"
  ON inventory_stores FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Inventory Items (master catalog)
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  category_id uuid REFERENCES inventory_categories(id) ON DELETE SET NULL,
  store_id uuid REFERENCES inventory_stores(id) ON DELETE SET NULL,
  name text NOT NULL,
  item_code text DEFAULT '',
  unit text DEFAULT 'piece',
  current_stock integer DEFAULT 0,
  reorder_level integer DEFAULT 0,
  unit_price numeric(10,2) DEFAULT 0,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view inventory items"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert inventory items"
  ON inventory_items FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can update inventory items"
  ON inventory_items FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can delete inventory items"
  ON inventory_items FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Item Receives (stock in from supplier)
CREATE TABLE IF NOT EXISTS item_receives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 0,
  unit_price numeric(10,2) DEFAULT 0,
  total_price numeric(10,2) DEFAULT 0,
  receive_date date DEFAULT CURRENT_DATE,
  invoice_number text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE item_receives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view item receives"
  ON item_receives FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert item receives"
  ON item_receives FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can update item receives"
  ON item_receives FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can delete item receives"
  ON item_receives FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Item Sells (stock out via sale)
CREATE TABLE IF NOT EXISTS item_sells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  unit_price numeric(10,2) DEFAULT 0,
  total_price numeric(10,2) DEFAULT 0,
  sell_date date DEFAULT CURRENT_DATE,
  buyer_name text DEFAULT '',
  buyer_type text DEFAULT 'external' CHECK (buyer_type IN ('student', 'staff', 'external')),
  notes text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE item_sells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view item sells"
  ON item_sells FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert item sells"
  ON item_sells FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can update item sells"
  ON item_sells FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can delete item sells"
  ON item_sells FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Issue Items (internal use)
CREATE TABLE IF NOT EXISTS item_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  issued_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  issued_to_type text DEFAULT 'staff' CHECK (issued_to_type IN ('student', 'staff')),
  quantity integer NOT NULL DEFAULT 0,
  issue_date date DEFAULT CURRENT_DATE,
  return_date date,
  purpose text DEFAULT '',
  status text DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'lost')),
  notes text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE item_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view item issues"
  ON item_issues FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert item issues"
  ON item_issues FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant', 'teacher'));

CREATE POLICY "Admins can update item issues"
  ON item_issues FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant', 'teacher'));

CREATE POLICY "Admins can delete item issues"
  ON item_issues FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
