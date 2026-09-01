/*
  # Storage, WhatsApp Settings, and Order Payments Setup

  1. Storage bucket for store product images
  2. whatsapp_settings table - stores per-school WhatsApp Business API credentials
  3. notification_triggers table - config for auto-notifications
  4. store_orders payment columns - payment_status, payment_method, payment_reference, paid_at
*/

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product images
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Product images are publicly readable' AND tablename = 'objects') THEN
    CREATE POLICY "Product images are publicly readable"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'product-images');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload product images' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can upload product images"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'product-images');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update product images' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can update product images"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'product-images');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete product images' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can delete product images"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'product-images');
  END IF;
END $$;

-- WhatsApp settings table
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  phone_number_id text DEFAULT '',
  access_token text DEFAULT '',
  verify_token text DEFAULT '',
  enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id)
);

ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read own school whatsapp settings"
  ON whatsapp_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = whatsapp_settings.school_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert whatsapp settings"
  ON whatsapp_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = whatsapp_settings.school_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update whatsapp settings"
  ON whatsapp_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = whatsapp_settings.school_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = whatsapp_settings.school_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Notification triggers table
CREATE TABLE IF NOT EXISTS notification_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  label text NOT NULL,
  channels text[] DEFAULT ARRAY['in_app'],
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, event_type)
);

ALTER TABLE notification_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read notification triggers"
  ON notification_triggers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = notification_triggers.school_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert notification triggers"
  ON notification_triggers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = notification_triggers.school_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update notification triggers"
  ON notification_triggers FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = notification_triggers.school_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = notification_triggers.school_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Add payment columns to store_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE store_orders ADD COLUMN payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE store_orders ADD COLUMN payment_method text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_orders' AND column_name = 'payment_reference'
  ) THEN
    ALTER TABLE store_orders ADD COLUMN payment_reference text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_orders' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE store_orders ADD COLUMN paid_at timestamptz;
  END IF;
END $$;
