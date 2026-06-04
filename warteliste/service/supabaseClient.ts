/**
 * Warteliste — Supabase Client
 * Ubicación: service/supabaseClient.ts
 *
 * Instalar: npx expo install @supabase/supabase-js
 *           npx expo install @react-native-async-storage/async-storage
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Credenciales ─────────────────────────────────────────────────────────────

const SUPABASE_URL  = 'https://vmgvnxzcfqhmjexfkthk.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_z5cCluGvKbjy2cTZu0oRGQ_pk72_OXt';

// ─── Cliente ──────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage:          AsyncStorage,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
});

// ─── Tipos de base de datos ───────────────────────────────────────────────────

export type SupabaseCompany = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  is_active: boolean;
  created_at: string;
};

export type SupabaseUser = {
  id: string;
  company_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'admin' | 'employee' | 'monitor' | 'kiosk';
  station: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
};

export type SupabaseQueue = {
  id: string;
  company_id: string;
  ticket_number: string;
  prefix: string;
  customer_name: string;
  customer_contact: string | null;
  service_section_id: string | null;
  status: 'waiting' | 'calling' | 'serving' | 'completed' | 'no_show';
  priority: 'normal' | 'senior' | 'vip' | 'urgent';
  desk: string | null;
  served_by: string | null;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  wait_time_seconds: number | null;
  // JOINs
  service_sections?: { title: string; color: string };
  users?: { full_name: string };
};

export type SupabaseSection = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  avg_time_minutes: number;
  prefix: string;
  color: string;
  is_active: boolean;
  created_at: string;
};

// ─── Helpers: config por empresa ─────────────────────────────────────────────

export async function getConfig(companyId: string, key: string): Promise<string | null> {
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', key)
    .single();
  return data?.value ?? null;
}

export async function setConfig(companyId: string, key: string, value: string): Promise<void> {
  await supabase.from('system_config').upsert(
    { company_id: companyId, key, value, updated_at: new Date().toISOString() },
    { onConflict: 'company_id,key' }
  );
}

// ─── Helpers: empresa por slug ────────────────────────────────────────────────

export async function getCompanyBySlug(slug: string): Promise<SupabaseCompany | null> {
  const { data } = await supabase
    .from('companies')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  return data ?? null;
}

export async function createCompany(
  name: string,
  slug: string,
  brandColor: string = '#00685f'
): Promise<SupabaseCompany | null> {
  const { data, error } = await supabase
    .from('companies')
    .insert({ name, slug: slug.toLowerCase().replace(/\s+/g, '-'), brand_color: brandColor })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ─── Realtime: suscribirse a cambios en la cola ───────────────────────────────

export function subscribeToQueue(
  companyId: string,
  onUpdate: (payload: any) => void,
) {
  return supabase
    .channel(`queue:${companyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'queue',
        filter: `company_id=eq.${companyId}`,
      },
      onUpdate,
    )
    .subscribe();
}