#!/usr/bin/env sh
set -eu

REPO_URL="${REPO_URL:-https://github.com/junchi861-debug/1monthfinder.git}"
SOURCE_ZIP_URL="${SOURCE_ZIP_URL:-https://github.com/junchi861-debug/1monthfinder/archive/refs/heads/main.zip}"
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
  pkg install -y git python
fi

PYTHON_BIN="$(find_python)" || {
  say "Python was not found. In Termux, run: pkg install -y python"
  exit 1
}

download_source_archive() {
  target_dir="$1"
  "$PYTHON_BIN" - "$SOURCE_ZIP_URL" "$target_dir" <<'PY'
import io
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

url = sys.argv[1]
target = Path(sys.argv[2]).expanduser()
tmp = target.with_name(target.name + ".download")
if tmp.exists():
    shutil.rmtree(tmp)
tmp.mkdir(parents=True, exist_ok=True)
with urllib.request.urlopen(url, timeout=60) as response:
    data = response.read()
with zipfile.ZipFile(io.BytesIO(data)) as archive:
    archive.extractall(tmp)
roots = [path for path in tmp.iterdir() if path.is_dir()]
if len(roots) != 1:
    raise SystemExit("source archive layout was not recognized")
if target.exists():
    shutil.rmtree(target)
shutil.move(str(roots[0]), str(target))
shutil.rmtree(tmp, ignore_errors=True)
PY
}

stop_existing_backend() {
  target_port="${1:-$PORT}"
  say "Stopping existing 1MonthFinder backend on port $target_port..."
  "$PYTHON_BIN" - "$target_port" <<'PY' || true
import os
import signal
import sys
import time

port = int(sys.argv[1])
socket_inodes = set()

def collect_listeners(path):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            rows = handle.read().splitlines()[1:]
    except OSError:
        return
    for row in rows:
        fields = row.split()
        if len(fields) < 10:
            continue
        local_address, state, inode = fields[1], fields[3], fields[9]
        try:
            local_port = int(local_address.rsplit(":", 1)[1], 16)
        except (IndexError, ValueError):
            continue
        if local_port == port and state == "0A":
            socket_inodes.add(inode)

collect_listeners("/proc/net/tcp")
collect_listeners("/proc/net/tcp6")

current_pid = os.getpid()
killed = set()
for name in os.listdir("/proc"):
    if not name.isdigit():
        continue
    pid = int(name)
    if pid == current_pid:
        continue
    cmdline = ""
    try:
        with open(f"/proc/{pid}/cmdline", "rb") as handle:
            cmdline = handle.read().replace(b"\0", b" ").decode("utf-8", "ignore")
    except OSError:
        pass
    backend_cmd = ("stock_finder.cli" in cmdline and "serve" in cmdline) or "stock_finder.local_server" in cmdline
    owns_socket = False
    if socket_inodes:
        fd_dir = f"/proc/{pid}/fd"
        try:
            for fd_name in os.listdir(fd_dir):
                try:
                    target = os.readlink(f"{fd_dir}/{fd_name}")
                except OSError:
                    continue
                if target.startswith("socket:[") and target[8:-1] in socket_inodes:
                    owns_socket = True
                    break
        except OSError:
            pass
    if not backend_cmd and not owns_socket:
        continue
    try:
        os.kill(pid, signal.SIGTERM)
        killed.add(pid)
    except (PermissionError, ProcessLookupError):
        pass

if killed:
    time.sleep(1)
    for pid in list(killed):
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            continue
        try:
            os.kill(pid, signal.SIGKILL)
        except (PermissionError, ProcessLookupError):
            pass
    print(f"Stopped backend process(es): {', '.join(str(pid) for pid in sorted(killed))}")
else:
    print("No existing backend process found.")
PY
}

stop_existing_backend "$PORT"

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
  if ! git clone "$REPO_URL" "$APP_DIR"; then
    say "Git clone failed. Downloading source archive with Python instead."
    download_source_archive "$APP_DIR"
  fi
else
  if ! git clone "$REPO_URL" "$APP_DIR"; then
    say "Git clone failed. Downloading source archive with Python instead."
    download_source_archive "$APP_DIR"
  fi
fi

cd "$APP_DIR"

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

health_check() {
  "\$PYTHON_BIN" - "\$PORT" <<'PY' >/dev/null 2>&1
import json
import sys
import urllib.request

port = sys.argv[1]
try:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=2) as response:
        payload = json.loads(response.read().decode("utf-8"))
except Exception:
    sys.exit(1)
sys.exit(0 if payload.get("ok") else 1)
PY
}

