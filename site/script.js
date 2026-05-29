const MONITOR_POLL_MS = 60000;
const SIGNAL_LOG_KEY = "1monthfinder.options.signalLog";
const SETTINGS_KEY = "1monthfinder.options.settings";
const WATCHLIST_KEY = "1monthfinder.watchlists";
const ANDROID_BACKEND_LOCAL_URL = "http://127.0.0.1:8000";
const ANDROID_STOP_BACKEND_COMMAND = [
  "python - \"${PORT:-8000}\" <<'PY'",
  "import os, signal, sys, time",
  "port = int(sys.argv[1])",
  "inodes = set()",
  "for path in ('/proc/net/tcp', '/proc/net/tcp6'):",
  "    try:",
  "        rows = open(path, encoding='utf-8').read().splitlines()[1:]",
  "    except OSError:",
  "        continue",
  "    for row in rows:",
  "        parts = row.split()",
  "        if len(parts) >= 10 and parts[3] == '0A':",
  "            try:",
  "                if int(parts[1].rsplit(':', 1)[1], 16) == port:",
  "                    inodes.add(parts[9])",
  "            except ValueError:",
  "                pass",
  "killed = set()",
  "for name in os.listdir('/proc'):",
  "    if not name.isdigit() or int(name) == os.getpid():",
  "        continue",
  "    pid = int(name)",
  "    cmd = ''",
  "    try:",
  "        cmd = open(f'/proc/{pid}/cmdline', 'rb').read().replace(b'\\0', b' ').decode('utf-8', 'ignore')",
  "    except OSError:",
  "        pass",
  "    match = ('stock_finder.cli' in cmd and 'serve' in cmd) or 'stock_finder.local_server' in cmd",
  "    if not match and inodes:",
  "        try:",
  "            for fd in os.listdir(f'/proc/{pid}/fd'):",
  "                try:",
  "                    target = os.readlink(f'/proc/{pid}/fd/{fd}')",
  "                except OSError:",
  "                    continue",
  "                if target.startswith('socket:[') and target[8:-1] in inodes:",
  "                    match = True",
  "                    break",
  "        except OSError:",
  "            pass",
  "    if match:",
  "        try:",
  "            os.kill(pid, signal.SIGTERM)",
  "            killed.add(pid)",
  "        except (PermissionError, ProcessLookupError):",
  "            pass",
  "if killed:",
  "    time.sleep(1)",
  "    for pid in list(killed):",
  "        try:",
  "            os.kill(pid, 0)",
  "        except ProcessLookupError:",
  "            continue",
  "        try:",
  "            os.kill(pid, signal.SIGKILL)",
  "        except (PermissionError, ProcessLookupError):",
  "            pass",
  "    print('Stopped backend process(es): ' + ', '.join(map(str, sorted(killed))))",
  "else:",
  "    print('No existing backend process found.')",
  "PY",
].join("\n");
const ANDROID_INSTALL_COMMAND = [
  "pkg update -y && pkg upgrade -y && pkg install -y git python",
  ANDROID_STOP_BACKEND_COMMAND,
  "python - <<'PY'",
  "from pathlib import Path",
  "from urllib.request import urlopen",
  "url = 'https://raw.githubusercontent.com/junchi861-debug/1monthfinder/main/scripts/install_android_backend.sh'",
  "Path.home().joinpath('install_1monthfinder.sh').write_bytes(urlopen(url, timeout=60).read())",
  "PY",
  'NO_START=1 sh "$HOME/install_1monthfinder.sh"',
].join("\n");
const ANDROID_START_COMMAND =
  'export PATH="$PREFIX/bin:$HOME/.local/bin:$PATH"; BACKEND_BIN="$(command -v 1monthfinder-backend || printf "%s" "${PREFIX:-$HOME/.local}/bin/1monthfinder-backend")"; echo "$BACKEND_BIN"; "$BACKEND_BIN" doctor && { "$BACKEND_BIN" status || "$BACKEND_BIN"; }';
const ANDROID_UPDATE_COMMAND =
  'export PATH="$PREFIX/bin:$HOME/.local/bin:$PATH"; BACKEND_BIN="$(command -v 1monthfinder-backend || printf "%s" "${PREFIX:-$HOME/.local}/bin/1monthfinder-backend")"; echo "$BACKEND_BIN"; "$BACKEND_BIN" update && "$BACKEND_BIN" doctor && "$BACKEND_BIN"';
const BACKEND_ENV_TEMPLATE = [
  "OPTIONS_BACKEND_PORT=8000",
  "KIWOOM_API_MODE=disabled",
  "KIWOOM_APP_KEY=",
  "KIWOOM_APP_SECRET=",
  "KIWOOM_ACCOUNT_NO=",
  "KIWOOM_CERT_PASSWORD=",
  "KIWOOM_PIN=",
].join("\n");
const TRADE_COLORS = {
  entry: "#2f7f83",
  stop: "#a95f59",
  tp1: "#5275ad",
  tp2: "#315f9d",
  exit: "#9aa8b8",
  mixed: "#b07a2a",
  watch: "#a97022",
  test: "#a97022",
  risk: "#a95f59",
  take_profit: "#5275ad",
};

const CHART_EXTRA_SERIES = [
  { key: "gma30", label: "30이평", color: "#2f7f83", width: 1.5, dash: [] },
  { key: "gma50", label: "50이평", color: "#95a3b7", width: 1.5, dash: [5, 4] },
  { key: "tenkan", label: "전환", color: "#b07a2a", width: 1.5, dash: [] },
  { key: "kijun", label: "기준", color: "#9aa8b8", width: 1.8, dash: [] },
];
// Codex experimental, not an expert rule. Remove usages of this tag to isolate
// the profit-extension ideas if later expert review rejects them.
const CODEX_EXPERIMENTAL_PROFIT_EXTENSION_TAG = "codex_experimental_profit_extension";
const APP_TABS = ["collection", "options", "etf", "stocks", "usStocks", "crypto"];
const DETAIL_ARCHIVE_DAYS = 90;
const SUMMARY_ARCHIVE_DAYS = 365;
const SEARCH_RESULT_LIMIT = 8;
const US_SEARCH_UNIVERSE = [
  ["AAPL", "Apple Inc.", "NASDAQ", "Mega Cap"],
  ["MSFT", "Microsoft Corp.", "NASDAQ", "Mega Cap"],
  ["NVDA", "NVIDIA Corp.", "NASDAQ", "AI 반도체"],
  ["AMZN", "Amazon.com Inc.", "NASDAQ", "플랫폼"],
  ["GOOGL", "Alphabet Class A", "NASDAQ", "플랫폼"],
  ["GOOG", "Alphabet Class C", "NASDAQ", "플랫폼"],
  ["META", "Meta Platforms", "NASDAQ", "플랫폼"],
  ["TSLA", "Tesla Inc.", "NASDAQ", "전기차"],
  ["AVGO", "Broadcom Inc.", "NASDAQ", "반도체"],
  ["AMD", "Advanced Micro Devices", "NASDAQ", "반도체"],
  ["TSM", "Taiwan Semiconductor", "NYSE", "반도체"],
  ["ASML", "ASML Holding", "NASDAQ", "반도체 장비"],
  ["LRCX", "Lam Research", "NASDAQ", "반도체 장비"],
  ["KLAC", "KLA Corp.", "NASDAQ", "반도체 장비"],
  ["TXN", "Texas Instruments", "NASDAQ", "반도체"],
  ["MRVL", "Marvell Technology", "NASDAQ", "반도체"],
  ["NFLX", "Netflix Inc.", "NASDAQ", "미디어"],
  ["COST", "Costco Wholesale", "NASDAQ", "소비"],
  ["PEP", "PepsiCo Inc.", "NASDAQ", "소비"],
  ["ADBE", "Adobe Inc.", "NASDAQ", "소프트웨어"],
  ["NOW", "ServiceNow Inc.", "NYSE", "소프트웨어"],
  ["PANW", "Palo Alto Networks", "NASDAQ", "보안"],
  ["CRWD", "CrowdStrike Holdings", "NASDAQ", "보안"],
  ["SNOW", "Snowflake Inc.", "NYSE", "데이터"],
  ["DDOG", "Datadog Inc.", "NASDAQ", "데이터"],
  ["NET", "Cloudflare Inc.", "NYSE", "클라우드"],
  ["CSCO", "Cisco Systems", "NASDAQ", "네트워크"],
  ["INTC", "Intel Corp.", "NASDAQ", "반도체"],
  ["QCOM", "Qualcomm Inc.", "NASDAQ", "반도체"],
  ["AMAT", "Applied Materials", "NASDAQ", "반도체 장비"],
  ["MU", "Micron Technology", "NASDAQ", "메모리"],
  ["ARM", "Arm Holdings", "NASDAQ", "반도체"],
  ["PLTR", "Palantir Technologies", "NASDAQ", "AI 소프트웨어"],
  ["ORCL", "Oracle Corp.", "NYSE", "소프트웨어"],
  ["CRM", "Salesforce Inc.", "NYSE", "소프트웨어"],
  ["IBM", "IBM", "NYSE", "소프트웨어"],
  ["UBER", "Uber Technologies", "NYSE", "플랫폼"],
  ["ABNB", "Airbnb Inc.", "NASDAQ", "플랫폼"],
  ["SHOP", "Shopify Inc.", "NYSE", "플랫폼"],
  ["PYPL", "PayPal Holdings", "NASDAQ", "결제"],
  ["SQ", "Block Inc.", "NYSE", "결제"],
  ["COIN", "Coinbase Global", "NASDAQ", "코인 관련"],
  ["HOOD", "Robinhood Markets", "NASDAQ", "증권 플랫폼"],
  ["SOFI", "SoFi Technologies", "NASDAQ", "핀테크"],
  ["JPM", "JPMorgan Chase", "NYSE", "금융"],
  ["BAC", "Bank of America", "NYSE", "금융"],
  ["GS", "Goldman Sachs", "NYSE", "금융"],
  ["V", "Visa Inc.", "NYSE", "결제"],
  ["MA", "Mastercard Inc.", "NYSE", "결제"],
  ["BRK.B", "Berkshire Hathaway", "NYSE", "복합"],
  ["LLY", "Eli Lilly", "NYSE", "헬스케어"],
  ["NVO", "Novo Nordisk", "NYSE", "헬스케어"],
  ["UNH", "UnitedHealth Group", "NYSE", "헬스케어"],
  ["JNJ", "Johnson & Johnson", "NYSE", "헬스케어"],
  ["MRK", "Merck & Co.", "NYSE", "헬스케어"],
  ["PFE", "Pfizer Inc.", "NYSE", "헬스케어"],
  ["ABBV", "AbbVie Inc.", "NYSE", "헬스케어"],
  ["TMO", "Thermo Fisher Scientific", "NYSE", "헬스케어"],
  ["ISRG", "Intuitive Surgical", "NASDAQ", "헬스케어"],
  ["XOM", "Exxon Mobil", "NYSE", "에너지"],
  ["CVX", "Chevron Corp.", "NYSE", "에너지"],
  ["CAT", "Caterpillar Inc.", "NYSE", "산업재"],
  ["GE", "GE Aerospace", "NYSE", "산업재"],
  ["BA", "Boeing Co.", "NYSE", "항공"],
  ["RTX", "RTX Corp.", "NYSE", "방산"],
  ["LMT", "Lockheed Martin", "NYSE", "방산"],
  ["DE", "Deere & Co.", "NYSE", "산업재"],
  ["UPS", "United Parcel Service", "NYSE", "물류"],
  ["FDX", "FedEx Corp.", "NYSE", "물류"],
  ["WMT", "Walmart Inc.", "NYSE", "소비"],
  ["HD", "Home Depot", "NYSE", "소비"],
  ["MCD", "McDonald's Corp.", "NYSE", "소비"],
  ["NKE", "Nike Inc.", "NYSE", "소비"],
  ["DIS", "Walt Disney", "NYSE", "미디어"],
  ["KO", "Coca-Cola Co.", "NYSE", "소비"],
  ["PG", "Procter & Gamble", "NYSE", "소비"],
  ["GM", "General Motors", "NYSE", "자동차"],
  ["F", "Ford Motor", "NYSE", "자동차"],
  ["RIVN", "Rivian Automotive", "NASDAQ", "전기차"],
  ["SPY", "SPDR S&P 500 ETF", "NYSEARCA", "시장 ETF"],
  ["QQQ", "Invesco QQQ Trust", "NASDAQ", "시장 ETF"],
  ["DIA", "SPDR Dow Jones ETF", "NYSEARCA", "시장 ETF"],
  ["IWM", "iShares Russell 2000 ETF", "NYSEARCA", "시장 ETF"],
  ["SMH", "VanEck Semiconductor ETF", "NASDAQ", "섹터 ETF"],
  ["XLK", "Technology Select Sector SPDR", "NYSEARCA", "섹터 ETF"],
  ["XLF", "Financial Select Sector SPDR", "NYSEARCA", "섹터 ETF"],
  ["XLE", "Energy Select Sector SPDR", "NYSEARCA", "섹터 ETF"],
].map(([symbol, name, market, group]) => ({ symbol, name, market, group }));
const SEARCH_ALIASES = {
  domestic: {
    삼전: ["005930", "삼성전자"],
    삼성: ["005930", "삼성전자"],
    삼성전자우: ["005935"],
    하닉: ["000660", "SK하이닉스"],
    하이닉스: ["000660", "SK하이닉스"],
    현차: ["005380", "현대차"],
    현대차: ["005380"],
    기아차: ["000270", "기아"],
    기아: ["000270"],
    네이버: ["035420", "NAVER"],
    카카오: ["035720"],
    삼바: ["207940", "삼성바이오로직스"],
    셀트리온: ["068270"],
    엘지엔솔: ["373220", "LG에너지솔루션"],
    포홀: ["005490", "POSCO홀딩스"],
  },
  us: {
    테슬라: ["TSLA", "Tesla"],
    엔비디아: ["NVDA", "NVIDIA"],
    엔비: ["NVDA", "NVIDIA"],
    애플: ["AAPL", "Apple"],
    마소: ["MSFT", "Microsoft"],
    마이크로소프트: ["MSFT", "Microsoft"],
    아마존: ["AMZN", "Amazon"],
    구글: ["GOOGL", "Alphabet"],
    알파벳: ["GOOGL", "Alphabet"],
    메타: ["META", "Meta"],
    브로드컴: ["AVGO", "Broadcom"],
    반도체: ["SMH", "NVDA", "AMD", "AVGO"],
    나스닥: ["QQQ"],
    에스피: ["SPY", "S&P 500"],
    "S&P": ["SPY", "S&P 500"],
    SP500: ["SPY", "S&P 500"],
    snp: ["SPY", "S&P 500"],
    러셀: ["IWM"],
    버크셔: ["BRK.B", "Berkshire"],
  },
};

const state = {
  weeklyOptions: null,
  replay: null,
  assetArchive: null,
  monitor: null,
  monitorTimer: null,
  activeTab: "collection",
  cryptoTab: "all",
  cryptoFrame: "240m",
  selectedDate: kstDateString(),
  dateLoading: false,
  dateLoadingTarget: null,
  dateLoadSeq: 0,
  activeReplayDate: null,
  replayCursors: {},
  activeModal: null,
  alertsEnabled: false,
  pendingAlertState: null,
  lastAlertKey: null,
  audioContext: null,
  serviceWorkerRegistration: null,
  signalLog: loadSignalLog(),
  settings: loadSettings(),
  watchlists: loadWatchlists(),
  searchCursor: { domestic: -1, us: -1 },
  wakeLock: null,
  chartResizeObserver: null,
  redrawFrame: null,
  viewportFrame: null,
  chartZoom: {},
};

const modalMeta = {
  replay: { eyebrow: "차트 검증", title: "복기" },
  settings: { eyebrow: "환경", title: "설정" },
};

const fallbackWeeklyOptions = {
  title: "위클리 옵션 전략",
  asset_scope: "KOSPI200 위클리 옵션",
  risk_limits: { daily_max_loss_krw: 3000000, loss_basis_label: "실현+평가+수수료" },
  entry: {
    initial_contracts: 3,
    strike_selection: {
      target_premium: 1.6,
      target_premium_range_label: "1.4~1.8",
      description: "중심가격 기준 약 2.5% 위 콜 중 프리미엄 1.6 근처를 찾습니다.",
    },
    order_ladder: [
      { label: "1차", price: 1.7 },
      { label: "2차", price: 1.6 },
      { label: "3차", price: 1.45 },
    ],
  },
  visual_chart: {
    title: "옵션 전략선",
    lines: [
      { key: "stop_loss", label: "-30% 손절", formula: "avg_entry * 0.70", color: "#a95f59" },
      { key: "entry_average", label: "평균 진입", formula: "avg_entry", color: "#e8eef5" },
      { key: "target_35", label: "+35%", formula: "avg_entry * 1.35", color: "#3b8f70" },
      { key: "target_45", label: "+45%", formula: "avg_entry * 1.45", color: "#2f7f83" },
    ],
  },
  states: [],
  questions: [],
};

function loadSettings() {
  try {
    return {
      repeatStrongAlerts: true,
      vibrationEnabled: true,
      saveSignalLog: true,
      alertsEnabled: false,
      apiBaseUrl: "",
      backendEnvDraft: "",
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"),
    };
  } catch (error) {
    return {
      repeatStrongAlerts: true,
      vibrationEnabled: true,
      saveSignalLog: true,
      alertsEnabled: false,
      apiBaseUrl: "",
      backendEnvDraft: "",
    };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadWatchlists() {
  try {
    const stored = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "{}");
    return normalizeWatchlists(stored);
  } catch (error) {
    return normalizeWatchlists({});
  }
}

function normalizeWatchlists(value = {}) {
  return {
    domestic: normalizeWatchlist(value.domestic || []),
    us: normalizeWatchlist(value.us || []),
  };
}

function normalizeWatchlist(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const symbol = String(item.symbol || item.name || "").trim().toUpperCase();
      if (!symbol) return null;
      return {
        symbol,
        name: String(item.name || symbol).trim(),
        market: String(item.market || "").trim(),
        addedAt: item.addedAt || new Date().toISOString(),
      };
    })
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((other) => other.symbol === item.symbol) === index)
    .slice(0, 30);
}

function saveWatchlists() {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(state.watchlists));
}

function normalizeApiBaseUrl(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  const protocol = location.protocol === "https:" ? "https" : "http";
  return `${protocol}://${text}`;
}

function apiBaseUrlFromInput() {
  return normalizeApiBaseUrl(document.querySelector("#apiBaseUrl")?.value ?? state.settings.apiBaseUrl);
}

function currentApiBaseUrl() {
  return normalizeApiBaseUrl(state.settings.apiBaseUrl);
}

function apiUrl(path, baseOverride = currentApiBaseUrl()) {
  if (!String(path).startsWith("/api/")) return path;
  const base = normalizeApiBaseUrl(baseOverride);
  return base ? `${base}${path}` : path;
}

function apiBaseLabel(base = currentApiBaseUrl()) {
  return base || "현재 주소";
}

function loadSignalLog() {
  try {
    const log = JSON.parse(localStorage.getItem(SIGNAL_LOG_KEY) || "[]");
    return Array.isArray(log) ? log : [];
  } catch (error) {
    return [];
  }
}

function saveSignalLog() {
  if (!state.settings.saveSignalLog) return;
  localStorage.setItem(SIGNAL_LOG_KEY, JSON.stringify(state.signalLog));
}

async function init() {
  state.alertsEnabled = Boolean(state.settings.alertsEnabled);
  bindControls();
  await registerServiceWorker();

  state.activeTab = tabFromHash();
  state.selectedDate = dateFromQuery() || kstDateString();
  state.activeReplayDate = state.selectedDate === kstDateString() ? null : state.selectedDate;

  const [weeklyOptions, replayPayload, publicReplay, signalLogPayload, assetArchive] = await Promise.all([
    loadOptionalJson("data/weekly_options.json"),
    loadOptionalJson("/api/options-replay"),
    loadOptionalJson("data/public_weekly_replay.json"),
    loadOptionalJson("/api/options-signals"),
    loadOptionalJson(`/api/asset-archive?date=${encodeURIComponent(state.selectedDate)}`),
  ]);

  state.weeklyOptions = weeklyOptions || fallbackWeeklyOptions;
  state.assetArchive = assetArchive || fallbackAssetArchive();
  state.replay = normalizeReplayPayload(replayPayload) || publicReplay || state.weeklyOptions.signal_replay || {};
  if (!state.activeReplayDate) state.activeReplayDate = activeReplaySession()?.date || state.replay.active_session_id || null;
  const backendSignalLog = normalizeBackendSignalLogPayload(signalLogPayload);
  if (backendSignalLog) state.signalLog = backendSignalLog;

  renderSignalLog();
  renderStaticPanels();
  renderSettings();
  await loadMonitor(true);
  startPolling();
  openStartupPanelFromUrl();
}

function openStartupPanelFromUrl() {
  const panel = new URLSearchParams(window.location.search).get("panel");
  if (panel && modalMeta[panel]) openModal(panel);
  renderNavigation();
}

