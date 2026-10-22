-- Dynamic menu customization schema for VEYNS Kiosk.
-- Prices for add-ons are stored in centavos (integer minor units).
-- Menu base prices remain in the existing menu_items.price column (pesos).

create table if not exists public.menu_option_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  selection_mode text not null default 'single' check (selection_mode in ('single', 'multiple')),
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_select <= max_select),
  check (selection_mode <> 'single' or max_select = 1)
);

create table if not exists public.menu_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.menu_option_groups(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  additional_price_minor integer not null default 0 check (additional_price_minor >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_options_group_sort_idx
  on public.menu_options(group_id, sort_order);

create table if not exists public.menu_item_option_groups (
  menu_item_id text not null references public.menu_items(id) on delete cascade,
  group_id uuid not null references public.menu_option_groups(id) on delete cascade,
  sort_order integer not null default 100,
  -- Every UUID here must be selected for this group to be visible.
  -- Empty array means always visible.
  visible_when_option_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (menu_item_id, group_id)
);

create index if not exists menu_item_option_groups_item_sort_idx
  on public.menu_item_option_groups(menu_item_id, sort_order);

alter table public.menu_option_groups enable row level security;
alter table public.menu_options enable row level security;
alter table public.menu_item_option_groups enable row level security;

-- Customers may read only active groups/options and assignments for available items.
drop policy if exists "public read active menu option groups" on public.menu_option_groups;
create policy "public read active menu option groups"
  on public.menu_option_groups for select
  to anon, authenticated
  using (is_active);

drop policy if exists "public read active menu options" on public.menu_options;
create policy "public read active menu options"
  on public.menu_options for select
  to anon, authenticated
  using (
    is_active and exists (
      select 1 from public.menu_option_groups g
      where g.id = group_id and g.is_active
    )
  );

drop policy if exists "public read menu option assignments" on public.menu_item_option_groups;
create policy "public read menu option assignments"
  on public.menu_item_option_groups for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.menu_items m
      where m.id = menu_item_id and coalesce(m.is_available, true)
    )
    and exists (
      select 1 from public.menu_option_groups g
      where g.id = group_id and g.is_active
    )
  );

-- Only authenticated sessions carrying an employee role may manage configuration.
-- The current app's PIN-only client-side gate is not a trusted server identity.
drop policy if exists "employees manage option groups" on public.menu_option_groups;
create policy "employees manage option groups"
  on public.menu_option_groups for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'employee')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'employee');

drop policy if exists "employees manage menu options" on public.menu_options;
create policy "employees manage menu options"
  on public.menu_options for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'employee')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'employee');

drop policy if exists "employees manage menu option assignments" on public.menu_item_option_groups;
create policy "employees manage menu option assignments"
  on public.menu_item_option_groups for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'employee')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'employee');

create or replace function public.resolve_menu_item_customizations(
  p_menu_item_id text,
  p_selected_option_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_base_minor integer;
  v_item_available boolean;
  v_selected uuid[] := coalesce(p_selected_option_ids, '{}');
  v_invalid_count integer;
  v_group record;
  v_selected_count integer;
  v_option_total integer := 0;
  v_options jsonb := '[]'::jsonb;
begin
  if cardinality(v_selected) <> (select count(distinct x) from unnest(v_selected) as t(x)) then
    raise exception 'Duplicate customization option IDs are not allowed';
  end if;

  select round(m.price * 100)::integer, coalesce(m.is_available, true)
    into v_base_minor, v_item_available
  from public.menu_items m
  where m.id = p_menu_item_id;

  if not found or not v_item_available then
    raise exception 'Menu item is unavailable';
  end if;

  -- Every submitted option must be active and assigned to this menu item.
  select count(*) into v_invalid_count
  from unnest(v_selected) as picked(option_id)
  left join public.menu_options o on o.id = picked.option_id and o.is_active
  left join public.menu_option_groups g on g.id = o.group_id and g.is_active
  left join public.menu_item_option_groups a
    on a.group_id = g.id and a.menu_item_id = p_menu_item_id
  where o.id is null or g.id is null or a.group_id is null;

  if v_invalid_count > 0 then
    raise exception 'One or more selected customizations are invalid or unavailable';
  end if;

  -- Enforce visibility dependencies and selection limits for every assigned group.
  for v_group in
    select g.id, g.name, g.min_select, g.max_select, g.selection_mode,
           g.is_required, a.visible_when_option_ids
    from public.menu_item_option_groups a
    join public.menu_option_groups g on g.id = a.group_id
    where a.menu_item_id = p_menu_item_id and g.is_active
    order by a.sort_order, g.sort_order, g.created_at
  loop
    select count(*) into v_selected_count
    from public.menu_options o
    where o.group_id = v_group.id
      and o.id = any(v_selected)
      and o.is_active;

    if not (coalesce(v_group.visible_when_option_ids, '{}') <@ v_selected) then
      if v_selected_count > 0 then
        raise exception 'Customization group "%" is not available for the selected choices', v_group.name;
      end if;
      continue;
    end if;

    if v_selected_count < case when v_group.is_required then greatest(v_group.min_select, 1) else v_group.min_select end then
      raise exception 'Select more options for "%"', v_group.name;
    end if;

    if v_selected_count > v_group.max_select then
      raise exception 'Too many selections for "%"', v_group.name;
    end if;
  end loop;

  select coalesce(sum(o.additional_price_minor), 0)::integer,
         coalesce(jsonb_agg(jsonb_build_object(
           'option_id', o.id,
           'group_id', g.id,
           'group_name', g.name,
           'name', o.name,
           'additional_price_minor', o.additional_price_minor
         ) order by a.sort_order, g.sort_order, o.sort_order), '[]'::jsonb)
    into v_option_total, v_options
  from public.menu_options o
  join public.menu_option_groups g on g.id = o.group_id
  join public.menu_item_option_groups a
    on a.group_id = g.id and a.menu_item_id = p_menu_item_id
  where o.id = any(v_selected)
    and o.is_active and g.is_active
    and coalesce(a.visible_when_option_ids, '{}') <@ v_selected;

  return jsonb_build_object(
    'menu_item_id', p_menu_item_id,
    'base_price_minor', v_base_minor,
    'options', v_options,
    'customization_total_minor', v_option_total,
    'unit_price_minor', v_base_minor + v_option_total
  );
end;
$$;

grant execute on function public.resolve_menu_item_customizations(text, uuid[]) to anon, authenticated;

comment on function public.resolve_menu_item_customizations(text, uuid[]) is
'Validates active option IDs, selection limits and dependencies; returns server-priced immutable option snapshots. Order creation must call this function server-side rather than trusting browser prices.';
