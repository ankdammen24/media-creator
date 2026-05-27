DROP POLICY IF EXISTS "Owners update own pending submissions" ON public.submissions;

CREATE POLICY "Owners update own submissions"
ON public.submissions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners delete own submissions"
ON public.submissions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins delete any submission"
ON public.submissions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete any audio"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete any artwork"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'artwork' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update any audio"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update any artwork"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'artwork' AND public.has_role(auth.uid(), 'admin'));