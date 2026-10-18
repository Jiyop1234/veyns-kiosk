// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vnmekojyjfoolvjxvgex.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IDMP1Sy7wk2RtMT5x8OK-w_lGA5DXSU'; // Replace with your actual sb_publishable_ key from Supabase

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);