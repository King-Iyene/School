-- Migration to fix event deletion policy
CREATE POLICY "Authorized roles can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'teacher', 'accountant')
    )
  );