function tabFromHash() {
  const key = String(location.hash || "").replace(/^#/, "");
  return APP_TABS.includes(key) ? key : "collection";
}

function dateFromQuery() {
  const value = new URLSearchParams(window.location.search).get("date");
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : null;
}

async function setActiveTab(tab, options = {}) {
  const next = APP_TABS.includes(tab) ? tab : "collection";
  state.activeTab = next;
  if (options.updateHash !== false && location.hash !== `#${next}`) {
    history.replaceState(null, "", `${location.pathname}${location.search}#${next}`);
  }
  renderNavigation();
  renderAssetTabs();
  scheduleChartRedraw();
}

function setCryptoTab(tab) {
  const previous = state.cryptoTab;
  state.cryptoTab = ["all", "btc", "eth"].includes(tab) ? tab : "all";
  if (previous === "all" && state.cryptoTab !== "all") state.cryptoFrame = "240m";
  renderCryptoPanel();
  scheduleChartRedraw();
}

function setCryptoFrame(frame) {
  state.cryptoFrame = ["240m", "60m", "1d"].includes(frame) ? frame : "240m";
  renderCryptoPanel();
  scheduleChartRedraw();
}

async function setSelectedDate(date) {
  const next = clampDate(date || kstDateString());
  const requestSeq = state.dateLoadSeq + 1;
  state.dateLoadSeq = requestSeq;
  state.selectedDate = next;
  const loadingStartedAt = performance.now();
  setDateLoading(true, next);
  try {
    const replayRequest = isLiveDate(next)
      ? Promise.resolve(null)
      : loadOptionalJson(`/api/options-replay?date=${encodeURIComponent(next || "")}`);
    const assetRequest = loadOptionalJson(`/api/asset-archive?date=${encodeURIComponent(next || "")}`);
    const [replayPayload, assetPayload] = await Promise.all([replayRequest, assetRequest]);
    if (requestSeq !== state.dateLoadSeq) return;
    if (isLiveDate(next)) {
      state.activeReplayDate = activeReplaySession()?.date || null;
    } else {
      state.activeReplayDate = next;
      if (replayPayload) {
        state.replay = normalizeReplayPayload(replayPayload) || state.replay;
      } else {
        state.replay = {
          ...state.replay,
          selected_date: next,
          active_session: null,
        };
      }
    }
    if (assetPayload) state.assetArchive = assetPayload;
    renderStaticPanels();
    renderMonitor();
  } finally {
    if (requestSeq === state.dateLoadSeq) {
      const remaining = 300 - (performance.now() - loadingStartedAt);
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setDateLoading(false);
    }
  }
}

function moveSelectedDate(deltaDays) {
  const current = parseDate(state.selectedDate) || parseDate(kstDateString());
  current.setUTCDate(current.getUTCDate() + deltaDays);
  setSelectedDate(clampDate(current.toISOString().slice(0, 10)));
}

async function refreshAssetArchive(date = state.selectedDate) {
  const payload = await loadOptionalJson(`/api/asset-archive?date=${encodeURIComponent(date || "")}`);
  if (payload) state.assetArchive = payload;
}

function setDateLoading(loading, target = state.selectedDate) {
  state.dateLoading = Boolean(loading);
  state.dateLoadingTarget = loading ? target : null;
  document.querySelector(".app-shell")?.classList.toggle("date-loading", state.dateLoading);
  document.querySelectorAll("#collectionBoard, #signalBoard, #etfBoard, #stocksBoard, #usStocksBoard, #cryptoBoard").forEach((board) => {
    board.classList.toggle("loading", state.dateLoading);
    board.setAttribute("aria-busy", state.dateLoading ? "true" : "false");
  });
  renderDateToolbar();
  if (state.dateLoading) setTopStatus(`${target} 불러오는 중...`);
}

async function loadOptionalJson(path) {
  const url = apiUrl(path);
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url} 로드 실패`);
    return response.json();
  } catch (error) {
    return null;
  }
}

function normalizeReplayPayload(payload) {
  if (!payload) return null;
  if (payload.active_session || payload.status === "local_archive") return payload;
  return payload.sessions?.length ? payload : null;
}

function normalizeBackendSignalLogPayload(payload) {
  if (!payload || payload.source !== "backend" || !Array.isArray(payload.entries)) return null;
  return normalizeSignalLogEntries(payload.entries);
}

async function loadReplayDate(date, options = {}) {
  const payload = await loadOptionalJson(`/api/options-replay?date=${encodeURIComponent(date || "")}`);
  if (payload) {
    state.replay = normalizeReplayPayload(payload) || state.replay;
  } else {
    state.replay = {
      ...state.replay,
      selected_date: date,
      active_session: null,
    };
  }
  if (options.render !== false) renderReplay();
}

function bindControls() {
  document.querySelector("#refreshMonitor")?.addEventListener("click", () => loadMonitor(true));
  document.querySelector("#globalDateSelector")?.addEventListener("change", (event) => setSelectedDate(event.target.value || kstDateString()));
  document.querySelector("#dateToday")?.addEventListener("click", () => setSelectedDate(kstDateString()));
  document.querySelector("#datePrev")?.addEventListener("click", () => moveSelectedDate(-1));
  document.querySelector("#dateNext")?.addEventListener("click", () => moveSelectedDate(1));
  document.querySelectorAll("[data-tab-target]").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tabTarget));
  });
  document.querySelectorAll("[data-crypto-tab]").forEach((button) => {
    button.addEventListener("click", () => setCryptoTab(button.dataset.cryptoTab));
  });
  document.querySelectorAll("[data-crypto-frame]").forEach((button) => {
    button.addEventListener("click", () => setCryptoFrame(button.dataset.cryptoFrame));
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chart-action]");
    if (button) {
      updateChartZoom(button.dataset.chartId, button.dataset.chartAction);
      return;
    }
    const removeButton = event.target.closest("[data-watch-remove]");
    if (removeButton) {
      removeWatchSymbol(removeButton.dataset.watchScope, removeButton.dataset.watchRemove);
      return;
    }
    const searchButton = event.target.closest("[data-search-add]");
    if (searchButton) {
      addSearchResult(searchButton.dataset.searchScope, searchButton.dataset.searchAdd);
      return;
    }
    const card = event.target.closest("[data-jump-tab]");
    if (card && !event.target.closest("button, input")) jumpToCardTarget(card);
  });
  document.querySelector("#domesticWatchInput")?.addEventListener("keydown", (event) => handleSearchKeydown(event, "domestic"));
  document.querySelector("#usWatchInput")?.addEventListener("keydown", (event) => handleSearchKeydown(event, "us"));
  document.querySelector("#domesticWatchInput")?.addEventListener("input", () => {
    resetSearchCursor("domestic");
    renderSearchResults("domestic");
  });
  document.querySelector("#usWatchInput")?.addEventListener("input", () => {
    resetSearchCursor("us");
    renderSearchResults("us");
  });
  document.querySelector("#addDomesticWatch")?.addEventListener("click", () => addWatchSymbol("domestic"));
  document.querySelector("#addUsWatch")?.addEventListener("click", () => addWatchSymbol("us"));
  window.addEventListener("hashchange", () => setActiveTab(tabFromHash(), { updateHash: false }));
  document.querySelector("#enableAlerts")?.addEventListener("click", requestAlertToggle);
  document.querySelector("#testAlert")?.addEventListener("click", testAlert);
  document.querySelector("#toggleWakeLock")?.addEventListener("click", toggleWakeLock);
  document.querySelector("#testBackend")?.addEventListener("click", () => testBackendConnection());
  document.querySelector("#saveApiBaseUrl")?.addEventListener("click", saveApiBaseUrl);
  document.querySelector("#resetApiBaseUrl")?.addEventListener("click", resetApiBaseUrl);
  document.querySelector("#copyAndroidInstallCommand")?.addEventListener("click", copyAndroidInstallCommand);
  document.querySelector("#copyAndroidUpdateCommand")?.addEventListener("click", copyAndroidUpdateCommand);
  document.querySelector("#copyAndroidStartCommand")?.addEventListener("click", copyAndroidStartCommand);
  document.querySelector("#useAndroidLocalBackend")?.addEventListener("click", useAndroidLocalBackend);
  document.querySelector("#saveBackendEnvDraft")?.addEventListener("click", saveBackendEnvDraft);
  document.querySelector("#resetBackendEnvDraft")?.addEventListener("click", resetBackendEnvDraft);
  document.querySelector("#copyBackendEnvDraft")?.addEventListener("click", copyBackendEnvDraft);
  document.querySelector("#backendEnvDraft")?.addEventListener("input", (event) => {
    state.settings.backendEnvDraft = event.target.value;
  });
  document.querySelector("#cancelAlertConfirm")?.addEventListener("click", closeAlertConfirm);
  document.querySelector("#confirmAlertToggle")?.addEventListener("click", confirmAlertToggle);
  document.querySelector("#alertConfirmBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "alertConfirmBackdrop") closeAlertConfirm();
  });
  document.querySelector("#closeModal")?.addEventListener("click", closeModal);
  document.querySelector("#modalBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "modalBackdrop") closeModal();
  });
  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.openModal));
  });
  document.querySelector("#replayDate")?.addEventListener("change", (event) => {
    state.activeReplayDate = event.target.value || null;
    if (state.activeReplayDate) delete state.replayCursors[state.activeReplayDate];
    loadReplayDate(state.activeReplayDate);
  });
  document.querySelector("#replayFirst")?.addEventListener("click", () => moveReplayCursor("first"));
  document.querySelector("#replayPrev")?.addEventListener("click", () => moveReplayCursor("prev"));
  document.querySelector("#replayNext")?.addEventListener("click", () => moveReplayCursor("next"));
  document.querySelector("#replayEnd")?.addEventListener("click", () => moveReplayCursor("end"));
  document.querySelector("#replayCursor")?.addEventListener("input", (event) => {
    const active = activeReplaySession();
    if (!active) return;
    state.replayCursors[active.date || active.id] = Number(event.target.value) || 0;
    renderReplay();
  });
  document.querySelector("#repeatStrongAlerts")?.addEventListener("change", (event) => {
    state.settings.repeatStrongAlerts = event.target.checked;
    saveSettings();
    renderSettings();
  });
  document.querySelector("#vibrationEnabled")?.addEventListener("change", (event) => {
    state.settings.vibrationEnabled = event.target.checked;
    saveSettings();
    renderSettings();
  });
  document.querySelector("#saveSignalLog")?.addEventListener("change", (event) => {
    state.settings.saveSignalLog = event.target.checked;
    saveSettings();
    renderSettings();
  });
  document.querySelector("#clearSignalLog")?.addEventListener("click", clearSignalLog);
  updateViewportMetrics();
  setupChartResizeObserver();
  window.addEventListener("resize", handleViewportChange);
  window.visualViewport?.addEventListener("resize", handleViewportChange);
  window.visualViewport?.addEventListener("scroll", handleViewportChange);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    state.serviceWorkerRegistration = await navigator.serviceWorker.register("sw.js");
    state.serviceWorkerRegistration.update().catch(() => {});
  } catch (error) {
    state.serviceWorkerRegistration = null;
  }
}

function startPolling() {
  if (state.monitorTimer) window.clearInterval(state.monitorTimer);
  state.monitorTimer = window.setInterval(() => loadMonitor(), MONITOR_POLL_MS);
}

async function loadMonitor(manual = false) {
  if (manual) {
    if (isLiveDate()) setTopStatus("조회 중");
    else renderTopStatus();
  }
  try {
    const response = await fetch(apiUrl("/api/options-monitor"), { cache: "no-store" });
    const snapshot = await response.json();
    state.monitor = snapshot;
    renderMonitor();
    maybeBackfillSignalLog(snapshot);
    maybeRecordSignal(snapshot);
    maybeFireAlert(snapshot);
  } catch (error) {
    state.monitor = {
      ok: false,
      signal: {
        type: "warning",
        label: "연결 실패",
        title: "로컬 서버 연결 실패",
        message: "옵션 감시 API를 읽지 못했습니다. 서버 실행 상태를 확인하세요.",
        rule: "LOCAL_API_FAILED",
        time: "-",
        metrics: {},
      },
      main: { candles: [], latest: null, levels: {} },
      secondary: { latest: null },
    };
    renderMonitor();
  }
}

function renderMonitor() {
  const snapshot = state.monitor || {};
  const signal = snapshot.signal || snapshot.main?.signal || {};
  const signalType = signalClass(signal.type);
  const board = document.querySelector("#signalBoard");
  const latest = snapshot.main?.latest || {};
  const secondaryLatest = snapshot.secondary?.latest || {};
  const levels = snapshot.main?.levels || {};
  const age = number(signal.metrics?.age_minutes);

  if (board) {
    board.className = signalBoardClass(signalType);
  }
  setText("#signalBadge", signal.label || "대기");
  document.querySelector("#signalBadge").className = `signal-pill ${signalType}`;
  setText("#signalTitle", signal.title || signal.label || "신호 대기");
  setText("#signalMessage", signal.message || "KOSPI200 5분봉 데이터를 기다리고 있습니다.");
  setText("#latestCandleTime", `최신봉 ${latest.time || "-"}`);
  setText("#delayText", Number.isFinite(age) ? `지연 ${age}분` : "지연 -");
  renderTopStatus();
  renderPriceGrid(latest, secondaryLatest, levels);
  renderLiveLegend(levels);
  const livePlan = buildLiveTradePlan(snapshot);
  renderLiveTradePlan(livePlan);
  drawLiveChart(livePlan);
  renderSettings();
  renderAssetTabs();
}

function statusText(snapshot, signal) {
  if (!snapshot.ok) return "데이터 오류";
  if (signal?.type === "warning" && signal?.rule === "DATA_STALE_DURING_MARKET") return "데이터 지연";
  return `${snapshot.source?.key_required === false ? "키 없음" : "데이터"} · ${signal?.label || "대기"}`;
}

function signalBoardClass(signal) {
  return `signal-board ${signal || "neutral"}${state.dateLoading ? " loading" : ""}`;
}

function renderTopStatus() {
  const mode = archiveMode();
  const live = isLiveDate();
  const archive = state.assetArchive || {};
  const prefix = live ? "실시간" : mode.label;

  if (state.activeTab === "collection") {
    setTopStatus(`${prefix} · 모음 감시`);
    return;
  }

  if (state.activeTab === "options") {
    if (!live) {
      setTopStatus(`${mode.label} · ${mode.isDetail ? "옵션 상세 복기" : "옵션 1년 요약"}`);
      return;
    }
    const snapshot = state.monitor || {};
    const signal = snapshot.signal || snapshot.main?.signal || {};
    setTopStatus(statusText(snapshot, signal));
    return;
  }

  if (state.activeTab === "etf") {
    const context = state.monitor?.etf_context || {};
    const summary = live && context.thirty_minute ? etfLiveSummary(context) : archive.etf?.summary || {};
    const label = summary.label || "ETF 관찰";
    setTopStatus(`${prefix} · ${label.startsWith("ETF") ? label : `ETF ${label}`}`);
    return;
  }

  if (state.activeTab === "stocks") {
    const indexFilter = archive.stocks?.index_filter || {};
    setTopStatus(`${prefix} · 국장 ${indexFilter.label || "주식 전용"}`);
    return;
  }

  if (state.activeTab === "usStocks") {
    const summary = archive.us_stocks?.summary || {};
    setTopStatus(`${prefix} · 미장 ${summary.label || "선택 감시"}`);
    return;
  }

  if (state.activeTab === "crypto") {
    const summary = archive.crypto?.summary || {};
    const label = summary.label || "코인 BTC/ETH";
    setTopStatus(`${prefix} · ${label.startsWith("코인") ? label : `코인 ${label}`}`);
    return;
  }

  setTopStatus(`${prefix} · 1MonthFinder`);
}

function setTopStatus(text) {
  setText("#topStatusText", text);
}

function renderPriceGrid(latest, secondaryLatest, levels) {
  const items = [
    { label: "메인", value: formatNum(latest.close, 2), text: "KOSPI200" },
    { label: "보조", value: formatNum(secondaryLatest.close, 0), text: "KODEX200" },
    { label: "기준", value: formatNum(levels.fib_618, 2), text: "61.8%" },
    { label: "지수R", value: formatNum(levels.reset_mid_618_100, 2), text: "리셋 중심" },
  ];
  document.querySelector("#priceGrid").innerHTML = items.map(metricCard).join("");
}

function metricCard(item) {
  return `
    <article>
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <small>${escapeHtml(item.text)}</small>
    </article>
  `;
}

function renderLiveLegend(levels) {
  const entries = [
    { label: "KOSPI200", color: themeColor("--chart-line", "#e8eef5") },
    ...chartLevelEntries(levels).map((level) => ({ label: `${level.label} ${formatNum(level.value, 2)}`, color: level.color })),
    ...CHART_EXTRA_SERIES.map((line) => ({ label: line.label, color: line.color })),
  ];
  document.querySelector("#liveLegend").innerHTML = entries.map(legendItem).join("");
}

function legendItem(item) {
  return `<span style="color:${escapeAttr(item.color)}"><i></i>${escapeHtml(item.label)}</span>`;
}

function chartLevelEntries(levels = {}) {
  return [
    { key: "fib_618", label: "61.8", color: "#3b8f70" },
    { key: "fib_50", label: "50", color: "#5275ad" },
    { key: "fib_100", label: "100", color: "#a97022" },
    { key: "reset_mid_618_100", label: "지수R", color: "#6f6aa6" },
    { key: "fib_382", label: "38.2", color: "#a95f59" },
    { key: "fib_105", label: "105", color: "#7c4f48" },
  ]
    .map((level) => ({ ...level, value: number(levels[level.key]) }))
    .filter((level) => level.value != null);
}

function maybeRecordSignal(snapshot) {
  if (isBackendSignalLogSnapshot(snapshot)) return;
  const backendEntries = Array.isArray(snapshot?.main?.recent_signals) ? snapshot.main.recent_signals : [];
  if (backendEntries.length) return;
  const signal = snapshot.signal || {};
  if (!isLoggableSignal(signal)) return;
  const latest = snapshot.main?.latest || {};
  const tradePlan = buildLiveTradePlan(snapshot);
  const entry = signalLogEntry(signal, signalLogCandle(signal, latest), tradePlan);
  if (!entry || state.signalLog.some((item) => item.key === entry.key)) return;
  mergeSignalLog([entry]);
}

function maybeBackfillSignalLog(snapshot) {
  const backendEntries = Array.isArray(snapshot?.main?.recent_signals) ? snapshot.main.recent_signals : [];
  if (isBackendSignalLogSnapshot(snapshot)) {
    replaceSignalLog(backendEntries);
    return;
  }
  if (backendEntries.length) {
    const existing = new Set(state.signalLog.map((item) => item.key));
    const additions = backendEntries
      .map(normalizeBackendSignalLogEntry)
      .filter((entry) => entry && !existing.has(entry.key));
    if (additions.length) mergeSignalLog(additions);
    return;
  }

  const signals = Array.isArray(snapshot?.main?.signals) ? snapshot.main.signals : [];
  if (!signals.length) return;
  const candles = Array.isArray(snapshot?.main?.candles) ? snapshot.main.candles : [];
  const latest = snapshot?.main?.latest || {};
  const existing = new Set(state.signalLog.map((item) => item.key));
  const additions = signals
    .map((signal) => {
      if (!isLoggableSignal(signal)) return null;
      const fallback = candles[clampIndex(signal.point_index, candles.length)] || latest;
      const candle = signalLogCandle(signal, fallback);
      const entry = signalLogEntry(signal, candle, backfilledTradePlan(snapshot, signal, candle));
      if (!entry || existing.has(entry.key)) return null;
      existing.add(entry.key);
      return entry;
    })
    .filter(Boolean);
  if (!additions.length) return;
  mergeSignalLog(additions);
}

function isBackendSignalLogSnapshot(snapshot) {
  return snapshot?.main?.signal_log_source === "backend" || snapshot?.signal_log?.source === "backend";
}

function replaceSignalLog(entries) {
  state.signalLog = normalizeSignalLogEntries(entries);
  saveSignalLog();
  renderSignalLog();
}

function normalizeSignalLogEntries(entries = []) {
  const seen = new Set();
  return entries
    .map(normalizeBackendSignalLogEntry)
    .filter(Boolean)
    .sort((a, b) => signalLogTimestamp(b) - signalLogTimestamp(a))
    .filter((item) => {
      if (!item?.key || seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
}

function normalizeBackendSignalLogEntry(entry = {}) {
  if (!entry.key) return null;
  return {
    key: entry.key,
    type: entry.type || "watch",
    title: entry.title || "Signal",
    message: entry.message || "",
    time: entry.time || "-",
    close: entry.close,
    trade: entry.trade || null,
    sourceAt: entry.sourceAt || entry.datetime || "",
    createdAt: entry.createdAt || new Date().toISOString(),
    source: entry.source || "backend",
  };
}

function isLoggableSignal(signal = {}) {
  const rule = signalLogRule(signal);
  return Boolean(rule && rule !== "WAIT" && signal.alert_level !== "silent");
}

function signalLogRule(signal = {}) {
  return signal.rule || signal.action || "";
}

function isLateSessionSignal(signal = {}) {
  const rule = String(signalLogRule(signal));
  return rule.includes("LATE_SESSION") || rule.includes("FINAL_1530");
}

function lateSessionTradePlan(signal = {}, premium = optionPremiumPlan(signal)) {
  const rule = String(signalLogRule(signal));
  const metrics = signal.metrics || {};
  const isFinal = rule.includes("FINAL_1530");
  const isAggressive = rule.includes("ACCELERATION_HOLD") || signal.trade_decision === "hold";
  const isExitPrep = rule.includes("EXIT_PREP");
  const trailingStop = number(metrics.option_trailing_stop_after_3_3);
  return {
    status: isFinal ? "최종청산" : isAggressive ? "공격홀딩" : isExitPrep ? "장후반청산" : "시간관리",
    entry: premium.entry,
    stop: trailingStop ?? premium.stop,
    tp1: premium.tp1,
    tp2: premium.tp2,
    stopText: isAggressive && trailingStop != null ? `3.3 후 ${formatNum(trailingStop, 2)} 방어` : "기준/전환 확인",
    tp2Text: isAggressive ? "15:30까지" : "15:30 준비",
    contracts: 1,
    experimentalTag: metrics.codex_experimental_tag || CODEX_EXPERIMENTAL_PROFIT_EXTENSION_TAG,
  };
}

function signalLogCandle(signal = {}, fallback = {}) {
  const candle = signal.candle || {};
  return {
    ...fallback,
    ...candle,
    time: signal.time || candle.time || fallback.time,
    datetime: signal.datetime || candle.datetime || fallback.datetime,
    date: signal.date || candle.date || fallback.date,
    close: signal.index_value ?? candle.close ?? fallback.close,
  };
}

function signalLogEntry(signal, candle, tradePlan = null) {
  const rule = signalLogRule(signal);
  const close = number(candle.close ?? signal.index_value);
  const sourceAt = candle.datetime || signal.datetime || "";
  const key = `${rule}:${sourceAt || signal.time || candle.time || ""}:${close ?? ""}`;
  if (!rule || !key) return null;
  return {
    key,
    type: signal.type || "watch",
    title: signal.title || signal.label || "신호",
    message: signal.message || "",
    time: signal.time || candle.time || "-",
    close,
    trade: tradePlan?.status ? {
      status: tradePlan.status,
      entry: tradePlan.entry,
      stop: tradePlan.stop,
      tp1: tradePlan.tp1,
      tp2: tradePlan.tp2,
      stopText: tradePlan.stopText,
      tp2Text: tradePlan.tp2Text,
      contracts: tradePlan.contracts,
      tp1Gain: tradePlan.tp1Gain,
      runnerTargetText: tradePlan.runnerTargetText,
    } : null,
    sourceAt,
    createdAt: new Date().toISOString(),
  };
}

function backfilledTradePlan(snapshot, signal, candle) {
  const close = number(candle.close ?? signal.index_value);
  const levels = signal.levels || snapshot?.main?.levels || {};
  const signalLike = {
    ...signal,
    levels,
    candle,
    index_value: close,
  };
  const setup = tradeSetupFromSignal(signalLike, { levels }, close);
  if (setup) {
    return {
      status: setup.contracts > 1 ? "콜 진입" : "콜 보초",
      entry: setup.entry,
      stop: setup.stop,
      tp1: setup.tp1,
      tp2: setup.tp2,
      stopText: setup.stopText,
      tp2Text: setup.tp2Text,
      contracts: setup.contracts,
      tp1Gain: setup.tp1Gain,
      runnerTargetText: setup.runnerTargetText,
    };
  }
  if (isLateSessionSignal(signal)) {
    const premium = optionPremiumPlan(signal);
    return lateSessionTradePlan(signal, premium);
  }
  if (signal.trade_decision === "take_profit" || String(signalLogRule(signal)).includes("RUNNER_EXIT")) {
    const premium = optionPremiumPlan(signal);
    const runnerExit = number(signal.metrics?.option_runner_exit_premium) ?? premium.entry;
    return {
      status: "잔량청산",
      entry: premium.entry,
      stop: runnerExit,
      tp1: premium.tp1,
      tp2: runnerExit,
      stopText: `3회차 본청 ${formatNum(runnerExit, 2)}`,
      tp2Text: "청산확인",
      contracts: number(signal.metrics?.option_runner_exit_contracts) || 1,
    };
  }
  if (signal.type === "sell" || String(signalLogRule(signal)).includes("BREAK")) {
    const premium = optionPremiumPlan(signalLike);
    return {
      status: "손절/청산",
      entry: premium.entry,
      stop: premium.stop,
      tp1: premium.tp1,
      tp2: premium.tp2,
    };
  }
  return null;
}

function mergeSignalLog(additions) {
  const seen = new Set();
  state.signalLog = additions
    .concat(state.signalLog)
    .sort((a, b) => signalLogTimestamp(b) - signalLogTimestamp(a))
    .filter((item) => {
      if (!item?.key || seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
  saveSignalLog();
  renderSignalLog();
}

function signalLogTimestamp(item = {}) {
  const parsed = Date.parse(item.sourceAt || item.createdAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderSignalLog() {
  setText("#logCount", `${state.signalLog.length}개`);
  const root = document.querySelector("#signalLog");
  if (!root) return;
  if (!state.signalLog.length) {
    root.innerHTML = `<article class="empty-log">강한 신호가 발생하면 여기에 최근 기록이 쌓입니다.</article>`;
    return;
  }
  root.innerHTML = state.signalLog
    .map((item) => {
      const tp1GainText = item.trade?.tp1Gain != null ? `(+${formatNum(item.trade.tp1Gain, 2)})` : "";
      const runnerText = item.trade?.runnerTargetText || item.trade?.tp2Text || "";
      const tradeText = item.trade
        ? `진입 ${formatNum(item.trade.entry, 2)} · ${item.trade.stopText || `손절 ${formatNum(item.trade.stop, 2)}`} · 1차 익절 ${formatNum(item.trade.tp1, 2)}${tp1GainText}${runnerText ? ` · ${runnerText}` : ""}`
        : item.message;
      return `
        <article class="log-item ${escapeAttr(signalClass(item.type))}">
          <span>${escapeHtml(item.time || "-")} · ${formatNum(item.close, 2)}</span>
          <strong>${escapeHtml(item.trade?.status || item.title)}</strong>
          <small>${escapeHtml(tradeText)}</small>
        </article>
      `;
    })
    .join("");
}

function renderStaticPanels() {
  renderNavigation();
  renderDateToolbar();
  renderReplay();
  renderAssetTabs();
}

function activeReplaySession() {
  const sessions = Array.isArray(state.replay?.sessions) ? state.replay.sessions : [];
  const requested = state.activeReplayDate || state.replay?.active_session_id;
  if (state.replay?.active_session && (!requested || state.replay.active_session.date === requested || state.replay.active_session.id === requested)) {
    return state.replay.active_session;
  }
  return (
    sessions.find((session) => session.date === requested || session.id === requested) ||
    sessions.find((session) => session.id === state.replay?.active_session_id) ||
    sessions[0] ||
    null
  );
}

function renderReplay() {
  const replay = state.replay || {};
  const sessions = Array.isArray(replay.sessions) ? replay.sessions : [];
  const active = activeReplaySession();
  const requested = state.activeReplayDate;
  const missing = Boolean(requested && !active);
  const dateInput = document.querySelector("#replayDate");
  if (dateInput) {
    const dates = sessions.map((session) => session.date || session.id).filter(Boolean).sort();
    const range = replay.date_range || {};
    dateInput.value = requested || active?.date || replay.selected_date || "";
    dateInput.min = range.start || dates[0] || "";
    dateInput.max = range.end || dates[dates.length - 1] || "";
  }

  setText("#replayBadge", missing ? "자료 없음" : active?.profile?.label || "복기");
  document.querySelector("#replayBadge").className = `signal-pill ${missing ? "warning" : "watch"}`;
  const range = replay.date_range || {};
  const rangeText = range.start && range.end
    ? `저장 범위 ${range.start} ~ ${range.end} · 최근 ${replay.retention_days || 31}일`
    : "저장된 최근 1개월 복기 데이터가 아직 없습니다.";
  setText("#replayRangeText", rangeText);
  renderReplayDataWarning(active, missing);
  setText(
    "#replayText",
    missing
      ? `${requested} 복기 데이터가 아직 없습니다. 저장된 날짜를 선택하세요.`
      : active?.data_window
        ? `옵션 프리미엄 플랜 전용 복기입니다. Yahoo 지수 5분봉 데이터 ${active.data_window.first_time}~${active.data_window.last_time} 기준입니다.`
        : active?.trade_plan?.text || replay.notice || "선택 날짜의 5분봉 공식선과 신호를 표시합니다.",
  );
  const cursorIndex = missing ? 0 : replayCursorIndex(active);
  renderReplayStepper(active, cursorIndex, missing);
  const visibleSession = missing ? null : clipReplaySession(active, cursorIndex);
  const tradePlan = missing ? emptyReplayTradePlan() : buildReplayTradePlan(visibleSession);
  renderReplayTradeStats(tradePlan, missing);
  renderReplayList(tradePlan.events, missing);
  renderReplayLegend();
  drawReplayChart(visibleSession, tradePlan);
}

function replayCursorIndex(session) {
  const seriesLength = Array.isArray(session?.series) ? session.series.length : 0;
  if (!seriesLength) return 0;
  const key = session.date || session.id;
  if (state.replayCursors[key] == null) state.replayCursors[key] = seriesLength - 1;
  return Math.max(0, Math.min(seriesLength - 1, Number(state.replayCursors[key]) || 0));
}

function renderReplayStepper(session, cursorIndex, missing) {
  const input = document.querySelector("#replayCursor");
  const series = Array.isArray(session?.series) ? session.series : [];
  const max = Math.max(0, series.length - 1);
  if (input) {
    input.min = "0";
    input.max = String(max);
    input.value = String(Math.max(0, Math.min(max, cursorIndex)));
    input.disabled = missing || !series.length;
  }
  const point = series[cursorIndex] || {};
  setText("#replayCursorText", series.length ? `${point.time || "-"} 기준 · ${cursorIndex + 1}/${series.length}봉 · 미래 데이터 숨김` : "복기 데이터 없음");
  ["#replayFirst", "#replayPrev"].forEach((selector) => {
    const node = document.querySelector(selector);
    if (node) node.disabled = missing || cursorIndex <= 0;
  });
  ["#replayNext", "#replayEnd"].forEach((selector) => {
    const node = document.querySelector(selector);
    if (node) node.disabled = missing || cursorIndex >= max;
  });
}

function clipReplaySession(session, cursorIndex) {
  const fullSeries = Array.isArray(session?.series) ? session.series : [];
  const series = fullSeries.slice(0, cursorIndex + 1);
  const signals = (Array.isArray(session?.signals) ? session.signals : []).filter((signal) => Number(signal.point_index || 0) <= cursorIndex);
  const visibleLevels = levelsForVisibleSeries(series);
  return {
    ...session,
    series,
    fullSeries,
    signals,
    levels: visibleLevels,
  };
}

function levelsForVisibleSeries(series) {
  const sample = series.length > 1 ? series.slice(0, -1) : series;
  const highs = sample.map((point) => number(point.high)).filter((value) => value != null);
  const lows = sample.map((point) => number(point.low)).filter((value) => value != null);
  if (!highs.length || !lows.length) return {};
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const span = Math.max(high - low, 0.0001);
  const resetFib100 = high - span / 0.618;
  return {
    day_high: high,
    day_low: low,
    fib_382: high - span * 0.382,
    fib_50: high - span * 0.5,
    fib_618: high - span * 0.618,
    fib_100: low,
    fib_105: high - span * 1.05,
    reset_fib_618: low,
    reset_fib_100: resetFib100,
    reset_mid_618_100: (low + resetFib100) / 2,
  };
}

function moveReplayCursor(action) {
  const active = activeReplaySession();
  const seriesLength = Array.isArray(active?.series) ? active.series.length : 0;
  if (!active || !seriesLength) return;
  const key = active.date || active.id;
  const current = replayCursorIndex(active);
  const max = seriesLength - 1;
  const next = {
    first: 0,
    prev: Math.max(0, current - 1),
    next: Math.min(max, current + 1),
    end: max,
  }[action] ?? current;
  state.replayCursors[key] = next;
  renderReplay();
}

function renderNavigation() {
  document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== state.activeTab;
    panel.classList.toggle("active", panel.dataset.tabPanel === state.activeTab);
  });
  document.querySelectorAll("[data-tab-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === state.activeTab);
  });
}

function renderDateToolbar() {
  const selected = clampDate(state.selectedDate || kstDateString());
  state.selectedDate = selected;
  const input = document.querySelector("#globalDateSelector");
  if (input) {
    input.value = selected;
    input.min = offsetDate(kstDateString(), -SUMMARY_ARCHIVE_DAYS);
    input.max = kstDateString();
  }
  const mode = archiveMode(selected);
  const badge = document.querySelector("#dateModeBadge");
  if (badge) {
    badge.textContent = state.dateLoading ? "불러오는 중" : mode.label;
    badge.className = `signal-pill ${state.dateLoading ? "watch" : mode.className}`;
  }
  setText("#dateModeText", state.dateLoading ? `${state.dateLoadingTarget || selected} 데이터를 불러오는 중입니다.` : mode.text);
  const prev = document.querySelector("#datePrev");
  const today = document.querySelector("#dateToday");
  const next = document.querySelector("#dateNext");
  const inputDisabled = state.dateLoading;
  if (input) input.disabled = inputDisabled;
  if (prev) prev.disabled = inputDisabled;
  if (today) today.disabled = inputDisabled;
  if (next) next.disabled = inputDisabled || selected >= kstDateString();
}

function renderAssetTabs() {
  renderNavigation();
  renderDateToolbar();
  renderTopStatus();
  renderCollectionPanel();
  renderOptionsPanel();
  renderEtfPanel();
  renderStocksPanel();
  renderUsStocksPanel();
  renderCryptoPanel();
  scheduleChartRedraw();
}

function renderCollectionPanel() {
  const archive = state.assetArchive || fallbackAssetArchive();
  const coreItems = collectionCoreItems(archive);
  const customItems = [
    ...watchItemsForScope("domestic", { compact: true }),
    ...watchItemsForScope("us", { compact: true }),
  ];
  const urgentCount = [...coreItems, ...customItems].filter((item) => ["candidate", "warning", "sell", "avoid"].includes(item.signal)).length;
  const board = document.querySelector("#collectionBoard");
  const boardSignal = urgentCount ? "watch" : "neutral";
  if (board) board.className = signalBoardClass(boardSignal);
  setText("#collectionBadge", urgentCount ? `${urgentCount}개 확인` : "모음");
  const badge = document.querySelector("#collectionBadge");
  if (badge) badge.className = `signal-pill ${urgentCount ? "watch" : "neutral"}`;
  setText("#collectionDateText", `${state.selectedDate} · ${isLiveDate() ? "실시간" : "복기"}`);
  setText("#collectionMessage", "기본 감시 4개를 먼저 보고, 아래에서 국장/미장 관심종목을 선택 감시합니다.");
  document.querySelector("#collectionMetricGrid").innerHTML = [
    { label: "기본 감시", value: "4", text: "옵션·ETF·BTC·ETH" },
    { label: "국장 관심", value: formatNum(state.watchlists.domestic.length, 0), text: "선택 종목" },
    { label: "미장 관심", value: formatNum(state.watchlists.us.length, 0), text: "선택 종목" },
    { label: "확인 필요", value: formatNum(urgentCount, 0), text: "신호/위험" },
  ].map(metricCard).join("");
  document.querySelector("#coreWatchGrid").innerHTML = coreItems.map(collectionCard).join("");
  document.querySelector("#customWatchGrid").innerHTML = customItems.length
    ? customItems.map(collectionCard).join("")
    : `<article class="watch-card neutral" data-jump-tab="stocks"><span class="watch-kind">선택 감시</span><strong>관심종목 대기</strong><p>국장 또는 미장 탭에서 관심종목을 추가하면 이곳에 쌓입니다.</p></article>`;
}

function collectionCoreItems(archive = state.assetArchive || fallbackAssetArchive()) {
  const snapshot = state.monitor || {};
  const optionSignal = snapshot.signal || {};
  const optionLatest = snapshot.main?.latest || {};
  const etfSummary = archive.etf?.summary || {};
  const etfSelected = archive.etf?.selected || archive.etf?.latest || {};
  const assets = archive.crypto?.assets || [];
  const btc = assets.find((asset) => String(asset.label || "").toUpperCase() === "BTC");
  const eth = assets.find((asset) => String(asset.label || "").toUpperCase() === "ETH");
  return [
    {
      kind: "옵션",
      title: "KOSPI200 옵션",
      signal: signalClass(optionSignal.type || "neutral"),
      badge: optionSignal.label || "대기",
      value: formatNum(optionLatest.close, 2),
      detail: optionSignal.title || optionSignal.message || "실시간 옵션 신호",
      jumpTab: "options",
    },
    {
      kind: "ETF",
      title: "KODEX200",
      signal: signalClass(etfSummary.signal || "watch"),
      badge: etfSummary.label || "관찰",
      value: formatNum(etfSelected.close, 0),
      detail: etfSummary.message || "ETF 분할매수 컨텍스트",
      jumpTab: "etf",
    },
    cryptoCollectionItem(btc, assets, "BTC", "btc"),
    cryptoCollectionItem(eth, assets, "ETH", "eth"),
  ];
}

function cryptoCollectionItem(asset, assets, title, cryptoTab) {
  const signal = cryptoSignalPlan(asset, assets);
  const selected = asset?.selected || asset?.latest || {};
  return {
    kind: "코인",
    title,
    signal: signal.className || "neutral",
    badge: signal.label || "관찰",
    value: formatNum(selected.close, priceDigits(selected.close)),
    detail: signal.message || "코인 신호",
    jumpTab: "crypto",
    jumpCrypto: cryptoTab,
  };
}

function collectionCard(item) {
  const signal = signalClass(item.signal || "neutral");
  return `
    <article class="watch-card ${escapeAttr(signal)}" role="button" tabindex="0" data-jump-tab="${escapeAttr(item.jumpTab || "")}" data-jump-crypto="${escapeAttr(item.jumpCrypto || "")}">
      <span class="watch-kind">${escapeHtml(item.kind || "감시")}</span>
      <div>
        <strong>${escapeHtml(item.title || "-")}</strong>
        <span class="signal-pill ${escapeAttr(signal)}">${escapeHtml(item.badge || "관찰")}</span>
      </div>
      <p>${escapeHtml(item.detail || "")}</p>
      <small>${escapeHtml(item.value || "-")}</small>
    </article>
  `;
}

function renderOptionsPanel() {
  const live = isLiveDate();
  const signalBoard = document.querySelector("#signalBoard");
  const logPanel = document.querySelector("#signalLogPanel");
  const archivePanel = document.querySelector("#optionArchivePanel");
  if (signalBoard) signalBoard.hidden = !live;
  if (logPanel) logPanel.hidden = !live;
  if (archivePanel) archivePanel.hidden = live;
  if (live) return;

  const mode = archiveMode();
  const session = replaySessionForDate(state.selectedDate);
  const summaryRoot = document.querySelector("#optionArchiveSummary");
  const listRoot = document.querySelector("#optionArchiveSignals");
  setText("#optionArchiveTitle", mode.isDetail ? "옵션 상세 복기" : "옵션 1년 요약");
  if (!session || !mode.isDetail) {
    const sessions = Array.isArray(state.replay?.sessions) ? state.replay.sessions : [];
    const range = state.replay?.date_range || state.assetArchive?.options?.date_range || {};
    if (summaryRoot) {
      summaryRoot.innerHTML = [
        { label: "선택일", value: state.selectedDate, text: mode.label },
        { label: "상세 보관", value: `${sessions.length}일`, text: `${range.start || "-"}~${range.end || "-"}` },
        { label: "정책", value: "90일+1년", text: "상세/요약 분리" },
      ].map(metricCard).join("");
    }
    setText("#optionArchiveCount", `${sessions.length}일`);
    drawEmptyChart(document.querySelector("#optionArchiveChart"), "상세 차트 없음", 320, mode.isDetail ? "저장된 거래일을 선택하세요." : "90일보다 오래된 날짜는 1년 요약으로 확인합니다.");
    if (listRoot) {
      listRoot.innerHTML = `<article class="replay-item watch"><strong>${escapeHtml(mode.label)}</strong><small>${escapeHtml(mode.text)}</small></article>`;
    }
    return;
  }

  const tradePlan = buildReplayTradePlan(session);
  const stats = tradePlan.stats || {};
  if (summaryRoot) {
    summaryRoot.innerHTML = [
      { label: "날짜", value: session.date || state.selectedDate, text: session.weekday_label || "복기" },
      { label: "5분봉", value: `${session.series?.length || 0}개`, text: session.data_window ? `${session.data_window.first_time}~${session.data_window.last_time}` : "저장 데이터" },
      { label: "신호", value: `${tradePlan.events?.length || 0}개`, text: `순손익 ${formatNum(stats.netProfit, 2)}` },
      { label: "승률", value: `${formatNum(stats.winRate, 1)}%`, text: "가상 플랜 기준" },
    ].map(metricCard).join("");
  }
  setText("#optionArchiveCount", `${tradePlan.events?.length || 0}개`);
  drawOptionArchiveChart(session, tradePlan);
  if (listRoot) {
    listRoot.innerHTML = tradePlan.events?.length
      ? tradePlan.events.slice(-12).reverse().map((event) => `
          <article class="replay-item ${escapeAttr(event.kind || "watch")}">
            <span>${escapeHtml(event.time || "-")} · ${formatNum(event.index_value, 2)}</span>
            <strong>${escapeHtml(event.title || event.label || "신호")}</strong>
            <small>${escapeHtml(event.detail || "")}</small>
          </article>
        `).join("")
      : `<article class="replay-item watch"><strong>신호 없음</strong><small>선택일에는 기록된 옵션 행동 신호가 없습니다.</small></article>`;
  }
}

function renderEtfPanel() {
  const archive = state.assetArchive || fallbackAssetArchive();
  const etf = archive.etf || {};
  const live = isLiveDate();
  const context = state.monitor?.etf_context || {};
  const selected = live ? state.monitor?.secondary?.latest || etf.latest || {} : etf.selected || {};
  const summary = live && context.thirty_minute
    ? etfLiveSummary(context)
    : etf.summary || {};
  const signal = signalClass(summary.signal || "watch");
  const board = document.querySelector("#etfBoard");
  if (board) board.className = signalBoardClass(signal);
  setText("#etfBadge", summary.label || "관찰");
  const badge = document.querySelector("#etfBadge");
  if (badge) badge.className = `signal-pill ${signal}`;
  setText("#etfDateText", `${state.selectedDate} · ${live ? "실시간" : "요약"}`);
  setText("#etfMessage", summary.message || "KODEX200 ETF 분할매수 컨텍스트를 확인합니다.");
  document.querySelector("#etfMetricGrid").innerHTML = [
    { label: "KODEX200", value: formatNum(selected.close, 0), text: selected.date || selected.time || "-" },
    { label: "점수", value: formatNum(summary.score, 1), text: "1년 요약" },
    { label: "30분 50%", value: formatNum(context.thirty_minute?.fib_50, 0), text: etfStanceLabel(context.thirty_minute?.stance) },
    { label: "61.8%", value: formatNum(context.thirty_minute?.fib_618, 0), text: "재투입 후보" },
  ].map(metricCard).join("");
  document.querySelector("#etfGuideList").innerHTML = [
    guideItem("분할", "30/30/20/20 모델로 보되 옵션 계약수로 직접 환산하지 않습니다."),
    guideItem("지수 필터", archive.etf?.index_filter?.message || "KOSPI200 흐름과 함께 확인합니다."),
    guideItem("아카이브", live ? "오늘은 실시간 ETF 컨텍스트를 표시합니다." : "과거 날짜는 1년 일봉 요약으로 표시합니다."),
  ].join("");
}

function renderStocksPanel() {
  const stocks = state.assetArchive?.stocks || {};
  const indexFilter = stocks.index_filter || {};
  const signal = signalClass(indexFilter.signal || "neutral");
  const board = document.querySelector("#stocksBoard");
  if (board) board.className = signalBoardClass(signal);
  setText("#stocksBadge", indexFilter.label || "주식 전용");
  const badge = document.querySelector("#stocksBadge");
  if (badge) badge.className = `signal-pill ${signal}`;
  setText("#stocksTitle", "국장 종목");
  setText("#stocksDateText", `${state.selectedDate} · ${isLiveDate() ? "실시간" : "요약"}`);
  setText("#stocksMessage", indexFilter.message || "국내 주식 후보를 지수 흐름 필터와 함께 확인합니다.");
  const universe = stocks.universe_summary || {};
  const shortTerm = stocks.short_term || {};
  const swing = stocks.swing || {};
  document.querySelector("#stocksMetricGrid").innerHTML = [
    { label: "전체 종목", value: formatNum(universe.total_count, 0), text: `분석 ${formatNum(universe.history_ready_count, 0)}개` },
    { label: "1일 후보", value: formatNum(shortTerm.candidate_count, 0), text: algorithmKoreanLabel(shortTerm.algorithm_label || shortTerm.label || "단기") },
    { label: "1달 후보", value: formatNum(swing.candidate_count, 0), text: algorithmKoreanLabel(swing.algorithm_label || swing.label || "스윙") },
    { label: "지수 필터", value: indexFilter.label || "-", text: `점수 ${formatNum(indexFilter.score, 1)}` },
  ].map(metricCard).join("");
  const rows = [...(shortTerm.top || []).map((row) => ({ ...row, bucket: "1일" })), ...(swing.top || []).slice(0, 5).map((row) => ({ ...row, bucket: "1달" }))];
  renderSearchResults("domestic");
  renderWatchList("domestic", "#domesticWatchList");
  document.querySelector("#stocksCandidateList").innerHTML = rows.length
    ? rows.slice(0, 12).map(stockItem).join("")
    : `<article class="asset-item watch"><div class="asset-main"><strong>후보 없음</strong><small>${escapeHtml(stocks.archive_note || "시장 데이터 생성 후 표시됩니다.")}</small></div></article>`;
}

function renderUsStocksPanel() {
  const usStocks = state.assetArchive?.us_stocks || {};
  const summary = usStocks.summary || {};
  const signal = signalClass(summary.signal || "neutral");
  const board = document.querySelector("#usStocksBoard");
  if (board) board.className = signalBoardClass(signal);
  setText("#usStocksBadge", summary.label || "미장 관찰");
  const badge = document.querySelector("#usStocksBadge");
  if (badge) badge.className = `signal-pill ${signal}`;
  setText("#usStocksDateText", `${state.selectedDate} · ${isLiveDate() ? "실시간" : "복기"}`);
  setText("#usStocksMessage", summary.message || "미장은 SPY/QQQ 상대강도와 20/50/200일선으로 관심종목 신호를 봅니다.");
  document.querySelector("#usStocksMetricGrid").innerHTML = [
    { label: "관심 종목", value: formatNum(state.watchlists.us.length, 0), text: "사용자 선택" },
    { label: "추적군", value: formatNum(usStocks.ready_count, 0), text: `${formatNum(usStocks.tracked_count, 0)}개 중` },
    { label: "후보", value: formatNum(usStocks.candidate_count, 0), text: "상승 후보" },
    { label: "기준", value: "SPY/QQQ", text: "상대강도" },
  ].map(metricCard).join("");
  renderSearchResults("us");
  renderWatchList("us", "#usWatchList");
  const top = usStocks.top || [];
  document.querySelector("#usFilterGuideList").innerHTML = top.length
    ? top.slice(0, 8).map(usStockItem).join("")
    : [
      guideItem("상대강도", "SPY/QQQ보다 강한 종목만 공격 후보로 올립니다."),
      guideItem("추세", "20일선 회복, 50일선 방향, 200일선 위치를 함께 봅니다."),
      guideItem("위험", "VIX 급등, 갭 하락, 거래량 없는 상승은 신호 강도를 낮춥니다."),
    ].join("");
}

function renderCryptoPanel() {
  const crypto = state.assetArchive?.crypto || {};
  const assets = crypto.assets || [];
  syncCryptoControls();
  if (state.cryptoTab !== "all") {
    renderCryptoDetailPanel(cryptoSelectedAsset(assets), assets);
    return;
  }
  const summary = crypto.summary || {};
  const signal = signalClass(summary.signal || "neutral");
  const board = document.querySelector("#cryptoBoard");
  if (board) board.className = signalBoardClass(signal);
  setText("#cryptoBadge", summary.label || "관찰");
  const badge = document.querySelector("#cryptoBadge");
  if (badge) badge.className = `signal-pill ${signal}`;
  setText("#cryptoDateText", `${state.selectedDate} · ${isLiveDate() ? "실시간" : "요약"}`);
  setText("#cryptoMessage", summary.message || "BTC/ETH 기본 감시를 표시합니다.");
  setText("#cryptoTitle", "코인");
  document.querySelector("#cryptoMetricGrid").innerHTML = cryptoMetricItems(assets).map(metricCard).join("");
  document.querySelector("#cryptoSignalList").innerHTML = assets.length
    ? assets.map((asset) => cryptoSignalCard(asset, assets)).join("")
    : `<article class="crypto-signal-card watch"><header><h2>신호 대기</h2><span class="signal-pill watch">관찰</span></header><p>BTC/ETH 데이터를 가져온 뒤 진입·손절·익절 기준을 표시합니다.</p></article>`;
  document.querySelector("#cryptoAssetList").innerHTML = assets.length
    ? assets.map(cryptoItem).join("")
    : `<article class="asset-item watch"><div class="asset-main"><strong>자료 없음</strong><small>BTC/ETH 데이터를 가져오지 못했습니다.</small></div></article>`;
}

function renderCryptoDetailPanel(asset, assets = []) {
  const name = state.cryptoTab === "eth" ? "이더리움" : "비트코인";
  const rows = cryptoRowsForFrame(asset, state.cryptoFrame);
  const signal = cryptoSignalPlan(asset, assets, { rows, frame: state.cryptoFrame });
  const boardSignal = signalClass(signal.className || "neutral");
  const board = document.querySelector("#cryptoBoard");
  if (board) board.className = signalBoardClass(boardSignal);
  setText("#cryptoBadge", signal.label || "관찰");
  const badge = document.querySelector("#cryptoBadge");
  if (badge) badge.className = `signal-pill ${boardSignal}`;
  setText("#cryptoTitle", name);
  setText("#cryptoDateText", `${state.selectedDate} · ${isLiveDate() ? "실시간" : "복기"} · ${cryptoFrameLabel(state.cryptoFrame)}`);
  setText(
    "#cryptoMessage",
    asset?.ok
      ? `${cryptoFrameLabel(state.cryptoFrame)} 기준으로 20선·60선·돌파선·손절/익절선을 함께 봅니다. 기본값은 과열 잡음을 줄이기 위해 240분입니다.`
      : `${name} 데이터를 가져오지 못했습니다. 연결 상태를 확인한 뒤 다시 새로고침해 주세요.`,
  );
  document.querySelector("#cryptoMetricGrid").innerHTML = cryptoDetailMetricItems(asset, assets, signal, rows).map(metricCard).join("");
  document.querySelector("#cryptoSignalList").innerHTML = asset
    ? cryptoSignalCard(asset, assets, { rows, frame: state.cryptoFrame })
    : `<article class="crypto-signal-card watch"><header><h2>${name}</h2><span class="signal-pill watch">대기</span></header><p>분봉 데이터를 기다리는 중입니다.</p></article>`;
  document.querySelector("#cryptoAssetList").innerHTML = asset
    ? cryptoItem(asset)
    : `<article class="asset-item watch"><div class="asset-main"><strong>${name}</strong><small>데이터 없음</small></div></article>`;
}

function syncCryptoControls() {
  document.querySelectorAll("[data-crypto-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.cryptoTab === state.cryptoTab);
  });
  document.querySelectorAll("[data-crypto-frame]").forEach((button) => {
    button.classList.toggle("active", button.dataset.cryptoFrame === state.cryptoFrame);
  });
  const frameTabs = document.querySelector("#cryptoTimeframeTabs");
  if (frameTabs) frameTabs.hidden = state.cryptoTab === "all";
}

function cryptoSelectedAsset(assets = []) {
  const target = state.cryptoTab === "eth" ? "ETH" : "BTC";
  return assets.find((asset) => String(asset.label || "").toUpperCase() === target) || null;
}

function cryptoMetricItems(assets = []) {
  const btc = assets.find((asset) => String(asset.label || "").toUpperCase() === "BTC") || {};
  const eth = assets.find((asset) => String(asset.label || "").toUpperCase() === "ETH") || {};
  const btcScore = number(btc.summary?.score);
  const ethScore = number(eth.summary?.score);
  const attackScore = Math.max(btcScore ?? 0, ethScore ?? 0);
  const leader = ethScore != null && ethScore > (btcScore ?? -1) ? "ETH 우위" : "BTC 기준";
  const btcAtr = atrPercent(btc.history, state.selectedDate, 14);
  const ethAtr = atrPercent(eth.history, state.selectedDate, 14);
  const stopText = btcAtr != null || ethAtr != null
    ? `${formatNum(Math.max((btcAtr || 0) * 2, (ethAtr || 0) * 2), 1)}%`
    : "-";
  return [
    { label: "시장 방어", value: formatNum(btcScore, 0), text: "BTC 기준" },
    { label: "공격 신호", value: formatNum(attackScore, 0), text: leader },
    { label: "최소 손절", value: stopText, text: "2ATR 기준" },
    { label: "추적 익절", value: "20일선", text: "잔량 기준" },
  ];
}

function cryptoDetailMetricItems(asset, allAssets = [], signal = null, rows = []) {
  const selected = cryptoLatestRow(rows) || asset?.selected || asset?.latest || {};
  const close = number(selected.close);
  const stopGap = signal?.entry != null && signal?.stop != null && signal.entry > 0
    ? `${formatNum((signal.entry - signal.stop) / signal.entry * 100, 1)}%`
    : "-";
  const atrPct = atrPercent(rows.length ? rows : asset?.history, state.selectedDate, 14);
  const btc = allAssets.find((item) => String(item.label || "").toUpperCase() === "BTC");
  const btcText = String(asset?.label || "").toUpperCase() === "BTC"
    ? "시장 기준"
    : cryptoSignalClass(btc?.summary?.signal, (number(btc?.summary?.score) ?? 0) < 52) === "warning"
      ? "BTC 약세 반영"
      : "BTC 필터 통과";
  return [
    { label: "현재가", value: formatNum(close, priceDigits(close)), text: selected.time ? `${shortDate(selected.date)} ${selected.time}` : selected.date || "-" },
    { label: "신호", value: signal?.label || "-", text: btcText },
    { label: "진입 기준", value: signal?.entryText || "-", text: cryptoFrameLabel(state.cryptoFrame) },
    { label: "손절 폭", value: stopGap, text: atrPct != null ? `ATR ${formatNum(atrPct, 1)}%` : "ATR 대기" },
  ];
}

function cryptoSignalCard(asset, allAssets = [], options = {}) {
  const signal = cryptoSignalPlan(asset, allAssets, options);
  return `
    <article class="crypto-signal-card ${escapeAttr(signal.className)}">
      <header>
        <h2>${escapeHtml(signal.name)}</h2>
        <span class="signal-pill ${escapeAttr(signal.className)}">${escapeHtml(signal.label)}</span>
      </header>
      <p>${escapeHtml(signal.message)}</p>
      <div class="crypto-signal-grid">
        ${[
          { label: "진입 기준", value: signal.entryText },
          { label: "최소 손절", value: signal.stopText },
          { label: "1차 익절", value: signal.take1Text },
          { label: "2차 익절", value: signal.take2Text },
          { label: "추적 익절", value: signal.trailText },
        ].map((item) => `
          <article>
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </article>
        `).join("")}
      </div>
    </article>
  `;
}

function cryptoSignalPlan(asset, allAssets = [], options = {}) {
  const rows = Array.isArray(options.rows) ? options.rows : Array.isArray(asset?.history) ? asset.history : [];
  const selected = options.selected || cryptoLatestRow(rows) || asset?.selected || asset?.latest || {};
  const close = number(selected.close);
  const summary = options.frame && options.frame !== "1d"
    ? cryptoComputedSummary(rows, selected, asset?.summary || {})
    : asset?.summary || {};
  const score = number(summary.score);
  const atrPct = atrPercent(rows, state.selectedDate, 14);
  const high20 = rollingExtreme(rows, state.selectedDate, 20, "high", "max");
  const high55 = rollingExtreme(rows, state.selectedDate, 55, "high", "max");
  const ma20 = rollingAverage(rows, state.selectedDate, 20) ?? number(summary.ma20);
  const ma60 = rollingAverage(rows, state.selectedDate, 60) ?? number(summary.ma60);
  const btc = allAssets.find((item) => String(item.label || "").toUpperCase() === "BTC");
  const btcRows = options.frame && options.frame !== "1d" ? cryptoRowsForFrame(btc, options.frame) : [];
  const btcSummary = btcRows.length ? cryptoComputedSummary(btcRows, cryptoLatestRow(btcRows), btc?.summary || {}) : btc?.summary || {};
  const btcWeak = String(asset?.label || "").toUpperCase() !== "BTC" && (btcSummary.signal === "warning" || (number(btcSummary.score) ?? 0) < 52);
  const className = cryptoSignalClass(summary.signal, btcWeak);
  const label = cryptoSignalLabel(summary.signal, btcWeak);
  const entry = cryptoEntryPrice(close, ma20, ma60, high20, high55, className);
  const stop = cryptoStopPrice(close, entry, atrPct, className);
  const risk = entry != null && stop != null ? Math.max(entry - stop, entry * 0.02) : null;
  const take1 = entry != null && risk != null ? entry + risk : null;
  const take2 = entry != null && risk != null ? entry + risk * 2 : null;
  const lineLabel = options.frame && options.frame !== "1d" ? "20선" : "20일선";
  const trail = ma20 != null ? `${lineLabel} ${formatNum(ma20, priceDigits(close))}` : lineLabel;
  const reason = cryptoSignalReason(summary, btcWeak, close, ma20, ma60, high20, score, options.frame);
  return {
    name: asset?.label || asset?.symbol || "코인",
    className,
    label,
    message: reason,
    close,
    entry,
    stop,
    take1,
    take2,
    ma20,
    ma60,
    high20,
    high55,
    entryText: entry != null ? formatNum(entry, priceDigits(entry)) : "-",
    stopText: stop != null ? formatNum(stop, priceDigits(stop)) : "-",
    take1Text: take1 != null ? formatNum(take1, priceDigits(take1)) : "-",
    take2Text: take2 != null ? formatNum(take2, priceDigits(take2)) : "-",
    trailText: trail,
  };
}

function cryptoSignalClass(signal, btcWeak) {
  if (btcWeak) return "warning";
  if (signal === "candidate") return "candidate";
  if (signal === "watch") return "watch";
  return "warning";
}

function cryptoSignalLabel(signal, btcWeak) {
  if (btcWeak) return "BTC 약세";
  if (signal === "candidate") return "진입 후보";
  if (signal === "watch") return "보초 관찰";
  return "회피/대기";
}

function cryptoSignalReason(summary, btcWeak, close, ma20, ma60, high20, score, frame = "1d") {
  const frameLabel = frame && frame !== "1d" ? cryptoFrameLabel(frame) : "일봉";
  const lineName = frame && frame !== "1d" ? "20선" : "20일선";
  const highName = frame && frame !== "1d" ? "20봉 고점" : "20일 고점";
  if (btcWeak) return "BTC 시장 방어 점수가 낮아 ETH 공격 신호를 낮춰 봅니다.";
  if (summary.signal === "candidate") return `${frameLabel} 20선과 60선이 우호적입니다. 돌파 유지와 손절 폭을 함께 확인합니다.`;
  if (summary.signal === "watch") return `방향은 중립권입니다. ${lineName} 회복 또는 ${highName} 돌파를 기다립니다.`;
  const lineText = ma20 != null ? `${lineName} ${formatNum(ma20, priceDigits(close))}` : lineName;
  const breakoutText = high20 != null ? `${highName} ${formatNum(high20, priceDigits(close))}` : highName;
  return `${lineText} 회복 전까지 관찰 우선입니다. 공격 신호는 ${breakoutText} 돌파 이후로 봅니다.`;
}

function cryptoEntryPrice(close, ma20, ma60, high20, high55, className) {
  if (close == null) return null;
  if (className === "candidate") return Math.max(close, high20 || close);
  if (className === "watch") return Math.max(ma20 || close, high20 || close);
  return Math.max(ma20 || close, ma60 || close, high20 || close, high55 || close);
}

function cryptoStopPrice(close, entry, atrPct, className) {
  if (entry == null) return null;
  const atrStopPct = Math.max((atrPct || 3) * (className === "candidate" ? 2 : 1.6), className === "candidate" ? 4 : 3);
  const reference = close != null ? Math.min(close, entry) : entry;
  return Math.max(0, reference * (1 - atrStopPct / 100));
}

function rollingExtreme(history = [], selectedDate, size, key, mode) {
  const values = (Array.isArray(history) ? history : [])
    .filter((row) => row?.date && (!selectedDate || row.date <= selectedDate))
    .slice(-size)
    .map((row) => number(row[key]))
    .filter((value) => value != null);
  if (!values.length) return null;
  return mode === "min" ? Math.min(...values) : Math.max(...values);
}

function rollingAverage(history = [], selectedDate, size) {
  const values = (Array.isArray(history) ? history : [])
    .filter((row) => row?.date && (!selectedDate || row.date <= selectedDate))
    .slice(-size)
    .map((row) => number(row.close))
    .filter((value) => value != null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function priceDigits(value) {
  const parsed = Math.abs(number(value) || 0);
  if (parsed >= 1000) return 0;
  if (parsed >= 100) return 1;
  return 2;
}

function cryptoRowsForFrame(asset, frame = state.cryptoFrame) {
  if (!asset) return [];
  if (frame === "1d") return Array.isArray(asset.history) ? asset.history : [];
  const sourceRows = Array.isArray(asset.intraday?.history) && asset.intraday.history.length
    ? asset.intraday.history
    : Array.isArray(asset.history) ? asset.history : [];
  if (frame === "240m" && asset.intraday?.history?.length) return aggregateCryptoRows(sourceRows, 4);
  return sourceRows;
}

function aggregateCryptoRows(rows = [], bucketHours = 4) {
  const buckets = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const close = number(row.close);
    const open = number(row.open);
    const high = number(row.high);
    const low = number(row.low);
    if (close == null || open == null || high == null || low == null || !row.date) return;
    const hour = Number(String(row.time || "00:00").slice(0, 2)) || 0;
    const bucketHour = Math.floor(hour / bucketHours) * bucketHours;
    const time = `${String(bucketHour).padStart(2, "0")}:00`;
    const key = `${row.date} ${time}`;
    const current = buckets.get(key);
    if (!current) {
      buckets.set(key, {
        date: row.date,
        time,
        datetime: row.datetime || `${row.date}T${time}:00+09:00`,
        open,
        high,
        low,
        close,
        volume: number(row.volume) || 0,
      });
      return;
    }
    current.high = Math.max(current.high, high);
    current.low = Math.min(current.low, low);
    current.close = close;
    current.volume += number(row.volume) || 0;
  });
  return [...buckets.values()].sort((a, b) => String(a.datetime || `${a.date} ${a.time}`).localeCompare(String(b.datetime || `${b.date} ${b.time}`)));
}

function cryptoLatestRow(rows = []) {
  const filtered = (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.date && (!state.selectedDate || row.date <= state.selectedDate) && number(row.close) != null);
  return filtered.length ? filtered[filtered.length - 1] : null;
}

function cryptoComputedSummary(rows = [], selected = null, fallback = {}) {
  const visible = (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.date && (!state.selectedDate || row.date <= state.selectedDate) && number(row.close) != null);
  const baseRows = selected && visible.includes(selected) ? visible.slice(0, visible.indexOf(selected) + 1) : visible;
  const closes = baseRows.map((row) => number(row.close)).filter((value) => value != null);
  if (!closes.length) return fallback || {};
  const close = closes[closes.length - 1];
  const ma20 = averageLast(closes, 20);
  const ma60 = averageLast(closes, 60);
  const ret20 = closes.length > 20 && closes[closes.length - 21] ? close / closes[closes.length - 21] - 1 : null;
  let score = 50;
  score += ma20 != null && close >= ma20 ? 18 : -10;
  score += ma60 != null && close >= ma60 ? 14 : -8;
  score += ret20 != null && ret20 >= 0 ? 10 : -8;
  score = Math.max(0, Math.min(100, score));
  return {
    ...fallback,
    signal: score >= 68 ? "candidate" : score >= 52 ? "watch" : "warning",
    label: score >= 68 ? "진입 후보" : score >= 52 ? "관찰" : "보수",
    score,
    ma20,
    ma60,
  };
}

function cryptoFrameLabel(frame = state.cryptoFrame) {
  return {
    "240m": "240분봉",
    "60m": "60분봉",
    "1d": "일봉",
  }[frame] || "240분봉";
}

function maxLast(values, size) {
  const sample = values.slice(-size).filter((value) => number(value) != null);
  return sample.length ? Math.max(...sample) : null;
}

function drawEtfChart() {
  drawAssetTrendChart({
    canvasSelector: "#etfChart",
    legendSelector: "#etfLegend",
    instrument: state.assetArchive?.etf,
    label: "KODEX200",
    emptyTitle: "ETF 차트 자료 없음",
    emptyDetail: "KODEX200 일봉 데이터가 아직 없습니다.",
  });
}

function drawStocksChart() {
  const market = state.assetArchive?.market || {};
  const instrument = market.index_proxy || market.kospi200 || state.assetArchive?.etf;
  drawAssetTrendChart({
    canvasSelector: "#stocksChart",
    legendSelector: "#stocksLegend",
    instrument,
    label: instrument?.proxy_for ? `${instrument.label || "KODEX200"} 대체지표` : instrument?.label || "지수 필터",
    emptyTitle: "국장 종목 차트 자료 없음",
    emptyDetail: "지수 필터 일봉 데이터가 아직 없습니다.",
  });
}

function drawUsStocksChart() {
  const usStocks = state.assetArchive?.us_stocks || {};
  const assets = usStocks.assets || [];
  const watchAsset = (state.watchlists.us || []).map((item) => findUsAsset(item.symbol)).find((asset) => asset?.history?.length);
  const benchmark = assets.find((asset) => asset.symbol === "SPY") || assets.find((asset) => asset.symbol === "QQQ");
  const instrument = watchAsset || benchmark || assets.find((asset) => asset?.history?.length);
  drawAssetTrendChart({
    canvasSelector: "#usStocksChart",
    legendSelector: "#usStocksLegend",
    instrument,
    label: instrument?.label || instrument?.symbol || "미장 추세",
    emptyTitle: "미장 차트 자료 없음",
    emptyDetail: usStocks.archive_note || "미장 핵심 추적군 일봉 데이터를 아직 가져오지 못했습니다.",
    averageSet: "us",
  });
}

function drawCryptoChart() {
  const canvas = document.querySelector("#cryptoChart");
  const assets = state.assetArchive?.crypto?.assets || [];
  if (state.cryptoTab !== "all") {
    drawCryptoDetailChart(canvas, cryptoSelectedAsset(assets), assets);
    return;
  }
  const points = cryptoComparisonPoints(assets, state.selectedDate, 180);
  if (!points.length) {
    drawEmptyChart(canvas, "코인 차트 자료 없음", 260, "비트코인과 이더리움 일봉 데이터가 아직 없습니다.");
    document.querySelector("#cryptoLegend").innerHTML = "";
    if (canvas) canvas.setAttribute("aria-label", "비트코인 이더리움 비교 차트");
    return;
  }
  if (canvas) canvas.setAttribute("aria-label", "비트코인 이더리움 비교 차트");
  document.querySelector("#cryptoLegend").innerHTML = [
    { label: "비트코인 기준 100", color: themeColor("--chart-line", "#e8eef5") },
    { label: "이더리움 기준 100", color: themeColor("--blue", "#82a7e6") },
  ].map(legendItem).join("");
  drawLineChart(canvas, {
    height: 260,
    padding: { top: 42, right: 50, bottom: 38, left: 28 },
    points,
    valueKey: "btc",
    timeKey: "date",
    extraSeries: [{ key: "eth", label: "이더리움", color: themeColor("--blue", "#82a7e6"), width: 2.1 }],
  });
}

function drawCryptoDetailChart(canvas, asset, assets = []) {
  const name = state.cryptoTab === "eth" ? "이더리움" : "비트코인";
  const rows = cryptoRowsForFrame(asset, state.cryptoFrame);
  const points = cryptoDetailPoints(rows, state.cryptoFrame, state.cryptoFrame === "1d" ? 180 : 160);
  if (!points.length) {
    drawEmptyChart(canvas, `${name} 차트 자료 없음`, 260, `${cryptoFrameLabel(state.cryptoFrame)} 데이터를 확인하는 중입니다.`);
    document.querySelector("#cryptoLegend").innerHTML = "";
    return;
  }
  if (canvas) canvas.setAttribute("aria-label", `${name} ${cryptoFrameLabel(state.cryptoFrame)} 신호 차트`);
  const signal = cryptoSignalPlan(asset, assets, { rows, frame: state.cryptoFrame });
  const levels = [
    { label: "진입", value: signal.entry, color: themeColor("--green", "#5fc79b") },
    { label: "손절", value: signal.stop, color: themeColor("--red", "#df7a72") },
    { label: "1차", value: signal.take1, color: themeColor("--blue", "#82a7e6") },
    { label: "2차", value: signal.take2, color: themeColor("--teal", "#4eb7b1") },
  ].filter((level) => number(level.value) != null);
  const markerKind = signal.className === "candidate" ? "entry" : signal.className === "warning" ? "risk" : "watch";
  document.querySelector("#cryptoLegend").innerHTML = [
    { label: `${name} 종가`, color: themeColor("--chart-line", "#e8eef5") },
    { label: "20선", color: themeColor("--green", "#5fc79b") },
    { label: "60선", color: themeColor("--blue", "#82a7e6") },
    { label: "20봉 고점", color: themeColor("--amber", "#d5a04e") },
    { label: "55봉 고점", color: themeColor("--teal", "#4eb7b1") },
  ].map(legendItem).join("");
  drawLineChart(canvas, {
    height: 260,
    padding: { top: 42, right: 50, bottom: 38, left: 28 },
    points,
    valueKey: "close",
    timeKey: "date",
    levels,
    extraSeries: [
      { key: "ma20", label: "20선", color: themeColor("--green", "#5fc79b"), width: 1.7 },
      { key: "ma60", label: "60선", color: themeColor("--blue", "#82a7e6"), width: 1.7, dash: [5, 4] },
      { key: "high20", label: "20봉 고점", color: themeColor("--amber", "#d5a04e"), width: 1.2, dash: [4, 4] },
      { key: "high55", label: "55봉 고점", color: themeColor("--teal", "#4eb7b1"), width: 1.2, dash: [2, 4] },
    ],
    tradeMarkers: [
      {
        point_index: points.length - 1,
        index_value: signal.close ?? points[points.length - 1]?.close,
        kind: markerKind,
        label: signal.label,
      },
    ],
  });
}

function drawAssetTrendChart({ canvasSelector, legendSelector, instrument, label, emptyTitle, emptyDetail, averageSet = "default" }) {
  const canvas = document.querySelector(canvasSelector);
  const points = assetTrendPoints(instrument, state.selectedDate, 180);
  if (!points.length) {
    drawEmptyChart(canvas, emptyTitle || "차트 자료 없음", 260, emptyDetail || "표시할 일봉 데이터가 없습니다.");
    const legendRoot = document.querySelector(legendSelector);
    if (legendRoot) legendRoot.innerHTML = "";
    return;
  }
  const legendRoot = document.querySelector(legendSelector);
  const averages = averageSet === "us"
    ? [
      { key: "ma20", label: "20일선", color: themeColor("--green", "#5fc79b"), width: 1.7 },
      { key: "ma50", label: "50일선", color: themeColor("--blue", "#82a7e6"), width: 1.7, dash: [5, 4] },
      { key: "ma200", label: "200일선", color: themeColor("--amber", "#d5a04e"), width: 1.4, dash: [3, 5] },
    ]
    : [
      { key: "ma20", label: "20일선", color: themeColor("--green", "#5fc79b"), width: 1.7 },
      { key: "ma60", label: "60일선", color: themeColor("--blue", "#82a7e6"), width: 1.7, dash: [5, 4] },
    ];
  if (legendRoot) {
    legendRoot.innerHTML = [
      { label: label || instrument?.label || "종가", color: themeColor("--chart-line", "#e8eef5") },
      ...averages.map((line) => ({ label: line.label, color: line.color })),
    ].map(legendItem).join("");
  }
  drawLineChart(canvas, {
    height: 260,
    padding: { top: 42, right: 50, bottom: 38, left: 28 },
    points,
    valueKey: "close",
    timeKey: "date",
    extraSeries: averages,
  });
}

function assetTrendPoints(instrument, selectedDate, limit = 180) {
  const rows = Array.isArray(instrument?.history) ? instrument.history : [];
  const filtered = rows
    .filter((row) => row?.date && (!selectedDate || row.date <= selectedDate) && number(row.close) != null)
    .slice(-limit);
  const closes = [];
  return filtered.map((row) => {
    closes.push(number(row.close));
    return {
      date: shortDate(row.date),
      close: number(row.close),
      ma20: averageLast(closes, 20),
      ma50: averageLast(closes, 50),
      ma60: averageLast(closes, 60),
      ma200: averageLast(closes, 200),
    };
  });
}

function cryptoDetailPoints(rows, frame = state.cryptoFrame, limit = 160) {
  const filtered = (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.date && (!state.selectedDate || row.date <= state.selectedDate) && number(row.close) != null)
    .slice(-limit);
  const closes = [];
  const highs = [];
  return filtered.map((row) => {
    const close = number(row.close);
    const high = number(row.high);
    closes.push(close);
    highs.push(high);
    return {
      date: frame === "1d" ? shortDate(row.date) : `${shortDate(row.date)} ${row.time || ""}`.trim(),
      close,
      ma20: averageLast(closes, 20),
      ma60: averageLast(closes, 60),
      high20: maxLast(highs, 20),
      high55: maxLast(highs, 55),
    };
  });
}

function cryptoComparisonPoints(assets, selectedDate, limit = 180) {
  const byLabel = Object.fromEntries((assets || []).map((asset) => [String(asset.label || "").toUpperCase(), asset]));
  const btcRows = assetRowsByDate(byLabel.BTC, selectedDate);
  const ethRows = assetRowsByDate(byLabel.ETH, selectedDate);
  const commonDates = [...btcRows.keys()].filter((date) => ethRows.has(date)).sort().slice(-limit);
  if (!commonDates.length) return [];
  const firstBtc = number(btcRows.get(commonDates[0])?.close);
  const firstEth = number(ethRows.get(commonDates[0])?.close);
  if (!firstBtc || !firstEth) return [];
  return commonDates.map((date) => ({
    date: shortDate(date),
    btc: (number(btcRows.get(date)?.close) / firstBtc) * 100,
    eth: (number(ethRows.get(date)?.close) / firstEth) * 100,
  }));
}

function assetRowsByDate(instrument, selectedDate) {
  const rows = Array.isArray(instrument?.history) ? instrument.history : [];
  return new Map(
    rows
      .filter((row) => row?.date && (!selectedDate || row.date <= selectedDate) && number(row.close) != null)
      .map((row) => [row.date, row]),
  );
}

function atrPercent(history = [], selectedDate, size = 14) {
  const rows = (Array.isArray(history) ? history : [])
    .filter((row) => row?.date && (!selectedDate || row.date <= selectedDate))
    .slice(-(size + 1));
  if (rows.length < 2) return null;
  const ranges = [];
  for (let index = 1; index < rows.length; index += 1) {
    const high = number(rows[index].high);
    const low = number(rows[index].low);
    const previousClose = number(rows[index - 1].close);
    const close = number(rows[index].close);
    if (high == null || low == null || previousClose == null || close == null || close === 0) continue;
    ranges.push(Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose)) / close * 100);
  }
  return ranges.length ? ranges.reduce((sum, value) => sum + value, 0) / ranges.length : null;
}

function averageLast(values, size) {
  const sample = values.slice(-size).filter((value) => number(value) != null);
  return sample.length >= Math.min(size, values.length) ? sample.reduce((sum, value) => sum + value, 0) / sample.length : null;
}

function shortDate(date) {
  return String(date || "").slice(5) || "-";
}

function algorithmKoreanLabel(value) {
  return {
    pulse: "단기 탄력",
    balanced: "균형 검증",
    "1d": "1일",
    "1m": "1달",
  }[value] || value || "-";
}

function replaySessionForDate(date) {
  if (!date) return null;
  const active = state.replay?.active_session;
  if (active && (active.date === date || active.id === date)) return active;
  const sessions = Array.isArray(state.replay?.sessions) ? state.replay.sessions : [];
  return sessions.find((session) => session.date === date || session.id === date) || null;
}

function drawOptionArchiveChart(session, tradePlan) {
  const canvas = document.querySelector("#optionArchiveChart");
  if (!session?.series?.length) {
    drawEmptyChart(canvas, "복기 자료 없음", 320, "저장된 거래일을 선택하세요.");
    return;
  }
  hideChartEmpty(canvas);
  document.querySelector("#optionArchiveLegend").innerHTML = replayLegendEntries().map(legendItem).join("");
  drawLineChart(canvas, {
    height: 320,
    compactTradeLabels: true,
    points: session.series,
    valueKey: "index",
    timeKey: "time",
    levels: chartLevelEntries(session.levels || {}),
    extraSeries: CHART_EXTRA_SERIES,
    tradeMarkers: tradePlan?.events || [],
  });
}

function etfLiveSummary(context = {}) {
  const thirty = context.thirty_minute || {};
  if (thirty.option_bias === "risk_overlay") {
    return {
      signal: "warning",
      label: "50% 이탈",
      message: "KODEX200 30분 50% 이탈 구간입니다. ETF는 2차 물량 축소, 옵션은 보초 모드가 우선입니다.",
      score: 42,
    };
  }
  if (thirty.option_bias === "support_test") {
    return {
      signal: "watch",
      label: "61.8% 확인",
      message: "KODEX200 61.8% 재투입 구간입니다. 5분봉 말아올림 확인이 필요합니다.",
      score: 58,
    };
  }
  if (thirty.option_bias === "reclaim_confirmation") {
    return {
      signal: "candidate",
      label: "50% 회복",
      message: "30분 50% 재회복 이후 추격은 가능하지만 5분봉 지지 확인이 우선입니다.",
      score: 72,
    };
  }
  return {
    signal: "watch",
    label: "ETF 관찰",
    message: etfStanceMessage(thirty.stance) || "KODEX200 30분/일봉 피보나치 컨텍스트를 관찰합니다.",
    score: 55,
  };
}

function etfStanceLabel(stance) {
  return {
    confirmed_below_50_reduce_second: "50% 이탈",
    reclaimed_50_chase_allowed: "50% 회복",
    near_61_8_readd_zone: "61.8% 근접",
    first_bounce_scout_only: "첫 반등",
    between_levels_wait: "대기",
  }[stance] || "요약";
}

function etfStanceMessage(stance) {
  return {
    first_bounce_scout_only: "30분 5이평 첫 반등 구간입니다. ETF는 5~10% 보초만, 옵션은 5분봉 지지 확인 전까지 작게 봅니다.",
    between_levels_wait: "30분 피보나치 지지 또는 5분 기준선/30이평 확인 전까지 대기합니다.",
    confirmed_below_50_reduce_second: "30분 50% 이탈 구간입니다. ETF 2차 물량 축소와 보수 모드를 우선합니다.",
    reclaimed_50_chase_allowed: "30분 50% 재회복입니다. 추격은 가능하지만 5분봉 확인을 붙입니다.",
    near_61_8_readd_zone: "61.8% 재투입 후보입니다. 밑꼬리와 회복 확인이 필요합니다.",
  }[stance] || "";
}

function guideItem(title, text) {
  return `
    <article class="guide-item">
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(text)}</small>
    </article>
  `;
}

function renderSearchResults(scope) {
  const root = document.querySelector(scope === "us" ? "#usSearchResults" : "#domesticSearchResults");
  if (!root) return;
  const input = document.querySelector(scope === "us" ? "#usWatchInput" : "#domesticWatchInput");
  const query = String(input?.value || "").trim();
  if (!query) {
    root.innerHTML = "";
    return;
  }
  const results = searchSymbols(scope, query);
  if (!results.length) {
    root.innerHTML = `<article class="search-empty">검색 결과 없음 · 종목명이나 티커를 다시 확인하세요.</article>`;
    return;
  }
  const visible = results.slice(0, SEARCH_RESULT_LIMIT);
  const activeIndex = normalizedSearchCursor(scope, visible.length);
  root.innerHTML = visible.map((item, index) => searchResultItem(item, index === activeIndex)).join("");
}

function searchSymbols(scope, query) {
  const terms = expandedSearchTerms(scope, query);
  if (!terms.length) return [];
  const universe = scope === "us" ? usSearchUniverse() : domesticSearchUniverse();
  const watchSet = new Set((state.watchlists[scope] || []).map((item) => normalizeSearchText(item.symbol)));
  return universe
    .map((item) => ({
      ...item,
      score: Math.max(...terms.map((term, index) => searchScore(item, term) - index * 0.2)),
      alreadyAdded: watchSet.has(normalizeSearchText(item.symbol)),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.symbol).localeCompare(String(b.symbol)))
    .slice(0, 12);
}

function domesticSearchUniverse() {
  const universe = state.assetArchive?.stocks?.search_universe || [];
  if (Array.isArray(universe) && universe.length) {
    return universe.map((item) => ({
      scope: "domestic",
      symbol: String(item.symbol || "").trim(),
      name: String(item.name || "").trim(),
      market: item.market || "국장",
      group: item.market || "국장",
      close: item.close,
      change_pct: item.change_pct,
    })).filter((item) => item.symbol && item.name);
  }
  const stocks = state.assetArchive?.stocks || {};
  const rows = [
    ...(stocks.short_term?.top || []),
    ...(stocks.short_term?.watch || []),
    ...(stocks.swing?.top || []),
    ...(stocks.swing?.watch || []),
  ];
  return rows.map((item) => ({
    scope: "domestic",
    symbol: String(item.symbol || "").trim(),
    name: String(item.name || item.symbol || "").trim(),
    market: item.market || "국장",
    group: item.bucket || "추천 후보",
    close: item.close,
    change_pct: item.change_pct,
  })).filter((item) => item.symbol && item.name);
}

function usSearchUniverse() {
  return US_SEARCH_UNIVERSE.map((item) => ({ ...item, scope: "us" }));
}

function searchScore(item, query) {
  const symbol = normalizeSearchText(item.symbol);
  const name = normalizeSearchText(item.name);
  const market = normalizeSearchText(item.market);
  const group = normalizeSearchText(item.group);
  if (!symbol || !name) return 0;
  if (symbol === query) return 120;
  if (name === query) return 115;
  if (symbol.startsWith(query)) return 100 - Math.max(0, symbol.length - query.length);
  if (name.startsWith(query)) return 88 - Math.max(0, name.length - query.length) * 0.1;
  if (name.includes(query)) return 72 - name.indexOf(query) * 0.1;
  if (symbol.includes(query)) return 66;
  if (group.startsWith(query)) return 52;
  if (group.includes(query)) return 42;
  if (market.includes(query)) return 24;
  return 0;
}

function searchResultItem(item, active = false) {
  const hint = searchSignalHint(item);
  const signal = item.alreadyAdded ? "neutral" : hint.signal;
  const priceText = item.close != null ? `${formatNum(item.close, 0)} · ${formatPercent(item.change_pct)}` : item.group || item.market || "";
  return `
    <article class="search-result ${escapeAttr(signal)}${active ? " active" : ""}" data-search-result="${escapeAttr(item.symbol)}">
      <div>
        <strong>${escapeHtml(item.name || item.symbol)}</strong>
        <small>${escapeHtml(item.symbol)} · ${escapeHtml(item.market || item.group || "")}</small>
        <small class="search-hint">${escapeHtml(hint.badge)} · ${escapeHtml(hint.detail)}</small>
      </div>
      <span>${escapeHtml(priceText || "-")}</span>
      <button class="soft-button" type="button" data-search-scope="${escapeAttr(item.scope)}" data-search-add="${escapeAttr(item.symbol)}" ${item.alreadyAdded ? "disabled" : ""}>
        ${item.alreadyAdded ? "추가됨" : "추가"}
      </button>
    </article>
  `;
}

function normalizeSearchText(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

function expandedSearchTerms(scope, query) {
  const base = normalizeSearchText(query);
  if (!base) return [];
  const terms = new Set([base]);
  const aliases = SEARCH_ALIASES[scope] || {};
  const directAliases = Object.entries(aliases).find(([key]) => normalizeSearchText(key) === base)?.[1] || [];
  (Array.isArray(directAliases) ? directAliases : [directAliases]).forEach((value) => {
    const normalized = normalizeSearchText(value);
    if (normalized) terms.add(normalized);
  });
  return [...terms];
}

function searchSignalHint(item) {
  if (item.scope === "domestic") {
    const match = findDomesticCandidate(item.symbol);
    const indexFilter = state.assetArchive?.stocks?.index_filter || {};
    const rawSignal = match?.final_action || match?.trade_signal || indexFilter.signal || "watch";
    const badge = match?.final_action || match?.trade_signal || indexFilter.label || "지수 관찰";
    const detail = match?.score != null
      ? `후보 점수 ${formatNum(match.score, 1)}`
      : indexFilter.message || "국장 지수 필터 기준으로 관찰";
    return { signal: signalClass(rawSignal), badge, detail };
  }
  const match = findUsAsset(item.symbol);
  if (match) {
    const summary = match.summary || {};
    return {
      signal: signalClass(summary.signal || "watch"),
      badge: summary.label || match.group || "미장 관찰",
      detail: summary.score != null ? `점수 ${formatNum(summary.score, 1)} · 상대강도 ${formatPercent(summary.relative_63d)}` : summary.message || "미장 추세 확인",
    };
  }
  const group = item.group || "관찰";
  const detail = {
    "AI 반도체": "QQQ/SMH와 같이 확인",
    반도체: "SMH 흐름과 같이 확인",
    "반도체 장비": "SMH와 설비투자 흐름 확인",
    메모리: "반도체 사이클 확인",
    보안: "QQQ와 소프트웨어 강도 확인",
    데이터: "클라우드 지출 흐름 확인",
    클라우드: "QQQ와 성장주 수급 확인",
    플랫폼: "지수 대비 상대강도 확인",
    소프트웨어: "QQQ와 성장주 수급 확인",
    "AI 소프트웨어": "AI 테마와 매출 성장 확인",
    결제: "소비/금리 흐름 확인",
    "코인 관련": "BTC/ETH 흐름과 같이 확인",
    "증권 플랫폼": "거래대금과 위험선호 확인",
    핀테크: "금리와 성장주 수급 확인",
    "시장 ETF": "시장 방향 기준",
    "섹터 ETF": "섹터 강도 기준",
    금융: "금리/장단기금리 확인",
    에너지: "유가 흐름 확인",
    헬스케어: "방어주 수급과 실적 확인",
    산업재: "경기민감 흐름 확인",
    방산: "방산/지정학 이슈 확인",
    물류: "경기와 운송 수요 확인",
    전기차: "성장주와 금리 민감도 확인",
    자동차: "경기민감/실적 흐름 확인",
    항공: "여행 수요와 비용 확인",
    미디어: "광고/구독 성장 확인",
    소비: "소비 지표와 마진 확인",
  }[group] || "SPY/QQQ 상대강도 연결 예정";
  return { signal: "watch", badge: group, detail };
}

function handleSearchKeydown(event, scope) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    moveSearchCursor(scope, event.key === "ArrowDown" ? 1 : -1);
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const active = activeSearchResult(scope);
    if (active) addSearchResult(scope, active.symbol);
    else addWatchSymbol(scope);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    const input = document.querySelector(scope === "us" ? "#usWatchInput" : "#domesticWatchInput");
    if (input) input.value = "";
    resetSearchCursor(scope);
    clearSearchResults(scope);
  }
}

function moveSearchCursor(scope, delta) {
  const results = currentVisibleSearchResults(scope);
  if (!results.length) return;
  const current = normalizedSearchCursor(scope, results.length);
  const next = current < 0
    ? (delta > 0 ? 0 : results.length - 1)
    : (current + delta + results.length) % results.length;
  state.searchCursor[scope] = next;
  renderSearchResults(scope);
}

function activeSearchResult(scope) {
  const results = currentVisibleSearchResults(scope);
  const activeIndex = normalizedSearchCursor(scope, results.length);
  return activeIndex >= 0 ? results[activeIndex] : null;
}

function currentVisibleSearchResults(scope) {
  const input = document.querySelector(scope === "us" ? "#usWatchInput" : "#domesticWatchInput");
  return searchSymbols(scope, String(input?.value || "").trim()).slice(0, SEARCH_RESULT_LIMIT);
}

function normalizedSearchCursor(scope, length) {
  const index = Number(state.searchCursor?.[scope]);
  if (!length || !Number.isFinite(index) || index < 0) return -1;
  if (index >= length) {
    state.searchCursor[scope] = length - 1;
    return length - 1;
  }
  return index;
}

function resetSearchCursor(scope) {
  state.searchCursor[scope] = -1;
}

function renderWatchList(scope, selector) {
  const root = document.querySelector(selector);
  if (!root) return;
  const items = watchItemsForScope(scope);
  root.innerHTML = items.length
    ? items.map(watchListItem).join("")
    : `<article class="asset-item watch"><div class="asset-main"><strong>관심종목 없음</strong><small>검색창에 종목명이나 티커를 입력해 추가하세요.</small></div></article>`;
}

function watchItemsForScope(scope, options = {}) {
  const items = state.watchlists[scope] || [];
  return items.map((item) => watchSignalItem(scope, item, options));
}

function watchSignalItem(scope, item) {
  if (scope === "domestic") {
    const match = findDomesticCandidate(item.symbol);
    const indexFilter = state.assetArchive?.stocks?.index_filter || {};
    const signal = signalClass(match?.final_action || match?.trade_signal || indexFilter.signal || "watch");
    return {
      scope,
      kind: "국장",
      title: item.name || item.symbol,
      symbol: item.symbol,
      signal,
      badge: match?.final_action || match?.trade_signal || indexFilter.label || "관찰",
      value: match?.score != null ? formatNum(match.score, 1) : item.symbol,
      detail: match?.reason || indexFilter.message || "국장 지수 필터 기준으로 관찰합니다.",
      jumpTab: "stocks",
    };
  }
  const match = findUsAsset(item.symbol);
  return {
    scope,
    kind: "미장",
    title: item.name || item.symbol,
    symbol: item.symbol,
    signal: signalClass(match?.summary?.signal || "watch"),
    badge: match?.summary?.label || "관찰",
    value: match?.selected?.close != null ? formatNum(match.selected.close, 2) : item.symbol,
    detail: match ? usSignalDetail(match) : "SPY/QQQ 상대강도와 20/50/200일선 신호를 기다립니다.",
    jumpTab: "usStocks",
  };
}

function usSignalDetail(asset) {
  const summary = asset.summary || {};
  const parts = [
    summary.message || asset.group || "미장 관찰",
    summary.score != null ? `점수 ${formatNum(summary.score, 1)}` : "",
    summary.ret_21d != null ? `21일 ${formatPercent(summary.ret_21d)}` : "",
    summary.relative_63d != null ? `상대강도 ${formatPercent(summary.relative_63d)}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function watchListItem(item) {
  const signal = signalClass(item.signal || "watch");
  return `
    <article class="asset-item ${escapeAttr(signal)}">
      <div class="asset-main">
        <strong>${escapeHtml(item.title || item.symbol || "-")}</strong>
        <small>${escapeHtml(item.kind || "관심")} · ${escapeHtml(item.detail || "")}</small>
      </div>
      <div class="asset-side">
        <strong>${escapeHtml(item.value || "-")}</strong>
        <button class="mini-remove" type="button" data-watch-scope="${escapeAttr(item.scope)}" data-watch-remove="${escapeAttr(item.symbol)}">제거</button>
      </div>
    </article>
  `;
}

