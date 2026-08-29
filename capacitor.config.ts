import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.anamul.goodapp',
  appName: 'Good-App',
  webDir: 'dist/client',
  // Primary mode: load the live deployed app so all server functions work.
  // To bundle locally (offline), comment out server.url and run `bun run cap:build`.
  server: {
    // Must be the FINAL domain (lovable.app 302-redirects here). A cross-host
    // redirect makes the WebView hand the URL to Chrome instead of staying in-app.
    url: 'https://www.goodapp2.live',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      '*.goodapp2.live',
      'www.goodapp2.live',
      'goodapp2.live',
      'good-app2.lovable.app',
      '*.lovable.app',
      '*.supabase.co',
      'accounts.google.com',
      'oauth2.googleapis.com',
    ],
  },
  android: {
    buildOptions: {
      // Release signing is handled by CI secrets; leave these undefined for debug builds.
    },
  },
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
      logLevel: 1,
    },
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#0ea5a4',
    },
  },
};

export default config;
