export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator

export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH=$JAVA_HOME/bin:$PATH

# Created by `pipx` on 2026-04-17 19:14:17
export PATH="$PATH:/Users/govideo/.local/bin"
ulimit -n 4096
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

