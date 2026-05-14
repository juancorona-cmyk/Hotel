import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hotelpuntagaleria.app',
  appName: 'Hotel Punta Galeria',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'hotelpuntagaleria.mx'
  }
};

export default config;
