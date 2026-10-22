# Dynamic menu customizations — implementation notes

## Database model

- `menu_option_groups`: selection mode, min/max, required/active state, ordering.
- `menu_options`: reusable named options and integer centavo prices.
- `menu_item_option_groups`: assigns groups to items and supports conditional visibility through `visible_when_option_ids`.
- `resolve_menu_item_customizations(menu_item_id, selected_option_ids)`: validates current configuration and returns authoritative prices plus option-name/ID/price snapshots.

The function returns prices in **minor units (centavos)**. The existing `menu_items.price` field is stored/displayed in pesos, so it converts that base price to centavos before calculating totals.

## Conditional rules

A group's `visible_when_option_ids` is an array of option UUIDs. The group is visible only when every UUID in that array is selected. Leave it empty for an unconditional group. For example, set Egg Preparation's dependency to the Add Egg option ID.

## Deployment steps

1. Apply `supabase/migrations/202610220001_dynamic_menu_customizations.sql` to the Supabase project.
2. Configure Supabase Auth employee accounts with `app_metadata.role = "employee"`. The repository currently uses a client-side PIN gate, which is not a trusted backend identity; the migration intentionally does not grant anonymous write access to customization tables.
3. Build the Menu Manager editor and customer picker against these tables. Call `resolve_menu_item_customizations` to validate selections and obtain price snapshots.
4. Before production, route order creation through a trusted database RPC/Edge Function that recalculates every line and the final order total in the same server-side transaction. Direct client inserts into `orders` must not be treated as price-secure.

## Order snapshot format

Persist each order line with an immutable `customizations` array, e.g.:

```json
{
  "option_id": "uuid",
  "group_id": "uuid",
  "group_name": "Add Egg",
  "name": "Add Egg",
  "additional_price_minor": 600
}
```

Also persist `base_price_minor` and `unit_price_minor` on each line. Historical orders must render these stored snapshots rather than look up the current menu configuration.