function findDomesticCandidate(symbol) {
  const text = String(symbol || "").trim().toUpperCase();
  const stocks = state.assetArchive?.stocks || {};
  const rows = [
    ...(stocks.short_term?.top || []),
    ...(stocks.short_term?.watch || []),
    ...(stocks.swing?.top || []),
    ...(stocks.swing?.watch || []),
  ];
  return rows.find((row) => {
    const code = String(row.symbol || "").trim().toUpperCase();
    const name = String(row.name || "").trim().toUpperCase();
    return code === text || name === text || name.includes(text);
  });
}

function findUsAsset(symbol) {
  const text = normalizeSearchText(symbol);
  const rows = state.assetArchive?.us_stocks?.assets || [];
  return rows.find((row) => normalizeSearchText(row.symbol) === text || normalizeSearchText(row.label) === text);
}

function addWatchSymbol(scope) {
  const input = document.querySelector(scope === "us" ? "#usWatchInput" : "#domesticWatchInput");
  const raw = String(input?.value || "").trim();
  if (!raw) return;
  const parts = raw.split(/[,;\n]/).map((value) => value.trim()).filter(Boolean);
  if (parts.length > 1) {
    parts.forEach((part) => addBestSearchMatch(scope, part, { silent: true }));
    if (input) input.value = "";
    clearSearchResults(scope);
    saveWatchlists();
    renderAssetTabs();
    return;
  }
  const added = addBestSearchMatch(scope, raw);
  if (!added) {
    renderSearchResults(scope);
    return;
  }
  saveWatchlists();
  if (input) input.value = "";
  clearSearchResults(scope);
  renderAssetTabs();
}

