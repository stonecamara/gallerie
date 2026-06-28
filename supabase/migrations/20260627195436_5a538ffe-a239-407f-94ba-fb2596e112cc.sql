
-- Lock down security definer functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_client_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_client_code() TO service_role;

-- Storage policies for "project-files" bucket
-- Path convention: {client_user_id}/{project_id}/...
CREATE POLICY "project-files admin all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'project-files' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'project-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "project-files client read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);
