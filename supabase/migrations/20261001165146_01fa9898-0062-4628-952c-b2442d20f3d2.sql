create or replace function public.slot_locked_share(_task_id uuid)
returns numeric language sql stable security definer set search_path=public as $$
  with t as (select id,user_id,coalesce(pending_mined,0)+coalesce(pending_carry,0) own from tasks where id=_task_id and status<>'empty' and coalesce(whitelist_ok,true)=false),
  u as (
    select ms.pending_mining pm,
      (select coalesce(sum(coalesce(pending_mined,0)+coalesce(pending_carry,0)),0) from tasks x where x.user_id=t.user_id) slot_sum,
      (select count(*) from tasks x where x.user_id=t.user_id and x.status<>'empty' and coalesce(x.whitelist_ok,true)=false) n
    from t join mining_state ms on ms.user_id=t.user_id)
  select coalesce(round(least((select pm from u), t.own + greatest((select pm from u)-(select slot_sum from u),0)/nullif((select n from u),0))::numeric,2),0)
  from t
$$;
revoke all on function public.slot_locked_share(uuid) from public, anon;
grant execute on function public.slot_locked_share(uuid) to authenticated, service_role;

create or replace function public.burn_slot_locked_share(_task_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare v numeric; uid uuid;
begin
  select user_id into uid from tasks where id=_task_id;
  v := coalesce(public.slot_locked_share(_task_id),0);
  if v > 0 then
    update mining_state set pending_mining = greatest(pending_mining - v,0) where user_id=uid;
  end if;
  update tasks set pending_mined=0, pending_carry=0 where id=_task_id;
  return v;
end $$;
revoke all on function public.burn_slot_locked_share(uuid) from public, anon, authenticated;
grant execute on function public.burn_slot_locked_share(uuid) to service_role;