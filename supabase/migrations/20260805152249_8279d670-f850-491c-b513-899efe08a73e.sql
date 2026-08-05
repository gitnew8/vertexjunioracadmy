CREATE POLICY "Anyone can read visual papers" ON storage.objects FOR SELECT USING (bucket_id = 'visual-papers');
CREATE POLICY "Anyone can upload visual papers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'visual-papers');
CREATE POLICY "Anyone can update visual papers" ON storage.objects FOR UPDATE USING (bucket_id = 'visual-papers');
CREATE POLICY "Anyone can delete visual papers" ON storage.objects FOR DELETE USING (bucket_id = 'visual-papers');