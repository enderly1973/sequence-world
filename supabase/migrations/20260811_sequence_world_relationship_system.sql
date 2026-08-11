-- =========================================================
-- Sequence World
-- Relationship System Migration
-- 2026-08-11
-- =========================================================


-- =========================================================
-- 1. 主人解除自己的直屬從屬者
-- =========================================================

create or replace function release_my_subordinate(
  p_subordinate_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_relation_id uuid;
begin
  if auth.uid() is null then
    raise exception '尚未登入';
  end if;

  update hierarchy_relations
  set status = 'ended'
  where superior_id = auth.uid()
    and subordinate_id = p_subordinate_id
    and status = 'active'
  returning id into v_relation_id;

  if v_relation_id is null then
    raise exception '找不到有效的主從關係';
  end if;

  return true;
end;
$$;

revoke all
on function release_my_subordinate(uuid)
from public;

revoke all
on function release_my_subordinate(uuid)
from anon;

grant execute
on function release_my_subordinate(uuid)
to authenticated;


-- =========================================================
-- 2. 從屬者主動解除自己的上級
-- =========================================================

create or replace function leave_my_superior()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_relation_id uuid;
begin
  if auth.uid() is null then
    raise exception '尚未登入';
  end if;

  update hierarchy_relations
  set status = 'ended'
  where subordinate_id = auth.uid()
    and status = 'active'
  returning id into v_relation_id;

  if v_relation_id is null then
    raise exception '目前沒有有效的上級關係';
  end if;

  return true;
end;
$$;

revoke all
on function leave_my_superior()
from public;

revoke all
on function leave_my_superior()
from anon;

grant execute
on function leave_my_superior()
to authenticated;


-- =========================================================
-- 3. 系統隨機分配上級
--
-- 規則：
-- - 排除自己
-- - 排除 founder / administrator
-- - 自己目前不能已有 active 上級
-- - 對方必須接受新從屬者
-- - 對方必須還有 subordinate_limit 名額
-- - 不會把自己的 active 直屬者配成自己的上級
-- - 下一次分配會避開最近一任 ended 上級
-- =========================================================

create or replace function random_assign_superior()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_superior_id uuid;
  v_last_superior_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception '尚未登入';
  end if;

  -- 管理帳號不能參與一般主從配對
  if exists (
    select 1
    from profiles
    where id = v_user_id
      and role::text in (
        'founder',
        'administrator'
      )
  ) then
    raise exception '管理帳號不能使用系統配對';
  end if;

  -- 已經有上級就不能再次配對
  if exists (
    select 1
    from hierarchy_relations
    where subordinate_id = v_user_id
      and status = 'active'
  ) then
    raise exception '目前已有上級';
  end if;

  -- 找最近一任已解除的上級
  select superior_id
  into v_last_superior_id
  from hierarchy_relations
  where subordinate_id = v_user_id
    and status = 'ended'
  order by created_at desc
  limit 1;

  -- 隨機選擇符合資格的上級
  select p.id
  into v_superior_id
  from profiles p
  where p.id <> v_user_id

    and p.status = 'active'

    -- 排除管理帳號
    and coalesce(
      p.role::text,
      ''
    ) not in (
      'founder',
      'administrator'
    )

    -- 排除最近一任上級
    and (
      v_last_superior_id is null
      or p.id <> v_last_superior_id
    )

    -- 必須願意接收新從屬者
    and p.accepting_subordinates = true

    -- 必須還有名額
    and (
      select count(*)
      from hierarchy_relations hr
      where hr.superior_id = p.id
        and hr.status = 'active'
    ) < p.subordinate_limit

    -- 不能把自己的 active 直屬者變成自己的上級
    and not exists (
      select 1
      from hierarchy_relations hr
      where hr.superior_id = v_user_id
        and hr.subordinate_id = p.id
        and hr.status = 'active'
    )

  order by random()
  limit 1;

  if v_superior_id is null then
    raise exception '目前沒有符合條件的可分配對象';
  end if;

  insert into hierarchy_relations (
    superior_id,
    subordinate_id,
    relation_type,
    status
  )
  values (
    v_superior_id,
    v_user_id,
    'system',
    'active'
  );

  return v_superior_id;
end;
$$;

revoke all
on function random_assign_superior()
from public;

revoke all
on function random_assign_superior()
from anon;

grant execute
on function random_assign_superior()
to authenticated;