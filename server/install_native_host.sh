#!/bin/zsh
# Registers the "Start server" helper with Chrome.
# Usage: ./install_native_host.sh <chrome-extension-id>
set -euo pipefail

EXT_ID="${1:?usage: $0 <chrome-extension-id>}"
[[ "$EXT_ID" =~ ^[a-p]{32}$ ]] || { echo "Not a valid extension id: $EXT_ID" >&2; exit 1; }

SERVER_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_DIR="$HOME/InternPilot/native_host"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
WRAPPER="$HOST_DIR/launcher"

mkdir -p "$HOST_DIR" "$MANIFEST_DIR"

cat > "$WRAPPER" <<EOF
#!/bin/zsh
cd "$SERVER_DIR"
exec "$SERVER_DIR/.venv/bin/python" -m internpilot.launcher
EOF
chmod 755 "$WRAPPER"

cat > "$MANIFEST_DIR/com.internpilot.launcher.json" <<EOF
{
  "name": "com.internpilot.launcher",
  "description": "Starts the local InternPilot server",
  "path": "$WRAPPER",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
EOF

echo "Installed native host for extension $EXT_ID"
