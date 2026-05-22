import Constants from 'expo-constants';

type QmesaExtraConfig = {
  qmesaSupabaseUrl?: string;
  qmesaAnonKey?: string;
};

const extra = (Constants.expoConfig?.extra as QmesaExtraConfig | undefined) || {};

export const QMESA_SUPABASE_URL =
  process.env.EXPO_PUBLIC_QMESA_SUPABASE_URL ||
  extra.qmesaSupabaseUrl ||
  'https://jlfbzdqhaezdtyyajqlk.supabase.co';

export const QMESA_ANON_KEY =
  process.env.EXPO_PUBLIC_QMESA_ANON_KEY ||
  extra.qmesaAnonKey ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsZmJ6ZHFoYWV6ZHR5eWFqcWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjM0NjksImV4cCI6MjA4ODkzOTQ2OX0.6VX3Z1FjxgZuBYALd2oU4bQl0nzbMcBUcc0nLW_DbvA';

export const QMESA_REST_URL = `${QMESA_SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
