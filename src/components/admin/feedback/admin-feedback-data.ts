// @ts-nocheck
// VEYNS Admin, Feedback: loads the numbers for the stat cards and the filter counts (Step B5).
// Read-only: one query for the posts' rating, status, date and reply date (the 1,000 newest posts). The list of posts is loaded by the manager as before.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { computeFeedbackStats } from './admin-feedback-calc';

export function useAdminFeedbackStats() {
  const [stats, setStats] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const reqId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const { data, error } = await supabase
        .from('feedback_posts')
        .select('id,rating,status,created_at,feedback_replies(created_at)')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (id !== reqId.current) return;
      if (error || !data) { setFailed(true); return; }
      setFailed(false);
      setStats(computeFeedbackStats(data, Date.now()));
    } catch {
      if (id === reqId.current) setFailed(true);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { stats, failed, reload };
}
