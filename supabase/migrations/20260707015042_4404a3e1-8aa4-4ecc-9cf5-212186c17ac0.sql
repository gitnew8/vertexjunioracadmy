
CREATE POLICY "exam snapshots public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'exam-snapshots');
CREATE POLICY "exam snapshots public write" ON storage.objects
  FOR ALL USING (bucket_id = 'exam-snapshots') WITH CHECK (bucket_id = 'exam-snapshots');
