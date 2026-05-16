import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hotelpuntagaleria.app',
  appName: 'Hotel Punta Galeria',
  webDir: 'dist',
  server: {
    url: 'http://localhost:5173',
    cleartext: true,
    androidScheme: 'http'
  }
};

export default config;
