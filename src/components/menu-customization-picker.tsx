import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPeso } from '@/lib/menu-data';

type Group = { id: string; name: string; description?: string; selection_mode: 'single'|'multiple'; min_select: number; max_select: number; is_required: boolean; is_active: boolean; sort_order: number };
type Option = { id: string; group_id: string; name: string; additional_price_minor: number; is_active: boolean; sort_order: number };
type Assignment = { group_id: string; sort_order: number; visible_when_option_ids: string[] };

export function MenuCustomizationPicker({ item, onCancel, onConfirm }: { item:any; onCancel:()=>void; onConfirm:(line:any, quantity:number)=>void }) {
  const [groups,setGroups]=useState<Group[]>([]);
  const [options,setOptions]=useState<Option[]>([]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [quantity,setQuantity]=useState(1);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const selectedSet=useMemo(()=>new Set(selectedIds),[selectedIds]);
  const visibleGroups=useMemo(()=>assignments.filter(a=>(a.visible_when_option_ids||[]).every(id=>selectedSet.has(id))),[assignments,selectedSet]);
  const selectedOptions=options.filter(o=>selectedSet.has(o.id));
  const previewTotal=(Math.round(Number(item.price||0)*100)+selectedOptions.reduce((s,o)=>s+o.additional_price_minor,0))/100;

  useEffect(()=>{(async()=>{
    const [g,o,a]=await Promise.all([
      supabase.from('menu_option_groups').select('*').eq('is_active',true).order('sort_order'),
      supabase.from('menu_options').select('*').eq('is_active',true).order('sort_order'),
      supabase.from('menu_item_option_groups').select('*').eq('menu_item_id',item.id).order('sort_order')
    ]);
    if(g.error||o.error||a.error){setError('Could not load menu options. Please try again.');setLoading(false);return;}
    setGroups(g.data||[]);setOptions(o.data||[]);setAssignments(a.data||[]);setLoading(false);
  })();},[item.id]);

  const toggle=(group:Group,option:Option)=>{
    setError('');
    setSelectedIds(prev=>{
      if(prev.includes(option.id)) return prev.filter(id=>id!==option.id);
      const currentGroupOptions=options.filter(o=>o.group_id===group.id).map(o=>o.id);
      const withoutGroup=prev.filter(id=>!currentGroupOptions.includes(id));
      return group.selection_mode==='single'?[...withoutGroup,option.id]:[...prev,option.id];
    });
  };

  const submit=async()=>{
    setError('');
    const payload={p_menu_item_id:item.id,p_selected_option_ids:selectedIds};
    const {data,error:rpcError}=await supabase.rpc('resolve_menu_item_customizations',payload);
    if(rpcError){setError(rpcError.message||'Please review the required selections.');return;}
    const result=Array.isArray(data)?data[0]:data;
    if(!result){setError('Unable to validate the selected options.');return;}
    const snapshot=(result.options||[]).map((o:any)=>({
      optionId:o.option_id,groupId:o.group_id,groupName:o.group_name,name:o.name,
      additionalPriceMinor:Number(o.additional_price_minor||0)
    }));
    const basePrice=Number(result.base_price_minor)/100;
    const unitPrice=Number(result.unit_price_minor)/100;
    const title=snapshot.length?item.name+' ('+snapshot.map((o:any)=>o.name).join(', ')+')':item.name;
    onConfirm({
      id:item.id+'-'+selectedIds.slice().sort().join('-'),
      menuItemId:item.id,name:title,baseName:item.name,category:item.category,
      price:unitPrice,basePrice,customizations:snapshot,
      description:item.description,pricingValidated:true
    },quantity);
  };

  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-3 sm:p-6">
    <div className="mx-auto max-w-lg space-y-4 rounded-3xl border border-emerald-800 bg-[#04140f] p-5 text-white shadow-2xl">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-lime-400">Customize your order</p><h2 className="mt-1 text-2xl font-extrabold">{item.name}</h2><p className="text-sm text-emerald-300">Base price {formatPeso(item.price||0)}</p></div><button onClick={onCancel} className="rounded-xl border border-emerald-800 px-3 py-2 text-sm">Close</button></div>
      {loading?<p className="text-sm text-emerald-300">Loading options…</p>:assignments.length===0?<p className="rounded-xl border border-emerald-900 p-3 text-sm text-emerald-300">No customizations configured for this item.</p>:visibleGroups.map(a=>{
        const g=groups.find(x=>x.id===a.group_id); if(!g)return null;
        const groupOptions=options.filter(o=>o.group_id===g.id).sort((x,y)=>x.sort_order-y.sort_order);
        const count=groupOptions.filter(o=>selectedSet.has(o.id)).length;
        return <section key={g.id} className="space-y-2 rounded-2xl border border-emerald-900 p-3">
          <div className="flex items-start justify-between gap-2"><div><h3 className="font-bold">{g.name}{g.is_required?' *':''}</h3><p className="text-xs text-emerald-400">{g.selection_mode==='single'?'Choose one':'Choose up to '+g.max_select}</p></div><span className="text-xs text-emerald-300">{count} selected</span></div>
          {groupOptions.map(o=><label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-900 bg-[#061d16] p-3">
            <input type={g.selection_mode==='single'?'radio':'checkbox'} name={'group-'+g.id} checked={selectedSet.has(o.id)} onChange={()=>toggle(g,o)} />
            <span className="flex-1 text-sm font-semibold">{o.name}</span><span className="text-sm font-bold text-lime-300">{o.additional_price_minor===0?'Included':'+'+formatPeso(o.additional_price_minor/100)}</span>
          </label>)}
        </section>
      })}
      <div className="flex items-center justify-between rounded-2xl border border-emerald-800 bg-emerald-950 p-3"><div><p className="text-xs text-emerald-300">Estimated unit price</p><p className="text-xl font-extrabold text-lime-300">{formatPeso(previewTotal)}</p></div><div className="flex items-center gap-3"><button onClick={()=>setQuantity(q=>Math.max(1,q-1))} className="h-9 w-9 rounded-xl border border-emerald-700">−</button><span className="font-bold">{quantity}</span><button onClick={()=>setQuantity(q=>Math.min(99,q+1))} className="h-9 w-9 rounded-xl border border-emerald-700">+</button></div></div>
      {error&&<p role="alert" className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">{error}</p>}
      <button disabled={loading} onClick={submit} className="w-full rounded-xl bg-lime-400 px-4 py-3 font-extrabold text-black disabled:opacity-50">Validate and add to cart</button>
      <p className="text-[11px] text-emerald-500">The database validates option availability, selection limits, dependencies, and prices when you add the item.</p>
    </div>
  </div>;
}
