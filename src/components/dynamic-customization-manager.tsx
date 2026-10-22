import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPeso } from '@/lib/menu-data';

type Group = {
  id: string; name: string; description: string; selection_mode: 'single' | 'multiple';
  min_select: number; max_select: number; is_required: boolean; is_active: boolean; sort_order: number;
};
type Option = {
  id: string; group_id: string; name: string; description: string; additional_price_minor: number;
  is_active: boolean; sort_order: number;
};
type Assignment = { menu_item_id: string; group_id: string; sort_order: number; visible_when_option_ids: string[] };

const field = 'w-full rounded-xl border border-emerald-800 bg-[#04140f] px-3 py-2 text-sm text-white focus:border-lime-400 focus:outline-none';
const label = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-emerald-300';

export function DynamicCustomizationManager({ item, onClose }: { item: any; onClose: () => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectionMode, setSelectionMode] = useState<'single' | 'multiple'>('single');
  const [minSelect, setMinSelect] = useState(0);
  const [maxSelect, setMaxSelect] = useState(1);
  const [required, setRequired] = useState(false);
  const [groupActive, setGroupActive] = useState(true);
  const [optionName, setOptionName] = useState('');
  const [optionPrice, setOptionPrice] = useState('0');
  const [optionActive, setOptionActive] = useState(true);
  const [editingGroupId, setEditingGroupId] = useState('');
  const [editingOptionId, setEditingOptionId] = useState('');
  const [dependencyIds, setDependencyIds] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const groupOptions = options.filter(o => o.group_id === selectedGroupId);
  const assigned = useMemo(() => assignments.find(a => a.group_id === selectedGroupId), [assignments, selectedGroupId]);

  const refresh = async () => {
    setLoading(true);
    const [g, o, a] = await Promise.all([
      supabase.from('menu_option_groups').select('*').order('sort_order'),
      supabase.from('menu_options').select('*').order('sort_order'),
      supabase.from('menu_item_option_groups').select('*').eq('menu_item_id', item.id).order('sort_order')
    ]);
    if (g.error || o.error || a.error) setStatus('Could not load customizations. Apply the Supabase migration and check database permissions.');
    const nextGroups = (g.data || []) as Group[];
    setGroups(nextGroups);
    setOptions((o.data || []) as Option[]);
    setAssignments((a.data || []) as Assignment[]);
    if (!selectedGroupId && nextGroups[0]) setSelectedGroupId(nextGroups[0].id);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [item.id]);

  const saveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('');
    const payload = {
      name: groupName.trim(), selection_mode: selectionMode,
      min_select: required ? Math.max(1, Number(minSelect)) : Number(minSelect),
      max_select: selectionMode === 'single' ? 1 : Math.max(1, Number(maxSelect)),
      is_required: required, is_active: groupActive
    };
    if (!payload.name) return setStatus('Enter a group name.');
    if (payload.min_select > payload.max_select) return setStatus('Minimum selections cannot exceed maximum selections.');
    const query = editingGroupId
      ? supabase.from('menu_option_groups').update(payload).eq('id', editingGroupId)
      : supabase.from('menu_option_groups').insert(payload).select('*').single();
    const result = await query;
    if (result.error) return setStatus(result.error.message);
    const id = editingGroupId || result.data?.id;
    setGroupName(''); setEditingGroupId('');
    await refresh();
    if (id) setSelectedGroupId(id);
    setStatus('Option group saved.');
  };

  const editGroup = (g: Group) => {
    setSelectedGroupId(g.id); setEditingGroupId(g.id); setGroupName(g.name);
    setSelectionMode(g.selection_mode); setMinSelect(g.min_select); setMaxSelect(g.max_select);
    setRequired(g.is_required); setGroupActive(g.is_active);
  };

  const saveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !optionName.trim()) return setStatus('Choose a group and enter an option name.');
    const price = Math.round(Number(optionPrice) * 100);
    if (!Number.isFinite(price) || price < 0) return setStatus('Enter a valid non-negative price.');
    const payload = { group_id: selectedGroupId, name: optionName.trim(), additional_price_minor: price, is_active: optionActive };
    const result = editingOptionId
      ? await supabase.from('menu_options').update(payload).eq('id', editingOptionId)
      : await supabase.from('menu_options').insert(payload);
    if (result.error) return setStatus(result.error.message);
    setOptionName(''); setOptionPrice('0'); setEditingOptionId('');
    await refresh(); setStatus('Option saved.');
  };

  const editOption = (o: Option) => {
    setEditingOptionId(o.id); setOptionName(o.name);
    setOptionPrice((o.additional_price_minor / 100).toFixed(2)); setOptionActive(o.is_active);
  };

  const toggleAssignment = async (checked: boolean) => {
    setStatus('');
    if (checked) {
      const result = await supabase.from('menu_item_option_groups').insert({
        menu_item_id: item.id, group_id: selectedGroupId, sort_order: assignments.length * 10,
        visible_when_option_ids: dependencyIds
      });
      if (result.error) return setStatus(result.error.message);
    } else {
      const result = await supabase.from('menu_item_option_groups').delete().eq('menu_item_id', item.id).eq('group_id', selectedGroupId);
      if (result.error) return setStatus(result.error.message);
    }
    await refresh();
  };

  const saveDependencies = async () => {
    const result = await supabase.from('menu_item_option_groups')
      .update({ visible_when_option_ids: dependencyIds })
      .eq('menu_item_id', item.id).eq('group_id', selectedGroupId);
    if (result.error) return setStatus(result.error.message);
    await refresh(); setStatus('Conditional visibility saved.');
  };

  const reorderGroup = async (direction: -1 | 1) => {
    const index = assignments.findIndex(a => a.group_id === selectedGroupId);
    const other = assignments[index + direction];
    if (index < 0 || !other) return;
    const current = assignments[index];
    await Promise.all([
      supabase.from('menu_item_option_groups').update({ sort_order: other.sort_order }).eq('menu_item_id', item.id).eq('group_id', current.group_id),
      supabase.from('menu_item_option_groups').update({ sort_order: current.sort_order }).eq('menu_item_id', item.id).eq('group_id', other.group_id)
    ]);
    refresh();
  };

  const reorderOption = async (o: Option, direction: -1 | 1) => {
    const list = [...groupOptions].sort((a,b) => a.sort_order - b.sort_order);
    const index = list.findIndex(x => x.id === o.id);
    const other = list[index + direction];
    if (!other) return;
    await Promise.all([
      supabase.from('menu_options').update({ sort_order: other.sort_order }).eq('id', o.id),
      supabase.from('menu_options').update({ sort_order: o.sort_order }).eq('id', other.id)
    ]);
    refresh();
  };

  const removeOption = async (o: Option) => {
    if (!window.confirm(`Delete "${o.name}"? Existing orders should retain their saved snapshots.`)) return;
    const result = await supabase.from('menu_options').delete().eq('id', o.id);
    if (result.error) setStatus(result.error.message); else { await refresh(); setStatus('Option deleted.'); }
  };

  const removeGroup = async (g: Group) => {
    if (!window.confirm(`Delete group "${g.name}" and its options?`)) return;
    const result = await supabase.from('menu_option_groups').delete().eq('id', g.id);
    if (result.error) setStatus(result.error.message); else { setSelectedGroupId(''); await refresh(); setStatus('Group deleted.'); }
  };

  useEffect(() => { setDependencyIds(assigned?.visible_when_option_ids || []); }, [selectedGroupId, assignments.length]);

  if (loading) return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 text-white">Loading customizations…</div>;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-3 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5 rounded-3xl border border-emerald-800 bg-[#04140f] p-4 text-white shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3 border-b border-emerald-900 pb-4">
          <div><p className="text-xs font-bold uppercase tracking-widest text-lime-400">Menu Manager / Customizations</p><h2 className="mt-1 text-2xl font-extrabold">{item.name}</h2><p className="text-sm text-emerald-300">Base price: {formatPeso(item.price)} · Configure reusable groups and options.</p></div>
          <button onClick={onClose} className="rounded-xl border border-emerald-800 px-3 py-2 text-sm">Close</button>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <section className="space-y-4 rounded-2xl border border-emerald-900 p-4">
            <h3 className="font-bold">Option groups</h3>
            <div className="space-y-2">
              {groups.map(g => <div key={g.id} className={`flex items-center gap-2 rounded-xl border p-2 ${g.id === selectedGroupId ? 'border-lime-400 bg-emerald-950' : 'border-emerald-900'}`}>
                <button className="min-w-0 flex-1 text-left" onClick={() => {setSelectedGroupId(g.id); setEditingGroupId(''); setGroupName('');}}>
                  <span className="block truncate text-sm font-bold">{g.name}</span><span className="text-[10px] text-emerald-300">{g.selection_mode} · {g.is_required ? 'required' : 'optional'} · {g.is_active ? 'active' : 'inactive'}</span>
                </button>
                <button className="text-xs text-lime-300" onClick={() => editGroup(g)}>Edit</button>
                <button className="text-xs text-red-300" onClick={() => removeGroup(g)}>Delete</button>
              </div>)}
            </div>
            <form onSubmit={saveGroup} className="space-y-3 border-t border-emerald-900 pt-4">
              <h4 className="text-sm font-bold">{editingGroupId ? 'Edit group' : 'Create group'}</h4>
              <div><label className={label}>Group name</label><input className={field} value={groupName} onChange={e=>setGroupName(e.target.value)} required placeholder="e.g. Add Egg" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={label}>Selection</label><select className={field} value={selectionMode} onChange={e=>{const v=e.target.value as any;setSelectionMode(v);if(v==='single')setMaxSelect(1);}}><option value="single">Single select</option><option value="multiple">Multi select</option></select></div>
                <div><label className={label}>Minimum</label><input className={field} type="number" min="0" value={minSelect} onChange={e=>setMinSelect(Number(e.target.value))}/></div>
                <div><label className={label}>Maximum</label><input className={field} type="number" min="1" value={selectionMode==='single'?1:maxSelect} disabled={selectionMode==='single'} onChange={e=>setMaxSelect(Number(e.target.value))}/></div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)}/> Required</label>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={groupActive} onChange={e=>setGroupActive(e.target.checked)}/> Active</label>
              </div>
              <div className="flex gap-2"><button className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-extrabold text-black">Save group</button>{editingGroupId && <button type="button" className="rounded-xl border border-emerald-800 px-3 text-sm" onClick={()=>{setEditingGroupId('');setGroupName('');}}>Cancel</button>}</div>
            </form>
          </section>
          <section className="space-y-4 rounded-2xl border border-emerald-900 p-4">
            <h3 className="font-bold">Options {selectedGroup ? `— ${selectedGroup.name}` : ''}</h3>
            {!selectedGroup ? <p className="text-sm text-emerald-300">Create or select a group to manage options.</p> : <>
              <form onSubmit={saveOption} className="grid gap-2 sm:grid-cols-[1fr_130px_auto]">
                <input className={field} value={optionName} onChange={e=>setOptionName(e.target.value)} required placeholder="Option name"/>
                <input className={field} type="number" min="0" step="0.01" value={optionPrice} onChange={e=>setOptionPrice(e.target.value)} required placeholder="Extra ₱"/>
                <button className="rounded-xl bg-lime-400 px-3 py-2 text-sm font-extrabold text-black">{editingOptionId?'Save':'Add option'}</button>
                <label className="flex items-center gap-2 text-xs text-emerald-300"><input type="checkbox" checked={optionActive} onChange={e=>setOptionActive(e.target.checked)}/> Option active</label>
                {editingOptionId && <button type="button" className="text-left text-xs text-emerald-300" onClick={()=>{setEditingOptionId('');setOptionName('');setOptionPrice('0');}}>Cancel edit</button>}
              </form>
              <div className="space-y-2">
                {groupOptions.sort((a,b)=>a.sort_order-b.sort_order).map(o=><div key={o.id} className="flex items-center gap-2 rounded-xl border border-emerald-900 p-3">
                  <div className="min-w-0 flex-1"><p className="font-semibold">{o.name} {!o.is_active && <span className="text-xs text-red-300">(inactive)</span>}</p><p className="text-xs text-lime-300">+{formatPeso(o.additional_price_minor/100)}</p></div>
                  <button onClick={()=>reorderOption(o,-1)} className="text-xs">↑</button><button onClick={()=>reorderOption(o,1)} className="text-xs">↓</button><button onClick={()=>editOption(o)} className="text-xs text-lime-300">Edit</button><button onClick={()=>removeOption(o)} className="text-xs text-red-300">Delete</button>
                </div>)}
              </div>
              <div className="space-y-3 border-t border-emerald-900 pt-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!assigned} onChange={e=>toggleAssignment(e.target.checked)}/> Assign this group to {item.name}</label>
                {assigned && <>
                  <div><label className={label}>Show this group only when ALL selected options are chosen</label><p className="mb-2 text-xs text-emerald-400">Leave empty for always visible. Choose an option such as “Add Egg” to make Egg Preparation conditional.</p>
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-emerald-900 p-3">
                      {options.filter(o=>o.is_active && o.group_id !== selectedGroupId).map(o=><label key={o.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dependencyIds.includes(o.id)} onChange={e=>setDependencyIds(prev=>e.target.checked?[...prev,o.id]:prev.filter(id=>id!==o.id))}/>{o.name} <span className="text-xs text-emerald-400">({groups.find(g=>g.id===o.group_id)?.name})</span></label>)}
                    </div>
                    <div className="mt-2 flex gap-2"><button onClick={saveDependencies} className="rounded-xl border border-emerald-700 px-3 py-2 text-xs font-bold">Save condition</button><button onClick={()=>reorderGroup(-1)} className="rounded-xl border border-emerald-700 px-3 py-2 text-xs">Group ↑</button><button onClick={()=>reorderGroup(1)} className="rounded-xl border border-emerald-700 px-3 py-2 text-xs">Group ↓</button></div>
                  </div>
                </>}
              </>}
          </section>
        </div>
        {status && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950 p-3 text-sm text-lime-200">{status}</p>}
        <p className="text-xs text-emerald-400">Changes apply to future orders. Completed order customization snapshots must remain unchanged.</p>
      </div>
    </div>
  );
}
