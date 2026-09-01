/*
  # Shop RLS Policies for Students and Parents

  Allow authenticated students and parents to:
  - Read active products from their school
  - Place orders (insert)
  - Read their own orders
*/

-- Allow all authenticated users in the school to read active products
CREATE POLICY "Students and parents can read active products"
  ON store_products FOR SELECT TO authenticated
  USING (
    active = true AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = store_products.school_id
    )
  );

-- Allow all authenticated users to place orders
CREATE POLICY "Authenticated users can place orders"
  ON store_orders FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = store_orders.school_id
    )
    AND ordered_by = auth.uid()
  );

-- Allow users to read their own orders
CREATE POLICY "Users can read own orders"
  ON store_orders FOR SELECT TO authenticated
  USING (
    ordered_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = store_orders.school_id
      AND profiles.role IN ('super_admin', 'admin', 'teacher')
    )
  );

-- Allow insert of order items
CREATE POLICY "Authenticated users can insert order items"
  ON store_order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM store_orders
      WHERE store_orders.id = store_order_items.order_id
      AND store_orders.ordered_by = auth.uid()
    )
  );

-- Allow read of order items for own orders or admins
CREATE POLICY "Users can read own order items"
  ON store_order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM store_orders
      WHERE store_orders.id = store_order_items.order_id
      AND (
        store_orders.ordered_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('super_admin', 'admin', 'teacher')
        )
      )
    )
  );

-- Allow store_categories to be read by all authenticated users in the school
CREATE POLICY "All school users can read store categories"
  ON store_categories FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = store_categories.school_id
    )
  );