stop_existing_backend() {
  target_port="\${1:-\$PORT}"
  echo "Stopping existing 1MonthFinder backend on port \$target_port..."
  "\$PYTHON_BIN" - "\$target_port" <<'PY' || true
import os
import signal
import sys
import time

port = int(sys.argv[1])
socket_inodes = set()

def collect_listeners(path):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            rows = handle.read().splitlines()[1:]
    except OSError:
        return
    for row in rows:
        fields = row.split()
        if len(fields) < 10:
            continue
        local_address, state, inode = fields[1], fields[3], fields[9]
        try:
            local_port = int(local_address.rsplit(":", 1)[1], 16)
        except (IndexError, ValueError):
            continue
        if local_port == port and state == "0A":
            socket_inodes.add(inode)

collect_listeners("/proc/net/tcp")
collect_listeners("/proc/net/tcp6")

current_pid = os.getpid()
killed = set()
for name in os.listdir("/proc"):
    if not name.isdigit():
        continue
    pid = int(name)
    if pid == current_pid:
        continue
    cmdline = ""
    try:
        with open(f"/proc/{pid}/cmdline", "rb") as handle:
            cmdline = handle.read().replace(b"\0", b" ").decode("utf-8", "ignore")
    except OSError:
        pass
    backend_cmd = ("stock_finder.cli" in cmdline and "serve" in cmdline) or "stock_finder.local_server" in cmdline
    owns_socket = False
    if socket_inodes:
        fd_dir = f"/proc/{pid}/fd"
        try:
            for fd_name in os.listdir(fd_dir):
                try:
                    target = os.readlink(f"{fd_dir}/{fd_name}")
                except OSError:
                    continue
                if target.startswith("socket:[") and target[8:-1] in socket_inodes:
                    owns_socket = True
                    break
        except OSError:
            pass
    if not backend_cmd and not owns_socket:
        continue
    try:
        os.kill(pid, signal.SIGTERM)
        killed.add(pid)
    except (PermissionError, ProcessLookupError):
        pass

if killed:
    time.sleep(1)
    for pid in list(killed):
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            continue
        try:
            os.kill(pid, signal.SIGKILL)
        except (PermissionError, ProcessLookupError):
            pass
    print(f"Stopped backend process(es): {', '.join(str(pid) for pid in sorted(killed))}")
else:
    print("No existing backend process found.")
PY
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
  status)
    if health_check; then
      echo "OK: backend is already running at http://127.0.0.1:\$PORT/site/"
    else
      echo "STOPPED: backend is not responding on port \$PORT."
      echo "Start it with: 1monthfinder-backend"
      exit 1
    fi
    ;;
  update)
    stop_existing_backend "\$PORT"
    if command -v pkg >/dev/null 2>&1; then
      pkg update -y
      pkg install -y git python
    fi
    if [ -d "\$APP_DIR/.git" ]; then
      git -C "\$APP_DIR" pull --ff-only
    else
      echo "This install was created from a source archive, not git."
      echo "Run the install command again to refresh the app files."
    fi
    "\$PYTHON_BIN" -m py_compile stock_finder/cli.py stock_finder/local_server.py stock_finder/options_monitor.py stock_finder/options_archive.py
    echo "OK: app files are updated and backend files compile."
    ;;
  start|"")
    if health_check; then
      echo "OK: backend is already running at http://127.0.0.1:\$PORT/site/"
      echo "Open Chrome: http://127.0.0.1:\$PORT/site/"
      exit 0
    fi
    if command -v termux-wake-lock >/dev/null 2>&1; then
      termux-wake-lock || true
    fi
    echo "Starting 1MonthFinder backend on http://127.0.0.1:\$PORT/site/"
    echo "Keep this Termux session open while using the phone browser."
    "\$PYTHON_BIN" -m stock_finder.cli serve --host 0.0.0.0 --port "\$PORT"
    ;;
  *)
    echo "Usage: 1monthfinder-backend [start|doctor|status|update]"
    exit 2
    ;;
esac
EOF
chmod +x "$START_BIN"

say ""
say "1MonthFinder Android backend installed."
say "Command check:"
say "  command -v 1monthfinder-backend || echo \"$START_BIN\""
say "Doctor command:"
say "  $START_BIN doctor"
say "Status command:"
say "  $START_BIN status"
say "Start command:"
say "  $START_BIN"
say "Update command:"
say "  $START_BIN update"
say ""
say "Phone browser:"
say "  http://127.0.0.1:$PORT/site/"
say ""
say "Other devices on the same Wi-Fi:"
say "  http://<android-phone-ip>:$PORT/site/"
say ""

if [ "${NO_START:-0}" != "1" ]; then
  exec "$START_BIN"
else
  say "Install-only mode: server was not started."
fi
