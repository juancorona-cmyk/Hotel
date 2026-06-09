import { writeFileSync } from 'fs'

const config = `import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hotelpuntagaleria.app',
  appName: 'Hotel Punta Galeria',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    // OTA manual: permite cargar la version desplegada manteniendo el bridge nativo
    allowNavigation: ['hotelpuntagaleria.mx', '*.hotelpuntagaleria.mx']
  }
};

export default config;
`

writeFileSync('capacitor.config.ts', config)
console.log('✅ capacitor.config.ts → producción (hotelpuntagaleria.mx)')