function addBestSearchMatch(scope, query, options = {}) {
  const results = searchSymbols(scope, query);
  const normalized = normalizeSearchText(query);
  const exact = results.find((item) => normalizeSearchText(item.symbol) === normalized || normalizeSearchText(item.name) === normalized);
  const match = exact || (results.length === 1 ? results[0] : null);
  if (!match) return false;
  addWatchItem(scope, match);
  if (!options.silent) clearSearchResults(scope);
  return true;
}

function addSearchResult(scope, symbol) {
  const universe = scope === "us" ? usSearchUniverse() : domesticSearchUniverse();
  const target = normalizeSearchText(symbol);
  const item = universe.find((candidate) => normalizeSearchText(candidate.symbol) === target);
  if (!item) return;
  addWatchItem(scope, item);
  saveWatchlists();
  const input = document.querySelector(scope === "us" ? "#usWatchInput" : "#domesticWatchInput");
  if (input) input.value = "";
  clearSearchResults(scope);
  renderAssetTabs();
}

function addWatchItem(scope, item) {
  const current = state.watchlists[scope] || [];
  state.watchlists[scope] = normalizeWatchlist([
    {
      symbol: String(item.symbol || "").toUpperCase(),
      name: item.name || item.symbol,
      market: item.market || item.group || "",
      addedAt: new Date().toISOString(),
    },
    ...current,
  ]);
}

