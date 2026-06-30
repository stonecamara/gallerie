
-- Storage policy: client can upload to own folder
-- Path convention: {client_user_id}/{project_id}/...
CREATE POLICY "project-files client upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policy: client can delete own files
CREATE POLICY "project-files client delete own" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
