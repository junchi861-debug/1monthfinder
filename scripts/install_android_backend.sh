#!/usr/bin/env sh
set -eu

REPO_URL="${REPO_URL:-https://github.com/junchi861-debug/1monthfinder.git}"
APP_DIR="${APP_DIR:-$HOME/1monthfinder}"
PORT="${PORT:-8000}"
START_BIN="${PREFIX:-$HOME/.local}/bin/1monthfinder-backend"

if command -v pkg >/dev/null 2>&1; then
  pkg update -y
  pkg install -y git python
fi

if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
elif [ -e "$APP_DIR" ]; then
  echo "$APP_DIR already exists and is not a git repository."
  echo "Set APP_DIR to another path or move that directory first."
  exit 1
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [ ! -f ".env.local" ] && [ -f "config/backend.env.example" ]; then
  cp "config/backend.env.example" ".env.local"
fi

mkdir -p "$(dirname "$START_BIN")"
cat > "$START_BIN" <<EOF
#!/usr/bin/env sh
set -eu
cd "$APP_DIR"
if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock || true
fi
python -m stock_finder.cli serve --host 0.0.0.0 --port "\${PORT:-$PORT}"
EOF
chmod +x "$START_BIN"

echo
echo "1MonthFinder Android backend installed."
echo "Start command:"
echo "  $START_BIN"
echo
echo "Phone browser:"
echo "  http://127.0.0.1:$PORT/site/"
echo
echo "Other devices on the same Wi-Fi:"
echo "  http://<android-phone-ip>:$PORT/site/"
echo

if [ "${NO_START:-0}" != "1" ]; then
  exec "$START_BIN"
fi