function clearSearchResults(scope) {
  resetSearchCursor(scope);
  const root = document.querySelector(scope === "us" ? "#usSearchResults" : "#domesticSearchResults");
  if (root) root.innerHTML = "";
}

function removeWatchSymbol(scope, symbol) {
  if (!state.watchlists[scope]) return;
  const target = String(symbol || "").toUpperCase();
  state.watchlists[scope] = state.watchlists[scope].filter((item) => item.symbol !== target);
  saveWatchlists();
  renderAssetTabs();
}

function jumpToCardTarget(card) {
  const target = card.dataset.jumpTab;
  if (!APP_TABS.includes(target)) return;
  if (card.dataset.jumpCrypto) {
    state.cryptoTab = card.dataset.jumpCrypto;
    state.cryptoFrame = "240m";
  }
  setActiveTab(target);
}

function stockItem(row) {
  const type = signalClass(row.final_action || row.trade_signal || "watch");
  return `
    <article class="asset-item ${escapeAttr(type)}">
      <div class="asset-main">
        <strong>${escapeHtml(row.name || row.symbol || "-")}</strong>
        <small>${escapeHtml(row.bucket || "주식")} · ${escapeHtml(row.reason || "후보")}</small>
      </div>
      <div class="asset-side">
        <strong>${formatNum(row.score, 1)}</strong>
        <small>${escapeHtml(row.symbol || "")}</small>
      </div>
    </article>
  `;
}

function usStockItem(asset) {
  const summary = asset.summary || {};
  const selected = asset.selected || asset.latest || {};
  const type = signalClass(summary.signal || "watch");
  return `
    <article class="asset-item ${escapeAttr(type)}">
      <div class="asset-main">
        <strong>${escapeHtml(asset.label || asset.symbol || "-")}</strong>
        <small>${escapeHtml(asset.group || "미장")} · ${escapeHtml(usSignalDetail(asset))}</small>
      </div>
      <div class="asset-side">
        <strong>${formatNum(selected.close, 2)}</strong>
        <small>${escapeHtml(asset.symbol || "")}</small>
      </div>
    </article>
  `;
}

function cryptoItem(asset) {
  const summary = asset.summary || {};
  const selected = asset.selected || asset.latest || {};
  const type = signalClass(summary.signal || "watch");
  return `
    <article class="asset-item ${escapeAttr(type)}">
      <div class="asset-main">
        <strong>${escapeHtml(asset.label || asset.symbol || "코인")}</strong>
        <small>${escapeHtml(summary.message || "BTC/ETH 기본 감시")} · ${escapeHtml(selected.date || "-")}</small>
      </div>
      <div class="asset-side">
        <strong>${formatNum(selected.close, asset.symbol?.includes("BTC") || asset.symbol?.includes("ETH") ? 2 : 0)}</strong>
        <small>${formatPercent(summary.ret_21d)} · ${escapeHtml(summary.label || "관찰")}</small>
      </div>
    </article>
  `;
}

function archiveMode(date = state.selectedDate) {
  if (isLiveDate(date)) {
    return { key: "live", label: "실시간", className: "candidate", isLive: true, isDetail: true, text: "오늘은 실시간 감시와 자동 갱신을 사용합니다." };
  }
  const age = daysAgo(date);
  if (age <= DETAIL_ARCHIVE_DAYS) {
    return { key: "replay", label: "복기", className: "watch", isLive: false, isDetail: true, text: "최근 90일은 상세 복기 차트와 신호를 표시합니다." };
  }
  return { key: "summary", label: "요약", className: "neutral", isLive: false, isDetail: false, text: "90일보다 오래된 날짜는 최근 1년 요약 아카이브로 확인합니다." };
}

function isLiveDate(date = state.selectedDate) {
  return clampDate(date) >= kstDateString();
}

function daysAgo(date) {
  const today = parseDate(kstDateString());
  const selected = parseDate(date);
  if (!today || !selected) return 0;
  return Math.max(0, Math.round((today - selected) / 86400000));
}

function clampDate(date) {
  const today = kstDateString();
  const min = offsetDate(today, -SUMMARY_ARCHIVE_DAYS);
  const text = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? String(date) : today;
  if (text > today) return today;
  if (text < min) return min;
  return text;
}

function offsetDate(date, days) {
  const parsed = parseDate(date);
  if (!parsed) return kstDateString();
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function parseDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return null;
  return new Date(`${date}T00:00:00Z`);
}

function kstDateString() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatPercent(value) {
  const parsed = number(value);
  if (parsed == null) return "-";
  return `${parsed > 0 ? "+" : ""}${formatNum(parsed * 100, 1)}%`;
}

function fallbackAssetArchive() {
  return {
    ok: false,
    policy: { detail_days: DETAIL_ARCHIVE_DAYS, summary_days: SUMMARY_ARCHIVE_DAYS },
    options: { sessions: [], date_range: {} },
    etf: { summary: { signal: "watch", label: "대기", message: "ETF 데이터를 기다리고 있습니다." } },
    stocks: { index_filter: { signal: "neutral", label: "지수 대기", message: "시장 데이터를 기다리고 있습니다." } },
    us_stocks: { assets: [], top: [], summary: { signal: "neutral", label: "미장 대기", message: "미장 데이터를 기다리고 있습니다." } },
    crypto: { assets: [], summary: { signal: "neutral", label: "코인 대기", message: "BTC/ETH 데이터를 기다리고 있습니다." } },
  };
}

function renderReplayDataWarning(session, missing) {
  const root = document.querySelector("#replayDataWarning");
  if (!root) return;
  if (missing || !session?.data_window) {
    root.textContent = "저장된 데이터 범위를 확인할 수 없습니다.";
    return;
  }
  const windowInfo = session.data_window;
  const lastTime = windowInfo.last_time || "-";
  const complete = lastTime >= "15:20";
  root.textContent = complete
    ? `데이터 범위 ${windowInfo.first_time || "-"}~${lastTime} · 공식 옵션장 ${windowInfo.official_options_session || "08:45~15:45"}`
    : `데이터 범위 ${windowInfo.first_time || "-"}~${lastTime} · Yahoo 지수 5분봉 기준, 옵션장 후반 데이터 없음`;
}

