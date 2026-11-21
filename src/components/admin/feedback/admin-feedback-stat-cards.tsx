// @ts-nocheck
// VEYNS Admin, Feedback: the 5 stat cards above the list (Step B5): average rating, total reviews, rating spread, reply rate, average response time.
import React from 'react';
import { Clock, MessageSquare, Star } from 'lucide-react';
import { FEEDBACK_RATINGS, formatResponseTime, ratingShare } from './admin-feedback-calc';

const BAR_COLOR: Record<number, string> = { 5: 'bg-lime-400', 4: 'bg-lime-300', 3: 'bg-lime-500', 2: 'bg-amber-400', 1: 'bg-red-400' };

function Shell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ${className}`}>{children}</div>;
}

function ReplyDonut({ percent }: { percent: number | null }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" aria-hidden="true">
      <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
      <circle
        cx="32" cy="32" r={radius} fill="none" stroke="#a3e635" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * circumference} ${circumference}`} transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffffff">{percent === null ? '—' : `${percent}%`}</text>
    </svg>
  );
}

export function AdminFeedbackStatCards({ stats }: { stats: any }) {
  const trend = stats ? stats.trend : null;
  return (
    <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-[1fr_0.8fr_1.6fr_1fr_1fr]">
      <Shell>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
          <Star className="h-6 w-6 fill-current" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight text-white">
            {stats && stats.average !== null ? stats.average.toFixed(1) : '—'}
            {trend !== null && trend !== 0 && (
              <span className={`ml-2 text-xs font-semibold ${trend > 0 ? 'text-lime-400' : 'text-red-400'}`}>
                {trend > 0 ? '↑ +' : '↓ '}{trend.toFixed(1)}
              </span>
            )}
          </p>
          <p className="text-xs text-zinc-400">{trend !== null ? 'Average rating, vs the 30 days before' : 'Average rating'}</p>
        </div>
      </Shell>

      <Shell>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-lime-300">
          <MessageSquare className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight text-white">{stats ? stats.total.toLocaleString() : '—'}</p>
          <p className="text-xs text-zinc-400">Total Reviews</p>
        </div>
      </Shell>

      <Shell className="col-span-2 xl:col-span-1">
        <div className="w-full space-y-1" role="img" aria-label="Share of reviews per star rating">
          {FEEDBACK_RATINGS.slice().reverse().map((n) => (
            <div key={n} className="flex items-center gap-2 text-[11px] text-zinc-300">
              <span className="flex w-6 shrink-0 items-center gap-0.5">{n}<Star className="h-2.5 w-2.5 fill-current text-amber-300" aria-hidden="true" /></span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                <span className={`block h-full rounded-full ${BAR_COLOR[n]}`} style={{ width: `${ratingShare(stats, n)}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right text-zinc-400">{stats ? `${ratingShare(stats, n)}%` : '—'}</span>
              <span className="w-7 shrink-0 text-right font-semibold text-white">{stats ? stats.ratingCounts[n] : '—'}</span>
            </div>
          ))}
        </div>
      </Shell>

      <Shell>
        <ReplyDonut percent={stats ? stats.replyRate : null} />
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight text-white">{stats && stats.replyRate !== null ? `${stats.replyRate}%` : '—'}</p>
          <p className="text-xs text-zinc-400">Reply Rate</p>
        </div>
      </Shell>

      <Shell>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-lime-300">
          <Clock className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold leading-tight text-white">{stats ? formatResponseTime(stats.avgResponseHours) : '—'}</p>
          <p className="text-xs text-zinc-400">Avg Response Time</p>
        </div>
      </Shell>
    </div>
  );
}
