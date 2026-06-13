/**
 * App configuration — EDIT THESE THREE VALUES before running.
 *
 * 1. SUPABASE_URL / SUPABASE_ANON_KEY:
 *    Supabase dashboard -> Project Settings -> API.
 *    (The anon key is safe to ship in the app; RLS enforces access.)
 *
 * 2. CRYPTO_SERVER_URL — where the Node crypto service runs. This is now
 *    derived automatically per platform (see below):
 *    - Web browser:             http://localhost:4000
 *    - Physical phone (Expo Go): http://<PC-LAN-IP>:4000 — auto-detected from
 *                               the Metro bundle host, no manual editing needed
 *    - Android emulator:        http://10.0.2.2:4000 (fallback)
 *    - iOS simulator:           http://127.0.0.1:4000 (fallback)
 *    Note: the crypto server must be reachable on your LAN — start it with
 *    `npm start` and allow Node through the firewall on port 4000.
 */
import { NativeModules, Platform } from 'react-native';

export const SUPABASE_URL = 'https://avlardakttkdnfltnape.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_LXPH1JifMnDAK51wf_SSJA_tUHRTUjo';

const CRYPTO_PORT = 4000;

/**
 * On a physical phone (Expo Go) the dev machine is NOT reachable at localhost
 * or the Android-emulator alias 10.0.2.2 — only at the PC's LAN IP. Metro
 * already served the JS bundle to the phone from that exact IP, so we recover
 * it from the bundle URL (e.g. http://192.168.1.5:8081/index.bundle) and reuse
 * it for the crypto service. This makes scanning "just work" on a real device
 * with no manual IP editing; emulators/simulators fall back below.
 */
function lanHostFromBundle(): string | null {
  const url: string = (NativeModules as { SourceCode?: { scriptURL?: string } })?.SourceCode?.scriptURL ?? '';
  const host = /^https?:\/\/([^/:]+)(?::\d+)?\//.exec(url)?.[1];
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

const lanHost = Platform.OS === 'web' ? null : lanHostFromBundle();
// Emulator/simulator fallbacks when no LAN IP is available.
const fallback = Platform.OS === 'ios' ? '127.0.0.1' : '10.0.2.2';

export const CRYPTO_SERVER_URL =
  Platform.OS === 'web'
    ? `http://localhost:${CRYPTO_PORT}`
    : `http://${lanHost ?? fallback}:${CRYPTO_PORT}`;

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
