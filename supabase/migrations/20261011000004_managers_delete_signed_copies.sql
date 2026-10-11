-- Lets managers clean up signed copies when removing an assignment or document.
create policy "Managers delete signed copies"
  on storage.objects for delete to authenticated
  using (bucket_id = 'signed' and (select private.is_manager()));
