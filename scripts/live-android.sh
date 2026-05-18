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

VITE_PID=""
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
  [ -n "$VITE_PID" ]    && kill "$VITE_PID"    2>/dev/null || true
  [ -n "$NETLIFY_PID" ] && kill "$NETLIFY_PID" 2>/dev/null || true
  # matar procesos huérfanos en esos puertos
  lsof -ti:5173 | xargs kill -9 2>/dev/null || true
  lsof -ti:8888 | xargs kill -9 2>/dev/null || true
  adb -s "$DEVICE" reverse --remove-all 2>/dev/null || true
  restore_prod_config
  # Reinstalar APK de producción para que la app quede funcional sin dev server
  if [ -f "HotelPuntaGaleria.apk" ]; then
    echo "📲 Restaurando APK de producción en el dispositivo..."
    adb -s "$DEVICE" install -r HotelPuntaGaleria.apk 2>/dev/null && echo "✅ APK de producción restaurado" || echo "⚠️  No se pudo reinstalar el APK de producción"
  fi
  echo "👋 Hasta luego"
}
trap cleanup EXIT INT TERM

# ── Limpiar procesos y puertos de sesiones anteriores ────────────────────────
echo "🧹 Limpiando procesos anteriores..."
pkill -9 -f "vite" 2>/dev/null || true
pkill -9 -f "netlify" 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:5174 | xargs kill -9 2>/dev/null || true
lsof -ti:8888 | xargs kill -9 2>/dev/null || true
sleep 2

# ── Config dev: apuntar a Vite en 5173 ────────────────────────────────────────
cat > capacitor.config.ts << 'EOF'
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
EOF

# ── Rebuild si el APK live no existe o el config cambió ──────────────────────
CONFIG_HASH=$(md5 -q capacitor.config.ts 2>/dev/null || md5sum capacitor.config.ts 2>/dev/null | awk '{print $1}')
STORED_HASH=$(cat .live-apk-hash 2>/dev/null || echo "none")

if [ ! -f "HotelPuntaGaleria-live.apk" ] || [ "$CONFIG_HASH" != "$STORED_HASH" ]; then
  echo ""
  echo -e "${YELLOW}📦 Compilando APK de live reload...${NC}"
  npx vite build
  npx cap sync android
  cd android && ./gradlew assembleDebug --quiet && cd ..
  cp android/app/build/outputs/apk/debug/app-debug.apk HotelPuntaGaleria-live.apk
  echo "$CONFIG_HASH" > .live-apk-hash
fi

# ── Instalar siempre (garantiza que la app esté en el dispositivo) ────────────
echo "📲 Instalando APK en el dispositivo..."
adb -s "$DEVICE" install -r HotelPuntaGaleria-live.apk
rm -f .live-installed-* 2>/dev/null || true
echo -e "${GREEN}✅ APK instalado${NC}"

# ── Tunnel USB: puertos 5173 (Vite + HMR) y 8888 (Netlify functions) ──────────
echo "🔌 Configurando tunnels ADB..."
adb -s "$DEVICE" reverse tcp:5173 tcp:5173
adb -s "$DEVICE" reverse tcp:8888 tcp:8888
echo "   ✓ :5173 (Vite + HMR WebSocket)"
echo "   ✓ :8888 (Netlify functions / DB)"

# ── Netlify dev (solo functions, sin framework) ────────────────────────────────
echo "⚙️  Iniciando Netlify functions en :8888..."
netlify dev --no-open > /tmp/netlify-live.log 2>&1 &
NETLIFY_PID=$!

# ── Vite (sin pipe para capturar PID real y no perder HMR) ───────────────────
echo "⚡ Iniciando Vite en :5173..."
npx vite --port 5173 --host --strictPort > /tmp/vite-live.log 2>&1 &
VITE_PID=$!

printf "   Esperando que Vite esté listo"
for i in $(seq 1 40); do
  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    echo ""
    echo -e "${RED}❌ Vite falló al iniciar. Últimas líneas del log:${NC}"
    tail -10 /tmp/vite-live.log
    exit 1
  fi
  if curl -sf "http://localhost:5173" > /dev/null 2>&1; then
    echo " ✓"; break
  fi
  printf "."; sleep 1
done

# ── Abrir app (force-stop para garantizar carga fresca) ──────────────────────
echo "▶️  Reiniciando app en el dispositivo..."
adb -s "$DEVICE" shell am force-stop "com.hotelpuntagaleria.app" 2>/dev/null || true
sleep 1
adb -s "$DEVICE" shell am start -n "com.hotelpuntagaleria.app/.MainActivity" 2>/dev/null || true

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅  Live reload activo                   ║${NC}"
echo -e "${GREEN}║  Edita → guarda → cambio instantáneo     ║${NC}"
echo -e "${GREEN}║  Logs: tail -f /tmp/vite-live.log        ║${NC}"
echo -e "${GREEN}║  Ctrl+C para detener                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

wait $VITE_PID
