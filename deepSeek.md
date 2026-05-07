# DeepSeek + Claude Code CLI — Manual de Setup

> Conexiones pool: [[proyectos_go/CLAUDE]] | [[proyectos_go/context_general_proyectos]]
> Recurso de soporte para desarrollo en todo el ecosistema

## Configuración estándar para el equipo de desarrollo

---

## Objetivo

Conectar la API de DeepSeek a Claude Code CLI para usar Claude Code como agente de desarrollo con modelos DeepSeek:

- **DeepSeek V4 Pro (1M tokens)** como modelo principal
- **DeepSeek V4 Flash** como modelo de subagentes (rápido y barato)
- Alias `claude-ds` para lanzarlo en segundos
- Costes mucho menores que las APIs oficiales de Anthropic/OpenAI

---

## Antes de empezar: cada dev usa su propia API Key

Cada desarrollador recibirá su propia API Key de DeepSeek. Esto es importante por dos razones:

1. **Límites de rate**: si compartís key, os rate-limitearéis entre vosotros
2. **Seguridad**: si una key se compromete, solo afecta a esa persona

Guarda tu key en un gestor de contraseñas (1Password, Bitwarden, etc.) como respaldo. No la compartas por Slack, email o chats.

---

## Requisitos previos

### Todos los sistemas

- Node.js >= 18 (verificar con `node --version`)
- npm >= 9 (viene con Node.js)
- Acceso a terminal

### macOS

- zsh (viene por defecto)

### Windows

- PowerShell 5.1+ o PowerShell Core 7+
- O Git Bash (si prefieres entorno Unix-like)

### Linux

- bash o zsh

---

## Paso 1 — Instalar Claude Code CLI

Ejecutar en el terminal:

```bash
npm install -g @anthropic-ai/claude-code
```

Verificar instalación:

```bash
claude --version
```

---

## Paso 2 — Obtener tu API Key de DeepSeek

1. Ir a https://platform.deepseek.com/api_keys
2. Iniciar sesión o crear cuenta
3. Hacer clic en "Create new API Key"
4. Copiar la key generada (solo se muestra una vez)

La key tiene este formato: `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

# Configuración por sistema operativo

Elige tu SO y sigue solo esa sección.

---

## macOS

### 2.1 — Editar `.zshrc`

```bash
nano ~/.zshrc
```

### 2.2 — Agregar al final del archivo

```bash
# ── DeepSeek API Key ──────────────────────────────────────
export DEEPSEEK_API_KEY="sk-e27fcc5a6d694c5fb6fa3ffcc71b4151"

# ── Claude Code + DeepSeek V4 Pro ─────────────────────────
alias claude-ds='
  ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic \
  ANTHROPIC_AUTH_TOKEN="$DEEPSEEK_API_KEY" \
  ANTHROPIC_MODEL=deepseek-v4-pro[1m] \
  ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m] \
  ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m] \
  ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash \
  CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash \
  CLAUDE_CODE_EFFORT_LEVEL=max \
  claude'
```

### 2.3 — Guardar y salir de nano

```
Ctrl+O → Enter → Ctrl+X
```

### 2.4 — Recargar la shell

```bash
source ~/.zshrc
```

### 2.5 — Verificar que el alias funciona

```bash
alias claude-ds
```

Debe mostrar el alias completo con todas las variables.

### 2.6 — Lanzar Claude Code con DeepSeek

```bash
claude-ds
```

Dentro de Claude Code, verificar el modelo activo:

```
/model
```

Debe responder: `deepseek-v4-pro[1m]`

---

## Windows (PowerShell)

### 2.1 — Guardar la API Key como variable de entorno

```powershell
[Environment]::SetEnvironmentVariable(
    "DEEPSEEK_API_KEY",
    "sk-tu-api-key-aqui",
    "User"
)
```

### 2.2 — Abrir el perfil de PowerShell

```powershell
notepad $PROFILE
```

Si el archivo no existe, créalo primero:

```powershell
New-Item -Path $PROFILE -Type File -Force
notepad $PROFILE
```

### 2.3 — Pegar la función y guardar

```powershell
# ── Claude Code + DeepSeek V4 Pro ─────────────────────────
function claude-ds {
    $env:ANTHROPIC_BASE_URL          = "https://api.deepseek.com/anthropic"
    $env:ANTHROPIC_AUTH_TOKEN        = $env:DEEPSEEK_API_KEY
    $env:ANTHROPIC_MODEL             = "deepseek-v4-pro[1m]"
    $env:ANTHROPIC_DEFAULT_OPUS_MODEL   = "deepseek-v4-pro[1m]"
    $env:ANTHROPIC_DEFAULT_SONNET_MODEL = "deepseek-v4-pro[1m]"
    $env:ANTHROPIC_DEFAULT_HAIKU_MODEL  = "deepseek-v4-flash"
    $env:CLAUDE_CODE_SUBAGENT_MODEL     = "deepseek-v4-flash"
    $env:CLAUDE_CODE_EFFORT_LEVEL       = "max"
    claude
}
```

### 2.4 — Recargar PowerShell

```powershell
. $PROFILE
```

### 2.5 — Verificar y lanzar

```powershell
claude-ds
```

Dentro de Claude Code, verificar modelo:

```
/model
```

Debe responder: `deepseek-v4-pro[1m]`

---

## Linux

### 2.1 — Editar `.bashrc` (o `.zshrc` según tu shell)

```bash
nano ~/.bashrc
```

### 2.2 — Agregar al final

```bash
# ── DeepSeek API Key ──────────────────────────────────────
export DEEPSEEK_API_KEY="sk-tu-api-key-aqui"

