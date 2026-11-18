-- Level dan durasi boleh diperbarui setelah ada pengerjaan. Durasi attempt
-- yang sedang berjalan tidak berubah karena expires_at sudah tersimpan.
create or replace function public.tests_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_missing integer;
begin
  if new.status = 'open' and old.status is distinct from 'open' then
    if not exists (select 1 from public.questions q where q.test_id = new.id) then
      raise exception using
        errcode = 'P0001',
        message = 'Tes belum memiliki soal sehingga tidak dapat dibuka.';
    end if;

    select count(*) into v_missing
    from public.questions q
    left join public.answer_keys k on k.question_id = q.id
    where q.test_id = new.id and k.question_id is null;

    if v_missing > 0 then
      raise exception using
        errcode = 'P0001',
        message = format('Ada %s soal tanpa kunci jawaban. Lengkapi kunci sebelum membuka tes.', v_missing);
    end if;
  end if;

  return new;
end;
$$;
