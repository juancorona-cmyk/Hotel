import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hotelpuntagaleria.app',
  appName: 'Hotel Punta Galeria',
  webDir: 'dist',
  server: {
    url: 'http://127.0.0.1:8888',
    cleartext: true,
    androidScheme: 'http'
  }
};

export default config;
