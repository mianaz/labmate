import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bioinfospace.labmate',
  appName: 'LabMate',
  webDir: 'dist',
  server: {
    // Allow fetching protocol updates from labmate-recipe repo
    allowNavigation: ['raw.githubusercontent.com'],
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
