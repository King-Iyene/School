/*
  # Fix RLS Policies and Add Stock Deduction Trigger

  1. Extend store_orders UPDATE to include admin role
  2. Extend notifications INSERT to include admin role
  3. Add database trigger to deduct stock when order items are inserted
     (secure server-side stock management, replaces client-side update)
*/

-- Extend store_orders UPDATE to include admin role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update order status' AND tablename = 'store_orders') THEN
    DROP POLICY "Admins can update order status" ON store_orders;
  END IF;
END $$;

CREATE POLICY "Admins can update order status"
  ON store_orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin', 'accountant')
    )
  );

-- Extend notifications INSERT to include admin role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can create notifications' AND tablename = 'notifications') THEN
    DROP POLICY "System can create notifications" ON notifications;
  END IF;
END $$;

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin', 'teacher', 'accountant')
    )
  );

-- Add store_products UPDATE policy for admin (to allow stock management from admin pages)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update products' AND tablename = 'store_products') THEN
    CREATE POLICY "Admins can update products"
      ON store_products FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.school_id = store_products.school_id
          AND profiles.role IN ('super_admin', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.school_id = store_products.school_id
          AND profiles.role IN ('super_admin', 'admin')
        )
      );
  END IF;
END $$;

-- Function to deduct stock when order items are inserted
CREATE OR REPLACE FUNCTION deduct_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE store_products
  SET stock_qty = GREATEST(0, stock_qty - NEW.quantity)
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

-- Trigger to call the function on order item insert
DROP TRIGGER IF EXISTS trigger_deduct_stock ON store_order_items;
CREATE TRIGGER trigger_deduct_stock
  AFTER INSERT ON store_order_items
  FOR EACH ROW
  EXECUTE FUNCTION deduct_product_stock();
