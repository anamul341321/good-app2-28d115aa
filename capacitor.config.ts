import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goodapp.mobile',
  appName: 'Good-App',
  webDir: 'dist/client',
  // Primary mode: load the live deployed app so all server functions work.
  // To bundle locally (offline), comment out server.url and run `bun run cap:build`.
  server: {
    url: 'https://good-app2.lovable.app',
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