# ── Claude Code + DeepSeek V4 Pro ─────────────────────────
alias claude-ds='
  ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic \
  ANTHROPIC_AUTH_TOKEN="$DEEPSEEK_API_KEY" \
  ANTHROPIC_MODEL=deepseek-v4-pro[1m] \
  ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m] \
  ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m] \
  ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash \
  CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash \
  CLAUDE_CODE_EFFORT_LEVEL=max \
  claude'
```

### 2.3 — Guardar, recargar, verificar

```bash
source ~/.bashrc
alias claude-ds
claude-ds
```

---

## Modelos disponibles y cuándo usar cada uno

| Modelo | Usar para | Ventana de contexto |
|---|---|---|
| `deepseek-v4-pro[1m]` | Arquitectura, proyectos grandes, refactors, razonamiento complejo | ~1M tokens |
| `deepseek-v4-flash` | Subagentes, tareas rápidas, búsquedas, documentación simple | ~128K tokens |

El alias ya está configurado para usar `pro` como modelo principal y `flash` para subagentes automáticamente.

---

## Checklist de verificación rápida

Después del setup, confirma estos 3 puntos:

1. `alias claude-ds` muestra el alias con todas las variables
2. `echo $DEEPSEEK_API_KEY` muestra tu key (empieza por `sk-`)
3. Dentro de Claude Code, `/model` devuelve `deepseek-v4-pro[1m]`

---

## Flujo de proyecto recomendado

Estructura sugerida para cada proyecto:

```
/proyecto
├── CLAUDE.md          ← Reglas e instrucciones para Claude Code
├── ARCHITECTURE.md    ← Decisiones de arquitectura
├── TASKS.md           ← Lista de tareas pendientes/en curso
├── DECISIONS.md       ← Log de decisiones técnicas
├── docs/
└── src/
```

### CLAUDE.md de ejemplo

```markdown
# Reglas del proyecto

- Sigue ARCHITECTURE.md estrictamente
- Divide el trabajo en fases, no hagas todo de golpe
- Explica el razonamiento antes de cambios grandes
- Mantén el código modular
- Escribe tests para funcionalidad nueva
- Actualiza TASKS.md y DECISIONS.md cuando corresponda
```

---

## Prompts útiles

**Arrancar un proyecto desde cero:**
```
Lee ARCHITECTURE.md y crea un plan por fases. No escribas código todavía, solo el plan.
```

**Modo multiagente:**
```
Actúa como un equipo multiagente: Arquitecto, Backend, Frontend, QA, DevOps, Documentador. Divide las tareas y coordina el trabajo.
```

**Refactor grande:**
```
Refactoriza usando clean architecture. Divide el trabajo en subtareas y ejecútalas una por una.
```

---

## Seguridad

- Nunca compartas tu API Key en chats, Slack, email o repositorios
- No subas `.zshrc`, `.bashrc` o `$PROFILE` a GitHub
- Usa `.env` + `.gitignore` si el proyecto necesita variables de entorno
- Si sospechas que tu key se ha filtrado, elimínala y genera una nueva en https://platform.deepseek.com/api_keys

---

## Troubleshooting

### `command not found: claude-ds`

Recargar la configuración de shell:

```bash
source ~/.zshrc    # macOS / Linux zsh
source ~/.bashrc   # Linux bash
. $PROFILE         # Windows PowerShell
```

Y verificar:

```bash
alias claude-ds    # macOS / Linux
```

### `command not found: claude`

Claude Code CLI no está instalado:

```bash
npm install -g @anthropic-ai/claude-code
```

### Claude Code sigue usando modelos de Anthropic en vez de DeepSeek

Verificar que la variable de entorno está seteada:

```bash
echo $ANTHROPIC_BASE_URL
```

Debe mostrar: `https://api.deepseek.com/anthropic`

Si no, el alias no está funcionando. Revisar que `source ~/.zshrc` se ejecutó correctamente.

### Error de autenticación / 401 Unauthorized

La API Key no es válida o no está bien configurada:

```bash
echo $DEEPSEEK_API_KEY
```

Debe empezar por `sk-`. Si está vacía o es incorrecta, revisar el `export` en `~/.zshrc`.

### Error: `deepseek-v4-pro[1m]` no aparece en `/model`

Cerrar Claude Code y relanzar con `claude-ds`. El modelo se configura al iniciar la sesión.

### Rate limit / demasiadas peticiones

Cada key tiene un límite de peticiones por minuto. Si varios devs comparten key, se agota rápido. Cada persona debe usar su propia key.

### Node.js demasiado antiguo

```bash
node --version
```

Si es menor a 18, actualizar con:

```bash
# macOS
brew install node

# Linux
sudo apt update && sudo apt install nodejs   # Debian/Ubuntu
# o usar nvm: https://github.com/nvm-sh/nvm
```

---

## Resumen

```
Claude Code CLI + DeepSeek V4 Pro = Agente de IA para desarrollo potente y barato
```

- ~1M tokens de contexto (proyectos enteros en una sesión)
- Multiagente práctico (arquitecto, backend, frontend, QA...)
- Coste muy bajo comparado con APIs oficiales
- Ideal para proyectos enterprise, refactors grandes y desarrollo desde cero
