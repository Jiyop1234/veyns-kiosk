import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

export const LoyaltyManager: React.FC = () => {
  const [searchEmail, setSearchEmail] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [message, setMessage] = useState('');

  const handleSearch = async () => {
    setMessage('');
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', searchEmail.trim())
      .single();

    if (error || !data) {
      setMessage('Customer not found.');
      setCustomer(null);
    } else {
      setCustomer(data);
    }
  };

  const updateStamps = async (delta: number) => {
    const newCount = Math.max(1, customer.current_stamp_count + delta);
    const { data, error } = await supabase
      .from('profiles')
      .update({ current_stamp_count: newCount })
      .eq('id', customer.id)
      .select()
      .single();

    if (!error) {
      setCustomer(data);
      setMessage(`Stamps updated to ${newCount}`);
    }
  };

  const updateTier = async (newTier: 'SILVER' | 'PLATINUM' | 'DIAMOND') => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ tier: newTier })
      .eq('id', customer.id)
      .select()
      .single();

    if (!error) {
      setCustomer(data);
      setMessage(`Tier updated to ${newTier}`);
    }
  };

  const toggleStatus = async () => {
    const newStatus = customer.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const { data, error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', customer.id)
      .select()
      .single();

    if (!error) {
      setCustomer(data);
      setMessage(`Card status set to ${newStatus}`);
    }
  };

  return (
    <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl text-white max-w-lg">
      <h2 className="text-lg font-bold mb-4 text-emerald-400">Admin Loyalty Manager</h2>

      {/* Search Bar */}
      <div className="flex gap-2 mb-4">
        <input
          type="email"
          placeholder="Customer Email..."
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
          className="flex-1 bg-zinc-800 border border-zinc-700 px-3 py-2 rounded text-sm text-white focus:outline-none focus:border-emerald-500"
        />
        <button
          onClick={handleSearch}
          className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-sm font-bold text-black"
        >
          Search
        </button>
      </div>

      {message && <div className="text-xs mb-4 text-amber-400">{message}</div>}

      {customer && (
        <div className="space-y-4 border-t border-zinc-800 pt-4">
          <div>
            <p className="font-bold">{customer.full_name || customer.email}</p>
            <p className="text-xs text-zinc-400">ID: {customer.id}</p>
          </div>

          {/* Stamp Controls */}
          <div className="flex items-center justify-between bg-zinc-800/50 p-3 rounded">
            <span className="text-sm">Stamps: <strong>{customer.current_stamp_count}</strong></span>
            <div className="flex gap-2">
              <button
                onClick={() => updateStamps(-1)}
                className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded font-bold"
              >
                -1
              </button>
              <button
                onClick={() => updateStamps(1)}
                className="bg-emerald-600 hover:bg-emerald-500 text-black px-3 py-1 rounded font-bold"
              >
                +1 Stamp
              </button>
            </div>
          </div>

          {/* Tier Override */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Override Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {(['SILVER', 'PLATINUM', 'DIAMOND'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => updateTier(t)}
                  className={`py-1.5 rounded text-xs font-bold border ${
                    customer.tier === t
                      ? 'bg-emerald-500 text-black border-emerald-400'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Freeze Switch */}
          <div className="pt-2">
            <button
              onClick={toggleStatus}
              className={`w-full py-2 rounded font-bold text-xs ${
                customer.status === 'ACTIVE'
                  ? 'bg-red-900/40 border border-red-700 text-red-300 hover:bg-red-900/60'
                  : 'bg-green-900/40 border border-green-700 text-green-300 hover:bg-green-900/60'
              }`}
            >
              {customer.status === 'ACTIVE' ? 'Freeze / Suspend Card' : 'Unfreeze Card'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};