-- =========================================================
-- Task submission / superior confirmation flow
-- pending -> accepted -> submitted -> completed
-- =========================================================

alter type public.task_status
add value if not exists 'submitted'
after 'accepted';


-- =========================================================
-- Subordinate submits task completion
-- accepted -> submitted
-- =========================================================

create or replace function public.complete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception '尚未登入';
  end if;

  update public.tasks
  set
    status = 'submitted',
    completed_at = null,
    updated_at = now()
  where id = p_task_id
    and receiver_id = v_user_id
    and status = 'accepted';

  if not found then
    raise exception '任務不存在、不是你的任務，或目前無法提交完成';
  end if;
end;
$function$;

revoke all on function public.complete_task(uuid) from public;
revoke all on function public.complete_task(uuid) from anon;
grant execute on function public.complete_task(uuid) to authenticated;


-- =========================================================
-- Superior confirms completion
-- submitted -> completed
-- =========================================================

create or replace function public.confirm_task_completion(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception '尚未登入';
  end if;

  update public.tasks
  set
    status = 'completed',
    completed_at = now(),
    updated_at = now()
  where id = p_task_id
    and sender_id = v_user_id
    and status = 'submitted';

  if not found then
    raise exception '任務不存在、不是你發出的任務，或目前無法確認完成';
  end if;
end;
$function$;

revoke all on function public.confirm_task_completion(uuid) from public;
revoke all on function public.confirm_task_completion(uuid) from anon;
grant execute on function public.confirm_task_completion(uuid) to authenticated;
