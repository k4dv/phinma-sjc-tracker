import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yvqnjttpoiyxdybdwpcm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1mV4wOJQkWTpLyM9uZCpag_NjkzV5NN';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);