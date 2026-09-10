import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor wraps the SAME Vite web build (dist/) that ships to the web.
// IMPORTANT: build with a relative base for the native shell — `npm run build:native`
// (VITE_BASE=./). The web deploy build uses base '/labmate/', whose absolute asset
// URLs 404 inside a capacitor://localhost / file:// origin.
const config: CapacitorConfig = {
  appId: 'com.bioinfospace.labmate',
  appName: 'LabMate',
  webDir: 'dist',
  // No `server.allowNavigation`: the recipe sync uses fetch(), which needs no
  // navigation allowance, and allowNavigation would expose the native bridge to
  // every page served from raw.githubusercontent.com (any GitHub user's content).
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
