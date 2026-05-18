#!/bin/bash
set -e
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
echo -e "${GREEN}🏨 Hotel Punta Galería — Live Reload${NC}"

# ── Verificar dispositivo ──────────────────────────────────────────────────────
DEVICE=$(adb devices | grep -v "List" | grep "device$" | awk '{print $1}' | head -1)
if [ -z "$DEVICE" ]; then
  echo -e "${RED}❌ No se detectó dispositivo Android.${NC}"
  echo "   Verifica: cable USB conectado y depuración USB activada."
  exit 1
fi
echo "📱 Dispositivo: $DEVICE"

NETLIFY_PID=""

restore_prod_config() {
  cat > capacitor.config.ts << 'PRODEOF'
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hotelpuntagaleria.app',
  appName: 'Hotel Punta Galeria',
  webDir: 'dist',
  server: {
    url: 'https://hotelpuntagaleria.mx',
    androidScheme: 'https'
  }
};

export default config;
PRODEOF
  echo "🔁 capacitor.config.ts → producción restaurado"
}

cleanup() {
  echo ""
  echo "🔄 Cerrando servidores..."
  [ -n "$NETLIFY_PID" ] && kill "$NETLIFY_PID" 2>/dev/null || true
  # matar procesos huérfanos en esos puertos
  lsof -ti:5173 | xargs kill -9 2>/dev/null || true
  lsof -ti:8888 | xargs kill -9 2>/dev/null || true
  adb -s "$DEVICE" reverse --remove-all 2>/dev/null || true
  restore_prod_config
  echo "👋 Hasta luego"
}
trap cleanup EXIT INT TERM

# ── Limpiar procesos y puertos de sesiones anteriores ────────────────────────
echo "🧹 Limpiando procesos anteriores..."
pkill -9 -f "vite" 2>/dev/null || true
pkill -9 -f "netlify" 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:8888 | xargs kill -9 2>/dev/null || true
sleep 2

# ── Config dev: apuntar a Netlify en 8888 (usar IP para mayor estabilidad) ──
cat > capacitor.config.ts << 'EOF'
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
EOF

# ── Rebuild si el APK live no existe o el config cambió ──────────────────────
CONFIG_HASH=$(md5 -q capacitor.config.ts 2>/dev/null || md5sum capacitor.config.ts 2>/dev/null | awk '{print $1}')
STORED_HASH=$(cat .live-apk-hash 2>/dev/null || echo "none")

if [ ! -f "HotelPuntaGaleria-live.apk" ] || [ "$CONFIG_HASH" != "$STORED_HASH" ]; then
  echo ""
  echo -e "${YELLOW}📦 Compilando APK de live reload...${NC}"
  npm run build
  npx cap sync android
  cd android && ./gradlew assembleDebug --quiet && cd ..
  cp android/app/build/outputs/apk/debug/app-debug.apk HotelPuntaGaleria-live.apk
  echo "$CONFIG_HASH" > .live-apk-hash
fi

# ── Tunnel USB: puertos 5173 (Vite HMR) y 8888 (Netlify) ──────────────────────
echo "🔌 Configurando tunnels ADB..."
adb -s "$DEVICE" reverse tcp:5173 tcp:5173
adb -s "$DEVICE" reverse tcp:8888 tcp:8888
echo "   ✓ :8888 (Servidor Principal)"
echo "   ✓ :5173 (Vite HMR)"

# ── Iniciar Netlify Dev en segundo plano ──────────────────────────────────────
echo "⚙️  Iniciando Netlify Dev..."
netlify dev > /tmp/netlify-live.log 2>&1 &
NETLIFY_PID=$!

# ── Esperar a que el servidor esté listo antes de abrir la app ───────────────
printf "   Esperando que el servidor esté listo"
for i in $(seq 1 60); do
  if ! kill -0 "$NETLIFY_PID" 2>/dev/null; then
    echo ""
    echo -e "${RED}❌ El servidor falló al iniciar. Logs:${NC}"
    tail -15 /tmp/netlify-live.log
    exit 1
  fi
  if curl -sf "http://127.0.0.1:8888" > /dev/null 2>&1; then
    echo " ✓ Listo!"
    break
  fi
  printf "."; sleep 1
done

# ── Abrir app ─────────────────────────────────────────────────────────────────
echo "▶️  Reiniciando app en el dispositivo..."
adb -s "$DEVICE" shell am force-stop "com.hotelpuntagaleria.app" 2>/dev/null || true
sleep 1
adb -s "$DEVICE" shell am start -n "com.hotelpuntagaleria.app/.MainActivity" 2>/dev/null || true

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅  Sincronización Activa                ║${NC}"
echo -e "${GREEN}║  PC: http://localhost:8888               ║${NC}"
echo -e "${GREEN}║  App: Iniciada en el celular             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

# Mostrar logs en vivo
tail -f /tmp/netlify-live.log
