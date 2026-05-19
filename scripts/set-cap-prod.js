import { writeFileSync } from 'fs'

const config = `import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hotelpuntagaleria.app',
  appName: 'Hotel Punta Galeria',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
`

writeFileSync('capacitor.config.ts', config)
console.log('✅ capacitor.config.ts → producción (hotelpuntagaleria.mx)')
