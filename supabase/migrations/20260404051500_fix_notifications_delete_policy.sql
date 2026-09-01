-- Fix missing DELETE policies for notifications
-- This allows recipients and senders to manage their notifications

-- 1. Enable RLS if not already enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing delete policy if it somehow exists
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

-- 3. Create a comprehensive DELETE policy
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (
  -- Recipient can delete
  user_id = (select auth.uid()) OR
  -- Sender can delete
  sender_id = (select auth.uid()) OR
  -- Admins can delete anything in their school
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.role IN ('super_admin', 'admin')
    AND profiles.school_id = notifications.school_id
  )
);

-- 4. Note: SELECT, INSERT, and UPDATE policies already exist from previous migrations
-- but they might need checking for school_id scoping if not already present.
-- For now, the priority is the DELETE policy.