function renderReplayList(events, missing) {
  const root = document.querySelector("#replaySignals");
  if (!root) return;
  if (!events.length) {
    root.innerHTML = `
      <article class="replay-item">
        <span>${missing ? "자료 없음" : "대기"}</span>
        <strong>${missing ? "선택 날짜 자료 없음" : "매매 포인트 없음"}</strong>
        <small>${missing ? "저장된 공개 복기 날짜를 선택하세요." : "진입 조건이 없어 가상 매매 로그를 만들지 않았습니다."}</small>
      </article>
    `;
    return;
  }
  root.innerHTML = events
    .map((event) => `
      <article class="replay-item ${escapeAttr(event.kind || signalClass(event.type))}">
        <span>${escapeHtml(event.time || "-")} · ${escapeHtml(event.label || "")} · ${formatNum(event.index_value, 2)}</span>
        <strong>${escapeHtml(event.title || "매매 포인트")}</strong>
        <small>${escapeHtml(event.detail || "")}</small>
      </article>
    `)
    .join("");
}

function emptyReplayTradePlan() {
  return {
    events: [],
    trades: [],
    stats: {
      total: 0,
      entries: 0,
      tests: 0,
      takes: 0,
      risks: 0,
      stops: 0,
      ambiguous: 0,
      netProfit: 0,
      winRate: 0,
      bestPremium: null,
    },
  };
}

function renderLiveTradePlan(plan) {
  const root = document.querySelector("#liveTradePlan");
  if (!root) return;
  const current = plan || standbyTradePlan();
  root.className = `trade-strip ${current.tone || "neutral"}`;
  const items = [
    { label: "상태", value: current.status || "대기" },
    { label: "계획진입", value: formatNum(current.entry, 2) },
    { label: current.stopLabel || "계획손절", value: current.stopText || formatNum(current.stop, 2) },
    { label: "1차 익절", value: formatNum(current.tp1, 2) },
    { label: current.tp2Label || "2차 익절", value: current.runnerTargetText || current.tp2Text || formatNum(current.tp2, 2) },
  ];
  root.innerHTML = items
    .map((item) => `
      <article>
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
      </article>
    `)
    .join("");
}

function renderReplayTradeStats(plan, missing) {
  const root = document.querySelector("#replayTradeStats");
  if (!root) return;
  const stats = plan?.stats || emptyReplayTradePlan().stats;
  const items = [
    { label: "진입", value: missing ? "-" : `${stats.entries}회`, className: stats.entries ? "good" : "" },
    { label: "보초", value: missing ? "-" : `${stats.tests}회` },
    { label: "순익", value: missing ? "-" : formatSigned(stats.netProfit, 2), className: stats.netProfit > 0 ? "good" : stats.netProfit < 0 ? "bad" : "" },
    { label: "승률", value: missing ? "-" : `${Math.round(stats.winRate || 0)}%`, className: stats.winRate >= 50 && stats.total ? "good" : "" },
    { label: "모호", value: missing ? "-" : `${stats.ambiguous}회`, className: stats.ambiguous ? "warn" : "" },
    { label: "손절", value: missing ? "-" : `${stats.stops}회`, className: stats.stops ? "bad" : "" },
  ];
  root.innerHTML = items
    .map((item) => `
      <article class="${escapeAttr(item.className || "")}">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
      </article>
    `)
    .join("");
}

function standbyTradePlan(status = "대기") {
  return {
    tone: "neutral",
    status,
    entry: null,
    stop: null,
    tp1: null,
    tp2: null,
    markers: [],
  };
}

function buildLiveTradePlan(snapshot) {
  const latest = snapshot?.main?.latest || {};
  const close = number(latest.close);
  if (!snapshot?.ok || close == null) return standbyTradePlan("대기");

  const backendPlan = snapshot?.main?.trade_plan;
  if (backendPlan?.status) {
    return {
      ...standbyTradePlan(backendPlan.status),
      ...backendPlan,
      markers: Array.isArray(backendPlan.markers) ? backendPlan.markers : [],
      backend: true,
    };
  }

  const candles = Array.isArray(snapshot.main?.candles) ? snapshot.main.candles.slice(-48) : [];
  const signal = snapshot.signal || {};
  const levels = snapshot.main?.levels || {};
  const pointIndex = Math.max(0, candles.length - 1);
  const signalLike = {
    ...signal,
    point_index: pointIndex,
    index_value: close,
    levels,
    candle: latest,
  };
  const setup = tradeSetupFromSignal(signalLike, { levels }, close);
  if (setup) {
    const eventKind = setup.mode === "test" ? "test" : "entry";
    return {
      tone: setup.mode === "test" ? "warning" : "buy",
      status: setup.contracts > 1 ? `콜 진입 ${setup.contracts}` : "콜 보초",
      entry: setup.entry,
      stop: setup.stop,
      tp1: setup.tp1,
      tp2: setup.tp2,
      stopLabel: setup.stopLabel,
      stopText: setup.stopText,
      tp2Label: setup.tp2Label,
      tp2Text: setup.tp2Text,
      contracts: setup.contracts,
      tp1Gain: setup.tp1Gain,
      runnerTargetText: setup.runnerTargetText,
      markers: [tradeEvent(eventKind, 1, candles[pointIndex] || latest, pointIndex, setup)],
    };
  }

  if (isLateSessionSignal(signal)) {
    const premium = optionPremiumPlan(signal);
    const plan = lateSessionTradePlan(signal, premium);
    const markerKind = signal.trade_decision === "hold" ? "watch" : "take_profit";
    const lateSetup = {
      ...premium,
      mode: "signal",
      currentStop: plan.stop,
      tp1Contracts: 1,
      indexEntry: close,
      indexStop: close,
      indexTp1: close,
      indexTp2: close,
      risk: 1,
    };
    return {
      tone: signal.trade_decision === "hold" ? "buy" : "warning",
      status: plan.status,
      entry: plan.entry,
      stop: plan.stop,
      tp1: plan.tp1,
      tp2: plan.tp2,
      stopLabel: "기준",
      stopText: plan.stopText,
      tp2Label: "시간",
      tp2Text: plan.tp2Text,
      contracts: 1,
      markers: [tradeEvent(markerKind, 1, candles[pointIndex] || latest, pointIndex, lateSetup, close)],
    };
  }

  if (signal.trade_decision === "take_profit" || String(signal.rule || "").includes("RUNNER_EXIT")) {
    const premium = optionPremiumPlan(signal);
    const runnerExit = number(signal.metrics?.option_runner_exit_premium) ?? premium.entry;
    const exitSetup = {
      ...premium,
      mode: "signal",
      currentStop: runnerExit,
      tp1Contracts: number(signal.metrics?.option_runner_exit_contracts) || 1,
      indexEntry: close,
      indexStop: close,
      indexTp1: close,
      indexTp2: close,
      risk: 1,
    };
    return {
      tone: "warning",
      status: "잔량청산",
      entry: premium.entry,
      stop: runnerExit,
      tp1: premium.tp1,
      tp2: runnerExit,
      stopLabel: "잔량",
      stopText: `3회차 본청 ${formatNum(runnerExit, 2)}`,
      tp2Label: "판단",
      tp2Text: "청산확인",
      contracts: number(signal.metrics?.option_runner_exit_contracts) || 1,
      markers: [tradeEvent("take_profit", 1, candles[pointIndex] || latest, pointIndex, exitSetup, close)],
    };
  }

  if (signal.type === "sell" || String(signal.rule || "").includes("BREAK")) {
    const premium = optionPremiumPlan(signal);
    return {
      tone: "sell",
      status: "손절/청산",
      entry: premium.entry,
      stop: premium.stop,
      tp1: premium.tp1,
      tp2: premium.tp2,
      markers: [tradeEvent("stop", 1, candles[pointIndex] || latest, pointIndex, { ...premium, indexEntry: close, indexStop: close, indexTp1: close, indexTp2: close, risk: 1 })],
    };
  }

  if (signal.type === "warning") {
    const premium = optionPremiumPlan(signal);
    return {
      ...standbyTradePlan("관찰"),
      tone: "warning",
      markers: [tradeEvent("watch", 1, candles[pointIndex] || latest, pointIndex, { ...premium, indexEntry: close, indexStop: close, indexTp1: close, indexTp2: close, risk: 1 })],
    };
  }

  return standbyTradePlan("대기");
}

function buildReplayTradePlan(session, options = {}) {
  if (!session?.series?.length) return emptyReplayTradePlan();
  const plan = emptyReplayTradePlan();
  const series = session.series;
  const signalsByIndex = groupSignalsByIndex(session.signals, series.length);
  const closeOpenTrade = options.closeOpenTrade !== false;
  let activeTrade = null;

  series.forEach((point, index) => {
    if (activeTrade && index > activeTrade.entryIndex) {
      const exitEvent = updateActiveTradeFromCandle(activeTrade, point, index, plan);
      if (exitEvent) {
        closeReplayTrade(activeTrade, exitEvent, plan);
        activeTrade = null;
      }
    }

    const signals = signalsByIndex.get(index) || [];
    signals.forEach((signal) => {
      if (isEntrySignal(signal)) {
        if (activeTrade) return;
        const setup = tradeSetupFromSignal(signal, session, number(point?.index));
        if (!setup) return;
        const tradeId = plan.trades.length + 1;
        const entryKind = setup.mode === "test" ? "test" : "entry";
        const entryEvent = tradeEvent(entryKind, tradeId, point, index, setup);
        plan.events.push(entryEvent);
        activeTrade = {
          id: tradeId,
          setup,
          mode: setup.mode,
          entryIndex: index,
          tp1Hit: false,
          openContracts: setup.contracts,
          realizedProfit: 0,
          ambiguousCount: 0,
          bestPremium: setup.entry,
        };
        return;
      }

      const event = signalEvent(signal, point, index, activeTrade);
      if (activeTrade && event.kind === "take_profit") {
        closeReplayTrade(activeTrade, event, plan);
        activeTrade = null;
        return;
      }
      plan.events.push(event);
    });
  });

  if (activeTrade && closeOpenTrade) {
    const lastIndex = series.length - 1;
    const exitEvent = tradeEvent("exit", activeTrade.id, series[lastIndex], lastIndex, activeTrade.setup, number(series[lastIndex]?.index));
    closeReplayTrade(activeTrade, exitEvent, plan);
  }

  plan.stats = tradeStats(plan.trades, plan.events);
  plan.events.sort((a, b) => (a.point_index - b.point_index) || eventPriority(a.kind) - eventPriority(b.kind));
  return plan;
}

function groupSignalsByIndex(signals, length) {
  const grouped = new Map();
  (Array.isArray(signals) ? signals : []).forEach((signal) => {
    const index = clampIndex(signal.point_index, length);
    if (!grouped.has(index)) grouped.set(index, []);
    grouped.get(index).push(signal);
  });
  return grouped;
}

function updateActiveTradeFromCandle(activeTrade, point, pointIndex, plan) {
  const setup = activeTrade.setup;
  const price = number(point?.index);
  const high = number(point?.high) ?? price;
  const low = number(point?.low) ?? price;
  if (price == null) return null;

  const activeStop = activeTrade.tp1Hit ? Math.max(setup.indexStop, setup.indexEntry) : setup.indexStop;
  const hitStop = low <= activeStop;
  const hitTp1 = !activeTrade.tp1Hit && high >= setup.indexTp1;
  const hitTp2 = high >= setup.indexTp2;
  const mixedPath = hitStop && (hitTp1 || hitTp2);
  if (mixedPath) {
    activeTrade.ambiguousCount += 1;
    plan.events.push(tradeEvent("mixed", activeTrade.id, point, pointIndex, setup, price));
  }

  if (hitStop && (!mixedPath || price < setup.indexEntry)) {
    return tradeEvent("stop", activeTrade.id, point, pointIndex, setup, activeStop);
  }

  if (hitTp1) {
    activeTrade.tp1Hit = true;
    setup.tp1Hit = true;
    setup.indexStop = Math.max(setup.indexStop, setup.indexEntry);
    setup.currentStop = setup.entry;
    const closedContracts = Math.min(activeTrade.openContracts, setup.tp1Contracts || 0);
    activeTrade.openContracts = Math.max(0, activeTrade.openContracts - closedContracts);
    activeTrade.realizedProfit += (setup.tp1 - setup.entry) * closedContracts;
    activeTrade.bestPremium = Math.max(activeTrade.bestPremium, setup.tp1);
    plan.events.push(tradeEvent("tp1", activeTrade.id, point, pointIndex, setup, setup.indexTp1));
  }

  if (hitTp2) {
    activeTrade.bestPremium = Math.max(activeTrade.bestPremium, setup.tp2);
    return tradeEvent("tp2", activeTrade.id, point, pointIndex, setup, setup.indexTp2);
  }

  return null;
}

function closeReplayTrade(activeTrade, exitEvent, plan) {
  plan.events.push(exitEvent);
  const exitPremium = number(exitEvent.premium) ?? activeTrade.setup.entry;
  const openContracts = Math.max(0, activeTrade.openContracts ?? activeTrade.setup.contracts);
  const netProfit = activeTrade.realizedProfit + (exitPremium - activeTrade.setup.entry) * openContracts;
  plan.trades.push({
    id: activeTrade.id,
    mode: activeTrade.mode || activeTrade.setup.mode,
    contracts: activeTrade.setup.contracts,
    entry: activeTrade.setup.entry,
    exit: exitPremium,
    exitKind: exitEvent.kind,
    hadTake: activeTrade.tp1Hit || exitEvent.kind === "tp1" || exitEvent.kind === "tp2",
    netProfit,
    ambiguousCount: activeTrade.ambiguousCount || 0,
    bestPremium: Math.max(activeTrade.bestPremium, exitEvent.premium || 0),
  });
}

function signalEvent(signal, point, pointIndex, activeTrade) {
  const kind = signalKind(signal);
  const setup = optionSignalSetup(signal, point, activeTrade);
  return {
    kind,
    trade_id: activeTrade?.id || 0,
    point_index: pointIndex,
    time: point?.time || signal.time || "-",
    index_value: number(signal.index_value) ?? number(point?.index),
    premium: setup.entry,
    label: signalLabel(kind),
    title: signalTitle(kind, signal, activeTrade),
    detail: signalDetail(kind, signal, setup, activeTrade),
    color: TRADE_COLORS[kind] || TRADE_COLORS.watch,
  };
}

function optionSignalSetup(signal, point, activeTrade) {
  if (activeTrade?.setup) return activeTrade.setup;
  const premium = optionPremiumPlan(signal);
  const indexValue = number(signal.index_value) ?? number(point?.index) ?? 0;
  return {
    ...premium,
    mode: signal.trade_decision === "test" ? "test" : "signal",
    currentStop: premium.stop,
    tp1Contracts: premium.contracts > 1 ? 1 : 0,
    indexEntry: indexValue,
    indexStop: indexValue,
    indexTp1: indexValue,
    indexTp2: indexValue,
    risk: 1,
  };
}

function signalKind(signal) {
  const decision = signal?.trade_decision;
  if (decision === "entry") return "entry";
  if (decision === "test") return "test";
  if (decision === "take_profit") return "take_profit";
  if (decision === "risk") return "risk";
  if (decision === "stop") return "stop";
  if (decision === "watch") return "watch";
  return signalClass(signal?.type);
}

function signalLabel(kind) {
  return {
    test: "보초",
    take_profit: "익절 확인",
    risk: "위험",
    stop: "손절",
    watch: "관찰",
    warning: "관찰",
  }[kind] || tradeLabel(kind);
}

function signalTitle(kind, signal, activeTrade) {
  if (kind === "take_profit" && activeTrade) return `#${activeTrade.id} 익절 확인`;
  if (kind === "stop" && activeTrade) return `#${activeTrade.id} 손절 확인`;
  return signal?.label || signal?.title || signalLabel(kind);
}

function signalDetail(kind, signal, setup, activeTrade) {
  if (kind === "test") {
    return `테스트 관찰 · 계획프리 ${formatNum(setup.entry, 2)} · ${signal.message || ""}`;
  }
  if (kind === "take_profit") {
    return activeTrade
      ? `보유 플랜 청산 확인 · 1차 ${formatNum(setup.tp1, 2)} · 2차 ${formatNum(setup.tp2, 2)}`
      : `청산 후보 · 보유 포지션 없음 · ${signal.message || ""}`;
  }
  if (kind === "risk" || kind === "stop") {
    return activeTrade
      ? `위험 확인 · 계획손절 ${formatNum(setup.currentStop ?? setup.stop, 2)}`
      : `위험 신호 · 보유 포지션 없음 · ${signal.message || ""}`;
  }
  return signal.message || signal.alert || "실시간 재생식 관찰 신호";
}

function eventPriority(kind) {
  return {
    stop: 1,
    tp1: 2,
    tp2: 3,
    mixed: 4,
    entry: 5,
    test: 6,
    take_profit: 7,
    risk: 8,
    watch: 9,
    exit: 10,
  }[kind] || 10;
}

function isEntrySignal(signal) {
  const action = String(signal?.action || signal?.rule || "");
  if (signal?.trade_decision) return signal.trade_decision === "entry" || signal.trade_decision === "test";
  return signal?.type === "candidate" && action.includes("FIB_618") && signal?.filter_pass !== false;
}

function tradeSetupFromSignal(signal, session, entryOverride = null) {
  if (!isEntrySignal(signal)) return null;
  const levels = signal.levels || session?.levels || {};
  const indexEntry = number(entryOverride) ?? number(signal.index_value);
  if (indexEntry == null) return null;

  const action = String(signal.action || signal.rule || "");
  const span = levelSpan(levels, indexEntry);
  const buffer = Math.max(span * 0.012, 0.12);
  const minRisk = Math.max(span * 0.018, 0.35);
  const isResetEntry = action.includes("INDEX_RESET") || action.includes("RESET_MID");
  const isTenkanPullback = action.includes("TENKAN_PULLBACK") || action.includes("KIJUN_SUPPORT");
  const metricLevel = (key) => number(signal.metrics?.[key]) ?? number(levels[key]);
  const reference = isResetEntry
    ? number(levels.reset_mid_618_100) ?? number(levels.fib_100)
    : isTenkanPullback
      ? metricLevel("tenkan_entry") ?? metricLevel("tenkan") ?? number(levels.fib_50)
      : action.includes("FIB_50")
        ? number(levels.fib_50)
        : number(levels.fib_618);
  const stopReference = isResetEntry
    ? number(levels.reset_fib_100) ?? number(levels.fib_105) ?? reference
    : isTenkanPullback
      ? metricLevel("kijun_stop") ?? metricLevel("kijun") ?? reference
    : reference;
  const candleLow = number(signal.candle?.low);
  const stopCandidates = [candleLow, stopReference]
    .filter((value) => value != null)
    .map((value) => value - buffer)
    .filter((value) => value < indexEntry);

  let indexStop = isTenkanPullback && stopReference != null
    ? stopReference
    : stopCandidates.length ? Math.min(...stopCandidates) : indexEntry - minRisk;
  let risk = indexEntry - indexStop;
  if (isTenkanPullback && (!Number.isFinite(risk) || risk <= 0)) {
    risk = minRisk;
    indexStop = indexEntry - risk;
  } else if (!isTenkanPullback && (!Number.isFinite(risk) || risk < minRisk)) {
    risk = minRisk;
    indexStop = indexEntry - risk;
  }
  const targetCandidates = isResetEntry
    ? [levels.fib_100, levels.fib_618, levels.fib_50, levels.fib_382, levels.day_high]
    : isTenkanPullback
      ? [levels.day_high, levels.fib_382, levels.fib_50]
    : [levels.fib_50, levels.fib_382, levels.day_high];
  const indexTp1 = targetAbove(indexEntry, targetCandidates, risk);
  const indexTp2 = targetAbove(indexTp1, targetCandidates, risk * 0.8);
  const premium = optionPremiumPlan(signal);
  const mode = signal.trade_decision === "test" ? "test" : "entry";
  const tp1Contracts = premium.contracts > 1 ? 1 : 0;
  const tenkanStopText = isTenkanPullback && stopReference != null
    ? `기준 ${formatNum(stopReference, 2)} · 선물확인`
    : null;
  const tp1Gain = number(signal.metrics?.option_tp1_gain) ?? (premium.tp1 - premium.entry);
  const extensionTarget = number(signal.metrics?.runner_extension_target);
  const runnerTargetText = isTenkanPullback
    ? extensionTarget != null ? `1.6배 ${formatNum(extensionTarget, 2)}` : "1.6배 홀딩"
    : null;

  return {
    direction: "CALL",
    mode,
    entry: premium.entry,
    stop: premium.stop,
    currentStop: premium.stop,
    tp1: premium.tp1,
    tp2: premium.tp2,
    contracts: premium.contracts,
    tp1Contracts,
    runnerContracts: premium.contracts - tp1Contracts,
    stopLabel: tenkanStopText ? "지수컷" : null,
    stopText: tenkanStopText,
    tp2Label: isTenkanPullback ? "잔량" : null,
    tp2Text: isTenkanPullback ? "트레일" : null,
    tp1Gain,
    runnerTargetText,
    tp1Reason: isTenkanPullback ? "D-1 타이트 안전마진" : null,
    runnerCutText: isTenkanPullback ? "기준선 지지 실패 컷" : null,
    optionRangeText: isTenkanPullback ? `${formatNum(signal.metrics?.option_premium_min, 1)}~${formatNum(signal.metrics?.option_premium_max, 1)}` : null,
    strikeOffsetText: isTenkanPullback ? `+${formatNum(signal.metrics?.option_strike_offset_points, 0)}p` : null,
    indexEntry,
    indexStop,
    indexTp1,
    indexTp2,
    risk,
  };
}

function optionPremiumPlan(signal = {}) {
  const strategy = state.weeklyOptions || fallbackWeeklyOptions;
  const entry = strategy.entry || {};
  const profile = premiumProfile(signal, entry);
  const base = profile.entry;
  const contracts = profile.contracts;
  return {
    entry: base,
    stop: profile.stop ?? base * profile.stopMultiplier,
    tp1: profile.tp1 ?? base * profile.tp1Multiplier,
    tp2: profile.tp2 ?? base * profile.tp2Multiplier,
    contracts,
  };
}

function premiumProfile(signal = {}, entry = {}) {
  const action = String(signal.action || signal.rule || "");
  if (signal.trade_decision === "test") {
    return {
      entry: 1.0,
      contracts: 1,
      stopMultiplier: 0.6,
      tp1Multiplier: 1.3,
      tp2Multiplier: 1.45,
    };
  }

  const explicitEntryPremium = number(signal.metrics?.option_entry_premium);
  if (explicitEntryPremium != null) {
    const explicitTp1 = number(signal.metrics?.option_tp1_premium) ?? explicitEntryPremium * 1.13;
    return {
      entry: explicitEntryPremium,
      contracts: number(signal.metrics?.contracts) || number(signal.metrics?.option_runner_exit_contracts) || 1,
      stopMultiplier: 0.68,
      tp1: explicitTp1,
      tp2: Math.max(explicitTp1, explicitEntryPremium * 1.37),
    };
  }

  const base = averageEntry(entry);
  if (action.includes("INDEX_RESET") || action.includes("RESET_MID")) {
    return {
      entry: base,
      contracts: 2,
      stopMultiplier: 0.7,
      tp1Multiplier: 1.35,
      tp2Multiplier: 1.55,
    };
  }

  if (action.includes("TENKAN_PULLBACK") || action.includes("KIJUN_SUPPORT")) {
    const entryPremium = number(signal.metrics?.option_entry_premium) ?? 2.3;
    const tp1Premium = number(signal.metrics?.option_tp1_premium) ?? 2.6;
    return {
      entry: entryPremium,
      contracts: number(signal.metrics?.contracts) || 2,
      stopMultiplier: 0.68,
      tp1: tp1Premium,
      tp2: Math.max(tp1Premium, entryPremium * 1.37),
    };
  }

  return {
    entry: base,
    contracts: entry.initial_contracts || 3,
    stopMultiplier: 0.7,
    tp1Multiplier: 1.3,
    tp2Multiplier: 1.45,
  };
}

function targetAbove(entry, candidates, fallbackDistance) {
  const usable = candidates
    .map((value) => number(value))
    .filter((value) => value != null && value > entry)
    .sort((a, b) => a - b);
  return usable[0] ?? entry + Math.max(fallbackDistance, 0.35);
}

function levelSpan(levels, fallback) {
  const high = number(levels?.day_high);
  const low = number(levels?.day_low);
  if (high != null && low != null && high > low) return high - low;
  return Math.max((number(fallback) || 100) * 0.01, 1);
}

function tradeEvent(kind, tradeId, point, pointIndex, setup, overridePrice = null) {
  const price = number(overridePrice) ?? number(point?.index) ?? number(point?.close) ?? setup.indexEntry;
  const premium = premiumForEvent(kind, setup, price);
  return {
    kind,
    trade_id: tradeId,
    point_index: pointIndex,
    time: point?.time || "-",
    index_value: price,
    premium,
    label: tradeLabel(kind),
    title: tradeTitle(kind, tradeId),
    detail: tradeDetail(kind, setup, premium),
    color: TRADE_COLORS[kind] || TRADE_COLORS.watch,
  };
}

function premiumForEvent(kind, setup, indexPrice = null) {
  if (kind === "exit") return plannedPremiumAtIndex(setup, indexPrice);
  return {
    entry: setup.entry,
    test: setup.entry,
    stop: setup.currentStop ?? setup.stop,
    tp1: setup.tp1,
    tp2: setup.tp2,
    mixed: plannedPremiumAtIndex(setup, indexPrice),
    watch: setup.entry,
  }[kind] ?? setup.entry;
}

function plannedPremiumAtIndex(setup, indexPrice) {
  const price = number(indexPrice);
  if (price == null) return setup.entry;
  const anchors = [
    { index: number(setup.indexStop), premium: number(setup.currentStop ?? setup.stop) },
    { index: number(setup.indexEntry), premium: number(setup.entry) },
    { index: number(setup.indexTp1), premium: number(setup.tp1) },
    { index: number(setup.indexTp2), premium: number(setup.tp2) },
  ]
    .filter((anchor) => anchor.index != null && anchor.premium != null)
    .sort((a, b) => a.index - b.index);
  if (!anchors.length) return setup.entry;
  if (price <= anchors[0].index) return anchors[0].premium;
  for (let index = 1; index < anchors.length; index += 1) {
    const prev = anchors[index - 1];
    const next = anchors[index];
    if (price <= next.index) {
      const distance = next.index - prev.index || 1;
      const ratio = (price - prev.index) / distance;
      return prev.premium + (next.premium - prev.premium) * ratio;
    }
  }
  return anchors[anchors.length - 1].premium;
}

function tradeLabel(kind) {
  return {
    entry: "진입",
    stop: "손절",
    tp1: "1차 익절",
    tp2: "2차 익절",
    mixed: "혼재",
    exit: "청산",
    watch: "관찰",
    test: "보초",
    risk: "위험",
    take_profit: "익절 확인",
  }[kind] || "신호";
}

function tradeTitle(kind, tradeId) {
  const prefix = `#${tradeId}`;
  return {
    entry: `${prefix} 콜 진입`,
    stop: `${prefix} 손절`,
    tp1: `${prefix} 1차 익절`,
    tp2: `${prefix} 2차 청산`,
    mixed: `${prefix} 5분봉 혼재`,
    exit: `${prefix} 시간 청산`,
    watch: "관찰",
    test: `${prefix} 콜 보초`,
    risk: "위험",
    take_profit: "익절 확인",
  }[kind] || `${prefix} 신호`;
}

function tradeDetail(kind, setup, outputR) {
  if (kind === "entry" || kind === "test") {
    if (setup.tp2Text) {
      const gainText = setup.tp1Gain != null ? `(+${formatNum(setup.tp1Gain, 2)})` : "";
      const runnerText = setup.runnerTargetText ? ` · ${setup.runnerTargetText}` : "";
      return `${setup.contracts}계약 · 1차 익절 ${formatNum(setup.tp1, 2)}${gainText} 1계약 · 잔량 ${setup.tp2Text}${runnerText} · ${setup.stopText || `손절 ${formatNum(setup.stop, 2)}`}`;
    }
    const tp1Text = setup.tp1Contracts ? `1차 익절 ${setup.tp1Contracts}계약` : "1차 이후 본전손절";
    return `${setup.contracts}계약 · 계획손절 ${formatNum(setup.stop, 2)} · ${tp1Text} · 2차 익절 ${formatNum(setup.tp2, 2)}`;
  }
  if (kind === "tp1") {
    return setup.tp1Contracts
      ? `계획프리 ${formatNum(outputR, 2)} · ${setup.tp1Contracts}계약 청산 · 잔량 ${setup.runnerTargetText || setup.tp2Text || "본전스탑"}`
      : `계획프리 ${formatNum(outputR, 2)} · 본전스탑 적용`;
  }
  if (kind === "mixed") {
    return "같은 5분봉에서 손절/목표가 함께 닿은 모호 구간 · 종가 기준으로 처리";
  }
  if (kind === "watch") return "진입 전 관찰 구간";
  return `계획프리 ${formatNum(outputR, 2)} · 진입 ${formatNum(setup.entry, 2)}`;
}

function tradeStats(trades, events = []) {
  const total = trades.length;
  const entries = events.filter((event) => event.kind === "entry").length;
  const tests = events.filter((event) => event.kind === "test").length;
  const takes = events.filter((event) => event.kind === "tp1" || event.kind === "tp2" || event.kind === "take_profit").length;
  const risks = events.filter((event) => event.kind === "risk" || (event.kind === "stop" && !event.trade_id)).length;
  const stops = trades.filter((trade) => trade.exitKind === "stop").length;
  const ambiguous = trades.reduce((sum, trade) => sum + (trade.ambiguousCount || 0), 0) + events.filter((event) => event.kind === "mixed" && !event.trade_id).length;
  const netProfit = trades.reduce((sum, trade) => sum + (number(trade.netProfit) || 0), 0);
  const winners = trades.filter((trade) => (number(trade.netProfit) || 0) > 0).length;
  const winRate = total ? (winners / total) * 100 : 0;
  const bestPremium = trades.length ? Math.max(...trades.map((trade) => number(trade.bestPremium) || number(trade.exit) || 0)) : null;
  return { total, entries, tests, takes, risks, stops, ambiguous, netProfit, winRate, bestPremium };
}

function clampIndex(value, length) {
  if (!length) return 0;
  return Math.max(0, Math.min(length - 1, Number(value) || 0));
}

function renderReplayLegend() {
  document.querySelector("#replayLegend").innerHTML = replayLegendEntries().map(legendItem).join("");
}

function replayLegendEntries() {
  return [
    { label: "지수", color: themeColor("--chart-line", "#e8eef5") },
    ...CHART_EXTRA_SERIES.map((line) => ({ label: line.label, color: line.color })),
    { label: "진입", color: TRADE_COLORS.entry },
    { label: "보초", color: TRADE_COLORS.test },
    { label: "손절", color: TRADE_COLORS.stop },
    { label: "익절", color: TRADE_COLORS.tp1 },
    { label: "혼재", color: TRADE_COLORS.mixed },
    { label: "위험", color: TRADE_COLORS.risk },
  ];
}

function renderDesign() {
  const strategy = state.weeklyOptions || fallbackWeeklyOptions;
  const risk = strategy.risk_limits || {};
  const entry = strategy.entry || {};
  const strike = entry.strike_selection || {};
  const money = strategy.money_management || {};
  const profitLock = money.daily_profit_lock || {};
  const avgEntry = averageEntry(entry);
  const items = [
    { label: "평균 진입", value: formatNum(avgEntry, 2), text: "3분할 기준" },
    { label: "목표 프리", value: strike.target_premium_range_label || formatNum(strike.target_premium, 2), text: "허용 범위" },
    { label: "손실한도", value: formatWon(risk.daily_max_loss_krw), text: risk.loss_basis_label || "누적 손실" },
    { label: "수익잠금", value: profitLock.profit_krw_range ? `${formatWon(profitLock.profit_krw_range[0])}~${formatWon(profitLock.profit_krw_range[1])}` : "-", text: "보수 모드" },
    { label: "계약", value: `${entry.initial_contracts || 3}계약`, text: "주문 없음" },
    { label: "행사가", value: `${strike.call_strike_offset_pct || 2.5}% 위`, text: "콜 후보" },
  ];
  document.querySelector("#designSummary").innerHTML = items.map(metricCard).join("");

  const ladder = Array.isArray(entry.order_ladder) ? entry.order_ladder : [];
  document.querySelector("#orderPlan").innerHTML = ladder.length
    ? ladder.map((order, index) => `
        <article class="replay-item buy">
          <span>${index + 1}차</span>
          <strong>${escapeHtml(order.label || "분할 주문")} · ${formatNum(order.price, 2)}</strong>
          <small>${escapeHtml(order.description || order.formula || "지정가 후보만 표시합니다.")}</small>
        </article>
      `).join("")
    : `<article class="replay-item"><strong>분할 주문 자료 없음</strong><small>전략 JSON의 order_ladder를 확인하세요.</small></article>`;
  renderDesignLegend();
  drawDesignChart();
}

function renderDesignLegend() {
  const visual = (state.weeklyOptions || fallbackWeeklyOptions).visual_chart || fallbackWeeklyOptions.visual_chart;
  const entries = (visual.lines || []).slice(0, 5).map((line) => ({
    label: line.label || line.key,
    color: line.color || themeColor("--chart-line", "#e8eef5"),
  }));
  document.querySelector("#designLegend").innerHTML = entries.map(legendItem).join("");
}

function renderGuide() {
  const strategy = state.weeklyOptions || fallbackWeeklyOptions;
  const risk = strategy.risk_limits || {};
  const entry = strategy.entry || {};
  const strike = entry.strike_selection || {};
  const states = Array.isArray(strategy.states) ? strategy.states : [];
  const questions = Array.isArray(strategy.questions) ? strategy.questions : [];

  const riskItems = [
    { label: "당일 중단", value: formatWon(risk.daily_max_loss_krw), text: risk.description || "한도 도달 시 신규 진입 중단" },
    { label: "진입", value: `${entry.initial_contracts || 3}계약`, text: "1계약씩 분할" },
    { label: "프리미엄", value: strike.target_premium_range_label || formatNum(strike.target_premium, 2), text: strike.description || "목표 프리미엄" },
  ];
  document.querySelector("#riskSummary").innerHTML = riskItems.map(metricCard).join("");
  document.querySelector("#guideList").innerHTML = [
    ...states.slice(0, 8).map((step) => ({
      title: step.label || step.key,
      text: step.description || "",
    })),
    ...questions.slice(0, 4).map((question) => ({ title: "확인 필요", text: question })),
  ]
    .map((item) => `
      <article class="guide-item">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.text)}</small>
      </article>
    `)
    .join("");
}

function renderSettings() {
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  const soundText = state.alertsEnabled ? (state.audioContext ? "소리 ON" : "소리 대기") : "소리 OFF";
  const vibrationText = state.settings.vibrationEnabled ? "진동 ON" : "진동 OFF";
  const wakeText = state.wakeLock ? "화면유지 ON" : "화면유지 OFF";
  const apiBase = currentApiBaseUrl();
  const alertText = `${state.alertsEnabled ? "알림 켜짐" : "알림 꺼짐"} · 브라우저 ${permission} · ${wakeText}`;
  setText("#alertStatus", alertText);
  setText("#backendStatus", `${apiBaseLabel(apiBase)} · /api/options-monitor 사용`);
  setText("#boardStatus", `${soundText} · ${vibrationText} · 알림센터 ${permission} · ${wakeText}`);
  setText("#enableAlerts", state.alertsEnabled ? "알림 끄기" : "알림 켜기");
  setText("#toggleWakeLock", state.wakeLock ? "화면유지 끄기" : "화면유지 켜기");
  const apiInput = document.querySelector("#apiBaseUrl");
  if (apiInput) apiInput.value = apiBase;
  const installCommand = document.querySelector("#androidInstallCommand");
  if (installCommand) installCommand.value = ANDROID_INSTALL_COMMAND;
  const envDraft = document.querySelector("#backendEnvDraft");
  if (envDraft) envDraft.value = state.settings.backendEnvDraft || BACKEND_ENV_TEMPLATE;
  setChecked("#repeatStrongAlerts", state.settings.repeatStrongAlerts);
  setChecked("#vibrationEnabled", state.settings.vibrationEnabled);
  setChecked("#saveSignalLog", state.settings.saveSignalLog);
}

async function clearSignalLog() {
  state.signalLog = [];
  localStorage.removeItem(SIGNAL_LOG_KEY);
  renderSignalLog();
  try {
    await fetch(apiUrl("/api/options-signals"), { method: "DELETE", cache: "no-store" });
  } catch (error) {
    // Static/offline mode keeps using the local clear above.
  }
}

async function saveApiBaseUrl() {
  const base = apiBaseUrlFromInput();
  state.settings.apiBaseUrl = base;
  saveSettings();
  renderSettings();
  setText("#backendStatus", `${apiBaseLabel(base)} 저장됨 · 연결 확인 중`);
  await testBackendConnection(base);
  await loadMonitor(true);
  await refreshReplayFromApi();
  setText("#backendStatus", `${apiBaseLabel(base)} 저장됨 · API 연결 적용`);
}

async function resetApiBaseUrl() {
  state.settings.apiBaseUrl = "";
  saveSettings();
  renderSettings();
  await testBackendConnection("");
  await loadMonitor(true);
  await refreshReplayFromApi();
  setText("#backendStatus", "현재 주소 저장됨 · API 연결 적용");
}

async function copyAndroidInstallCommand() {
  await copyText(ANDROID_INSTALL_COMMAND, "#androidBackendStatus", "설치 명령을 복사했습니다. Termux에 붙여넣어 실행하세요.");
}

async function copyAndroidUpdateCommand() {
  await copyText(ANDROID_UPDATE_COMMAND, "#androidBackendStatus", "업데이트 명령을 복사했습니다. Termux에 붙여넣으면 최신화 후 다시 실행합니다.");
}

async function copyAndroidStartCommand() {
  await copyText(ANDROID_START_COMMAND, "#androidBackendStatus", "실행 명령을 복사했습니다. 설치 후 Termux에서 실행하세요.");
}

async function useAndroidLocalBackend() {
  state.settings.apiBaseUrl = ANDROID_BACKEND_LOCAL_URL;
  saveSettings();
  renderSettings();
  setText("#androidBackendStatus", "이 폰의 로컬 백엔드 주소를 적용했습니다.");
  await testBackendConnection(ANDROID_BACKEND_LOCAL_URL);
  await loadMonitor(true);
  await refreshReplayFromApi();
}

function saveBackendEnvDraft() {
  const draft = document.querySelector("#backendEnvDraft")?.value || "";
  state.settings.backendEnvDraft = draft;
  saveSettings();
  setText("#backendEnvStatus", "환경 변수 초안을 브라우저에 저장했습니다.");
}

function resetBackendEnvDraft() {
  state.settings.backendEnvDraft = BACKEND_ENV_TEMPLATE;
  saveSettings();
  renderSettings();
  setText("#backendEnvStatus", "키움 API용 템플릿을 복원했습니다.");
}

async function copyBackendEnvDraft() {
  const draft = document.querySelector("#backendEnvDraft")?.value || BACKEND_ENV_TEMPLATE;
  await copyText(draft, "#backendEnvStatus", "환경 변수 초안을 복사했습니다.");
}

async function testBackendConnection(baseOverride = apiBaseUrlFromInput()) {
  const base = normalizeApiBaseUrl(baseOverride);
  setText("#backendStatus", `${apiBaseLabel(base)} 연결 확인 중`);
  try {
    const response = await fetch(apiUrl("/api/health", base), { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "health failed");
    const time = payload.generated_at ? payload.generated_at.slice(11, 16) : "-";
    setText("#backendStatus", `${apiBaseLabel(base)} 연결 OK · ${time}`);
  } catch (error) {
    setText("#backendStatus", `${apiBaseLabel(base)} 연결 실패 · 같은 Wi-Fi와 서버 주소를 확인하세요.`);
  }
}

async function refreshReplayFromApi() {
  if (state.activeReplayDate) {
    await loadReplayDate(state.activeReplayDate);
    return;
  }
  const payload = await loadOptionalJson("/api/options-replay");
  if (payload) {
    state.replay = normalizeReplayPayload(payload) || state.replay;
    state.activeReplayDate = activeReplaySession()?.date || state.replay.active_session_id || null;
  }
  renderReplay();
}

function openModal(name) {
  state.activeModal = name;
  const meta = modalMeta[name] || modalMeta.replay;
  setText("#modalEyebrow", meta.eyebrow);
  setText("#modalTitle", meta.title);
  document.querySelector("#modalBackdrop").hidden = false;
  document.querySelectorAll("[data-modal-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.modalPanel !== name;
  });
  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.classList.toggle("active", button.dataset.openModal === name);
  });
  scheduleChartRedraw();
}

function closeModal() {
  state.activeModal = null;
  document.querySelector("#modalBackdrop").hidden = true;
  document.querySelectorAll("[data-open-modal]").forEach((button) => button.classList.remove("active"));
}

function requestAlertToggle() {
  const nextState = !state.alertsEnabled;
  state.pendingAlertState = nextState;
  setText("#alertConfirmEyebrow", nextState ? "알림 켜기" : "알림 끄기");
  setText("#alertConfirmTitle", nextState ? "알림을 켤까요?" : "알림을 끌까요?");
  setText(
    "#alertConfirmText",
    nextState
      ? "신호가 발생하면 이 폰에서 소리, 진동, 가능한 경우 알림센터 알림을 보냅니다."
      : "알림을 끄면 신호는 화면에만 표시되고 소리와 진동은 울리지 않습니다.",
  );
  setText("#confirmAlertToggle", nextState ? "켜기" : "끄기");
  document.querySelector("#alertConfirmBackdrop").hidden = false;
}

function closeAlertConfirm() {
  state.pendingAlertState = null;
  document.querySelector("#alertConfirmBackdrop").hidden = true;
}

async function confirmAlertToggle() {
  const nextState = Boolean(state.pendingAlertState);
  document.querySelector("#alertConfirmBackdrop").hidden = true;
  state.pendingAlertState = null;
  await setAlertsEnabled(nextState);
}

async function setAlertsEnabled(enabled) {
  state.alertsEnabled = enabled;
  state.settings.alertsEnabled = enabled;
  saveSettings();

  if (enabled) {
    unlockAudio();
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (error) {
        // Sound and vibration still work while the page is open.
      }
    }
    fireAlert({
      type: "watch",
      title: "알림 준비",
      message: "신호가 뜨면 이 폰에서 소리와 진동을 보냅니다.",
      rule: "ALERT_READY",
    }, true);
  } else {
    state.lastAlertKey = null;
    if (navigator.vibrate) navigator.vibrate(0);
  }

  renderSettings();
}

function testAlert() {
  renderSettings();
  fireAlert({
    type: "candidate",
    title: "테스트 알림",
    message: "소리, 진동, 알림센터 전달 상태를 확인합니다.",
    rule: "TEST_ALERT",
  }, true);
}

function maybeFireAlert(snapshot) {
  if (!state.alertsEnabled) return;
  if (!isLiveDate()) return;
  const signal = snapshot.signal || {};
  if (!["candidate", "sell", "warning", "watch"].includes(signal.type)) return;
  if (signal.alert_level === "silent") return;
  const latest = snapshot.main?.latest || {};
  const key = `${signal.rule}:${latest.datetime || signal.time}:${latest.close || ""}`;
  if (state.lastAlertKey === key) return;
  state.lastAlertKey = key;
  fireAlert(signal);
}

async function fireAlert(signal, force = false) {
  if (!force && !state.alertsEnabled) return;
  playTone(signal.type);
  vibrate(signal.type);

  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = `옵션 감시: ${signal.title || signal.label || "신호"}`;
  const body = signal.message || "KOSPI200 5분봉 신호를 확인하세요.";
  try {
    if (state.serviceWorkerRegistration) {
      await state.serviceWorkerRegistration.showNotification(title, {
        body,
        tag: `options-monitor-${signal.rule || "signal"}`,
        renotify: true,
        requireInteraction: ["candidate", "sell"].includes(signal.type),
      });
    } else {
      new Notification(title, { body, tag: `options-monitor-${signal.rule || "signal"}` });
    }
  } catch (error) {
    // The page alert path still completed.
  }
}

function unlockAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!state.audioContext) state.audioContext = new AudioContext();
  if (state.audioContext.state === "suspended") state.audioContext.resume();
}

function playTone(type) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!state.audioContext) state.audioContext = new AudioContext();
  const context = state.audioContext;
  if (context.state === "suspended") context.resume();
  const strong = state.settings.repeatStrongAlerts && ["candidate", "sell"].includes(type);
  const pattern =
    type === "sell"
      ? [760, 520, 760, 520, ...(strong ? [760, 520] : [])]
      : type === "candidate"
        ? [880, 880, 660, ...(strong ? [880, 660] : [])]
        : type === "warning"
          ? [620, 620]
          : [520];

  pattern.forEach((frequency, index) => {
    const start = context.currentTime + index * 0.18;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.14);
  });
}

function vibrate(type) {
  if (!state.settings.vibrationEnabled || !navigator.vibrate) return;
  const pattern =
    type === "sell"
      ? [260, 90, 260, 90, 420]
      : type === "candidate"
        ? [220, 80, 220, 80, 220]
        : type === "warning"
          ? [150, 70, 150]
          : [90];
  navigator.vibrate(pattern);
}

async function toggleWakeLock() {
  if (!("wakeLock" in navigator)) {
    setText("#alertStatus", "이 브라우저는 화면 유지 API를 지원하지 않습니다.");
    return;
  }
  try {
    if (state.wakeLock) {
      await state.wakeLock.release();
      state.wakeLock = null;
    } else {
      state.wakeLock = await navigator.wakeLock.request("screen");
      state.wakeLock.addEventListener("release", () => {
        state.wakeLock = null;
        renderSettings();
      });
    }
  } catch (error) {
    setText("#alertStatus", "화면 유지 요청이 거부되었습니다.");
  }
  renderSettings();
}

function buildLiveReplaySession(snapshot = state.monitor) {
  const backendSeries = Array.isArray(snapshot?.main?.series) ? snapshot.main.series : [];
  if (backendSeries.length) {
    return {
      id: backendSeries[0]?.date || "live",
      date: backendSeries[0]?.date,
      series: backendSeries,
      signals: Array.isArray(snapshot?.main?.signals) ? snapshot.main.signals : [],
      levels: snapshot?.main?.levels || {},
      markers: Array.isArray(snapshot?.main?.markers) ? snapshot.main.markers : [],
      events: Array.isArray(snapshot?.main?.events) ? snapshot.main.events : [],
      backend: true,
    };
  }

  const rawCandles = Array.isArray(snapshot?.main?.candles) ? snapshot.main.candles : [];
  const candles = latestSessionCandles(rawCandles);
  if (!candles.length) return null;
  return {
    id: candles[0]?.date || "live",
    date: candles[0]?.date,
    series: seriesFromCandles(candles),
    signals: Array.isArray(snapshot?.main?.signals) ? snapshot.main.signals : [],
    levels: snapshot?.main?.levels || {},
  };
}

function latestSessionCandles(candles) {
  const latestDate = candles[candles.length - 1]?.date;
  if (!latestDate) return candles;
  return candles.filter((candle) => candle.date === latestDate);
}

function seriesFromCandles(candles) {
  const closes = [];
  return candles.map((candle, index) => {
    const close = number(candle.close);
    if (close != null) closes.push(close);
    const partial = candles.slice(0, index + 1);
    return {
      ...candle,
      index: close,
      gma30: chartGeometricAverage(closes.slice(-30)),
      gma50: chartGeometricAverage(closes.slice(-50)),
      tenkan: chartIchimokuMid(partial, 9),
      kijun: chartIchimokuMid(partial, 26),
    };
  });
}

function chartGeometricAverage(values) {
  const sample = values.filter((value) => value != null && value > 0);
  if (!sample.length) return null;
  return Math.exp(sample.reduce((sum, value) => sum + Math.log(value), 0) / sample.length);
}

function chartIchimokuMid(candles, windowSize) {
  if (candles.length < windowSize) return null;
  const sample = candles.slice(-windowSize);
  const highs = sample.map((candle) => number(candle.high)).filter((value) => value != null);
  const lows = sample.map((candle) => number(candle.low)).filter((value) => value != null);
  if (!highs.length || !lows.length) return null;
  return (Math.max(...highs) + Math.min(...lows)) / 2;
}

