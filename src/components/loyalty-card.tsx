import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface LoyaltyCardProps {
  userId: string;
}

export const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ userId }) => {
  const [profile, setProfile] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoyaltyData();
  }, [userId]);

  const fetchLoyaltyData = async () => {
    setLoading(true);
    
    // Fetch customer profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Fetch dynamic milestone blocks & rewards from database
    const { data: blks } = await supabase
      .from('milestone_blocks')
      .select('*')
      .order('block_number');

    const { data: rwds } = await supabase
      .from('block_rewards')
      .select('*');

    // Fetch account vouchers
    const { data: vchs } = await supabase
      .from('vouchers')
      .select('*')
      .eq('user_id', userId);

    setProfile(prof);
    setBlocks(blks || []);
    setRewards(rwds || []);
    setVouchers(vchs || []);
    setLoading(false);
  };

  if (loading) return <div className="p-4 text-white text-xs">Loading Loyalty Card...</div>;

  // Account Suspension View
  if (profile?.status === 'SUSPENDED') {
    return (
      <div className="w-full max-w-md p-6 bg-red-950/80 border border-red-500 rounded-2xl text-center text-red-200 shadow-2xl">
        <h2 className="text-lg font-bold mb-2 text-red-400">CARD SUSPENDED</h2>
        <p className="text-xs text-red-200/80">
          Your loyalty card is currently suspended and cannot accumulate stamps or claim rewards.
        </p>
      </div>
    );
  }

  // Calculate current active block dynamically
  const stamps = profile?.current_stamp_count || 1;
  const currentBlock = blocks.find(
    (b) => stamps >= b.cumulative_start && stamps <= b.cumulative_end
  ) || blocks[0] || { stamps_required: 4, cumulative_start: 1, block_number: 1 };

  const stampsInCurrentBlock = stamps - currentBlock.cumulative_start + 1;

  // Claim secret single-use voucher code
  const claimVoucher = async (reward: any) => {
    const code = `VEYNS-${reward.reward_type.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const { data, error } = await supabase
      .from('vouchers')
      .insert({
        user_id: userId,
        code,
        discount_type: reward.reward_type,
        is_claimed: true
      })
      .select()
      .single();

    if (!error && data) {
      setVouchers([...vouchers, data]);
    }
  };

  return (
    <div className="w-full max-w-md perspective-1000 my-4">
      <div 
        className={`relative w-full h-80 rounded-2xl transition-transform duration-700 transform-style-3d cursor-pointer shadow-2xl ${
          isFlipped ? 'rotate-y-180' : ''
        } ${
          profile?.tier === 'DIAMOND' 
            ? 'bg-zinc-950 border-2 border-cyan-400 shadow-cyan-500/20' 
            : profile?.tier === 'PLATINUM'
            ? 'bg-zinc-900 border-2 border-slate-300 shadow-slate-400/20'
            : 'bg-emerald-950 border-2 border-blue-500 shadow-blue-500/30' // Regular Emerald Skin
        }`}
      >
        {/* FRONT OF CARD */}
        <div className="absolute inset-0 p-6 flex flex-col justify-between backface-hidden">
          <div className="flex justify-between items-center">
            {/* Header label: Shows VIP tier if PLATINUM or DIAMOND, otherwise shows current Block */}
            <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase">
              {profile?.tier ? `${profile.tier} CARD` : `BLOCK ${currentBlock.block_number}`}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
              className="text-xs bg-emerald-800/50 hover:bg-emerald-700 px-3 py-1 rounded-full text-emerald-200 cursor-pointer"
            >
              Flip for Rewards ↺
            </button>
          </div>

          {/* Stamp Grid */}
          <div className="grid grid-cols-4 gap-3 my-auto">
            {Array.from({ length: currentBlock.stamps_required }).map((_, idx) => {
              const stampNum = idx + 1;
              const isStamped = stampNum <= stampsInCurrentBlock;
              const globalStampNum = currentBlock.cumulative_start + idx;
              const reward = rewards.find((r) => r.cumulative_stamp === globalStampNum);

              return (
                <div
                  key={idx}
                  className={`h-14 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all ${
                    isStamped
                      ? 'bg-emerald-500 border-emerald-300 text-black shadow-lg shadow-emerald-500/50'
                      : 'bg-emerald-900/30 border-emerald-800 text-emerald-600'
                  }`}
                >
                  {isStamped ? (
                    globalStampNum === 1 ? 'WELCOME' : '✓'
                  ) : reward ? (
                    <span className="text-[10px] text-amber-400">{reward.reward_type}</span>
                  ) : (
                    stampNum
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-xs text-emerald-400/70 text-center">
            Total Stamps: {stamps} | 1 Stamp / Day Limit
          </div>
        </div>

        {/* BACK OF CARD */}
        <div className="absolute inset-0 p-6 flex flex-col justify-between backface-hidden rotate-y-180 bg-zinc-900 rounded-2xl text-white">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-emerald-400">Founder's Vault & Vouchers</h3>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-full text-zinc-300 cursor-pointer"
            >
              Front ↺
            </button>
          </div>

          <div className="overflow-y-auto max-h-48 space-y-2 my-2 pr-1">
            <p className="text-xs italic text-zinc-400 mb-2">"Thank you for being part of VEYNS."</p>
            {rewards.filter(r => r.cumulative_stamp <= stamps).map((reward, i) => {
              const existingVoucher = vouchers.find(v => v.discount_type === reward.reward_type);

              return (
                <div key={i} className="flex justify-between items-center bg-zinc-800/80 p-2 rounded text-xs border border-zinc-700">
                  <span>{reward.reward_type} (Stamp #{reward.cumulative_stamp})</span>
                  {existingVoucher ? (
                    <span className="font-mono bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">
                      {existingVoucher.code}
                    </span>
                  ) : (
                    <button
                      onClick={() => claimVoucher(reward)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-black px-3 py-1 rounded font-bold cursor-pointer"
                    >
                      Claim
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyCard;