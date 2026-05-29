#!/usr/bin/env sh
set -eu

REPO_URL="${REPO_URL:-https://github.com/junchi861-debug/1monthfinder.git}"
APP_DIR="${APP_DIR:-$HOME/1monthfinder}"
PORT="${PORT:-8000}"
START_BIN="${PREFIX:-$HOME/.local}/bin/1monthfinder-backend"

say() {
  printf '%s\n' "$*"
}

find_python() {
  if command -v python >/dev/null 2>&1; then
    command -v python
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return 0
  fi
  return 1
}

if command -v pkg >/dev/null 2>&1; then
  pkg update -y
  pkg install -y curl git python
fi

if [ -d "$APP_DIR/.git" ]; then
  if ! git -C "$APP_DIR" pull --ff-only; then
    say "Git update failed. Keeping the existing app copy and continuing."
    say "If this keeps happening, run: RESET_REPO=1 sh scripts/install_android_backend.sh"
    if [ "${RESET_REPO:-0}" = "1" ]; then
      git -C "$APP_DIR" fetch origin main
      git -C "$APP_DIR" reset --hard origin/main
    fi
  fi
elif [ -e "$APP_DIR" ]; then
  BACKUP_DIR="$APP_DIR.backup.$(date +%Y%m%d-%H%M%S)"
  say "$APP_DIR already exists and is not a git repository."
  say "Moving it to $BACKUP_DIR and cloning a clean copy."
  mv "$APP_DIR" "$BACKUP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

PYTHON_BIN="$(find_python)" || {
  say "Python was not found. In Termux, run: pkg install -y python"
  exit 1
}

if [ ! -f ".env.local" ] && [ -f "config/backend.env.example" ]; then
  cp "config/backend.env.example" ".env.local"
fi

"$PYTHON_BIN" -m py_compile \
  stock_finder/cli.py \
  stock_finder/local_server.py \
  stock_finder/options_monitor.py \
  stock_finder/options_archive.py

START_DIR="${START_BIN%/*}"
mkdir -p "$START_DIR"
cat > "$START_BIN" <<EOF
#!/usr/bin/env sh
set -eu
APP_DIR="$APP_DIR"
DEFAULT_PORT="$PORT"
LOG_FILE="\${LOG_FILE:-\$APP_DIR/termux-backend.log}"

find_python() {
  if command -v python >/dev/null 2>&1; then
    command -v python
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return 0
  fi
  return 1
}

command_name="\${1:-start}"
PORT="\${PORT:-\$DEFAULT_PORT}"
cd "$APP_DIR"
PYTHON_BIN="\$(find_python)" || {
  echo "Python was not found. Run: pkg install -y python"
  exit 1
}

case "\$command_name" in
  doctor)
    echo "1MonthFinder backend doctor"
    echo "APP_DIR=\$APP_DIR"
    echo "PORT=\$PORT"
    echo "PYTHON=\$PYTHON_BIN"
    "\$PYTHON_BIN" --version
    git -C "\$APP_DIR" rev-parse --short HEAD 2>/dev/null || true
    "\$PYTHON_BIN" -m py_compile stock_finder/cli.py stock_finder/local_server.py stock_finder/options_monitor.py stock_finder/options_archive.py
    echo "OK: backend files compile."
    ;;
  update)
    git -C "\$APP_DIR" pull --ff-only
    ;;
  start|"")
    if command -v termux-wake-lock >/dev/null 2>&1; then
      termux-wake-lock || true
    fi
    echo "Starting 1MonthFinder backend on http://127.0.0.1:\$PORT/site/"
    echo "Log file: \$LOG_FILE"
    if command -v tee >/dev/null 2>&1; then
      "\$PYTHON_BIN" -m stock_finder.cli serve --host 0.0.0.0 --port "\$PORT" 2>&1 | tee -a "\$LOG_FILE"
    else
      "\$PYTHON_BIN" -m stock_finder.cli serve --host 0.0.0.0 --port "\$PORT"
    fi
    ;;
  *)
    echo "Usage: 1monthfinder-backend [start|doctor|update]"
    exit 2
    ;;
esac
EOF
chmod +x "$START_BIN"

say ""
say "1MonthFinder Android backend installed."
say "Doctor command:"
say "  $START_BIN doctor"
say "Start command:"
say "  $START_BIN"
say ""
say "Phone browser:"
say "  http://127.0.0.1:$PORT/site/"
say ""
say "Other devices on the same Wi-Fi:"
say "  http://<android-phone-ip>:$PORT/site/"
say ""

if [ "${NO_START:-0}" != "1" ]; then
  exec "$START_BIN"
fi