function mergeLiveTradeMarkers(replayEvents, liveMarkers, series) {
  const latestIndex = Math.max(0, (series?.length || 1) - 1);
  const normalizedLive = (liveMarkers || []).map((marker) => ({ ...marker, point_index: latestIndex }));
  const merged = [];
  const seen = new Set();
  replayEvents.concat(normalizedLive).forEach((marker) => {
    const key = `${marker.kind || ""}:${marker.point_index}:${marker.label || ""}:${formatNum(marker.premium, 2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(marker);
  });
  return merged;
}

function drawLiveChart(livePlan = buildLiveTradePlan(state.monitor)) {
  const canvas = document.querySelector("#liveChart");
  const liveSession = buildLiveReplaySession(state.monitor);
  if (!liveSession?.series?.length) {
    const signal = state.monitor?.signal || {};
    drawEmptyChart(
      canvas,
      signal.title || "옵션 감시 연결 대기",
      320,
      signal.message || "백엔드 주소와 로컬 서버 실행 상태를 확인하세요.",
    );
    return;
  }
  const backendMarkers = Array.isArray(liveSession.markers) ? liveSession.markers : [];
  const backendEvents = Array.isArray(liveSession.events) ? liveSession.events : [];
  const replayEvents = backendMarkers.length || backendEvents.length
    ? backendEvents
    : buildReplayTradePlan(liveSession, { closeOpenTrade: false }).events;
  const tradeMarkers = backendMarkers.length
    ? backendMarkers
    : mergeLiveTradeMarkers(replayEvents, livePlan?.markers || [], liveSession.series);
  drawLineChart(canvas, {
    height: 320,
    padding: { top: 56, right: 52, bottom: 42, left: 30 },
    compactTradeLabels: true,
    points: liveSession.series,
    valueKey: "index",
    timeKey: "time",
    levels: chartLevelEntries(liveSession.levels),
    extraSeries: CHART_EXTRA_SERIES,
    marker: state.monitor?.signal?.type !== "neutral",
    tradeMarkers,
  });
}

function drawReplayChart(session, tradePlan = null) {
  const canvas = document.querySelector("#replayChart");
  if (!session?.series?.length) {
    drawEmptyChart(canvas, "복기 자료 없음", 360, "날짜 또는 백엔드 연결 상태를 확인하세요.");
    return;
  }
  drawLineChart(document.querySelector("#replayChart"), {
    height: 360,
    padding: { top: 70, right: 58, bottom: 46, left: 30 },
    compactTradeLabels: true,
    points: session.series,
    valueKey: "index",
    timeKey: "time",
    levels: chartLevelEntries(session.levels || {}),
    extraSeries: CHART_EXTRA_SERIES,
    tradeMarkers: (tradePlan || buildReplayTradePlan(session)).events,
  });
}

function drawDesignChart() {
  const canvas = document.querySelector("#designChart");
  const strategy = state.weeklyOptions || fallbackWeeklyOptions;
  const visual = strategy.visual_chart || fallbackWeeklyOptions.visual_chart;
  const avgEntry = averageEntry(strategy.entry || {});
  const scope = {
    avg_entry: avgEntry,
    switch_entry: 2.2,
    final_entry: 2.4,
    scalp_entry: 1.0,
    lottery_entry: 1.0,
  };
  const multipliers = visual.sample_path_multipliers || [1, 0.92, 0.75, 0.96, 1.18, 1.35, 1.45, 1.3, 1.55];
  const points = multipliers.map((multiplier, index) => ({
    time: index === 0 ? "진입" : `${index}`,
    value: avgEntry * multiplier,
  }));
  const levels = (visual.lines || [])
    .map((line) => ({
      label: line.label || line.key,
      color: line.color || themeColor("--chart-line", "#e8eef5"),
      value: formulaValue(line.formula, scope),
    }))
    .filter((level) => number(level.value) != null);
  drawLineChart(canvas, {
    height: 300,
    padding: { top: 42, right: 48, bottom: 38, left: 28 },
    points,
    valueKey: "value",
    timeKey: "time",
    levels,
  });
}

function ensureChartControls(canvas, enabled = true) {
  if (!canvas?.id) return;
  const frame = canvas.closest(".chart-frame");
  if (!frame) return;
  let controls = frame.querySelector(".chart-controls");
  if (!controls) {
    controls = document.createElement("div");
    controls.className = "chart-controls";
    controls.innerHTML = `
      <button type="button" data-chart-action="zoom-in" aria-label="차트 확대">+</button>
      <button type="button" data-chart-action="zoom-out" aria-label="차트 축소">-</button>
      <button type="button" data-chart-action="reset" aria-label="차트 초기화">초기</button>
    `;
    frame.appendChild(controls);
  }
  controls.hidden = !enabled;
  controls.querySelectorAll("[data-chart-action]").forEach((button) => {
    button.dataset.chartId = canvas.id;
  });
  const level = chartZoomLevel(canvas.id);
  const zoomIn = controls.querySelector('[data-chart-action="zoom-in"]');
  const zoomOut = controls.querySelector('[data-chart-action="zoom-out"]');
  const reset = controls.querySelector('[data-chart-action="reset"]');
  if (zoomIn) zoomIn.disabled = !enabled || level >= 5;
  if (zoomOut) zoomOut.disabled = !enabled || level <= 1;
  if (reset) reset.disabled = !enabled || level <= 1;
}

function updateChartZoom(chartId, action) {
  if (!chartId) return;
  const current = chartZoomLevel(chartId);
  if (action === "zoom-in") state.chartZoom[chartId] = Math.min(5, current + 1);
  if (action === "zoom-out") state.chartZoom[chartId] = Math.max(1, current - 1);
  if (action === "reset") state.chartZoom[chartId] = 1;
  scheduleChartRedraw();
}

function chartZoomLevel(chartId) {
  return Math.max(1, Math.min(5, Number(state.chartZoom?.[chartId]) || 1));
}

function zoomedChartOptions(canvas, options, points) {
  const level = chartZoomLevel(canvas?.id);
  if (level <= 1 || points.length < 24) return { ...options, points };
  const focusIndex = chartFocusIndex(options, points.length);
  const visibleCount = Math.max(18, Math.ceil(points.length / (1.75 ** (level - 1))));
  const start = Math.max(0, Math.min(points.length - visibleCount, focusIndex - Math.floor(visibleCount * 0.62)));
  const end = Math.min(points.length, start + visibleCount);
  const remapMarkers = (markers = []) => markers
    .map((marker) => ({ ...marker, point_index: clampIndex(marker.point_index, points.length) - start }))
    .filter((marker) => marker.point_index >= 0 && marker.point_index < end - start);
  return {
    ...options,
    points: points.slice(start, end),
    axisPoints: Array.isArray(options.axisPoints) && options.axisPoints.length ? options.axisPoints.slice(start, end) : null,
    scalePoints: Array.isArray(options.scalePoints) && options.scalePoints.length ? options.scalePoints.slice(start, end) : null,
    tradeMarkers: remapMarkers(options.tradeMarkers || []),
    signals: remapMarkers(options.signals || []),
  };
}

function chartFocusIndex(options, length) {
  const markers = [...(options.tradeMarkers || []), ...(options.signals || [])]
    .map((marker) => Number(marker.point_index))
    .filter((index) => Number.isFinite(index));
  if (markers.length) return clampIndex(markers[markers.length - 1], length);
  return Math.max(0, length - 1);
}

function drawLineChart(canvas, options) {
  if (!canvas) return;
  ensureChartControls(canvas, true);
  let points = (options.points || []).filter((point) => number(point[options.valueKey]) != null);
  options = zoomedChartOptions(canvas, options, points);
  points = options.points;
  const axisPoints = Array.isArray(options.axisPoints) && options.axisPoints.length ? options.axisPoints : points;
  const scalePoints = (Array.isArray(options.scalePoints) && options.scalePoints.length ? options.scalePoints : points).filter(
    (point) => number(point[options.valueKey]) != null,
  );
  const { context, width, height } = setupCanvas(canvas, options.height || 210);
  context.clearRect(0, 0, width, height);
  if (!points.length) {
    ensureChartControls(canvas, false);
    showChartEmpty(canvas, "차트 자료 없음", "표시할 5분봉 데이터가 없습니다.");
    return;
  }
  hideChartEmpty(canvas);

  const padding = chartPadding(options.padding, width, height);
  const values = points.map((point) => number(point[options.valueKey]));
  const scaleValues = scalePoints.map((point) => number(point[options.valueKey])).filter((value) => value != null);
  const extraValues = (options.extraSeries || []).flatMap((series) => scalePoints.map((point) => number(point[series.key]))).filter((value) => value != null);
  const levelValues = (options.levels || []).map((level) => number(level.value)).filter((value) => value != null);
  const markerValues = (options.tradeMarkers || options.signals || [])
    .map((marker) => {
      const pointIndex = clampIndex(marker.point_index, points.length);
      return number(marker.index_value ?? points[pointIndex]?.[options.valueKey]);
    })
    .filter((value) => value != null);
  const allValues = scaleValues.concat(extraValues, levelValues, markerValues).filter((value) => value != null);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const rawSpan = rawMax - rawMin || 1;
  const yMargin = rawSpan * 0.07;
  const min = rawMin - yMargin;
  const max = rawMax + yMargin;
  const span = max - min || 1;
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = Math.max(1, height - padding.top - padding.bottom);
  const xDomainLength = Math.max(axisPoints.length, points.length, 1);
  const xFor = (index) => padding.left + index * (plotWidth / Math.max(xDomainLength - 1, 1));
  const yFor = (value) => height - padding.bottom - ((value - min) / span) * plotHeight;

  drawGrid(context, width, height, padding);
  (options.levels || []).forEach((level) => drawHorizontalLevel(context, width, padding, yFor(number(level.value)), level));
  (options.extraSeries || []).forEach((series) => {
    drawSeries(context, points.map((point) => number(point[series.key])), xFor, yFor, series.color, series.width || 1.5, series.dash || []);
  });
  drawSeries(context, values, xFor, yFor, themeColor("--chart-line", "#e8eef5"), 2.6, []);
  drawLatestPoint(context, points, values, xFor, yFor, options);
  if (options.tradeMarkers?.length) {
    drawTradeMarkers(context, points, xFor, yFor, options);
  } else {
    drawSignalMarkers(context, points, xFor, yFor, options);
  }
  drawAxisLabels(context, width, height, padding, axisPoints, scaleValues.length ? scaleValues : values, options.timeKey);
}

function drawLatestPoint(context, points, values, xFor, yFor, options) {
  const lastIndex = values.length - 1;
  const latest = values[lastIndex];
  if (latest == null) return;
  const x = xFor(lastIndex);
  const y = yFor(latest);
  context.fillStyle = options.marker ? themeColor("--red", "#df7a72") : themeColor("--teal", "#4eb7b1");
  context.beginPath();
  context.arc(x, y, options.marker ? 5 : 4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = themeColor("--chart-line", "#e8eef5");
  context.font = "11px Segoe UI, sans-serif";
  context.textAlign = "right";
  context.fillText(`${points[lastIndex][options.timeKey] || ""} ${formatNum(latest, 2)}`, x, Math.max(13, y - 9));
}

function drawSignalMarkers(context, points, xFor, yFor, options) {
  const signals = options.signals || [];
  const occupied = [];
  signals.forEach((signal, index) => {
    const pointIndex = Math.max(0, Math.min(points.length - 1, Number(signal.point_index ?? 0)));
    const point = points[pointIndex];
    const value = number(signal.index_value ?? point?.[options.valueKey]);
    if (value == null) return;
    const x = xFor(pointIndex);
    const y = yFor(value);
    context.fillStyle = signalClass(signal.type) === "buy"
      ? themeColor("--green", "#5fc79b")
      : signalClass(signal.type) === "sell"
        ? themeColor("--red", "#df7a72")
        : themeColor("--amber", "#d5a04e");
    context.beginPath();
    context.arc(x, y, 4.5, 0, Math.PI * 2);
    context.fill();
    if (index % 2 === 0) {
      drawTradeChip(context, x, y, signal.label || "신호", context.fillStyle, signalClass(signal.type), index, occupied);
    }
  });
}

function drawTradeMarkers(context, points, xFor, yFor, options) {
  const markers = options.tradeMarkers || [];
  const placed = [];
  const labelCandidates = [];
  markers.forEach((marker, index) => {
    const pointIndex = clampIndex(marker.point_index, points.length);
    const point = points[pointIndex];
    const value = number(marker.index_value ?? point?.[options.valueKey]);
    if (value == null) return;

    const x = xFor(pointIndex);
    const y = yFor(value);
    const color = marker.color || TRADE_COLORS[marker.kind] || TRADE_COLORS.watch;
    drawTradeShape(context, x, y, marker.kind, color);
    if (shouldLabelTradeMarker(marker, options)) {
      labelCandidates.push({ marker, x, y, color, index });
    }
  });
  labelCandidates
    .sort((a, b) => a.x - b.x || eventPriority(a.marker.kind) - eventPriority(b.marker.kind))
    .forEach((item) => {
      drawTradeChip(context, item.x, item.y, item.marker.label || tradeLabel(item.marker.kind), item.color, item.marker.kind, item.index, placed);
    });
}

function drawTradeShape(context, x, y, kind, color) {
  context.save();
  context.fillStyle = color;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2;
  context.beginPath();
  if (kind === "entry") {
    context.moveTo(x, y - 9);
    context.lineTo(x + 8, y + 7);
    context.lineTo(x - 8, y + 7);
    context.closePath();
  } else if (kind === "test") {
    context.rect(x - 7, y - 7, 14, 14);
  } else if (kind === "stop") {
    context.moveTo(x, y - 8);
    context.lineTo(x + 8, y);
    context.lineTo(x, y + 8);
    context.lineTo(x - 8, y);
    context.closePath();
  } else if (kind === "mixed") {
    context.moveTo(x - 8, y - 8);
    context.lineTo(x + 8, y + 8);
    context.moveTo(x + 8, y - 8);
    context.lineTo(x - 8, y + 8);
    context.stroke();
    context.restore();
    return;
  } else if (kind === "tp1" || kind === "tp2") {
    context.arc(x, y, 7, 0, Math.PI * 2);
  } else {
    context.rect(x - 6, y - 6, 12, 12);
  }
  context.fill();
  context.stroke();
  context.restore();
}

function drawTradeChip(context, x, y, label, color, kind, index, occupied = []) {
  const rect = context.canvas.getBoundingClientRect();
  const canvasWidth = rect.width || context.canvas.width;
  const canvasHeight = rect.height || context.canvas.height;
  const above = kind !== "stop";
  const text = String(label || "SIGNAL");

  context.save();
  context.font = "bold 11px Segoe UI, sans-serif";
  const width = Math.ceil(context.measureText(text).width) + 14;
  const height = 18;
  let chipX = 4;
  let chipY = 4;
  let placed = false;
  for (let lane = 0; lane < 3; lane += 1) {
    const laneOffset = lane * 18;
    const rawY = above ? y - 34 - laneOffset : y + 15 + laneOffset;
    chipX = Math.max(4, Math.min(canvasWidth - width - 4, x - width / 2));
    chipY = Math.max(4, Math.min(canvasHeight - height - 4, rawY));
    const box = { x: chipX, y: chipY, width, height };
    if (!occupied.some((other) => boxesOverlap(box, other))) {
      occupied.push(box);
      placed = true;
      break;
    }
  }
  if (!placed) {
    context.restore();
    return false;
  }

  fillRoundRect(context, chipX, chipY, width, height, 5, color);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, chipX + width / 2, chipY + height / 2 + 0.5);
  context.restore();
  return true;
}

function fillRoundRect(context, x, y, width, height, radius, color) {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.fill();
}

function drawAxisLabels(context, width, height, padding, points, values, timeKey) {
  context.fillStyle = themeColor("--muted", "#9aa8b8");
  context.font = "10px Segoe UI, sans-serif";
  context.textAlign = "left";
  context.fillText(points[0]?.[timeKey] || "", padding.left, height - 8);
  context.textAlign = "right";
  context.fillText(points[points.length - 1]?.[timeKey] || "", width - padding.right, height - 8);
  context.fillText(formatNum(Math.max(...values), 2), width - padding.right, padding.top - 12);
}

function drawGrid(context, width, height, padding) {
  context.save();
  context.strokeStyle = themeColor("--chart-grid", "rgba(148, 164, 184, 0.2)");
  context.lineWidth = 1;
  for (let index = 0; index < 4; index += 1) {
    const y = padding.top + index * ((height - padding.top - padding.bottom) / 3);
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
  }
  context.restore();
}

function drawHorizontalLevel(context, width, padding, y, level) {
  if (!Number.isFinite(y)) return;
  context.save();
  context.strokeStyle = level.color || themeColor("--muted", "#9aa8b8");
  context.lineWidth = 1;
  context.setLineDash(level.label === "105" ? [4, 4] : []);
  context.beginPath();
  context.moveTo(padding.left, y);
  context.lineTo(width - padding.right, y);
  context.stroke();
  context.fillStyle = level.color || themeColor("--muted", "#9aa8b8");
  context.font = "10px Segoe UI, sans-serif";
  context.textAlign = "right";
  context.fillText(level.label || "", width - 8, Math.max(padding.top - 10, Math.min(y - 3, heightSafeLabelY(context, padding))));
  context.restore();
}

function chartPadding(value = {}, width = 360, height = 240) {
  const compact = width < 380;
  if (typeof value === "number") {
    const size = compact ? Math.min(value, 34) : value;
    return { top: size, right: size, bottom: size, left: size };
  }
  const padding = {
    top: Number(value.top) || 52,
    right: Number(value.right) || 52,
    bottom: Number(value.bottom) || 40,
    left: Number(value.left) || 28,
  };
  if (!compact) return padding;
  return {
    top: Math.min(padding.top, Math.max(38, height * 0.14)),
    right: Math.min(padding.right, 42),
    bottom: Math.min(padding.bottom, 36),
    left: Math.min(padding.left, 24),
  };
}

function heightSafeLabelY(context, padding) {
  const rect = context.canvas.getBoundingClientRect();
  const height = rect.height || context.canvas.height || 210;
  return Math.max(padding.top, height - padding.bottom + 10);
}

function shouldLabelTradeMarker(marker, options) {
  const kind = marker?.kind;
  if (!options.compactTradeLabels) return true;
  return ["entry", "test", "stop", "tp1", "tp2", "mixed"].includes(kind);
}

function boxesOverlap(a, b) {
  return !(
    a.x + a.width + 4 < b.x ||
    b.x + b.width + 4 < a.x ||
    a.y + a.height + 4 < b.y ||
    b.y + b.height + 4 < a.y
  );
}

function drawSeries(context, values, xFor, yFor, color, width, dash) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.setLineDash(dash);
  context.beginPath();
  let started = false;
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      started = false;
      return;
    }
    const x = xFor(index);
    const y = yFor(value);
    if (!started) context.moveTo(x, y);
    else context.lineTo(x, y);
    started = true;
  });
  context.stroke();
  context.restore();
}

function drawEmptyChart(canvas, message, height = 210, detail = "") {
  if (!canvas) return;
  ensureChartControls(canvas, false);
  const { context, width, height: canvasHeight } = setupCanvas(canvas, height);
  context.clearRect(0, 0, width, canvasHeight);
  drawEmpty(context, width, canvasHeight, message);
  showChartEmpty(canvas, message, detail);
}

function drawEmpty(context, width, height, message) {
  context.fillStyle = themeColor("--muted", "#9aa8b8");
  context.font = "14px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.fillText(message, width / 2, height / 2);
}

function showChartEmpty(canvas, title, detail = "") {
  const node = document.querySelector(`#${canvas.id}Empty`);
  if (!node) return;
  node.hidden = false;
  const strong = node.querySelector("strong");
  const span = node.querySelector("span");
  if (strong) strong.textContent = title || "차트 자료 없음";
  if (span) span.textContent = detail || "표시할 데이터가 없습니다.";
}

function hideChartEmpty(canvas) {
  const node = document.querySelector(`#${canvas.id}Empty`);
  if (node) node.hidden = true;
}

function setupCanvas(canvas, height) {
  const frame = canvas.closest(".chart-frame") || canvas.parentElement;
  const rect = canvas.getBoundingClientRect();
  const frameRect = frame?.getBoundingClientRect();
  const viewportWidth = window.visualViewport?.width || document.documentElement.clientWidth || window.innerWidth || 320;
  const frameWidth = frame?.clientWidth || frameRect?.width || canvas.parentElement?.clientWidth || 320;
  const measuredWidth = rect.width || frameWidth;
  const cssWidth = Math.max(1, Math.min(measuredWidth, frameWidth, viewportWidth));
  const measuredHeight = frameRect?.height || rect.height || height;
  const cssHeight = measuredHeight && measuredHeight > 20 ? measuredHeight : height;
  const scale = 1;
  canvas.style.width = `${Math.round(cssWidth)}px`;
  canvas.style.maxWidth = "100%";
  canvas.style.height = `${Math.round(cssHeight)}px`;
  canvas.width = Math.max(1, Math.floor(cssWidth * scale));
  canvas.height = Math.max(1, Math.floor(cssHeight * scale));
  canvas.setAttribute("width", String(Math.round(cssWidth)));
  canvas.setAttribute("height", String(Math.round(cssHeight)));
  const context = canvas.getContext("2d");
  context.setTransform(scale, 0, 0, scale, 0, 0);
  return { context, width: cssWidth, height: cssHeight };
}

function setupChartResizeObserver() {
  if (!("ResizeObserver" in window)) return;
  state.chartResizeObserver?.disconnect();
  state.chartResizeObserver = new ResizeObserver(scheduleChartRedraw);
  document.querySelectorAll(".chart-frame").forEach((frame) => state.chartResizeObserver.observe(frame));
}

function handleViewportChange() {
  updateViewportMetrics();
  scheduleChartRedraw();
}

function updateViewportMetrics() {
  if (state.viewportFrame) window.cancelAnimationFrame(state.viewportFrame);
  state.viewportFrame = window.requestAnimationFrame(() => {
    state.viewportFrame = null;
    const viewport = window.visualViewport;
    const height = Math.max(320, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 640));
    const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    document.documentElement.style.setProperty("--app-viewport-height", `${height}px`);
    document.documentElement.style.setProperty("--app-viewport-top", `${offsetTop}px`);
  });
}

function scheduleChartRedraw() {
  if (state.redrawFrame) window.cancelAnimationFrame(state.redrawFrame);
  state.redrawFrame = window.requestAnimationFrame(() => {
    state.redrawFrame = window.requestAnimationFrame(() => {
      state.redrawFrame = null;
      redrawCharts();
    });
  });
}

function redrawCharts() {
  if (state.activeTab === "options" && isLiveDate()) {
    drawLiveChart();
  }
  if (state.activeTab === "options" && !isLiveDate()) {
    const session = replaySessionForDate(state.selectedDate);
    if (session) drawOptionArchiveChart(session, buildReplayTradePlan(session));
  }
  if (state.activeTab === "etf") drawEtfChart();
  if (state.activeTab === "stocks") drawStocksChart();
  if (state.activeTab === "usStocks") drawUsStocksChart();
  if (state.activeTab === "crypto") drawCryptoChart();
  if (state.activeModal === "replay") {
    const active = activeReplaySession();
    const cursorIndex = replayCursorIndex(active);
    const visibleSession = active ? clipReplaySession(active, cursorIndex) : null;
    drawReplayChart(visibleSession, visibleSession ? buildReplayTradePlan(visibleSession) : null);
  }
}

function averageEntry(entry) {
  const ladder = Array.isArray(entry.order_ladder) ? entry.order_ladder : [];
  const prices = ladder.map((order) => number(order.price)).filter((value) => value != null);
  if (prices.length) return prices.reduce((sum, value) => sum + value, 0) / prices.length;
  return number(entry.strike_selection?.target_premium) || 1.6;
}

function formulaValue(formula, scope) {
  const text = String(formula || "").trim();
  if (!text) return null;
  if (!/^[\w\s.+\-*/()]+$/.test(text)) return null;
  try {
    const keys = Object.keys(scope);
    const values = keys.map((key) => scope[key]);
    return Function(...keys, `"use strict"; return (${text});`)(...values);
  } catch (error) {
    return null;
  }
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value ?? "";
}

function setChecked(selector, checked) {
  const node = document.querySelector(selector);
  if (node) node.checked = Boolean(checked);
}

async function copyText(text, statusSelector, successText) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setText(statusSelector, successText);
  } catch (error) {
    setText(statusSelector, "복사에 실패했습니다. 명령을 길게 눌러 직접 복사하세요.");
  }
}

function signalClass(type) {
  return {
    buy: "buy",
    candidate: "candidate",
    warning: "warning",
    watch: "watch",
    sell: "sell",
    stop: "sell",
    avoid: "avoid",
  }[type] || "neutral";
}

function number(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNum(value, digits = 2) {
  const parsed = number(value);
  if (parsed == null) return "-";
  return parsed.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function themeColor(name, fallback) {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  } catch (error) {
    return fallback;
  }
}

function formatSigned(value, digits = 2) {
  const parsed = number(value);
  if (parsed == null) return "-";
  const sign = parsed > 0 ? "+" : "";
  return `${sign}${formatNum(parsed, digits)}`;
}

function formatWon(value) {
  const parsed = number(value);
  if (parsed == null) return "-";
  return `${parsed.toLocaleString("ko-KR")}원`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

init();
