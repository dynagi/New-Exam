/**
 * App configuration — EDIT THESE THREE VALUES before running.
 *
 * 1. SUPABASE_URL / SUPABASE_ANON_KEY:
 *    Supabase dashboard -> Project Settings -> API.
 *    (The anon key is safe to ship in the app; RLS enforces access.)
 *
 * 2. CRYPTO_SERVER_URL — where the Node crypto service runs:
 *    - Web browser:             http://localhost:4000 (picked automatically)
 *    - Android emulator:        http://10.0.2.2:4000
 *    - iOS simulator:           http://127.0.0.1:4000
 *    - Physical phone (Expo Go): http://<YOUR-PC-LAN-IP>:4000  e.g. http://192.168.1.5:4000
 */
import { Platform } from 'react-native';

export const SUPABASE_URL = 'https://avlardakttkdnfltnape.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_LXPH1JifMnDAK51wf_SSJA_tUHRTUjo';
export const CRYPTO_SERVER_URL =
  Platform.OS === 'web' ? 'http://localhost:4000' : 'http://10.0.2.2:4000';

export const IS_CONFIGURED = !SUPABASE_URL.includes('YOUR-PROJECT');

/**
 * Deterministic login email for a center code. MUST match centerEmail() in
 * the Node server — the center logs in with code + password, and both sides
 * map the code to the same hidden auth email.
 */
export function centerEmail(code: string): string {
  const slug = code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `center.${slug}@secureaiexam.local`;
}
