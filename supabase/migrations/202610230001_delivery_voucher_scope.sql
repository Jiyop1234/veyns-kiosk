-- DRAFT ONLY. Apply together with supabase-auth-rls-draft.sql after reviewing the updated app.
-- Browser callers submit item IDs, quantities, option IDs, delivery coordinates and promo codes.
-- Prices, option charges, promo rules, totals, and delivery fee are recalculated here.
create or replace function public.place_order_secure_v2(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_guest boolean := auth.uid() is null;
  v_profile public.profiles%rowtype;
  v_line jsonb;
  v_group jsonb;
  v_option jsonb;
  v_item public.menu_items%rowtype;
  v_opts jsonb;
  v_line_opts jsonb;
  v_items jsonb := '[]'::jsonb;
  v_line_snapshot jsonb;
  v_qty integer;
  v_unit numeric;
  v_base numeric;
  v_addons numeric;
  v_subtotal numeric := 0;
  v_delivery numeric := 0;
  v_discount numeric := 0;
  v_food_discount numeric := 0;
  v_delivery_discount numeric := 0;
  v_food_pct numeric := 0;
  v_food_peso numeric := 0;
  v_delivery_pct numeric := 0;
  v_delivery_peso numeric := 0;
  v_delivery_free boolean := false;
  v_target text;
  v_codes jsonb := coalesce(p_order -> 'promoCodesList', '[]'::jsonb);
  v_code text;
  v_promo public.promos%rowtype;
  v_person_uses integer;
  v_lat numeric;
  v_lng numeric;
  v_km numeric;
  v_order_id uuid;
  v_order_number text := '#' || lpad((floor(random() * 9000) + 1000)::text, 4, '0');
  v_fulfillment text := lower(coalesce(p_order ->> 'fulfillment', 'pickup'));
  v_order_type text := lower(coalesce(p_order ->> 'orderType', 'today'));
  v_customer_name text := nullif(btrim(p_order ->> 'name'), '');
  v_location text := nullif(btrim(p_order ->> 'location'), '');
  v_email text := nullif(btrim(p_order ->> 'email'), '');
  v_phone text := nullif(btrim(p_order ->> 'phone'), '');
  v_schedule text := nullif(btrim(p_order ->> 'scheduleInfo'), '');
  v_date_key text := nullif(btrim(p_order ->> 'dateKey'), '');
  v_slot_time text := nullif(btrim(p_order ->> 'slotTime'), '');
  v_stamps jsonb;
  v_today text := to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD');
begin
  if jsonb_typeof(p_order) is distinct from 'object' then raise exception 'Invalid order'; end if;
  if v_fulfillment not in ('pickup', 'delivery') then raise exception 'Invalid fulfillment method'; end if;
  if v_order_type not in ('today', 'reservation') then raise exception 'Invalid order schedule'; end if;
  if v_order_type = 'today' and extract(hour from now() at time zone 'Asia/Manila') < 12 then raise exception 'Store ordering opens at 12 noon Manila time'; end if;
  if v_customer_name is null or length(v_customer_name) > 120 then raise exception 'Customer name is required'; end if;
  if jsonb_typeof(p_order -> 'items') is distinct from 'array'
     or jsonb_array_length(p_order -> 'items') < 1
     or jsonb_array_length(p_order -> 'items') > 40 then
    raise exception 'Order must contain between 1 and 40 item lines';
  end if;

  if not v_is_guest then
    select * into v_profile from public.profiles where auth_user_id = v_uid for update;
    if not found then raise exception 'Sign in and complete profile verification first'; end if;
  elsif jsonb_array_length(v_codes) > 0 then
    raise exception 'Guest orders cannot use vouchers or promo codes';
  end if;

  if v_fulfillment = 'delivery' then
    if v_location is null or length(v_location) > 500 or v_phone is null then
      raise exception 'Delivery address and phone number are required';
    end if;
    begin
      v_lat := (p_order ->> 'deliveryLat')::numeric;
      v_lng := (p_order ->> 'deliveryLng')::numeric;
    exception when others then raise exception 'Choose a delivery location on the map';
    end;
    if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
      raise exception 'Invalid delivery coordinates';
    end if;
    -- Store location: 10.359511, 123.952739. The client cannot choose the fee.
    v_km := 6371 * 2 * asin(least(1, sqrt(
      power(sin(radians(v_lat - 10.359511) / 2), 2)
      + cos(radians(10.359511)) * cos(radians(v_lat))
      * power(sin(radians(v_lng - 123.952739) / 2), 2)
    )));
    v_delivery := case when v_km < 1 then 0 when v_km <= 2 then 40 else 40 + ceil(v_km - 2) * 5 end;
  end if;

  for v_line in select value from jsonb_array_elements(p_order -> 'items') loop
    if nullif(v_line ->> 'menuItemId', '') is null then raise exception 'Invalid menu item'; end if;
    begin v_qty := (v_line ->> 'quantity')::integer;
    exception when others then raise exception 'Invalid item quantity'; end;
    if v_qty < 1 or v_qty > 30 then raise exception 'Item quantity must be between 1 and 30'; end if;
    select * into v_item from public.menu_items where id = v_line ->> 'menuItemId' for share;
    if not found or coalesce(v_item.is_available, true) is false then raise exception 'A selected item is unavailable'; end if;
    if v_item.price < 0 or coalesce(v_item.discount_percent, 0) < 0 or coalesce(v_item.discount_percent, 0) > 100 then
      raise exception 'Menu price configuration is invalid';
    end if;
    v_base := round(v_item.price * (1 - coalesce(v_item.discount_percent, 0) / 100), 2);
    v_addons := 0;
    v_line_opts := coalesce(v_line -> 'options', '[]'::jsonb);
    if jsonb_typeof(v_line_opts) <> 'array' then raise exception 'Invalid item options'; end if;
    if jsonb_array_length(v_line_opts) > 30 then raise exception 'Too many item options'; end if;

    -- Validate every option submitted against the current server-owned menu configuration.
    for v_option in select value from jsonb_array_elements(v_line_opts) loop
      if not exists (
        select 1
        from jsonb_array_elements(coalesce(v_item.option_groups, '[]'::jsonb)) g
        cross join lateral jsonb_array_elements(coalesce(g -> 'options', '[]'::jsonb)) o
        where g ->> 'id' = v_option ->> 'groupId'
          and o ->> 'id' = v_option ->> 'optionId'
      ) then raise exception 'An item option is invalid or no longer available'; end if;
    end loop;

    for v_group in select value from jsonb_array_elements(coalesce(v_item.option_groups, '[]'::jsonb)) loop
      declare
        v_selected integer;
        v_visible boolean := true;
        v_group_id text := v_group ->> 'id';
      begin
        if jsonb_typeof(v_group -> 'parentOptionIds') = 'array'
           and jsonb_array_length(v_group -> 'parentOptionIds') > 0 then
          select exists (
            select 1 from jsonb_array_elements(v_line_opts) chosen
            where (v_group -> 'parentOptionIds') ? (chosen ->> 'optionId')
          ) into v_visible;
        end if;
        select count(*) into v_selected
        from jsonb_array_elements(v_line_opts) chosen
        where chosen ->> 'groupId' = v_group_id;
        if not v_visible and v_selected > 0 then raise exception 'An unavailable option was selected'; end if;
        if v_visible and coalesce((v_group ->> 'required')::boolean, false) and v_selected = 0 then
          raise exception 'A required item option is missing';
        end if;
        if v_visible and coalesce(v_group ->> 'type', '') = 'single' and v_selected > 1 then
          raise exception 'Only one option may be selected for this item';
        end if;
      end;
      for v_option in
        select o.value from jsonb_array_elements(v_line_opts) chosen
        cross join lateral jsonb_array_elements(coalesce(v_group -> 'options', '[]'::jsonb)) o
        where chosen ->> 'groupId' = v_group ->> 'id'
          and chosen ->> 'optionId' = o.value ->> 'id'
      loop
        if coalesce((v_option ->> 'price')::numeric, 0) < 0 then raise exception 'Invalid option price'; end if;
        v_addons := v_addons + coalesce((v_option ->> 'price')::numeric, 0);
      end loop;
    end loop;

    v_unit := round(v_base + v_addons, 2);
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_line_snapshot := jsonb_build_object(
      'item', jsonb_build_object('id', v_item.id, 'name', v_item.name, 'category', v_item.category,
        'price', v_item.price, 'discountPercent', coalesce(v_item.discount_percent, 0)),
      'qty', v_qty, 'unitPrice', v_unit,
      'customizations', coalesce(v_line_opts, '[]'::jsonb),
      'customizationsSummary', coalesce(v_line ->> 'customizationsSummary', '')
    );
    v_items := v_items || jsonb_build_array(v_line_snapshot);
  end loop;

  if jsonb_typeof(v_codes) is distinct from 'array' or jsonb_array_length(v_codes) > 5 then raise exception 'Invalid promo list'; end if;
  if (select count(*) from jsonb_array_elements(v_codes)) <> (select count(distinct upper(btrim(value #>> '{}'))) from jsonb_array_elements(v_codes)) then raise exception 'A promo code cannot be applied more than once'; end if;
  if jsonb_array_length(v_codes) > 0 and v_is_guest then raise exception 'Guest orders cannot use vouchers or promo codes'; end if;
  for v_code in select upper(btrim(value #>> '{}')) from jsonb_array_elements(v_codes) loop
    if v_code = '' then raise exception 'Invalid promo code'; end if;
    select * into v_promo from public.promos where upper(code) = v_code for update;
    if not found or v_promo.visibility <> 'public' then raise exception 'Promo code is invalid'; end if;
    if v_promo.start_date is not null and v_promo.start_date > now() then raise exception 'Promo code is not active yet'; end if;
    if v_promo.expiry_duration_ms > 0 and (v_promo.created_at::numeric / 1000 + v_promo.expiry_duration_ms::numeric / 1000) < extract(epoch from now()) then
      raise exception 'Promo code has expired';
    end if;
    if v_promo.usage_limit is not null and v_promo.usage_count >= v_promo.usage_limit then raise exception 'Promo code usage limit reached'; end if;
    if lower(coalesce(v_promo.eligibility, 'all')) = 'registered' and v_is_guest then raise exception 'This promo requires a registered account'; end if;
    if v_promo.per_person_limit is not null then
      select count(*) into v_person_uses from public.orders o
      where o.user_id = v_uid and exists (
        select 1 from unnest(string_to_array(coalesce(o.promo_code, ''), ',')) old_code
        where upper(btrim(old_code)) = v_code
      );
      if v_person_uses >= v_promo.per_person_limit then raise exception 'You have reached this promo limit'; end if;
    end if;
    v_target := lower(coalesce(v_promo.target_type, 'subtotal'));
    if v_target not in ('subtotal', 'delivery') then raise exception 'Promo discount scope is invalid'; end if;
    if v_promo.type = 'free' then
      if v_target <> 'delivery' then raise exception 'Free delivery promos must target delivery fees'; end if;
      v_delivery_free := true;
    elsif v_promo.type = 'peso' then
      if v_target = 'delivery' then v_delivery_peso := v_delivery_peso + v_promo.discount_value;
      else v_food_peso := v_food_peso + v_promo.discount_value; end if;
    elsif v_promo.type = 'percentage' then
      if v_promo.discount_value < 0 or v_promo.discount_value > 100 then raise exception 'Promo percentage is invalid'; end if;
      if v_target = 'delivery' then v_delivery_pct := v_delivery_pct + v_promo.discount_value;
      else v_food_pct := v_food_pct + v_promo.discount_value; end if;
    else
      raise exception 'Promo discount type is invalid';
    end if;
    update public.promos set usage_count = coalesce(usage_count, 0) + 1, updated_at = now() where code = v_promo.code;
  end loop;
  v_food_discount := least(v_subtotal, round(v_subtotal * v_food_pct / 100 + v_food_peso, 2));
  v_delivery_discount := case when v_delivery_free then v_delivery
    else least(v_delivery, round(v_delivery * v_delivery_pct / 100 + v_delivery_peso, 2)) end;
  v_discount := v_food_discount + v_delivery_discount;

  if v_order_type = 'reservation' then
    if v_date_key is null or v_slot_time is null then raise exception 'Choose a reservation date and time'; end if;
    if v_date_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or v_date_key::date <= v_today::date then raise exception 'Choose a future reservation date'; end if;
    perform 1 from public.slot_capacities sc
      where sc.date_key = v_date_key and sc.slot_time = v_slot_time for update;
    if not found then raise exception 'That reservation slot is unavailable'; end if;
    if found then
      update public.slot_capacities sc
      set booked_count = coalesce(booked_count, 0) + 1,
          is_fully_booked = coalesce(booked_count, 0) + 1 >= coalesce(max_slots, 10),
          updated_at = now()
      where sc.date_key = v_date_key and sc.slot_time = v_slot_time
        and coalesce(sc.booked_count, 0) < coalesce(sc.max_slots, 10);
      if not found then raise exception 'That reservation slot is full'; end if;
    end if;
  end if;

  insert into public.orders (
    order_number, customer_name, items, total, status, email, phone, fulfillment,
    location, landmark, promo_code, promo_discount, delivery_fee, account_nickname,
    order_type, schedule_info, server_verified_total, server_verified_promo_discount, user_id
  ) values (
    v_order_number, v_customer_name, v_items, v_subtotal - v_food_discount + v_delivery - v_delivery_discount,
    'completed', v_email, v_phone, v_fulfillment, v_location,
    nullif(btrim(p_order ->> 'landmark'), ''),
    case when jsonb_array_length(v_codes) = 0 then null else (select string_agg(upper(btrim(value #>> '{}')), ', ') from jsonb_array_elements(v_codes)) end,
    v_discount, v_delivery - v_delivery_discount, case when v_is_guest then 'Guest' else coalesce(v_profile.name, 'Customer') end,
    v_order_type, coalesce(v_schedule, 'Immediate / Today'),
    v_subtotal - v_food_discount + v_delivery - v_delivery_discount, v_discount, v_uid
  ) returning id into v_order_id;

  -- Award at most one trusted stamp per authenticated customer per Manila calendar day.
  if not v_is_guest then
    v_stamps := coalesce(v_profile.stamps_data, '[]'::jsonb);
    if jsonb_typeof(v_stamps) <> 'array' then v_stamps := '[]'::jsonb; end if;
    if not exists (select 1 from jsonb_array_elements(v_stamps) stamp where stamp ->> 'date' = v_today and stamp ->> 'status' = 'valid')
       and jsonb_array_length(v_stamps) < 12 then
      v_stamps := v_stamps || jsonb_build_array(jsonb_build_object('status', 'valid', 'date', v_today));
      update public.profiles set stamps_data = v_stamps where auth_user_id = v_uid;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_order_id, 'orderNumber', v_order_number, 'items', v_items,
    'subtotal', v_subtotal, 'promoDiscount', v_discount,
    'foodPromoDiscount', v_food_discount, 'deliveryPromoDiscount', v_delivery_discount,
    'deliveryFee', v_delivery - v_delivery_discount, 'deliveryDistanceKm', round(coalesce(v_km, 0), 3),
    'total', v_subtotal - v_food_discount + v_delivery - v_delivery_discount
  );
end;
$$;

revoke all on function public.place_order_secure_v2(jsonb) from public;
grant execute on function public.place_order_secure_v2(jsonb) to anon, authenticated;

