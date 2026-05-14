#!/bin/bash
set -e
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home

# Verificar dispositivo ADB conectado por USB
DEVICE=$(adb devices | grep -v "List" | grep "device$" | awk '{print $1}' | head -1)
[ -z "$DEVICE" ] && echo "❌ No se detectó dispositivo Android. Verifica el cable USB y modo depuración." && exit 1
echo "📱 Dispositivo: $DEVICE"

CAP_CONFIG="capacitor.config.ts"
CAP_BACKUP="capacitor.config.ts.bak"

cleanup() {
  echo ""
  echo "🔄 Restaurando capacitor.config.ts..."
  cp "$CAP_BACKUP" "$CAP_CONFIG" 2>/dev/null && rm -f "$CAP_BACKUP"
  # Quitar port forwarding
  adb -s "$DEVICE" reverse --remove tcp:8888 2>/dev/null || true
  kill $NETLIFY_PID 2>/dev/null || true
  echo "👋 Listo"
}
trap cleanup EXIT INT TERM

# Parchear config para usar localhost via adb reverse (USB)
cp "$CAP_CONFIG" "$CAP_BACKUP"
cat > "$CAP_CONFIG" << 'EOF'
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hotelpuntagaleria.app',
  appName: 'Hotel Punta Galeria',
  webDir: 'dist',
  server: {
    url: 'http://localhost:8888',
    cleartext: true
  }
};

export default config;
EOF

echo "📝 server.url → http://localhost:8888 (via adb reverse)"

# Build web + sync Android
echo "🔨 Building..."
npx vite build

echo "🔄 Syncing Android..."
npx cap sync android

# Build APK
echo "🏗  Building APK..."
cd android
./gradlew assembleDebug --quiet
cd ..
cp android/app/build/outputs/apk/debug/app-debug.apk HotelPuntaGaleria-live.apk

# Iniciar netlify dev ANTES de instalar el APK
echo "🚀 Iniciando servidor local en puerto 8888..."
netlify dev --no-open &
NETLIFY_PID=$!

echo "⏳ Esperando que el servidor esté listo..."
READY=0
for i in $(seq 1 45); do
  if curl -sf "http://localhost:8888/.netlify/functions/turso-proxy" > /dev/null 2>&1; then
    READY=1
    break
  fi
  printf "."
  sleep 1
done
echo ""
[ "$READY" -eq 0 ] && echo "⚠️  El servidor tardó más de 45s, continuando de todas formas..."

# Redirigir puerto via USB (el teléfono accede a localhost:8888 del Mac)
echo "🔌 Configurando adb reverse tcp:8888..."
adb -s "$DEVICE" reverse tcp:8888 tcp:8888

# Instalar APK
echo "📲 Instalando APK en $DEVICE..."
adb -s "$DEVICE" install -r HotelPuntaGaleria-live.apk

# Abrir la app
echo "▶️  Abriendo app..."
adb -s "$DEVICE" shell am start -n "com.hotelpuntagaleria.app/.MainActivity" 2>/dev/null || true

echo ""
echo "✅ Live reload activo"
echo "   El teléfono accede al servidor Mac via USB (no necesita WiFi)"
echo "   Ctrl+C para detener y restaurar config"
echo ""

wait $NETLIFY_PID
