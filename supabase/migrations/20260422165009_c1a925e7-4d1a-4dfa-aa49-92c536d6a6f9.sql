create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id uuid,
  user_email text,
  user_name text,
  action text not null,
  table_name text not null,
  record_id text,
  record_label text,
  old_data jsonb,
  new_data jsonb,
  changed_fields jsonb,
  source text not null default 'database_trigger'
);

alter table public.audit_logs enable row level security;

create policy "Authenticated users can view audit logs"
on public.audit_logs
for select
to authenticated
using (true);

create or replace function public.get_audit_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from auth.users where id = auth.uid();
$$;

create or replace function public.get_audit_user_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(name, email) from public.app_profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb;
  new_row jsonb;
  diff jsonb := '{}'::jsonb;
  key text;
  label_value text;
begin
  if tg_op = 'INSERT' then
    new_row := to_jsonb(new);
    label_value := coalesce(new_row->>'name', new_row->>'document_number', new_row->>'lot_number', new_row->>'id');
  elsif tg_op = 'UPDATE' then
    old_row := to_jsonb(old);
    new_row := to_jsonb(new);
    label_value := coalesce(new_row->>'name', old_row->>'name', new_row->>'document_number', old_row->>'document_number', new_row->>'lot_number', old_row->>'lot_number', new_row->>'id', old_row->>'id');

    for key in select jsonb_object_keys(new_row)
    loop
      if (old_row->key) is distinct from (new_row->key) then
        diff := diff || jsonb_build_object(key, jsonb_build_object('old', old_row->key, 'new', new_row->key));
      end if;
    end loop;
  elsif tg_op = 'DELETE' then
    old_row := to_jsonb(old);
    label_value := coalesce(old_row->>'name', old_row->>'document_number', old_row->>'lot_number', old_row->>'id');
  end if;

  insert into public.audit_logs (
    user_id,
    user_email,
    user_name,
    action,
    table_name,
    record_id,
    record_label,
    old_data,
    new_data,
    changed_fields
  ) values (
    auth.uid(),
    public.get_audit_user_email(),
    public.get_audit_user_name(),
    tg_op,
    tg_table_name,
    coalesce(new_row->>'id', old_row->>'id'),
    label_value,
    old_row,
    new_row,
    case when tg_op = 'UPDATE' then diff else null end
  );

  return coalesce(new, old);
end;
$$;

create index if not exists idx_audit_logs_occurred_at on public.audit_logs (occurred_at desc);
create index if not exists idx_audit_logs_table_name on public.audit_logs (table_name);
create index if not exists idx_audit_logs_user_id on public.audit_logs (user_id);

create trigger audit_inventory_changes after insert or update or delete on public.inventory for each row execute function public.audit_row_change();
create trigger audit_ambalaje_inventory_changes after insert or update or delete on public.ambalaje_inventory for each row execute function public.audit_row_change();
create trigger audit_etichete_inventory_changes after insert or update or delete on public.etichete_inventory for each row execute function public.audit_row_change();
create trigger audit_products_changes after insert or update or delete on public.products for each row execute function public.audit_row_change();
create trigger audit_ambalaje_products_changes after insert or update or delete on public.ambalaje_products for each row execute function public.audit_row_change();
create trigger audit_etichete_products_changes after insert or update or delete on public.etichete_products for each row execute function public.audit_row_change();
create trigger audit_suppliers_changes after insert or update or delete on public.suppliers for each row execute function public.audit_row_change();
create trigger audit_ambalaje_suppliers_changes after insert or update or delete on public.ambalaje_suppliers for each row execute function public.audit_row_change();
create trigger audit_etichete_suppliers_changes after insert or update or delete on public.etichete_suppliers for each row execute function public.audit_row_change();
create trigger audit_manufacturers_changes after insert or update or delete on public.manufacturers for each row execute function public.audit_row_change();
create trigger audit_ambalaje_manufacturers_changes after insert or update or delete on public.ambalaje_manufacturers for each row execute function public.audit_row_change();
create trigger audit_etichete_manufacturers_changes after insert or update or delete on public.etichete_manufacturers for each row execute function public.audit_row_change();
create trigger audit_production_stock_changes after insert or update or delete on public.production_stock for each row execute function public.audit_row_change();
create trigger audit_ambalaje_production_stock_changes after insert or update or delete on public.ambalaje_production_stock for each row execute function public.audit_row_change();
create trigger audit_etichete_production_stock_changes after insert or update or delete on public.etichete_production_stock for each row execute function public.audit_row_change();