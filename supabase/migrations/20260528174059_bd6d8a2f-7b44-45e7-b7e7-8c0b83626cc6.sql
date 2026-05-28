-- Restrict non-admin owners from self-approving submissions
DROP POLICY IF EXISTS "Owners update own submissions" ON public.submissions;
CREATE POLICY "Owners update own submissions"
ON public.submissions
FOR UPDATE
TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (auth.uid() = user_id AND status IN ('pending_review'::submission_status, 'rejected'::submission_status))
);

-- Restrict non-admin owners from approving/publishing albums
DROP POLICY IF EXISTS "Owners or admins update albums" ON public.albums;
CREATE POLICY "Owners or admins update albums"
ON public.albums
FOR UPDATE
TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (auth.uid() = user_id AND status IN ('draft'::release_status, 'uploaded'::release_status, 'under_review'::release_status, 'rejected'::release_status))
);
