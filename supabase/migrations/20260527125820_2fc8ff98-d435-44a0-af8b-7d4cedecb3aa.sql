CREATE POLICY "Admins update any artist profile"
ON public.artist_profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete any artist profile"
ON public.artist_profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));