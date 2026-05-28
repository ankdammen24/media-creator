
CREATE POLICY "Artists update any artist profile" ON public.artist_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'artist')) WITH CHECK (public.has_role(auth.uid(), 'artist'));
CREATE POLICY "Artists delete any artist profile" ON public.artist_profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'artist'));

CREATE POLICY "Artists insert any album" ON public.albums FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'artist'));
CREATE POLICY "Artists update any album" ON public.albums FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'artist')) WITH CHECK (public.has_role(auth.uid(), 'artist'));
CREATE POLICY "Artists delete any album" ON public.albums FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'artist'));

CREATE POLICY "Artists read all images" ON public.artist_images FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'artist'));
CREATE POLICY "Artists insert any image" ON public.artist_images FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'artist'));
CREATE POLICY "Artists update any image" ON public.artist_images FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'artist')) WITH CHECK (public.has_role(auth.uid(), 'artist'));
CREATE POLICY "Artists delete any image" ON public.artist_images FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'artist'));

CREATE POLICY "Artists view all submissions" ON public.submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'artist'));
CREATE POLICY "Artists update any submission" ON public.submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'artist')) WITH CHECK (public.has_role(auth.uid(), 'artist'));
CREATE POLICY "Artists delete any submission" ON public.submissions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'artist'));

CREATE POLICY "Artists insert submission_artists" ON public.submission_artists FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'artist'));
CREATE POLICY "Artists update submission_artists" ON public.submission_artists FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'artist')) WITH CHECK (public.has_role(auth.uid(), 'artist'));
CREATE POLICY "Artists delete submission_artists" ON public.submission_artists FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'artist'));
