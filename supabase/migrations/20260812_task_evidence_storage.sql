-- =========================================================
-- Task evidence attachments
-- =========================================================

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),

  task_id uuid not null
    references public.tasks(id)
    on delete cascade,

  uploader_id uuid not null
    references public.profiles(id)
    on delete cascade,

  file_path text not null,

  file_type text not null
    check (file_type in ('image', 'video')),

  created_at timestamptz not null default now()
);

create index if not exists task_attachments_task_id_idx
on public.task_attachments(task_id);

create index if not exists task_attachments_uploader_id_idx
on public.task_attachments(uploader_id);

alter table public.task_attachments
enable row level security;


-- =========================================================
-- task_attachments RLS
-- =========================================================

drop policy if exists "Task participants can view attachments" on public.task_attachments;

create policy "Task participants can view attachments"
on public.task_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.tasks
    where tasks.id = task_attachments.task_id
      and (
        tasks.sender_id = auth.uid()
        or tasks.receiver_id = auth.uid()
      )
  )
);

drop policy if exists "Task receiver can add attachments" on public.task_attachments;

create policy "Task receiver can add attachments"
on public.task_attachments
for insert
to authenticated
with check (
  uploader_id = auth.uid()
  and exists (
    select 1
    from public.tasks
    where tasks.id = task_attachments.task_id
      and tasks.receiver_id = auth.uid()
      and tasks.status = 'accepted'
  )
);

drop policy if exists "Task receiver can delete own attachments" on public.task_attachments;

create policy "Task receiver can delete own attachments"
on public.task_attachments
for delete
to authenticated
using (
  uploader_id = auth.uid()
  and exists (
    select 1
    from public.tasks
    where tasks.id = task_attachments.task_id
      and tasks.receiver_id = auth.uid()
      and tasks.status = 'accepted'
  )
);


-- =========================================================
-- Storage bucket
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit
)
values (
  'task-evidence',
  'task-evidence',
  false,
  52428800
)
on conflict (id) do nothing;


-- =========================================================
-- Storage RLS
-- path:
-- taskId/userId/filename
-- =========================================================

drop policy if exists "Task receiver can upload evidence" on storage.objects;

create policy "Task receiver can upload evidence"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-evidence'
  and exists (
    select 1
    from public.tasks
    where tasks.id::text = (storage.foldername(name))[1]
      and tasks.receiver_id = auth.uid()
      and tasks.status = 'accepted'
  )
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Task participants can view evidence" on storage.objects;

create policy "Task participants can view evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-evidence'
  and exists (
    select 1
    from public.tasks
    where tasks.id::text = (storage.foldername(name))[1]
      and (
        tasks.sender_id = auth.uid()
        or tasks.receiver_id = auth.uid()
      )
  )
);

drop policy if exists "Task receiver can delete evidence" on storage.objects;

create policy "Task receiver can delete evidence"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-evidence'
  and owner_id = auth.uid()::text
  and exists (
    select 1
    from public.tasks
    where tasks.id::text = (storage.foldername(name))[1]
      and tasks.receiver_id = auth.uid()
      and tasks.status = 'accepted'
  )
);
