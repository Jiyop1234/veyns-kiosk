// @ts-nocheck
import { Flame, Leaf, Plus, Star } from "lucide-react";
import { formatPeso, type MenuItem } from "@/lib/menu-data";
import { useCart } from "@/lib/cart";

export function MenuCard({ item }: { item: MenuItem }) {
  const { add } = useCart();
  return (
    <div className="group flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold leading-snug">{item.name}</h3>
        <span className="shrink-0 font-display text-lg font-bold text-primary">
          {formatPeso(item.price)}
        </span>
      </div>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          {item.popular && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              <Star className="size-3" /> Popular
            </span>
          )}
          {item.spicy && (
            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
              <Flame className="size-3" /> Spicy
            </span>
          )}
          {item.veg && (
            <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
              <Leaf className="size-3" /> Veggie
            </span>
          )}
        </div>
        <button
          onClick={() => add(item)}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>
    </div>
  );
}
