const MONITOR_POLL_MS = 60000;
const ASSET_ARCHIVE_POLL_MS = 5 * 60000;
const SIGNAL_LOG_KEY = "1monthfinder.options.signalLog";
const SIGNAL_INBOX_READ_KEY = "1monthfinder.signalInbox.readKeys";
const SETTINGS_KEY = "1monthfinder.options.settings";
const WATCHLIST_KEY = "1monthfinder.watchlists";
const COLLECTION_ORDER_KEY = "1monthfinder.collection.order";
const COLLECTION_SORT_KEY = "1monthfinder.collection.sortMode";
const API_CACHE_KEY = "1monthfinder.api.lastGood";
const SIGNAL_ALERT_THROTTLE_MS = 10 * 60000;
const API_TIMEOUT_MS = 12000;
const MONITOR_TIMEOUT_MS = 10000;
const ASSET_ARCHIVE_TIMEOUT_MS = 45000;
const API_RETRY_DELAY_MS = 650;
const ASSET_ARCHIVE_RETRY_COUNT = 2;
const API_CACHE_MAX_AGE_MS = 30 * 60000;
const ASSET_ARCHIVE_CACHE_MAX_AGE_MS = 60 * 60000;
const API_CACHE_RECORD_MAX_CHARS = 1500000;
const ASSET_ARCHIVE_SECTIONS = ["options", "etf", "stocks", "us_stocks", "crypto", "market"];
const MANAGE_FILTERS = ["all", "strong", "watch", "risk"];
const API_FEED_LABELS = {
  "options-monitor": "옵션",
  "asset-archive": "자산",
  "options-replay": "복기",
  "options-signals": "신호함",
};
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
const CRYPTO_DEFAULT_KEYS = ["btc", "eth", "xrp", "xlm", "id", "pokt", "inj"];
const CRYPTO_DETAIL_TABS = [...CRYPTO_DEFAULT_KEYS, "doge", "trx", "sol"];
const CRYPTO_ASSET_META = {
  btc: { name: "비트코인", assetType: "major", typeLabel: "메이저", capPct: 70 },
  eth: { name: "이더리움", assetType: "major", typeLabel: "메이저", capPct: 70 },
  xrp: { name: "엑스알피", assetType: "alt", typeLabel: "알트", capPct: 30 },
  xlm: { name: "스텔라루멘", assetType: "alt", typeLabel: "알트", capPct: 30 },
  id: { name: "스페이스아이디", assetType: "exception", typeLabel: "예외", capPct: 2.5, poolCapPct: 5 },
  pokt: { name: "포켓네트워크", assetType: "exception", typeLabel: "예외", capPct: 2.5, poolCapPct: 5 },
  inj: { name: "인젝티브", assetType: "exception", typeLabel: "예외", capPct: 2.5, poolCapPct: 5 },
  doge: { name: "도지코인", assetType: "exception", typeLabel: "예외", capPct: 2.5, poolCapPct: 5 },
  trx: { name: "트론", assetType: "exception", typeLabel: "예외", capPct: 2.5, poolCapPct: 5 },
  sol: { name: "솔라나", assetType: "exception", typeLabel: "예외", capPct: 2.5, poolCapPct: 5 },
  usdt: { name: "테더", assetType: "cash", typeLabel: "현금성", capPct: null },
};
const CRYPTO_COMPARE_COLORS = [
  ["--chart-line", "#e8eef5"],
  ["--blue", "#82a7e6"],
  ["--amber", "#d5a04e"],
  ["--teal", "#4eb7b1"],
  ["--green", "#5fc79b"],
  ["--red", "#df7a72"],
];
const CRYPTO_SLOT_PCT = {
  none: 0,
  reduced: 15,
  scout: 5,
  starter: 30,
  starterPlus10: 40,
  starterPlus20: 50,
  base: 65,
  basePlus17: 82,
  full: 100,
};
const CRYPTO_PYRAMID_ADD_SLOT_PCT = CRYPTO_SLOT_PCT.full - CRYPTO_SLOT_PCT.base;
const CRYPTO_PYRAMID_MARKET_SLOT_PCT = CRYPTO_PYRAMID_ADD_SLOT_PCT / 2;
const CRYPTO_PYRAMID_VERTICAL_RISE_PCT = 10;
const CRYPTO_PYRAMID_SECOND_RISE_PCT = 20;
const CRYPTO_PYRAMID_PULLBACK_PCT = 77;
const CRYPTO_TENKAN_ALERT_BUFFER_PCT = 10;
const CRYPTO_EXCEPTION_TENKAN_ALERT_BUFFER_PCT = 15;
const CRYPTO_TENKAN_NEAR_PCT = 3;
const CRYPTO_THIRTY_MINUTE_RISK_BARS = 80;
const CRYPTO_INTRADAY_BOX_STOP_BARS = CRYPTO_THIRTY_MINUTE_RISK_BARS;
const CRYPTO_FORCED_REDUCE_DRAWDOWN_PCT = {
  major: 15,
  alt: 20,
  exception: 25,
};
const CRYPTO_FORCED_REDUCE_HARD_MULTIPLIER = 1.1;
const CRYPTO_REENTRY_BOUNCE_PCT = {
  major: 5,
  alt: 7,
  exception: 10,
};
const CRYPTO_REENTRY_HARD_MULTIPLIER = 1.2;
const CRYPTO_REENTRY_LOOKBACK_BARS = 80;
const CRYPTO_LINE_TOUCH_BUFFER_PCT = 1.2;
const CRYPTO_BASE_REBUILD_MARKET_SLOT_PCT = 15;
const CRYPTO_BASE_REBUILD_LIMIT_DISCOUNT_PCT = [2, 7];
const CRYPTO_EXCEPTION_WEEKLY_PROBE_PORTFOLIO_PCT = 1;
const CRYPTO_EXCEPTION_WEEKLY_WIDE_STOP_PCT = 30;
const CRYPTO_EXCEPTION_APPROVAL_DEFAULT_POOL_PCT = 5;
const CRYPTO_EXCEPTION_APPROVAL_RANGE = [6, 7, 8, 9, 10];
const CRYPTO_EXCEPTION_ABSOLUTE_MAX_POOL_PCT = 15;
const DETAIL_ARCHIVE_DAYS = 90;
const SUMMARY_ARCHIVE_DAYS = 365;
const SEARCH_RESULT_LIMIT = 8;
const SIGNAL_BASE_SCORES = {
  buy: 84,
  candidate: 82,
  watch: 58,
  neutral: 50,
  warning: 38,
  sell: 18,
  avoid: 12,
};
const SIGNAL_STATUS_TEXT = {
  buy: "매수 후보",
  candidate: "매수 후보",
  watch: "관찰",
  neutral: "대기",
  warning: "위험 점검",
  sell: "축소/청산",
  avoid: "제외",
};
const SIGNAL_ACTION_TEXT = {
  buy: "분할 진입 가능 구간인지 확인",
  candidate: "조건 충족 시 분할 진입 검토",
  watch: "지지/거래대금 확인 후 유지",
  neutral: "새 신호 대기",
  warning: "비중 축소 또는 신규 진입 보류",
  sell: "손절/청산 기준 우선 확인",
  avoid: "감시에서 제외 검토",
};
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
  dashboardMode: "live",
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
  lastCryptoAlertKey: null,
  signalInboxReadKeys: loadSignalInboxReadKeys(),
  signalInboxFilter: "all",
  signalInboxAlertedKeys: new Set(),
  signalInboxAlertThrottle: new Map(),
  dataFeeds: {},
  apiCache: loadApiCache(),
  assetSectionsLoaded: new Set(),
  assetSectionRequests: new Map(),
  emptyAssetSectionRetries: new Map(),
  lastAssetArchiveRefreshAt: 0,
  audioContext: null,
  serviceWorkerRegistration: null,
  signalLog: loadSignalLog(),
  settings: loadSettings(),
  watchlists: loadWatchlists(),
  collectionOrder: loadCollectionOrder(),
  collectionSortMode: loadCollectionSortMode(),
  manageFilters: { domestic: "all", us: "all", crypto: "all" },
  focusedAssets: { domestic: "", us: "" },
  searchCursor: { domestic: -1, us: -1 },
  wakeLock: null,
  chartResizeObserver: null,
  redrawFrame: null,
  viewportFrame: null,
  chartZoom: {},
};

const modalMeta = {
  signals: { eyebrow: "오늘 신호", title: "작업함" },
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
      assetAlertMode: "all",
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
      assetAlertMode: "all",
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
  const hasCrypto = Object.prototype.hasOwnProperty.call(value || {}, "crypto");
  return {
    domestic: normalizeWatchlist(value.domestic || []),
    us: normalizeWatchlist(value.us || []),
    crypto: normalizeCryptoWatchlist(hasCrypto ? value.crypto : CRYPTO_DEFAULT_KEYS),
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

function normalizeCryptoWatchlist(items = []) {
  const source = Array.isArray(items) ? items : [];
  return source
    .map((item) => {
      const key = normalizeCryptoKey(typeof item === "string" ? item : item.key || item.symbol || item.name);
      if (!key || key === "all" || key === "usdt") return null;
      const meta = CRYPTO_ASSET_META[key] || {};
      return {
        key,
        symbol: String((typeof item === "string" ? item : item.symbol) || key).trim().toUpperCase(),
        name: String((typeof item === "string" ? "" : item.name) || meta.name || key.toUpperCase()).trim(),
        addedAt: (typeof item === "string" ? "" : item.addedAt) || new Date().toISOString(),
      };
    })
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((other) => other.key === item.key) === index)
    .slice(0, 40);
}

function normalizeCryptoKey(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  const symbol = text.split("-")[0].replace(/[^a-z0-9]/g, "");
  if (symbol === "spaceid") return "id";
  return symbol;
}

function saveWatchlists() {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(state.watchlists));
}

function loadCollectionOrder() {
  try {
    const keys = JSON.parse(localStorage.getItem(COLLECTION_ORDER_KEY) || "[]");
    return Array.isArray(keys) ? keys.filter(Boolean).map(String) : [];
  } catch (error) {
    return [];
  }
}

function saveCollectionOrder() {
  state.collectionOrder = (state.collectionOrder || []).filter(Boolean).map(String).slice(0, 300);
  localStorage.setItem(COLLECTION_ORDER_KEY, JSON.stringify(state.collectionOrder));
}

function loadCollectionSortMode() {
  try {
    const value = localStorage.getItem(COLLECTION_SORT_KEY);
    return value === "auto" ? "auto" : "manual";
  } catch (error) {
    return "manual";
  }
}

function saveCollectionSortMode() {
  const mode = state.collectionSortMode === "auto" ? "auto" : "manual";
  state.collectionSortMode = mode;
  localStorage.setItem(COLLECTION_SORT_KEY, mode);
}

function loadApiCache() {
  try {
    const value = JSON.parse(localStorage.getItem(API_CACHE_KEY) || "{}");
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value).filter(([key, record]) => record?.payload && record.persist !== false && shouldPersistApiCache(key, record.payload)),
    );
  } catch (error) {
    return {};
  }
}

function saveApiCache() {
  try {
    const entries = Object.entries(state.apiCache || {})
      .filter(
        ([key, value]) =>
          value?.payload &&
          value.persist !== false &&
          shouldPersistApiCache(key, value.payload) &&
          Date.now() - Number(value.savedAt || 0) < API_CACHE_MAX_AGE_MS * 8,
      )
      .slice(-12);
    localStorage.setItem(API_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (error) {
    try {
      localStorage.removeItem(API_CACHE_KEY);
    } catch (_) {}
  }
}

function shouldPersistApiCache(key, payload) {
  const text = String(key || "");
  if (text.includes("/api/asset-archive") || text.includes("asset-archive")) return false;
  try {
    return JSON.stringify(payload).length <= API_CACHE_RECORD_MAX_CHARS;
  } catch (error) {
    return false;
  }
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

function apiFeedKey(path = "") {
  const text = String(path || "");
  if (text.includes("/api/options-monitor")) return "options-monitor";
  if (isAssetArchivePath(text)) return "asset-archive";
  if (text.includes("/api/options-replay")) return "options-replay";
  if (text.includes("/api/options-signals")) return "options-signals";
  return text.replace(/^.*\/api\//, "").split(/[?#]/)[0] || "data";
}

function isAssetArchivePath(path = "") {
  const text = String(path || "");
  return text.includes("/api/asset-archive") || text.includes("/api/assets/");
}

function apiCacheKey(path = "") {
  const text = String(path || "");
  return text.startsWith("/api/") ? text : apiUrl(text);
}

async function fetchJsonWithTimeout(path, options = {}) {
  const url = apiUrl(path);
  const timeoutMs = Number(options.timeoutMs) || API_TIMEOUT_MS;
  const cacheKey = options.cacheKey || apiCacheKey(path);
  const startedAt = Date.now();
  const retryCount = Math.max(0, Number(options.retryCount) || 0);
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs) || API_RETRY_DELAY_MS);
  let lastError = null;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`${url} 로드 실패 (${response.status})`);
      const payload = await response.json();
      const record = { payload, savedAt: Date.now(), url, persist: shouldPersistApiCache(cacheKey, payload) };
      state.apiCache[cacheKey] = record;
      saveApiCache();
      return {
        ok: true,
        payload,
        source: "live",
        url,
        elapsedMs: Date.now() - startedAt,
        receivedAt: Date.now(),
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error;
    } finally {
      window.clearTimeout(timer);
    }
    if (attempt < retryCount) {
      await delay(retryDelayMs * (attempt + 1));
    }
  }
  const cached = state.apiCache?.[cacheKey];
  const cacheAge = cached ? Date.now() - Number(cached.savedAt || 0) : Infinity;
  if (cached?.payload && cacheAge <= (Number(options.cacheMaxAgeMs) || API_CACHE_MAX_AGE_MS)) {
    return {
      ok: true,
      payload: cached.payload,
      source: "cache",
      stale: true,
      url,
      elapsedMs: Date.now() - startedAt,
      receivedAt: Date.now(),
      cacheAgeMs: cacheAge,
      attempts: retryCount + 1,
      error: lastError?.name === "AbortError" ? "timeout" : String(lastError?.message || lastError),
    };
  }
  return {
    ok: false,
    payload: null,
    source: "error",
    url,
    elapsedMs: Date.now() - startedAt,
    receivedAt: Date.now(),
    attempts: retryCount + 1,
    error: lastError?.name === "AbortError" ? "timeout" : String(lastError?.message || lastError),
  };
}

function delay(ms = 0) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function recordDataFeed(path, result = {}) {
  const key = apiFeedKey(path);
  state.dataFeeds[key] = {
    key,
    label: API_FEED_LABELS[key] || key,
    ok: Boolean(result.ok),
    source: result.source || (result.ok ? "live" : "error"),
    stale: Boolean(result.stale),
    url: result.url || apiUrl(path),
    elapsedMs: result.elapsedMs,
    receivedAt: result.receivedAt || Date.now(),
    cacheAgeMs: result.cacheAgeMs,
    attempts: result.attempts || 1,
    error: result.error || "",
    generatedAt: result.payload?.generated_at || result.payload?.selected_date || "",
  };
  renderDataHealthStrip();
  renderAppUpdatedAt();
}

function renderDataHealthStrip() {
  const root = document.querySelector("#dataHealthStrip");
  if (!root) return;
  const keys = ["options-monitor", "asset-archive", "options-replay", "options-signals"];
  root.innerHTML = keys.map((key) => dataFeedPill(state.dataFeeds[key] || { key, label: API_FEED_LABELS[key] || key })).join("");
}

function dataFeedPill(feed = {}) {
  const info = dataFeedStateInfo(feed);
  const age = feed.receivedAt ? relativeAgeText(feed.receivedAt) : "-";
  return `
    <article class="data-feed-pill ${escapeAttr(info.className)}">
      <span>${escapeHtml(feed.label || feed.key || "데이터")}</span>
      <strong>${escapeHtml(info.status)}</strong>
      <small>${escapeHtml(age)}${escapeHtml(info.detail)}</small>
    </article>
  `;
}

function dataFeedStateInfo(feed = {}) {
  const source = feed.source || "pending";
  const attempts = Number(feed.attempts || 1);
  const retry = attempts > 1 ? ` · 재시도 ${attempts}` : "";
  const error = feed.error ? ` · ${feed.error === "timeout" ? "시간초과" : "연결실패"}` : "";
  if (feed.ok && source === "live") return { className: feed.stale ? "watch" : "candidate", status: "실제", detail: retry };
  if (feed.ok && source === "cache") return { className: "warning", status: "오류", detail: retry || " · 캐시 fallback" };
  if (source === "pending") return { className: "neutral", status: "대기", detail: retry };
  return { className: "warning", status: "오류", detail: error || retry };
}

function relativeAgeText(timestamp) {
  const diff = Math.max(0, Date.now() - Number(timestamp || 0));
  if (diff < 1500) return "방금";
  if (diff < 60000) return `${Math.round(diff / 1000)}초 전`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}분 전`;
  return `${Math.round(diff / 3600000)}시간 전`;
}

function renderAppUpdatedAt() {
  const node = document.querySelector("#appUpdatedAt");
  if (!node) return;
  const generatedAt = [
    state.monitor?.generated_at,
    state.assetArchive?.generated_at,
    ...Object.values(state.dataFeeds || {}).map((feed) => feed.generatedAt),
  ].filter(Boolean).sort().at(-1);
  node.textContent = compactDateTime(generatedAt) || shortDate(kstDateString());
}

function compactDateTime(value) {
  const text = String(value || "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)(\d{2}):(\d{2})/);
  if (match) return `${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return shortDate(text);
  return "";
}

function loadSignalLog() {
  try {
    const log = JSON.parse(localStorage.getItem(SIGNAL_LOG_KEY) || "[]");
    return Array.isArray(log) ? log : [];
  } catch (error) {
    return [];
  }
}

function loadSignalInboxReadKeys() {
  try {
    const keys = JSON.parse(localStorage.getItem(SIGNAL_INBOX_READ_KEY) || "[]");
    return new Set(Array.isArray(keys) ? keys.filter(Boolean) : []);
  } catch (error) {
    return new Set();
  }
}

function saveSignalInboxReadKeys() {
  const keys = [...state.signalInboxReadKeys].slice(-600);
  state.signalInboxReadKeys = new Set(keys);
  localStorage.setItem(SIGNAL_INBOX_READ_KEY, JSON.stringify(keys));
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
  const requestedDate = dateFromQuery();
  state.dashboardMode = requestedDate && requestedDate < kstDateString() ? "replay" : "live";
  state.selectedDate = state.dashboardMode === "replay" ? requestedDate : kstDateString();
  state.activeReplayDate = state.selectedDate === kstDateString() ? null : state.selectedDate;
  resetAssetSectionsLoaded();
  const initialAssetSections = assetSectionsForTab(state.activeTab);

  const [weeklyOptions, replayPayload, publicReplay, signalLogPayload, assetArchive] = await Promise.all([
    loadOptionalJson("data/weekly_options.json"),
    loadOptionalJson("/api/options-replay"),
    loadOptionalJson("data/public_weekly_replay.json"),
    loadOptionalJson("/api/options-signals"),
    loadOptionalJson(assetArchiveRequestPath(state.selectedDate, initialAssetSections)),
  ]);

  state.weeklyOptions = weeklyOptions || fallbackWeeklyOptions;
  state.assetArchive = mergeAssetArchivePayload(fallbackAssetArchive(), assetArchive);
  state.lastAssetArchiveRefreshAt = assetArchive ? Date.now() : 0;
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
  warmAssetArchiveSections();
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
  ensureAssetSectionsForTab(next).catch(() => {});
}

function setCryptoTab(tab) {
  const previous = state.cryptoTab;
  const key = normalizeCryptoKey(tab);
  const validKeys = cryptoSelectableKeys();
  state.cryptoTab = tab === "all" || key === "all" ? "all" : validKeys.includes(key) ? key : "all";
  if (previous === "all" && state.cryptoTab !== "all") state.cryptoFrame = "240m";
  renderCryptoPanel();
  scheduleChartRedraw();
}

function setCryptoFrame(frame) {
  state.cryptoFrame = ["30m", "60m", "240m", "1d", "1w"].includes(frame) ? frame : "240m";
  renderCryptoPanel();
  scheduleChartRedraw();
}

async function toggleDashboardMode() {
  await setDashboardMode(state.dashboardMode === "replay" ? "live" : "replay");
}

async function setDashboardMode(mode) {
  const nextMode = mode === "replay" ? "replay" : "live";
  state.dashboardMode = nextMode;
  const targetDate = nextMode === "replay" ? replayDashboardDate() : kstDateString();
  if (targetDate !== state.selectedDate) {
    await setSelectedDate(targetDate);
    return;
  }
  renderStaticPanels();
  renderMonitor();
}

function replayDashboardDate() {
  const selected = clampDate(state.selectedDate || "");
  if (selected < kstDateString()) return selected;
  return defaultReplayDate();
}

function defaultReplayDate() {
  const today = kstDateString();
  const sessions = Array.isArray(state.replay?.sessions) ? state.replay.sessions : [];
  const candidates = [
    activeReplaySession()?.date,
    state.replay?.active_session?.date,
    state.replay?.active_session_id,
    ...sessions.map((session) => session.date || session.id),
  ]
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")))
    .filter((date) => date < today)
    .sort()
    .reverse();
  return candidates[0] || offsetDate(today, -1);
}

function normalizeAssetSections(sections = ASSET_ARCHIVE_SECTIONS) {
  const list = Array.isArray(sections) ? sections : String(sections || "").split(",");
  const normalized = list
    .map((section) => String(section || "").trim().toLowerCase().replace(/-/g, "_"))
    .filter((section) => ASSET_ARCHIVE_SECTIONS.includes(section));
  return [...new Set(normalized.length ? normalized : ASSET_ARCHIVE_SECTIONS)];
}

function assetSectionsForTab(tab = state.activeTab) {
  if (tab === "crypto") return ["crypto"];
  if (tab === "stocks") return ["stocks", "market"];
  if (tab === "usStocks") return ["us_stocks"];
  if (tab === "etf") return ["etf", "market"];
  if (tab === "options") return ["options", "etf", "market"];
  return ASSET_ARCHIVE_SECTIONS;
}

function assetArchiveRequestPath(date = state.selectedDate, sections = ASSET_ARCHIVE_SECTIONS) {
  const normalized = normalizeAssetSections(sections);
  const query = `date=${encodeURIComponent(date || "")}`;
  if (normalized.length === 1) {
    return `/api/assets/${normalized[0].replace(/_/g, "-")}?${query}`;
  }
  return `/api/asset-archive?${query}&sections=${encodeURIComponent(normalized.join(","))}`;
}

function mergeAssetArchivePayload(current, payload) {
  if (!payload) return current || fallbackAssetArchive();
  const base = current || fallbackAssetArchive();
  const merged = {
    ...base,
    ok: payload.ok ?? base.ok,
    generated_at: payload.generated_at || base.generated_at,
    selected_date: payload.selected_date || base.selected_date,
    policy: payload.policy || base.policy,
  };
  ASSET_ARCHIVE_SECTIONS.forEach((section) => {
    if (payload[section] != null) merged[section] = payload[section];
  });
  markAssetSectionsLoaded(payload);
  return merged;
}

function markAssetSectionsLoaded(payload = {}) {
  const sections = Array.isArray(payload.sections)
    ? payload.sections
    : ASSET_ARCHIVE_SECTIONS.filter((section) => payload[section] != null);
  sections.forEach((section) => {
    const normalized = normalizeAssetSections([section])[0];
    if (normalized) state.assetSectionsLoaded.add(normalized);
  });
}

function resetAssetSectionsLoaded() {
  state.assetSectionsLoaded = new Set();
  state.emptyAssetSectionRetries = new Map();
}

function assetArchiveHasSections(sections = []) {
  return normalizeAssetSections(sections).every((section) => state.assetSectionsLoaded.has(section));
}

async function ensureAssetSectionsForTab(tab = state.activeTab, options = {}) {
  const sections = assetSectionsForTab(tab);
  if (assetArchiveHasSections(sections)) return state.assetArchive;
  return refreshAssetArchive(state.selectedDate, sections, { render: true, ...options });
}

function warmAssetArchiveSections() {
  const missing = ASSET_ARCHIVE_SECTIONS.filter((section) => !state.assetSectionsLoaded.has(section));
  if (!missing.length) return;
  window.setTimeout(async () => {
    for (const section of missing) {
      if (!state.assetSectionsLoaded.has(section)) {
        await refreshAssetArchive(state.selectedDate, [section], { render: false });
      }
    }
    renderAssetTabs();
  }, 500);
}

function retryEmptyAssetSection(section, hasData) {
  const normalized = normalizeAssetSections([section])[0];
  if (!normalized || hasData) return;
  const key = `${state.selectedDate || ""}:${normalized}`;
  const count = Number(state.emptyAssetSectionRetries.get(key) || 0);
  if (count >= 2) return;
  state.emptyAssetSectionRetries.set(key, count + 1);
  window.setTimeout(() => {
    refreshAssetArchive(state.selectedDate, [normalized], { render: state.activeTab === tabForAssetSection(normalized) }).catch(() => {});
  }, 900 + count * 1500);
}

function assetSectionDataState(section, hasData, feed = state.dataFeeds?.["asset-archive"] || {}) {
  const normalized = normalizeAssetSections([section])[0] || section;
  const key = `${state.selectedDate || ""}:${normalized}`;
  const retryCount = Number(state.emptyAssetSectionRetries.get(key) || 0);
  const source = feed.source || "pending";
  if (hasData) {
    if (source === "cache") return { value: "캐시 오류", signal: "warning" };
    if (source === "live") return { value: "실제", signal: "candidate" };
    return { value: "확인됨", signal: "watch" };
  }
  if (retryCount > 0 && retryCount < 2) return { value: `재요청 ${retryCount}/2`, signal: "watch" };
  if (retryCount >= 2) return { value: "데이터 없음", signal: "warning" };
  if (source === "cache") return { value: "캐시 확인", signal: "watch" };
  if (source === "error") return { value: feed.error === "timeout" ? "시간초과" : "연결실패", signal: "warning" };
  return { value: "대기", signal: "neutral" };
}

function tabForAssetSection(section) {
  return { crypto: "crypto", stocks: "stocks", us_stocks: "usStocks", etf: "etf" }[section] || state.activeTab;
}

async function setSelectedDate(date) {
  const next = clampDate(date || kstDateString());
  const requestSeq = state.dateLoadSeq + 1;
  state.dateLoadSeq = requestSeq;
  state.selectedDate = next;
  resetAssetSectionsLoaded();
  const loadingStartedAt = performance.now();
  setDateLoading(true, next);
  try {
    const replayRequest = isLiveDate(next)
      ? Promise.resolve(null)
      : loadOptionalJson(`/api/options-replay?date=${encodeURIComponent(next || "")}`);
    const assetRequest = loadOptionalJson(assetArchiveRequestPath(next, assetSectionsForTab(state.activeTab)));
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
    if (assetPayload) {
      state.assetArchive = mergeAssetArchivePayload(fallbackAssetArchive(), assetPayload);
      state.lastAssetArchiveRefreshAt = Date.now();
    }
    renderStaticPanels();
    renderMonitor();
    warmAssetArchiveSections();
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
  const next = clampDate(current.toISOString().slice(0, 10));
  if (state.dashboardMode === "replay" && next >= kstDateString()) return;
  setSelectedDate(next);
}

async function refreshAssetArchive(date = state.selectedDate, sections = assetSectionsForTab(state.activeTab), options = {}) {
  const normalizedSections = normalizeAssetSections(sections);
  const requestKey = `${date || ""}:${normalizedSections.join(",")}`;
  if (state.assetSectionRequests.has(requestKey)) return state.assetSectionRequests.get(requestKey);
  const request = loadOptionalJson(assetArchiveRequestPath(date, normalizedSections))
    .then((payload) => {
      if (payload) {
        state.assetArchive = mergeAssetArchivePayload(state.assetArchive || fallbackAssetArchive(), payload);
        state.lastAssetArchiveRefreshAt = Date.now();
        if (options.render) renderAssetTabs();
      }
      return payload;
    })
    .finally(() => state.assetSectionRequests.delete(requestKey));
  state.assetSectionRequests.set(requestKey, request);
  return request;
}

async function refreshFullAssetArchive(date = state.selectedDate) {
  const payload = await loadOptionalJson(assetArchiveRequestPath(date, ASSET_ARCHIVE_SECTIONS));
  if (payload) {
    state.assetArchive = mergeAssetArchivePayload(state.assetArchive || fallbackAssetArchive(), payload);
    state.lastAssetArchiveRefreshAt = Date.now();
  }
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
  const result = await fetchJsonWithTimeout(path, {
    timeoutMs: isAssetArchivePath(path) ? ASSET_ARCHIVE_TIMEOUT_MS : API_TIMEOUT_MS,
    retryCount: isAssetArchivePath(path) ? ASSET_ARCHIVE_RETRY_COUNT : 0,
    retryDelayMs: API_RETRY_DELAY_MS,
    cacheMaxAgeMs: isAssetArchivePath(path)
      ? ASSET_ARCHIVE_CACHE_MAX_AGE_MS
      : path.includes("/api/options-replay")
        ? API_CACHE_MAX_AGE_MS * 8
        : API_CACHE_MAX_AGE_MS,
  });
  recordDataFeed(path, result);
  return result.payload;
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
  document.querySelector("#refreshMonitor")?.addEventListener("click", refreshDashboard);
  document.querySelector("#dashboardModeToggle")?.addEventListener("click", () => toggleDashboardMode());
  document.querySelector("#globalDateSelector")?.addEventListener("change", (event) => setSelectedDate(event.target.value || kstDateString()));
  document.querySelector("#dateToday")?.addEventListener("click", () => setDashboardMode("live"));
  document.querySelector("#datePrev")?.addEventListener("click", () => moveSelectedDate(-1));
  document.querySelector("#dateNext")?.addEventListener("click", () => moveSelectedDate(1));
  document.querySelectorAll("[data-tab-target]").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tabTarget));
  });
  document.querySelectorAll("[data-crypto-frame]").forEach((button) => {
    button.addEventListener("click", () => setCryptoFrame(button.dataset.cryptoFrame));
  });
  document.addEventListener("click", (event) => {
    const cryptoTabButton = event.target.closest("[data-crypto-tab]");
    if (cryptoTabButton) {
      setCryptoTab(cryptoTabButton.dataset.cryptoTab);
      return;
    }
    const cryptoAddButton = event.target.closest("[data-crypto-add]");
    if (cryptoAddButton) {
      cryptoAddButton.disabled = true;
      cryptoAddButton.textContent = "추가중";
      if (!addCryptoWatch(cryptoAddButton.dataset.cryptoAdd)) {
        cryptoAddButton.disabled = false;
        cryptoAddButton.textContent = "+ 추가";
      }
      return;
    }
    const cryptoRemoveButton = event.target.closest("[data-crypto-remove]");
    if (cryptoRemoveButton) {
      removeCryptoWatch(cryptoRemoveButton.dataset.cryptoRemove);
      return;
    }
    const manageFilterButton = event.target.closest("[data-manage-filter]");
    if (manageFilterButton) {
      setManageFilter(manageFilterButton.dataset.manageScope, manageFilterButton.dataset.manageFilter);
      return;
    }
    const cryptoFocusCard = event.target.closest("[data-crypto-focus]");
    if (cryptoFocusCard && !event.target.closest("button, summary, .crypto-card-details")) {
      setCryptoTab(cryptoFocusCard.dataset.cryptoFocus);
      return;
    }
    const stockFocusCard = event.target.closest("[data-stock-focus-symbol]");
    if (stockFocusCard && !event.target.closest("button, input, summary, .crypto-card-details")) {
      setStockFocus(stockFocusCard.dataset.stockFocusScope, stockFocusCard.dataset.stockFocusSymbol);
      return;
    }
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
    const signalFilterButton = event.target.closest("[data-signal-filter]");
    if (signalFilterButton) {
      setSignalInboxFilter(signalFilterButton.dataset.signalFilter);
      return;
    }
    const collectionSortButton = event.target.closest("[data-collection-sort]");
    if (collectionSortButton) {
      setCollectionSortMode(collectionSortButton.dataset.collectionSort);
      return;
    }
    const collectionMoveButton = event.target.closest("[data-collection-move]");
    if (collectionMoveButton) {
      moveCollectionItem(collectionMoveButton.dataset.collectionKey, Number(collectionMoveButton.dataset.collectionMove) || 0);
      return;
    }
    const collectionPinButton = event.target.closest("[data-collection-pin]");
    if (collectionPinButton) {
      pinCollectionItem(collectionPinButton.dataset.collectionKey);
      return;
    }
    const quickTabButton = event.target.closest("[data-quick-tab]");
    if (quickTabButton) {
      setActiveTab(quickTabButton.dataset.quickTab);
      return;
    }
    const card = event.target.closest("[data-jump-tab]");
    if (card && !event.target.closest("button, input")) jumpToCardTarget(card);
  });
  document.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    if (event.target.closest("button, input")) return;
    const card = event.target.closest("[data-jump-tab]");
    if (!card) return;
    event.preventDefault();
    jumpToCardTarget(card);
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
  document.querySelector("#assetAlertMode")?.addEventListener("change", (event) => {
    state.settings.assetAlertMode = event.target.value;
    saveSettings();
    renderSettings();
  });
  document.querySelector("#clearSignalLog")?.addEventListener("click", clearSignalLog);
  document.querySelector("#markSignalsRead")?.addEventListener("click", markAllSignalInboxRead);
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
    const result = await fetchJsonWithTimeout("/api/options-monitor", {
      timeoutMs: MONITOR_TIMEOUT_MS,
      cacheMaxAgeMs: API_CACHE_MAX_AGE_MS,
    });
    recordDataFeed("/api/options-monitor", result);
    if (!result.payload) throw new Error(result.error || "옵션 감시 API 응답 없음");
    const snapshot = result.source === "cache"
      ? {
        ...result.payload,
        ok: false,
        cached: true,
        signal: {
          ...(result.payload.signal || result.payload.main?.signal || {}),
          type: "avoid",
          label: "캐시",
          title: "최근 정상 데이터",
          message: `실시간 옵션 API가 응답하지 않아 ${relativeAgeText(Date.now() - (result.cacheAgeMs || 0))} 데이터를 임시 표시합니다.`,
          rule: "LOCAL_API_CACHE_ERROR",
          reliability: "error",
          label: "캐시 오류",
          title: "실시간 API 오류",
          message: `실시간 옵션 API가 응답하지 않아 ${relativeAgeText(Date.now() - (result.cacheAgeMs || 0))} 캐시 데이터는 오류 신호로만 표시합니다.`,
          metrics: { ...((result.payload.signal || {}).metrics || {}), age_minutes: Math.round((result.cacheAgeMs || 0) / 60000) },
        },
      }
      : result.payload;
    state.monitor = snapshot;
    renderMonitor();
    maybeBackfillSignalLog(snapshot);
    if (!snapshot.cached) {
      maybeRecordSignal(snapshot);
      maybeFireAlert(snapshot);
      await maybeRefreshLiveAssetArchive();
      maybeFireCryptoAlerts();
      maybeFireSignalInboxAlerts();
    }
  } catch (error) {
    state.monitor = {
      ok: false,
      signal: {
        type: "avoid",
        label: "연결 실패",
        title: "로컬 서버 연결 실패",
        message: "옵션 감시 API를 읽지 못했습니다. 서버 실행 상태를 확인하세요.",
        rule: "LOCAL_API_FAILED",
        reliability: "error",
        label: "연결 오류",
        title: "로컬 서버 연결 실패",
        message: "옵션 감시 API를 읽지 못했습니다. 서버 실행 상태를 확인하기 전까지 신호를 사용하지 않습니다.",
        time: "-",
        metrics: {},
      },
      main: { candles: [], latest: null, levels: {} },
      secondary: { latest: null },
    };
    recordDataFeed("/api/options-monitor", {
      ok: false,
      source: "error",
      elapsedMs: 0,
      receivedAt: Date.now(),
      error: String(error?.message || error),
    });
    renderMonitor();
  }
}

async function refreshDashboard() {
  if (state.dashboardMode === "replay") {
    await setSelectedDate(state.selectedDate);
    return;
  }
  await loadMonitor(true);
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
    board.className = `${signalBoardClass(signalType)} option-live-board`;
  }
  setText("#signalBadge", signal.label || "대기");
  document.querySelector("#signalBadge").className = `signal-pill ${signalType}`;
  setText("#signalTitle", signal.title || signal.label || "신호 대기");
  setText("#signalMessage", signal.message || "KOSPI200 5분봉 데이터를 기다리고 있습니다.");
  setText("#latestCandleTime", `최신봉 ${latest.time || "-"}`);
  setText("#delayText", Number.isFinite(age) ? `지연 ${age}분` : "지연 -");
  const livePlan = buildLiveTradePlan(snapshot);
  renderBoardDecision("#signalBoard", {
    scope: "options",
    signal: signalType,
    signalScore: commonSignalScore({ signal: signalType, score: signal.score, momentum: signal.metrics?.momentum }),
    detail: signal.message || livePlan.status || "KOSPI200 5분봉 신호 대기",
    actionText: optionActionText(signal, livePlan),
  });
  renderTopStatus();
  renderPriceGrid(latest, secondaryLatest, levels);
  renderLiveLegend(levels);
  renderOptionSignalCard(snapshot, livePlan);
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
    const label = summary.label || "코인 감시";
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

function renderOptionSignalCard(snapshot = state.monitor || {}, livePlan = null) {
  const root = document.querySelector("#optionSignalList");
  if (!root) return;
  const signal = snapshot.signal || snapshot.main?.signal || {};
  const latest = snapshot.main?.latest || {};
  const levels = snapshot.main?.levels || {};
  const secondaryLatest = snapshot.secondary?.latest || {};
  const className = signalClass(signal.type || livePlan?.tone || "neutral");
  const score = commonSignalScore({
    signal: className,
    score: signal.score,
    momentum: signal.metrics?.momentum,
    riskAlert: className === "warning",
  });
  const decision = signalDecisionSummary({
    scope: "options",
    signal: className,
    signalScore: score,
    badge: signal.label || "대기",
    detail: signal.message || livePlan?.status || "KOSPI200 5분봉 데이터를 기다립니다.",
    actionText: optionActionText(signal, livePlan, score),
  });
  const items = [
    { label: "KOSPI200", value: formatNum(latest.close, 2), text: latest.time || "-" },
    { label: "KODEX200", value: formatNum(secondaryLatest.close, 0), text: "보조" },
    { label: "61.8%", value: formatNum(levels.fib_618, 2), text: "기준" },
    { label: "계획진입", value: formatNum(livePlan?.entry, 2), text: livePlan?.status || "-" },
    { label: "손절", value: livePlan?.stopText || formatNum(livePlan?.stop, 2), text: livePlan?.stopLabel || "계획" },
  ];
  root.innerHTML = optionDecisionCard({
    className,
    title: signal.title || signal.label || "옵션 신호",
    badge: signal.label || "대기",
    score,
    summary: signal.message || "KOSPI200 5분봉 신호를 카드 기준으로 확인합니다.",
    decision,
    items,
  });
}

function optionActionText(signal = {}, livePlan = null, score = 0) {
  const type = signalClass(signal.type || livePlan?.tone || "watch");
  if (livePlan?.status && type === "candidate") return `${livePlan.status} · 분할 진입 조건 확인`;
  if (livePlan?.status && type === "sell") return `${livePlan.status} · 청산 기준 우선`;
  if (type === "warning") return "데이터/기준선 지연 또는 위험 먼저 확인";
  if (score >= 72) return "5분봉 지지 확인 후 실행 판단";
  return signalActionText(type, score, "options");
}

function optionDecisionCard({ className = "watch", title = "신호", badge = "관찰", score = 0, summary = "", decision = {}, items = [] } = {}) {
  const normalized = signalClass(className);
  return `
    <article class="crypto-signal-card option-signal-card ${escapeAttr(normalized)}">
      <header>
        <h2>${escapeHtml(title)}</h2>
        <span class="signal-pill ${escapeAttr(normalized)}">${escapeHtml(badge)}</span>
        ${scoreBadgeHtml(score, normalized)}
      </header>
      <details class="crypto-card-details">
        <summary>상세 조건 보기</summary>
        <div class="crypto-detail-section">
          <strong>핵심 판단</strong>
          <p class="crypto-card-summary">${escapeHtml(summary || "신호 조건을 확인합니다.")}</p>
          ${decisionDetailHtml(decision)}
        </div>
        <div class="crypto-detail-section">
          <strong>지표</strong>
          <div class="crypto-signal-grid">
            ${cryptoSignalGridItems(items)}
          </div>
        </div>
      </details>
    </article>
  `;
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

function renderCryptoLegend(entries = []) {
  const root = document.querySelector("#cryptoLegend");
  if (!root) return;
  const items = Array.isArray(entries) ? entries.filter((item) => item?.label) : [];
  const visible = items.slice(0, 4);
  const hidden = items.slice(4);
  root.classList.toggle("is-collapsible", hidden.length > 0);
  root.innerHTML = [
    ...visible.map(legendItem),
    hidden.length
      ? `<details class="legend-more"><summary>+${hidden.length}</summary><div>${hidden.map(legendItem).join("")}</div></details>`
      : "",
  ].join("");
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
  const visibleLog = signalLogForDisplayDate();
  setText("#logCount", `${visibleLog.length}개`);
  const root = document.querySelector("#signalLog");
  if (!root) return;
  if (!visibleLog.length) {
    root.innerHTML = `<article class="empty-log">당일 옵션 신호가 발생하면 여기에 최근 기록이 쌓입니다.</article>`;
    return;
  }
  root.innerHTML = visibleLog
    .slice()
    .sort((a, b) => signalPriorityRank(a) - signalPriorityRank(b) || signalLogTimestamp(b) - signalLogTimestamp(a))
    .map(optionLogCard)
    .join("");
}

function optionLogCard(item = {}) {
  const signal = signalClass(item.type || "watch");
  const score = commonSignalScore({ signal });
  const tp1GainText = item.trade?.tp1Gain != null ? `(+${formatNum(item.trade.tp1Gain, 2)})` : "";
  const runnerText = item.trade?.runnerTargetText || item.trade?.tp2Text || "";
  const tradeText = item.trade
    ? `진입 ${formatNum(item.trade.entry, 2)} · ${item.trade.stopText || `손절 ${formatNum(item.trade.stop, 2)}`} · 1차 익절 ${formatNum(item.trade.tp1, 2)}${tp1GainText}${runnerText ? ` · ${runnerText}` : ""}`
    : item.message;
  const decision = signalDecisionSummary({
    scope: "options",
    signal,
    signalScore: score,
    badge: item.title || "신호",
    detail: tradeText || item.message || item.title,
    actionText: optionLogActionText(item, signal),
  });
  const items = [
    { label: "시각", value: item.time || "-", text: signalLogDate(item) || "당일" },
    { label: "지수", value: formatNum(item.close, 2), text: "KOSPI200" },
    { label: "진입", value: formatNum(item.trade?.entry, 2), text: item.trade?.status || "-" },
    { label: "손절", value: item.trade?.stopText || formatNum(item.trade?.stop, 2), text: "계획" },
  ];
  return `
    <article class="crypto-signal-card option-log-card ${escapeAttr(signal)}">
      <header>
        <h2>${escapeHtml(item.trade?.status || item.title || "옵션 신호")}</h2>
        <span class="signal-pill ${escapeAttr(signal)}">${escapeHtml(item.title || "신호")}</span>
        ${scoreBadgeHtml(score, signal)}
      </header>
      <details class="crypto-card-details">
        <summary>상세 조건 보기</summary>
        <div class="crypto-detail-section">
          <strong>핵심 판단</strong>
          <p class="crypto-card-summary">${escapeHtml(tradeText || "당일 옵션 신호입니다.")}</p>
          ${decisionDetailHtml(decision)}
        </div>
        <div class="crypto-detail-section">
          <strong>지표</strong>
          <div class="crypto-signal-grid">
            ${cryptoSignalGridItems(items)}
          </div>
        </div>
      </details>
    </article>
  `;
}

function optionLogActionText(item = {}, signal = "watch") {
  if (item.trade?.status) return `${item.trade.status} 기준 재확인`;
  return signalActionText(signal, commonSignalScore({ signal }), "options");
}

function signalLogForDisplayDate() {
  const targetDate = isLiveDate() ? kstDateString() : clampDate(state.selectedDate);
  return state.signalLog.filter((item) => signalLogDate(item) === targetDate);
}

function signalLogDate(item = {}) {
  const explicitDate = String(item.date || "").match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (explicitDate) return explicitDate;
  const sourceText = String(item.sourceAt || item.datetime || "");
  const sourceDate = sourceText.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (sourceDate) return sourceDate;
  const parsed = Date.parse(sourceText || item.createdAt || "");
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
  const replayMode = state.dashboardMode === "replay";
  const todayText = kstDateString();
  const maxReplayDate = offsetDate(todayText, -1);
  const selected = replayMode
    ? (clampDate(state.selectedDate || maxReplayDate) >= todayText ? maxReplayDate : clampDate(state.selectedDate || maxReplayDate))
    : todayText;
  state.selectedDate = selected;
  document.querySelector(".app-shell")?.classList.toggle("replay-dashboard", replayMode);
  document.querySelector(".app-shell")?.classList.toggle("live-dashboard", !replayMode);
  const toolbar = document.querySelector(".date-toolbar");
  if (toolbar) toolbar.hidden = !replayMode;
  const toggle = document.querySelector("#dashboardModeToggle");
  if (toggle) {
    toggle.textContent = replayMode ? "실시간" : "과거 확인";
    toggle.setAttribute("aria-pressed", replayMode ? "true" : "false");
    toggle.title = replayMode ? "실시간 대시보드로 돌아가기" : "과거 확인 대시보드 열기";
    toggle.className = `mode-toggle signal-pill ${replayMode ? "candidate" : "watch"}`;
  }
  const input = document.querySelector("#globalDateSelector");
  if (input) {
    input.value = selected;
    input.min = offsetDate(kstDateString(), -SUMMARY_ARCHIVE_DAYS);
    input.max = replayMode ? maxReplayDate : todayText;
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
  if (today) {
    today.disabled = inputDisabled;
    today.textContent = replayMode ? "실시간" : "오늘";
  }
  if (next) next.disabled = inputDisabled || selected >= (replayMode ? maxReplayDate : todayText);
}

function renderAssetTabs() {
  renderNavigation();
  renderDateToolbar();
  renderDataHealthStrip();
  renderTopStatus();
  renderCollectionPanel();
  renderAlgorithmAuditPanel();
  renderOptionsPanel();
  renderEtfPanel();
  renderStocksPanel();
  renderUsStocksPanel();
  renderCryptoPanel();
  renderSignalInbox();
  scheduleChartRedraw();
}

function renderCollectionPanel() {
  const archive = state.assetArchive || fallbackAssetArchive();
  const items = collectionWatchItems(archive);
  const urgentCount = items.filter(signalNeedsAttention).length;
  const actionCount = items.filter((item) => ["action", "risk", "weak"].includes(collectionTaskBucket(item).key)).length;
  const board = document.querySelector("#collectionBoard");
  const boardSignal = urgentCount ? "watch" : "neutral";
  if (board) board.className = signalBoardClass(boardSignal);
  setText("#collectionBadge", items.length ? `${items.length}개 감시` : "감시 없음");
  const badge = document.querySelector("#collectionBadge");
  if (badge) badge.className = `signal-pill ${urgentCount ? "watch" : "neutral"}`;
  setText("#collectionDateText", `${state.selectedDate} · ${isLiveDate() ? "실시간" : "복기"}`);
  setText("#collectionMessage", items.length
    ? `직접 감시 중인 카드만 표시합니다. 오늘 할 일 ${actionCount}개 · ${state.collectionSortMode === "auto" ? "자동 정렬" : "수동 순서"}`
    : "국장·미장·코인 화면에서 감시 항목을 추가하면 이곳에 카드로 표시됩니다.");
  renderBoardDecision("#collectionBoard", {
    scope: "collection",
    signal: urgentCount ? "watch" : "neutral",
    signalScore: items.length ? Math.round(items.reduce((sum, item) => sum + commonSignalScore(item), 0) / items.length) : 0,
    detail: items.length ? `처리 필요 ${actionCount}개 · 감시 ${items.length}개` : "감시 항목을 먼저 추가하세요.",
    actionText: actionCount ? "작업함과 각 카드의 다음 행동 확인" : "후보 화면에서 감시 추가",
  });
  renderCollectionSortControls();
  renderTodayFocusGrid(items);
  const root = document.querySelector("#collectionWatchGrid");
  if (!root) return;
  root.innerHTML = items.length
    ? items.map((item, index) => collectionCard(item, { index, total: items.length })).join("")
    : collectionCard({
      kind: "선택 감시",
      title: "감시 카드 없음",
      signal: "neutral",
      badge: "대기",
      value: "추가 필요",
      detail: "국장·미장·코인 화면에서 감시 항목을 추가하세요.",
      jumpTab: "stocks",
      emptyActions: true,
    });
}

function renderTodayFocusGrid(items = []) {
  const root = document.querySelector("#todayFocusGrid");
  if (!root) return;
  const topItems = autoSortedCollectionItems(items).slice(0, 3);
  root.innerHTML = topItems.length
    ? topItems.map(todayFocusCard).join("")
    : `<article class="today-focus-card neutral"><span>오늘 핵심</span><strong>대기</strong><small>감시 항목을 추가하면 우선순위 3개가 표시됩니다.</small></article>`;
}

function todayFocusCard(item = {}) {
  const signal = signalClass(item.signal || "watch");
  const decision = signalDecisionSummary(item);
  const cryptoAttr = item.jumpCrypto ? ` data-jump-crypto="${escapeAttr(item.jumpCrypto)}"` : "";
  const focusAttr = item.focusKey ? ` data-jump-focus="${escapeAttr(item.focusKey)}"` : "";
  return `
    <article class="today-focus-card ${escapeAttr(signal)}" role="button" tabindex="0" data-jump-tab="${escapeAttr(item.jumpTab || "")}"${cryptoAttr}${focusAttr}>
      <span>${escapeHtml(item.kind || "핵심")} · ${escapeHtml(item.badge || decision.status)}</span>
      <strong>${escapeHtml(item.title || "-")}</strong>
      <small>${escapeHtml(decision.action)}</small>
    </article>
  `;
}

function renderAlgorithmAuditPanel() {
  const root = document.querySelector("#algorithmAuditPanel");
  if (!root) return;
  const auditItems = algorithmAuditItems();
  const averageScore = auditItems.length
    ? Math.round(auditItems.reduce((sum, item) => sum + item.score, 0) / auditItems.length)
    : 0;
  const weakCount = auditItems.filter((item) => item.signal === "warning" || item.score < 50).length;
  const liveFeeds = Object.values(state.dataFeeds || {}).filter((feed) => feed.ok && feed.source === "live").length;
  setText("#algorithmAuditStatus", auditItems.length ? `${averageScore}점 · 점검 ${weakCount}개` : "대기");
  const grid = document.querySelector("#algorithmAuditGrid");
  if (grid) {
    grid.innerHTML = [
      { label: "검증점수", value: `${averageScore || "-"}점`, text: weakCount ? `개선 ${weakCount}개` : "정상" },
      { label: "실제 API", value: `${liveFeeds}개`, text: "실시간 응답" },
      { label: "캐시/오류", value: `${Object.values(state.dataFeeds || {}).filter((feed) => feed.source === "cache" || !feed.ok).length}개`, text: "상태 표시" },
      { label: "감시카드", value: `${collectionWatchItems().length}개`, text: state.collectionSortMode === "auto" ? "자동 정렬" : "수동 정렬" },
    ].map(metricCard).join("");
  }
  const list = document.querySelector("#algorithmAuditList");
  if (list) {
    list.innerHTML = auditItems.map(algorithmAuditCard).join("");
  }
}

function algorithmAuditItems() {
  const archive = state.assetArchive || fallbackAssetArchive();
  const replaySessions = Array.isArray(state.replay?.sessions) ? state.replay.sessions.slice(0, 12) : [];
  const optionStats = replaySessions.map((session) => buildReplayTradePlan(session).stats || {});
  const optionEntries = optionStats.reduce((sum, stats) => sum + (Number(stats.entries) || 0), 0);
  const optionStops = optionStats.reduce((sum, stats) => sum + (Number(stats.stops) || 0), 0);
  const optionNet = optionStats.reduce((sum, stats) => sum + (Number(stats.netProfit) || 0), 0);
  const optionScore = clampScore(58 + Math.min(optionEntries, 20) * 1.3 + Math.max(-18, Math.min(18, optionNet * 0.25)) - optionStops * 2.5);

  const stocks = archive.stocks || {};
  const shortTerm = stocks.short_term || {};
  const swing = stocks.swing || {};
  const stockCount = (shortTerm.top || []).length + (swing.top || []).length;
  const stockBacktest = shortTerm.backtest || {};
  const stockWinRate = number(stockBacktest.win_rate ?? stockBacktest.winRate ?? stockBacktest.avg_win_rate);
  const stockScore = clampScore(50 + stockCount * 5 + (stockWinRate != null ? (stockWinRate > 1 ? stockWinRate : stockWinRate * 100) * 0.22 : 0));

  const crypto = archive.crypto || {};
  const cryptoPlans = [
    ...cryptoVisibleAssets(crypto.assets || []).map((asset) => cryptoPlanForAsset(asset, crypto)),
    ...cryptoVisibleAssets(crypto.exception_assets || []).map((asset) => cryptoPlanForAsset(asset, crypto)),
  ];
  const cryptoScores = cryptoPlans.map(cryptoQualityScore);
  const cryptoScore = cryptoScores.length
    ? Math.round(cryptoScores.reduce((sum, score) => sum + score, 0) / cryptoScores.length)
    : 0;
  const cryptoRisk = cryptoPlans.filter((plan) => ["warning", "sell", "avoid"].includes(signalClass(plan.className))).length;

  const feedItems = Object.values(state.dataFeeds || {});
  const feedScore = clampScore(30 + feedItems.filter((feed) => feed.ok && feed.source === "live").length * 18 - feedItems.filter((feed) => !feed.ok).length * 16 - feedItems.filter((feed) => feed.source === "cache").length * 7);
  const proof = signalProofSummary();

  return [
    {
      title: "데이터 수신",
      signal: feedScore >= 70 ? "candidate" : feedScore >= 50 ? "watch" : "warning",
      score: feedScore,
      status: feedItems.length ? "출처 추적" : "수신 대기",
      reason: feedItems.length ? `${feedItems.filter((feed) => feed.source === "live").length}개 실제 · ${feedItems.filter((feed) => feed.source === "cache").length}개 캐시` : "아직 API 응답 없음",
      action: feedScore >= 50 ? "상단 데이터 상태만 확인" : "서버 실행/포트 확인",
    },
    {
      title: "옵션 알고리즘",
      signal: optionScore >= 70 ? "candidate" : optionScore >= 50 ? "watch" : "warning",
      score: optionScore,
      status: `${replaySessions.length}일 표본`,
      reason: `진입 ${optionEntries}회 · 손절 ${optionStops}회 · 순손익 ${formatNum(optionNet, 2)}`,
      action: optionStops ? "손절 구간 재점검" : "실시간 신호 유지",
    },
    {
      title: "신호 성과 로그",
      signal: proof.score >= 70 ? "candidate" : proof.score >= 50 ? "watch" : "warning",
      score: proof.score,
      status: `${proof.count}개 기록`,
      reason: proof.reason,
      action: proof.action,
    },
    {
      title: "국장 알고리즘",
      signal: stockScore >= 70 ? "candidate" : stockScore >= 50 ? "watch" : "warning",
      score: stockScore,
      status: `${stockCount}개 후보`,
      reason: `1일 ${formatNum(shortTerm.candidate_count, 0)} · 1달 ${formatNum(swing.candidate_count, 0)} · 지수 ${stocks.index_filter?.label || "대기"}`,
      action: stockCount ? "후보 카드에서 차트 확인" : "거래대금/지수 필터 대기",
    },
    {
      title: "코인 알고리즘",
      signal: cryptoScore >= 70 ? "candidate" : cryptoRisk ? "warning" : "watch",
      score: cryptoScore,
      status: `${cryptoPlans.length}개 감시`,
      reason: `평균 ${cryptoScore || "-"}점 · 위험 ${cryptoRisk}개 · 좋은 신호순 후보 정렬`,
      action: cryptoRisk ? "비중/손절 먼저 확인" : "차트 기준선 확인",
    },
  ];
}

function signalProofSummary() {
  const entries = Array.isArray(state.signalLog) ? state.signalLog : [];
  const dated = entries.filter((item) => signalLogDate(item));
  const recent = dated.slice(0, 30);
  const actionable = recent.filter((item) => ["entry", "buy", "candidate", "risk", "stop", "take_profit", "watch"].includes(signalClass(item.type || item.signal || item.kind)));
  const backendCount = recent.filter((item) => String(item.source || "").includes("backend")).length;
  const score = clampScore(42 + Math.min(recent.length, 20) * 2 + Math.min(backendCount, 10) * 2);
  return {
    count: recent.length,
    score,
    reason: recent.length ? `최근 ${recent.length}개 · 서버 계산 ${backendCount}개 · 실행형 ${actionable.length}개` : "아직 누적 신호가 적습니다.",
    action: recent.length >= 10 ? "1/3/7일 결과율 추적 준비" : "신호를 더 누적해 검증 표본 확보",
  };
}

function algorithmAuditCard(item = {}) {
  const signal = signalClass(item.signal || "watch");
  return `
    <article class="algorithm-audit-card ${escapeAttr(signal)}">
      <div>
        <strong>${escapeHtml(item.title || "검증")}</strong>
        <small>${escapeHtml(item.status || "대기")} · ${escapeHtml(item.reason || "조건 확인")}</small>
        <small class="next-action">${escapeHtml(item.action || "재점검")}</small>
      </div>
      ${scoreBadgeHtml(item.score || 0, signal)}
    </article>
  `;
}

function signalNeedsAttention(item = {}) {
  const signal = signalClass(item.signal || item.className || item.type || "watch");
  if (["candidate", "buy", "warning", "sell", "avoid"].includes(signal)) return true;
  return commonSignalScore(item) >= 72;
}

function renderCollectionSortControls() {
  document.querySelectorAll("[data-collection-sort]").forEach((button) => {
    const active = button.dataset.collectionSort === state.collectionSortMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setCollectionSortMode(mode = "manual") {
  state.collectionSortMode = mode === "auto" ? "auto" : "manual";
  saveCollectionSortMode();
  renderCollectionPanel();
}

function collectionWatchItems(archive = state.assetArchive || fallbackAssetArchive()) {
  const crypto = archive.crypto || {};
  const normalAssets = cryptoVisibleAssets(crypto.assets || []);
  const exceptionAssets = cryptoVisibleAssets(crypto.exception_assets || []);
  const stockItems = [
    ...watchItemsForScope("domestic"),
    ...watchItemsForScope("us"),
  ].map((item) => ({
    ...item,
    collectionKey: collectionItemKey(item.scope, item.symbol),
    focusKey: collectionItemKey(item.scope, item.symbol),
  }));
  const cryptoItems = [
    ...normalAssets.map((asset) => collectionCryptoWatchItem(asset, normalAssets)),
    ...exceptionAssets.map((asset) => collectionCryptoWatchItem(asset, normalAssets, { exceptionMode: true })),
  ].filter(Boolean);
  return orderedCollectionItems([...stockItems, ...cryptoItems]);
}

function collectionCryptoWatchItem(asset, assets = [], options = {}) {
  const signal = cryptoSignalPlan(asset, assets, options);
  const signalScore = cryptoQualityScore(signal);
  return {
    scope: "crypto",
    kind: "코인",
    title: signal.name || cryptoAssetName(asset),
    symbol: signal.key,
    signal: signal.className || "watch",
    badge: signal.label || "관찰",
    signalScore,
    statusLabel: signalStatusText(signal.className || "watch", signalScore),
    actionText: signalActionText(signal.className || "watch", signalScore, "crypto"),
    value: signal.portfolioText || formatNum(signal.close, priceDigits(signal.close)),
    detail: signal.message || signal.thirtySubText || "코인 운용 신호",
    jumpTab: "crypto",
    jumpCrypto: signal.key,
    collectionKey: collectionItemKey("crypto", signal.key),
    focusKey: collectionItemKey("crypto", signal.key),
    metrics: [
      { label: "점수", value: `${signalScore}점` },
      { label: "현재가", value: formatNum(signal.close, priceDigits(signal.close)) },
      { label: "비중", value: signal.portfolioText },
      { label: "손절", value: signal.stopText },
    ],
  };
}

function orderedCollectionItems(items = []) {
  if (state.collectionSortMode === "auto") return autoSortedCollectionItems(items);
  const order = state.collectionOrder || [];
  const orderIndex = new Map(order.map((key, index) => [key, index]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aOrder = orderIndex.has(a.item.collectionKey) ? orderIndex.get(a.item.collectionKey) : Number.MAX_SAFE_INTEGER;
      const bOrder = orderIndex.has(b.item.collectionKey) ? orderIndex.get(b.item.collectionKey) : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.index - b.index;
    })
    .map(({ item }) => item);
}

function autoSortedCollectionItems(items = []) {
  return items
    .map((item, index) => ({ item, index, bucket: collectionTaskBucket(item) }))
    .sort((a, b) => {
      if (a.bucket.order !== b.bucket.order) return a.bucket.order - b.bucket.order;
      const scoreDiff = commonSignalScore(b.item) - commonSignalScore(a.item);
      if (scoreDiff) return scoreDiff;
      const scopeDiff = signalInboxScopeOrder(a.item.jumpTab) - signalInboxScopeOrder(b.item.jumpTab);
      if (scopeDiff) return scopeDiff;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function collectionTaskBucket(item = {}) {
  const signal = signalClass(item.signal || "watch");
  const score = commonSignalScore(item);
  if (["warning", "sell", "avoid"].includes(signal)) return { key: "risk", label: "위험", order: 1 };
  if (["candidate", "buy"].includes(signal) || score >= 72) return { key: "action", label: "진입", order: 2 };
  if (score <= 45) return { key: "weak", label: "약화", order: 3 };
  return { key: "watch", label: "관찰", order: 4 };
}

function moveCollectionItem(key, delta) {
  if (!key || !delta) return;
  const items = collectionWatchItems();
  const visibleKeys = items.map((item) => item.collectionKey).filter(Boolean);
  const index = visibleKeys.indexOf(key);
  const nextIndex = index + delta;
  if (index < 0 || nextIndex < 0 || nextIndex >= visibleKeys.length) return;
  const nextKeys = [...visibleKeys];
  [nextKeys[index], nextKeys[nextIndex]] = [nextKeys[nextIndex], nextKeys[index]];
  const visibleSet = new Set(nextKeys);
  state.collectionOrder = [
    ...nextKeys,
    ...(state.collectionOrder || []).filter((entry) => !visibleSet.has(entry)),
  ];
  saveCollectionOrder();
  renderCollectionPanel();
}

function pinCollectionItem(key) {
  if (!key) return;
  const items = collectionWatchItems();
  if (!items.some((item) => item.collectionKey === key)) return;
  state.collectionOrder = [key, ...items.map((item) => item.collectionKey).filter((itemKey) => itemKey && itemKey !== key)];
  saveCollectionOrder();
  renderCollectionPanel();
}

function collectionItemKey(scope, symbol) {
  const key = scope === "crypto" ? normalizeCryptoKey(symbol) : normalizeSearchText(symbol);
  return key ? `${scope}:${key}` : "";
}

function addCollectionOrderKey(key) {
  if (!key) return;
  state.collectionOrder = [key, ...(state.collectionOrder || []).filter((entry) => entry !== key)];
  saveCollectionOrder();
}

function removeCollectionOrderKey(key) {
  if (!key) return;
  state.collectionOrder = (state.collectionOrder || []).filter((entry) => entry !== key);
  saveCollectionOrder();
}

function collectionCoreItems(archive = state.assetArchive || fallbackAssetArchive()) {
  const snapshot = state.monitor || {};
  const optionSignal = snapshot.signal || {};
  const optionLatest = snapshot.main?.latest || {};
  const etfSummary = archive.etf?.summary || {};
  const etfSelected = archive.etf?.selected || archive.etf?.latest || {};
  const assets = cryptoVisibleAssets(archive.crypto?.assets || []);
  const btc = assets.find((asset) => String(asset.label || "").toUpperCase() === "BTC");
  const eth = assets.find((asset) => String(asset.label || "").toUpperCase() === "ETH");
  return [
    {
      kind: "옵션",
      title: "KOSPI200 옵션",
      signal: signalClass(optionSignal.type || "neutral"),
      badge: optionSignal.label || "대기",
      signalScore: commonSignalScore({ signal: optionSignal.type || "neutral", score: optionSignal.score, momentum: optionSignal.metrics?.momentum }),
      value: formatNum(optionLatest.close, 2),
      detail: optionSignal.title || optionSignal.message || "실시간 옵션 신호",
      jumpTab: "options",
    },
    {
      kind: "ETF",
      title: "KODEX200",
      signal: signalClass(etfSummary.signal || "watch"),
      badge: etfSummary.label || "관찰",
      signalScore: commonSignalScore({ signal: etfSummary.signal || "watch", score: etfSummary.score }),
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
  const signalScore = cryptoQualityScore(signal);
  return {
    kind: "코인",
    title,
    signal: signal.className || "neutral",
    badge: signal.label || "관찰",
    signalScore,
    value: formatNum(selected.close, priceDigits(selected.close)),
    detail: signal.message || "코인 신호",
    jumpTab: "crypto",
    jumpCrypto: cryptoTab,
  };
}

function collectionCard(item, options = {}) {
  const signal = signalClass(item.signal || "neutral");
  const index = Number(options.index) || 0;
  const total = Number(options.total) || 0;
  const decision = signalDecisionSummary(item);
  const moveControls = item.collectionKey && total > 1
    ? `
      <div class="collection-card-actions">
        <button type="button" data-collection-key="${escapeAttr(item.collectionKey)}" data-collection-pin="1" aria-label="맨 위로 이동" ${index <= 0 ? "disabled" : ""}>⇧</button>
        <button type="button" data-collection-key="${escapeAttr(item.collectionKey)}" data-collection-move="-1" aria-label="위로 이동" ${index <= 0 ? "disabled" : ""}>&uarr;</button>
        <button type="button" data-collection-key="${escapeAttr(item.collectionKey)}" data-collection-move="1" aria-label="아래로 이동" ${index >= total - 1 ? "disabled" : ""}>&darr;</button>
      </div>
    `
    : "";
  const controls = state.collectionSortMode === "auto" ? "" : moveControls;
  const focusAttr = item.focusKey ? ` data-focus-key="${escapeAttr(item.focusKey)}"` : "";
  const metrics = collectionCardMetrics(item);
  const bucket = collectionTaskBucket(item);
  const emptyActions = item.emptyActions
    ? `
      <div class="collection-empty-actions">
        <button type="button" data-quick-tab="stocks">국장 추가</button>
        <button type="button" data-quick-tab="usStocks">미장 추가</button>
        <button type="button" data-quick-tab="crypto">코인 추가</button>
      </div>
    `
    : "";
  return `
    <article class="watch-card collection-card ${escapeAttr(signal)}" role="button" tabindex="0" data-jump-tab="${escapeAttr(item.jumpTab || "")}" data-jump-crypto="${escapeAttr(item.jumpCrypto || "")}" data-jump-focus="${escapeAttr(item.focusKey || "")}"${focusAttr}>
      <div class="collection-card-head">
        <span class="watch-kind">${escapeHtml(item.kind || "감시")}</span>
        ${item.emptyActions ? "" : `<span class="task-badge ${escapeAttr(bucket.key)}">${escapeHtml(bucket.label)}</span>`}
        <span class="signal-pill ${escapeAttr(signal)}">${escapeHtml(item.badge || "관찰")}</span>
        ${scoreBadgeHtml(decision.score, signal)}
      </div>
      <div class="collection-card-title">
        <strong>${escapeHtml(item.title || "-")}</strong>
        <small>${escapeHtml(item.value || "-")}</small>
      </div>
      ${decisionDetailHtml(decision)}
      ${foldedDecisionDetails(item.detail, decision)}
      <div class="collection-card-metrics">
        ${metrics.map((metric) => `<span><b>${escapeHtml(metric.label)}</b>${escapeHtml(metric.value || "-")}</span>`).join("")}
      </div>
      ${emptyActions}
      ${controls}
    </article>
  `;
}

function collectionCardMetrics(item = {}) {
  const decision = signalDecisionSummary(item);
  if (Array.isArray(item.metrics) && item.metrics.length) {
    const metrics = compactDetailMetrics(item.metrics, 4);
    if (metrics.length) return metrics;
  }
  return [
    { label: "값", value: item.value || "-" },
    { label: "분류", value: item.kind || "-" },
    { label: "다음", value: decision.action },
  ].slice(0, 4);
}

function isDuplicateDetailMetric(metric = {}) {
  const label = String(metric.label || "").toLowerCase();
  return label.includes("점수") || label.includes("score") || label.includes("공통") || label === "신호";
}

function compactDetailMetrics(items = [], limit = 4) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && !isDuplicateDetailMetric(item))
    .filter((item) => {
      const key = String(item.label || "").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function decisionStackHtml(decision = {}) {
  return `
    <div class="decision-stack">
      <div>
        <span>현재</span>
        <strong>${escapeHtml(decision.status || "대기")}</strong>
      </div>
      <div>
        <span>근거</span>
        <strong>${escapeHtml(decision.reason || "조건 확인 중")}</strong>
      </div>
      <div>
        <span>다음</span>
        <strong>${escapeHtml(decision.action || "새 신호 대기")}</strong>
      </div>
    </div>
  `;
}

function decisionDetailHtml(decision = {}) {
  return `
    <div class="decision-stack decision-detail-stack">
      <div>
        <span>근거</span>
        <strong>${escapeHtml(decision.reason || "조건 확인 중")}</strong>
      </div>
      <div>
        <span>다음</span>
        <strong>${escapeHtml(decision.action || "다음 신호 대기")}</strong>
      </div>
    </div>
  `;
}

function foldedDecisionDetails(text, decision = {}) {
  const detail = String(text || "").trim();
  if (!detail || detail.length <= 78) return "";
  return `
    <details class="watch-card-details">
      <summary>근거 더보기</summary>
      <p>${escapeHtml(detail)}</p>
      <small>${escapeHtml(decision.action || "")}</small>
    </details>
  `;
}

function scoreBadgeHtml(score, signal = "watch") {
  const normalized = clampScore(score);
  const tone = scoreTone(normalized, signal);
  return `<span class="score-badge ${escapeAttr(tone)}" aria-label="공통 신호 점수 ${normalized}점">${normalized}</span>`;
}

function signalDecisionSummary(item = {}) {
  const signal = signalClass(item.signal || item.className || item.type || "watch");
  const score = commonSignalScore(item);
  const status = item.statusLabel || signalStatusText(signal, score);
  const reason = compactSignalText(item.reason || item.detail || item.message || item.badge || status, 68);
  const action = item.actionText || signalActionText(signal, score, item.scope);
  return { signal, score, status, reason, action };
}

function signalPriorityRank(item = {}) {
  const signal = signalClass(item.signal || item.className || item.type || item.final_action || item.trade_signal || "watch");
  const score = commonSignalScore(item);
  const title = `${item.title || ""} ${item.message || ""} ${item.trade?.status || ""}`.toLowerCase();
  if (["sell", "avoid"].includes(signal) || title.includes("청산") || title.includes("손절") || title.includes("stop")) return 0;
  if (signal === "warning" || score <= 44) return 1;
  if (["candidate", "buy"].includes(signal) || score >= 72) return 2;
  if (signal === "watch" || score >= 55) return 3;
  return 4;
}

function signalSortLabel(item = {}) {
  return String(item.title || item.name || item.label || item.symbol || item.key || "").toLowerCase();
}

function signalPrioritySort(a = {}, b = {}) {
  const rankDiff = signalPriorityRank(a) - signalPriorityRank(b);
  if (rankDiff) return rankDiff;
  const scoreDiff = commonSignalScore(b) - commonSignalScore(a);
  if (scoreDiff) return scoreDiff;
  return signalSortLabel(a).localeCompare(signalSortLabel(b));
}

function signalOpportunityRank(item = {}) {
  const backendRank = number(item.sortRank ?? item.sort_rank);
  if (backendRank != null && backendRank >= 0) return backendRank;
  const signal = signalClass(item.signal || item.className || item.type || "watch");
  const score = commonSignalScore(item);
  if (["warning", "sell", "avoid"].includes(signal) || score <= 44) return 2;
  if (["candidate", "buy"].includes(signal) || score >= 72) return 0;
  if (signal === "watch" || score >= 55) return 1;
  return 4;
}

function signalOpportunitySort(a = {}, b = {}) {
  const rankDiff = signalOpportunityRank(a) - signalOpportunityRank(b);
  if (rankDiff) return rankDiff;
  const scoreDiff = commonSignalScore(b) - commonSignalScore(a);
  if (scoreDiff) return scoreDiff;
  return signalSortLabel(a).localeCompare(signalSortLabel(b));
}

function sortBySignalPriority(items = []) {
  return [...items].sort(signalPrioritySort);
}

function renderBoardDecision(boardSelector, item = {}) {
  const board = document.querySelector(boardSelector);
  if (!board) return;
  let root = board.querySelector(".board-decision-strip");
  if (!root) {
    root = document.createElement("div");
    root.className = "board-decision-strip";
    const anchor = board.querySelector(".price-grid, .sub-tab-row, .chart-frame");
    board.insertBefore(root, anchor || board.firstChild?.nextSibling || null);
  }
  const decision = signalDecisionSummary(item);
  root.innerHTML = `
    <article>
      <span>현재</span>
      <strong>${escapeHtml(decision.status)}</strong>
    </article>
    <article>
      <span>근거</span>
      <strong>${escapeHtml(decision.reason)}</strong>
    </article>
    <article>
      <span>다음</span>
      <strong>${escapeHtml(decision.action)}</strong>
    </article>
  `;
}

function clearBoardDecision(boardSelector) {
  const root = document.querySelector(`${boardSelector} .board-decision-strip`);
  if (root) root.remove();
}

function signalStatusText(signal, score = null) {
  const normalized = signalClass(signal);
  if (normalized === "watch" && number(score) != null) {
    if (score >= 70) return "강한 관찰";
    if (score <= 45) return "약화 관찰";
  }
  return SIGNAL_STATUS_TEXT[normalized] || "대기";
}

function signalActionText(signal, score = null, scope = "") {
  const normalized = signalClass(signal);
  if (normalized === "watch" && number(score) != null) {
    if (score >= 70) return "돌파/지지 확인 후 후보 전환";
    if (score <= 45) return "조건 회복 전 신규 진입 보류";
  }
  if (scope === "crypto" && ["warning", "sell", "avoid"].includes(normalized)) return "비중/손절 기준 먼저 확인";
  if (scope === "domestic" && normalized === "candidate") return "지수 필터 통과 시 분할 진입 검토";
  if (scope === "us" && normalized === "candidate") return "SPY/QQQ 대비 강도 유지 확인";
  return SIGNAL_ACTION_TEXT[normalized] || "새 신호 대기";
}

function commonSignalScore(item = {}, options = {}) {
  const signal = signalClass(item.signal || item.className || item.type || item.summary?.signal || "watch");
  const explicit = number(item.signalScore ?? item.qualityScore ?? item.score ?? item.summary?.score);
  let score = explicit == null ? signalBaseScore(signal) : normalizeScore(explicit, options.scoreMax);
  const momentum = normalizedMomentum(item.momentum ?? item.ret_21d ?? item.change_pct ?? item.summary?.ret_21d ?? item.summary?.relative_63d);
  if (momentum != null) score += clampNumber(momentum * 85, -12, 12);
  const riskPct = number(item.risk_pct ?? item.atr_pct ?? item.volatility_pct ?? item.summary?.risk_pct);
  if (riskPct != null) score -= clampNumber(riskPct * 0.45, 0, 14);
  if (item.freshSignal || item.newSignal) score += 5;
  if (item.trackingAlert || item.finalStop || item.riskAlert) score -= 16;
  if (item.trackingNotice) score -= 7;
  if (item.liquidityBonus != null) score += clampNumber(number(item.liquidityBonus) || 0, 0, 8);
  return clampScore(score);
}

function signalBaseScore(signal) {
  return SIGNAL_BASE_SCORES[signalClass(signal)] ?? SIGNAL_BASE_SCORES.neutral;
}

function normalizeScore(value, scoreMax = null) {
  const parsed = number(value);
  if (parsed == null) return signalBaseScore("watch");
  const max = number(scoreMax);
  if (max && max > 0 && max !== 100) return clampScore(parsed / max * 100);
  if (parsed > 100 && parsed <= 1000) return clampScore(parsed / 10);
  return clampScore(parsed);
}

function clampScore(value) {
  return Math.round(clampNumber(number(value) ?? SIGNAL_BASE_SCORES.neutral, 0, 100));
}

function clampNumber(value, min, max) {
  const parsed = number(value);
  if (parsed == null) return min;
  return Math.max(min, Math.min(max, parsed));
}

function normalizedMomentum(value) {
  const parsed = number(value);
  if (parsed == null) return null;
  return Math.abs(parsed) > 1 ? parsed / 100 : parsed;
}

function scoreTone(score, signal = "watch") {
  const normalized = signalClass(signal);
  if (["sell", "avoid", "warning"].includes(normalized)) return normalized;
  if (score >= 76) return "candidate";
  if (score >= 58) return "watch";
  if (score >= 40) return "warning";
  return "sell";
}

function compactSignalText(value, maxLength = 76) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function renderSignalInbox() {
  const items = signalInboxItems();
  const pendingCount = items.filter(signalInboxNeedsAction).length;
  const filteredItems = signalInboxFilteredItems(items);
  const countNode = document.querySelector("#signalInboxCount");
  const button = document.querySelector("#signalInboxButton");
  if (countNode) {
    countNode.textContent = pendingCount > 99 ? "99+" : String(pendingCount);
    countNode.hidden = pendingCount <= 0;
  }
  if (button) {
    button.classList.toggle("has-alerts", pendingCount > 0);
    button.setAttribute("aria-label", pendingCount ? `처리 필요 신호 ${pendingCount}개` : "처리 필요 신호 없음");
  }
  document.querySelectorAll("[data-signal-filter]").forEach((filterButton) => {
    const active = filterButton.dataset.signalFilter === state.signalInboxFilter;
    filterButton.classList.toggle("active", active);
    filterButton.setAttribute("aria-selected", active ? "true" : "false");
  });
  const avgScore = items.length
    ? Math.round(items.reduce((sum, item) => sum + commonSignalScore(item), 0) / items.length)
    : 0;
  const doneCount = Math.max(0, items.length - pendingCount);
  setText("#signalInboxSummary", items.length
    ? `${state.selectedDate} 오늘 신호 ${items.length}개 · 처리 필요 ${pendingCount}개 · 확인 완료 ${doneCount}개 · 평균 ${avgScore}점 · ${signalInboxFilterLabel(state.signalInboxFilter)} ${filteredItems.length}개`
    : `${state.selectedDate} 기준 처리할 오늘 신호가 없습니다.`);
  renderSignalInboxBuckets(items);
  const root = document.querySelector("#signalInboxList");
  if (!root) return;
  root.innerHTML = filteredItems.length
    ? filteredItems.map(signalInboxItemHtml).join("")
    : `<article class="empty-log">선택한 필터에 표시할 신호가 없습니다.</article>`;
}

function renderSignalInboxBuckets(items = []) {
  const root = document.querySelector("#signalInboxBuckets");
  if (!root) return;
  const buckets = ["action", "risk", "weak", "watch"].map((key) => {
    const bucketItems = items.filter((item) => signalInboxWorkBucket(item).key === key);
    const unread = bucketItems.filter(signalInboxNeedsAction).length;
    return { key, items: bucketItems, unread };
  });
  root.innerHTML = buckets
    .map((bucket) => {
      const label = signalInboxFilterLabel(bucket.key);
      const active = state.signalInboxFilter === bucket.key ? " active" : "";
      return `
        <button type="button" class="signal-bucket ${escapeAttr(bucket.key)}${active}" data-signal-filter="${escapeAttr(bucket.key)}">
          <span>${escapeHtml(label)}</span>
          <strong>${bucket.items.length}</strong>
          <small>${bucket.unread ? `${bucket.unread}개 미확인` : "정리됨"}</small>
        </button>
      `;
    })
    .join("");
}

function signalInboxItems() {
  const archive = state.assetArchive || fallbackAssetArchive();
  const items = [];
  collectionCoreItems(archive)
    .filter((item) => item.jumpTab !== "crypto")
    .forEach((item) => addSignalInboxItem(items, {
      ...item,
      sourceKey: `core:${item.jumpTab || item.title}`,
    }));

  const stocks = archive.stocks || {};
  const indexFilter = stocks.index_filter || {};
  if (indexFilter.signal || indexFilter.label || indexFilter.message) {
    addSignalInboxItem(items, {
      kind: "국장",
      title: "국장 지수 필터",
      signal: indexFilter.signal || "watch",
      badge: indexFilter.label || "관찰",
      value: `점수 ${formatNum(indexFilter.score, 1)}`,
      detail: indexFilter.message || "국장 시장 필터를 확인합니다.",
      jumpTab: "stocks",
      sourceKey: "stocks:index-filter",
    });
  }

  domesticSignalRows().forEach((row) => addSignalInboxItem(items, {
    scope: "domestic",
    kind: "국장",
    title: row.name || row.symbol || "국장 종목",
    symbol: row.symbol,
    signal: row.trade_signal || row.final_action || "watch",
    badge: row.final_action || row.trade_signal || row.bucket || "관찰",
    value: row.score != null ? `점수 ${formatNum(row.score, 1)}` : row.symbol || "-",
    detail: row.reason || row.bucket || "국장 후보 신호",
    jumpTab: "stocks",
    sourceKey: `stocks:domestic:${normalizeSearchText(row.symbol || row.name)}`,
  }));

  watchItemsForScope("domestic").forEach((item) => addSignalInboxItem(items, {
    ...item,
    sourceKey: `stocks:domestic:${normalizeSearchText(item.symbol || item.title)}`,
  }));

  const usStocks = archive.us_stocks || {};
  const usSummary = usStocks.summary || {};
  if (usSummary.signal || usSummary.label || usSummary.message) {
    addSignalInboxItem(items, {
      scope: "us",
      kind: "미장",
      title: "미장 필터",
      signal: usSummary.signal || "watch",
      badge: usSummary.label || "관찰",
      value: `후보 ${formatNum(usStocks.candidate_count, 0)}`,
      detail: usSummary.message || "미장 전체 조건을 확인합니다.",
      jumpTab: "usStocks",
      sourceKey: "stocks:us-filter",
    });
  }

  (usStocks.top || []).forEach((asset) => {
    const summary = asset.summary || {};
    const selected = asset.selected || asset.latest || {};
    addSignalInboxItem(items, {
      kind: "미장",
      title: asset.label || asset.name || asset.symbol || "미장 종목",
      symbol: asset.symbol,
      signal: summary.signal || "watch",
      badge: summary.label || "관찰",
      value: selected.close != null ? formatNum(selected.close, 2) : asset.symbol || "-",
      detail: usSignalDetail(asset),
      jumpTab: "usStocks",
      sourceKey: `stocks:us:${normalizeSearchText(asset.symbol || asset.label)}`,
    });
  });

  watchItemsForScope("us").forEach((item) => addSignalInboxItem(items, {
    ...item,
    sourceKey: `stocks:us:${normalizeSearchText(item.symbol || item.title)}`,
  }));

  const crypto = archive.crypto || {};
  const normalAssets = cryptoVisibleAssets(crypto.assets || []);
  const exceptionAssets = cryptoVisibleAssets(crypto.exception_assets || []);
  normalAssets.forEach((asset) => addSignalInboxItem(items, signalInboxCryptoItem(cryptoSignalPlan(asset, normalAssets))));
  exceptionAssets.forEach((asset) => addSignalInboxItem(items, signalInboxCryptoItem(cryptoSignalPlan(asset, normalAssets, { exceptionMode: true }))));

  return signalInboxUnique(items).sort(signalInboxSort).slice(0, 80);
}

function signalInboxFilteredItems(items = []) {
  return items.filter((item) => signalInboxFilterMatches(item, state.signalInboxFilter));
}

function signalInboxFilterMatches(item = {}, filter = "all") {
  const bucket = signalInboxWorkBucket(item).key;
  if (filter === "action") return bucket === "action";
  if (filter === "risk") return bucket === "risk";
  if (filter === "weak") return bucket === "weak";
  if (filter === "watch") return bucket === "watch";
  return true;
}

function signalInboxFilterLabel(filter = "all") {
  return {
    all: "오늘",
    action: "진입",
    risk: "위험",
    weak: "약화",
    watch: "관찰",
  }[filter] || "전체";
}

function setSignalInboxFilter(filter = "all") {
  state.signalInboxFilter = ["all", "action", "risk", "weak", "watch"].includes(filter) ? filter : "all";
  renderSignalInbox();
}

function markAllSignalInboxRead() {
  signalInboxItems().forEach((item) => {
    if (item.key) state.signalInboxReadKeys.add(item.key);
  });
  saveSignalInboxReadKeys();
  renderSignalInbox();
}

function markSignalInboxRead(key) {
  if (!key) return;
  state.signalInboxReadKeys.add(key);
  saveSignalInboxReadKeys();
  renderSignalInbox();
}

function signalInboxIsUnread(item = {}) {
  return Boolean(item.key && !state.signalInboxReadKeys.has(item.key));
}

function signalInboxNeedsAction(item = {}) {
  return signalInboxIsUnread(item);
}

function signalInboxWorkBucket(item = {}) {
  const signal = signalClass(item.signal || "watch");
  const score = commonSignalScore(item);
  if (["warning", "sell", "avoid"].includes(signal)) return { key: "risk", label: "위험", order: 1 };
  if (["candidate", "buy"].includes(signal) || score >= 72) return { key: "action", label: "진입", order: 2 };
  if (score <= 45) return { key: "weak", label: "약화", order: 3 };
  return { key: "watch", label: "관찰", order: 4 };
}

function signalInboxItemKey(sourceKey, signal, badge) {
  return [state.selectedDate, sourceKey, signalClass(signal), signalInboxKeyText(badge)].join(":");
}

function signalInboxKeyText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9가-힣_.:-]/g, "")
    .slice(0, 72) || "signal";
}

function signalInboxCryptoItem(plan = {}) {
  const signalScore = cryptoQualityScore(plan);
  return {
    kind: "코인",
    title: plan.name || plan.key || "코인",
    symbol: plan.key,
    signal: plan.className || "watch",
    badge: plan.label || "관찰",
    value: `${signalScore}점`,
    signalScore,
    statusLabel: signalStatusText(plan.className || "watch", signalScore),
    actionText: signalActionText(plan.className || "watch", signalScore, "crypto"),
    detail: plan.message || plan.thirtySubText || "코인 운용 신호",
    jumpTab: "crypto",
    jumpCrypto: plan.key,
    sourceKey: `crypto:${plan.key || plan.name}`,
    focusKey: collectionItemKey("crypto", plan.key),
  };
}

function addSignalInboxItem(items, item = {}) {
  const signal = signalClass(item.signal || item.type || "watch");
  if (signal === "neutral") return;
  if (!item.jumpTab || !APP_TABS.includes(item.jumpTab)) return;
  const sourceKey = item.sourceKey || `${item.jumpTab}:${normalizeSearchText(item.symbol || item.title || item.badge)}`;
  const badge = item.badge || item.label || "관찰";
  const focusKey = item.focusKey || (item.scope && item.symbol ? collectionItemKey(item.scope, item.symbol) : "");
  const signalScore = commonSignalScore({ ...item, signal });
  items.push({
    kind: item.kind || "신호",
    title: item.title || item.symbol || "신호",
    symbol: item.symbol || "",
    signal,
    badge,
    value: item.value || `${signalScore}점`,
    signalScore,
    statusLabel: signalStatusText(signal, signalScore),
    actionText: signalActionText(signal, signalScore, item.scope),
    detail: item.detail || item.message || "",
    jumpTab: item.jumpTab,
    jumpCrypto: item.jumpCrypto || "",
    sourceKey,
    focusKey,
    key: signalInboxItemKey(sourceKey, signal, badge),
  });
}

function signalInboxUnique(items = []) {
  const byKey = new Map();
  items.forEach((item) => {
    const key = item.sourceKey || `${item.jumpTab}:${normalizeSearchText(item.symbol || item.title)}`;
    const previous = byKey.get(key);
    if (!previous || signalInboxPriority(item.signal) > signalInboxPriority(previous.signal)) {
      byKey.set(key, item);
    }
  });
  return [...byKey.values()];
}

function signalInboxPriority(signal) {
  return {
    sell: 90,
    warning: 82,
    avoid: 78,
    candidate: 72,
    buy: 72,
    watch: 42,
    neutral: 0,
  }[signalClass(signal)] || 0;
}

function signalInboxSort(a, b) {
  const statusDiff = Number(signalInboxNeedsAction(b)) - Number(signalInboxNeedsAction(a));
  if (statusDiff) return statusDiff;
  const bucketDiff = signalInboxWorkBucket(a).order - signalInboxWorkBucket(b).order;
  if (bucketDiff) return bucketDiff;
  const scoreDiff = commonSignalScore(b) - commonSignalScore(a);
  if (scoreDiff) return scoreDiff;
  const priorityDiff = signalInboxPriority(b.signal) - signalInboxPriority(a.signal);
  if (priorityDiff) return priorityDiff;
  const scopeDiff = signalInboxScopeOrder(a.jumpTab) - signalInboxScopeOrder(b.jumpTab);
  if (scopeDiff) return scopeDiff;
  return String(a.title || "").localeCompare(String(b.title || ""), "ko");
}

function signalInboxScopeOrder(tab) {
  return { options: 1, etf: 2, stocks: 3, usStocks: 4, crypto: 5, collection: 6 }[tab] || 9;
}

function signalInboxItemHtml(item) {
  const signal = signalClass(item.signal || "watch");
  const decision = signalDecisionSummary(item);
  const cryptoAttr = item.jumpCrypto ? ` data-jump-crypto="${escapeAttr(item.jumpCrypto)}"` : "";
  const focusAttr = item.focusKey ? ` data-jump-focus="${escapeAttr(item.focusKey)}"` : "";
  const pending = signalInboxNeedsAction(item);
  const bucket = signalInboxWorkBucket(item);
  return `
    <article class="signal-inbox-item ${escapeAttr(signal)} ${pending ? "unread needs-action" : "done"}" role="button" tabindex="0" data-signal-key="${escapeAttr(item.key || "")}" data-jump-tab="${escapeAttr(item.jumpTab)}"${cryptoAttr}${focusAttr}>
      <div class="signal-inbox-main">
        <span>${escapeHtml(item.kind || "신호")}<em class="${pending ? "pending" : "complete"}">${pending ? "처리" : "완료"}</em><em class="bucket">${escapeHtml(bucket.label)}</em></span>
        <strong>${escapeHtml(item.title || "-")}</strong>
        <small>${escapeHtml(decision.status)} · ${escapeHtml(item.detail || "해당 화면에서 세부 조건을 확인하세요.")}</small>
        <small class="next-action">${escapeHtml(decision.action)}</small>
      </div>
      <div class="signal-inbox-side">
        <span class="signal-pill ${escapeAttr(signal)}">${escapeHtml(item.badge || "관찰")}</span>
        ${scoreBadgeHtml(decision.score, signal)}
      </div>
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
  const quality = replayQualitySummary(stats);
  if (summaryRoot) {
    summaryRoot.innerHTML = [
      { label: "날짜", value: session.date || state.selectedDate, text: session.weekday_label || "복기" },
      { label: "5분봉", value: `${session.series?.length || 0}개`, text: session.data_window ? `${session.data_window.first_time}~${session.data_window.last_time}` : "저장 데이터" },
      { label: "신호", value: `${tradePlan.events?.length || 0}개`, text: `순손익 ${formatNum(stats.netProfit, 2)}` },
      { label: "복기품질", value: `${quality.score}점`, text: quality.label },
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
  const etfScore = commonSignalScore({ signal, score: summary.score });
  renderBoardDecision("#etfBoard", {
    scope: "etf",
    signal,
    signalScore: etfScore,
    detail: summary.message || "KODEX200 30분/일봉 기준 확인",
    actionText: signalActionText(signal, etfScore, "etf"),
  });
  document.querySelector("#etfMetricGrid").innerHTML = [
    { label: "KODEX200", value: formatNum(selected.close, 0), text: selected.date || selected.time || "-" },
    { label: "공통점수", value: `${etfScore}점`, text: signalStatusText(signal, etfScore) },
    { label: "30분 50%", value: formatNum(context.thirty_minute?.fib_50, 0), text: etfStanceLabel(context.thirty_minute?.stance) },
    { label: "61.8%", value: formatNum(context.thirty_minute?.fib_618, 0), text: "재투입 후보" },
  ].map(metricCard).join("");
  renderEtfSignalCard({
    signal,
    score: etfScore,
    summary,
    selected,
    context,
    indexFilter: archive.etf?.index_filter || {},
  });
}

function renderEtfSignalCard({ signal = "watch", score = 0, summary = {}, selected = {}, context = {}, indexFilter = {} } = {}) {
  const root = document.querySelector("#etfSignalList");
  if (!root) return;
  const decision = signalDecisionSummary({
    scope: "etf",
    signal,
    signalScore: score,
    badge: summary.label || "ETF 관찰",
    detail: summary.message || indexFilter.message || "KOSPI200 흐름과 ETF 30분 기준을 함께 확인합니다.",
    actionText: signalActionText(signal, score, "etf"),
  });
  const thirty = context.thirty_minute || {};
  const items = [
    { label: "점수", value: `${score}점`, text: decision.status },
    { label: "KODEX200", value: formatNum(selected.close, 0), text: selected.date || selected.time || "-" },
    { label: "30분 50%", value: formatNum(thirty.fib_50, 0), text: etfStanceLabel(thirty.stance) },
    { label: "61.8%", value: formatNum(thirty.fib_618, 0), text: "재투입 후보" },
    { label: "지수필터", value: indexFilter.label || summary.label || "-", text: `점수 ${formatNum(indexFilter.score, 1)}` },
    { label: "다음", value: decision.action, text: "실행 기준" },
  ];
  root.innerHTML = optionDecisionCard({
    className: signal,
    title: "ETF 판단",
    badge: summary.label || "관찰",
    score,
    summary: summary.message || "KODEX200 ETF 분할매수 컨텍스트를 카드 기준으로 확인합니다.",
    decision,
    items,
  });
}

function renderStocksPanel() {
  const stocks = state.assetArchive?.stocks || {};
  retryEmptyAssetSection("stocks", Boolean((stocks.short_term?.top || []).length || (stocks.swing?.top || []).length || stocks.index_filter?.label));
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
  const activeItems = watchItemsForScope("domestic");
  const candidateItems = stockManageCandidateItems("domestic");
  const stats = stockManageStats(activeItems, candidateItems);
  const panelScore = stats.avgScore || commonSignalScore({ signal, score: indexFilter.score });
  renderBoardDecision("#stocksBoard", {
    scope: "domestic",
    signal,
    signalScore: panelScore,
    detail: indexFilter.message || `후보 ${candidateItems.length}개 · 감시 ${activeItems.length}개`,
    actionText: stats.strong ? "강한 후보 차트 확인" : signalActionText(signal, panelScore, "domestic"),
  });
  document.querySelector("#stocksMetricGrid").innerHTML = [
    { label: "공통점수", value: `${panelScore}점`, text: `감시 ${activeItems.length}개` },
    { label: "오늘 확인", value: `${stats.strong}개`, text: "신규 부각/강한 관찰" },
    { label: "위험/약화", value: `${stats.risk}개`, text: "축소 또는 보류" },
    { label: "분석 종목", value: formatNum(universe.total_count, 0), text: `1일 ${formatNum(shortTerm.candidate_count, 0)} · 1달 ${formatNum(swing.candidate_count, 0)}` },
  ].map(metricCard).join("");
  renderStockReliability("domestic", stocks);
  renderStockManagePanel("domestic");
}

function renderUsStocksPanel() {
  const usStocks = state.assetArchive?.us_stocks || {};
  retryEmptyAssetSection("us_stocks", Boolean((usStocks.assets || []).length || (usStocks.top || []).length));
  const summary = usStocks.summary || {};
  const signal = signalClass(summary.signal || "neutral");
  const board = document.querySelector("#usStocksBoard");
  if (board) board.className = signalBoardClass(signal);
  setText("#usStocksBadge", summary.label || "미장 관찰");
  const badge = document.querySelector("#usStocksBadge");
  if (badge) badge.className = `signal-pill ${signal}`;
  setText("#usStocksDateText", `${state.selectedDate} · ${isLiveDate() ? "실시간" : "복기"}`);
  setText("#usStocksMessage", summary.message || "미장은 SPY/QQQ 상대강도와 20/50/200일선으로 관심종목 신호를 봅니다.");
  const activeItems = watchItemsForScope("us");
  const candidateItems = stockManageCandidateItems("us");
  const stats = stockManageStats(activeItems, candidateItems);
  const panelScore = stats.avgScore || commonSignalScore({ signal, score: summary.score });
  renderBoardDecision("#usStocksBoard", {
    scope: "us",
    signal,
    signalScore: panelScore,
    detail: summary.message || `후보 ${candidateItems.length}개 · 감시 ${activeItems.length}개`,
    actionText: stats.strong ? "상대강도 유지 확인" : signalActionText(signal, panelScore, "us"),
  });
  document.querySelector("#usStocksMetricGrid").innerHTML = [
    { label: "공통점수", value: `${panelScore}점`, text: `감시 ${activeItems.length}개` },
    { label: "오늘 확인", value: `${stats.strong}개`, text: "신규 부각/상대강도" },
    { label: "위험/약화", value: `${stats.risk}개`, text: "갭/추세 이탈" },
    { label: "추적군", value: formatNum(usStocks.ready_count, 0), text: `${formatNum(usStocks.tracked_count, 0)}개 중` },
  ].map(metricCard).join("");
  renderStockReliability("us", usStocks);
  renderStockManagePanel("us");
}

function renderStockReliability(scope, payload = {}) {
  const root = document.querySelector(scope === "us" ? "#usStocksReliabilityStrip" : "#stocksReliabilityStrip");
  if (!root) return;
  const feed = state.dataFeeds?.["asset-archive"] || {};
  const hasData = scope === "us"
    ? Boolean((payload.assets || []).length || (payload.top || []).length)
    : Boolean((payload.short_term?.top || []).length || (payload.swing?.top || []).length || payload.index_filter?.label);
  const dataState = assetSectionDataState(scope === "us" ? "us_stocks" : "stocks", hasData, feed);
  const items = scope === "us"
    ? [
      { label: "데이터", value: dataState.value, signal: dataState.signal },
      { label: "준비", value: `${formatNum(payload.ready_count, 0)}/${formatNum(payload.tracked_count, 0)}`, signal: number(payload.ready_count) ? "candidate" : "warning" },
      { label: "후보", value: `${formatNum(payload.candidate_count, 0)}개`, signal: number(payload.candidate_count) ? "watch" : "neutral" },
      { label: "기준", value: (payload.benchmarks || []).some((asset) => asset?.ok) ? "SPY/QQQ" : "부족", signal: (payload.benchmarks || []).some((asset) => asset?.ok) ? "candidate" : "warning" },
    ]
    : [
      { label: "데이터", value: dataState.value, signal: dataState.signal },
      { label: "지수", value: payload.index_filter?.label || "-", signal: signalClass(payload.index_filter?.signal || "watch") },
      { label: "1일", value: `${formatNum(payload.short_term?.candidate_count, 0)}개`, signal: number(payload.short_term?.candidate_count) ? "watch" : "neutral" },
      { label: "1달", value: `${formatNum(payload.swing?.candidate_count, 0)}개`, signal: number(payload.swing?.candidate_count) ? "watch" : "neutral" },
    ];
  root.innerHTML = items.map((item) => `
    <article class="${escapeAttr(signalClass(item.signal || "neutral"))}">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value || "-")}</strong>
    </article>
  `).join("");
}

function renderCryptoReliability(crypto = state.assetArchive?.crypto || {}) {
  const root = document.querySelector("#cryptoReliabilityStrip");
  if (!root) return;
  root.innerHTML = "";
  root.hidden = true;
}

function setManageFilter(scope, filter) {
  const key = manageScopeKey(scope);
  const next = MANAGE_FILTERS.includes(filter) ? filter : "all";
  state.manageFilters[key] = next;
  renderAssetTabs();
}

function setStockFocus(scope, symbol) {
  const key = manageScopeKey(scope);
  if (!["domestic", "us"].includes(key)) return;
  const target = normalizeSearchText(symbol);
  if (!target) return;
  state.focusedAssets[key] = target;
  renderAssetTabs();
  scheduleChartRedraw();
  window.setTimeout(() => focusTargetCard(collectionItemKey(key, target)), 60);
}

function manageScopeKey(scope) {
  return scope === "crypto" ? "crypto" : scope === "us" ? "us" : "domestic";
}

function currentManageFilter(scope) {
  const key = manageScopeKey(scope);
  return MANAGE_FILTERS.includes(state.manageFilters[key]) ? state.manageFilters[key] : "all";
}

function manageCandidateSignalItem(item, scope) {
  if (scope === "crypto") {
    const plan = item?.plan || {};
    const score = cryptoCandidateScore(plan);
    return {
      ...plan,
      signal: plan.className,
      signalScore: score,
      title: cryptoAssetName(item?.asset),
      key: cryptoAssetKey(item?.asset),
    };
  }
  const score = stockCandidateScore(item);
  return {
    ...item,
    signalScore: score,
    title: item?.name || item?.symbol,
  };
}

function manageCandidateBucket(item, scope) {
  const rank = signalOpportunityRank(manageCandidateSignalItem(item, scope));
  if (rank === 0) return "strong";
  if (rank >= 2 && rank <= 3) return "risk";
  return "watch";
}

function filteredManageCandidates(scope, candidates = []) {
  const filter = currentManageFilter(scope);
  if (filter === "all") return candidates;
  return candidates.filter((item) => manageCandidateBucket(item, scope) === filter);
}

function manageFilterTabs(scope, candidates = []) {
  const key = manageScopeKey(scope);
  const active = currentManageFilter(key);
  const counts = {
    all: candidates.length,
    strong: candidates.filter((item) => manageCandidateBucket(item, key) === "strong").length,
    watch: candidates.filter((item) => manageCandidateBucket(item, key) === "watch").length,
    risk: candidates.filter((item) => manageCandidateBucket(item, key) === "risk").length,
  };
  const labels = {
    all: "전체",
    strong: "좋은 신호",
    watch: "관찰",
    risk: "위험",
  };
  return `
    <div class="manage-filter-tabs" role="tablist" aria-label="추가 후보 필터">
      ${MANAGE_FILTERS.map((filter) => `
        <button type="button" class="${active === filter ? "active" : ""}" data-manage-scope="${escapeAttr(key)}" data-manage-filter="${escapeAttr(filter)}">
          <span>${escapeHtml(labels[filter])}</span>
          <strong>${formatNum(counts[filter], 0)}</strong>
        </button>
      `).join("")}
    </div>
  `;
}

function renderStockManagePanel(scope) {
  const config = stockManageConfig(scope);
  const panel = document.querySelector(config.panel);
  if (!panel) return;
  renderSearchResults(scope);
  const activeItems = sortBySignalPriority(watchItemsForScope(scope));
  const candidates = stockManageCandidateItems(scope);
  const stats = stockManageStats(activeItems, candidates);
  setText(config.summary, `감시 ${activeItems.length}개 · 추가 후보 ${candidates.length}개 · 평균 ${stats.avgScore}점`);
  renderStockSignalList(config, activeItems);
  const candidateRoot = document.querySelector(config.candidateList);
  if (candidateRoot) {
    const filtered = filteredManageCandidates(scope, candidates);
    candidateRoot.innerHTML = [
      manageFilterTabs(scope, candidates),
      filtered.length
        ? filtered.slice(0, 16).map((item) => stockCandidateItem(item)).join("")
        : `<article class="asset-manage-empty">선택한 필터에 표시할 ${config.label} 후보가 없습니다.</article>`,
    ].join("");
  }
}

function renderStockSignalList(config, activeItems = []) {
  const root = document.querySelector(config.signalList);
  if (!root) return;
  root.innerHTML = activeItems.length
    ? activeItems.map(stockSignalCard).join("")
    : `
      <article class="crypto-signal-card stock-signal-card watch">
        <header>
          <h2>감시 종목 없음</h2>
          <span class="signal-pill watch">대기</span>
        </header>
        <details class="crypto-card-details">
          <summary>상세 조건 보기</summary>
          <div class="crypto-detail-section">
            <strong>안내</strong>
            <p class="crypto-card-summary">${escapeHtml(`${config.label} 추가 패널에서 감시할 종목을 추가하면 이곳에서 삭제와 신호 확인을 같이 할 수 있습니다.`)}</p>
          </div>
        </details>
      </article>
    `;
}

function stockManageConfig(scope) {
  return scope === "us"
    ? {
      label: "미장",
      panel: "#usManagePanel",
      summary: "#usManageSummary",
      signalList: "#usSignalList",
      candidateList: "#usManageCandidateList",
    }
    : {
      label: "국장",
      panel: "#domesticManagePanel",
      summary: "#domesticManageSummary",
      signalList: "#domesticSignalList",
      candidateList: "#domesticManageCandidateList",
    };
}

function stockSignalCard(item) {
  const signal = signalClass(item.signal || "watch");
  const decision = signalDecisionSummary(item);
  const metrics = collectionCardMetrics(item);
  const detail = String(item.detail || "").trim();
  const badgeText = stockBadgeText(item.badge, signal, decision.score);
  const focusScope = manageScopeKey(item.scope);
  const focusSymbol = normalizeSearchText(item.symbol);
  const focusClass = state.focusedAssets[focusScope] === focusSymbol ? " is-chart-focus" : "";
  return `
    <article class="crypto-signal-card stock-signal-card ${escapeAttr(signal)}${focusClass}" data-focus-key="${escapeAttr(collectionItemKey(item.scope, item.symbol))}" data-stock-focus-scope="${escapeAttr(focusScope)}" data-stock-focus-symbol="${escapeAttr(focusSymbol)}">
      <header>
        <h2>${escapeHtml(item.title || item.symbol || "-")}</h2>
        <span class="signal-pill ${escapeAttr(signal)}">${escapeHtml(badgeText)}</span>
        ${scoreBadgeHtml(decision.score, signal)}
        <button class="mini-remove" type="button" data-watch-scope="${escapeAttr(item.scope)}" data-watch-remove="${escapeAttr(item.symbol)}">삭제</button>
      </header>
      <details class="crypto-card-details">
        <summary>상세 조건 보기</summary>
        <div class="crypto-detail-section">
          <strong>핵심 판단</strong>
          <p class="crypto-card-summary">${escapeHtml(detail || "지수 필터와 상대강도 기준으로 감시합니다.")}</p>
          ${decisionDetailHtml(decision)}
        </div>
        <div class="crypto-detail-section">
          <strong>지표</strong>
          <div class="crypto-signal-grid">
            ${cryptoSignalGridItems(metrics)}
          </div>
        </div>
      </details>
    </article>
  `;
}

function stockManageCandidateItems(scope) {
  const selected = new Set((state.watchlists[scope] || []).map((item) => normalizeSearchText(item.symbol)));
  const universe = scope === "us" ? usManageCandidateUniverse() : domesticManageCandidateUniverse();
  return uniqueStockItems(universe)
    .filter((item) => item.symbol && !selected.has(normalizeSearchText(item.symbol)))
    .map((item) => {
      const hint = searchSignalHint({ ...item, scope });
      return {
        ...item,
        scope,
        signal: hint.signal,
        signalScore: hint.score,
        statusLabel: signalStatusText(hint.signal, hint.score),
        actionText: signalActionText(hint.signal, hint.score, scope),
        alreadyAdded: false,
      };
    })
    .sort((a, b) => signalOpportunitySort(stockManageCandidateSortItem(a), stockManageCandidateSortItem(b)));
}

function domesticSignalRows() {
  const stocks = state.assetArchive?.stocks || {};
  const shortTerm = stocks.short_term || {};
  const swing = stocks.swing || {};
  return uniqueStockItems([
    ...(shortTerm.top || []).map((row) => ({ ...row, bucket: "1일" })),
    ...(shortTerm.watch || []).map((row) => ({ ...row, bucket: "1일 관찰" })),
    ...(swing.top || []).map((row) => ({ ...row, bucket: "1달" })),
    ...(swing.watch || []).map((row) => ({ ...row, bucket: "1달 관찰" })),
  ]);
}

function domesticManageCandidateUniverse() {
  const rows = domesticSignalRows();
  const source = rows.length ? rows : domesticSearchUniverse().slice(0, 40);
  return source.map((item) => ({
    scope: "domestic",
    symbol: String(item.symbol || "").trim(),
    name: String(item.name || item.symbol || "").trim(),
    market: item.market || "국장",
    group: item.bucket || item.group || "추천 후보",
    close: item.close ?? item.last_close,
    change_pct: item.change_pct ?? item.ret_1d ?? item.ret_21d,
    score: item.score,
    reason: item.reason,
    trade_signal: item.trade_signal,
    final_action: item.final_action,
    bucket: item.bucket,
    atr_pct: item.atr_pct,
    trade_value: item.trade_value ?? item.amount,
  })).filter((item) => item.symbol && item.name);
}

function usManageCandidateUniverse() {
  const usStocks = state.assetArchive?.us_stocks || {};
  const rows = [
    ...(usStocks.top || []),
    ...(usStocks.assets || []),
  ];
  if (!rows.length) return usSearchUniverse();
  return rows.map((asset) => {
    const selected = asset.selected || asset.latest || {};
    return {
      scope: "us",
      symbol: String(asset.symbol || "").trim(),
      name: String(asset.label || asset.name || asset.symbol || "").trim(),
      market: asset.market || "US",
      group: asset.group || "미장",
      close: selected.close,
      change_pct: asset.summary?.ret_21d,
      score: asset.summary?.score,
      signal: asset.summary?.signal,
      summary: asset.summary,
      reason: asset.summary?.message,
      market_cap: asset.market_cap,
      dollar_volume: asset.dollar_volume,
    };
  }).filter((item) => item.symbol && item.name);
}

function uniqueStockItems(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = normalizeSearchText(item.symbol);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stockCandidateScore(item) {
  const hint = searchSignalHint(item);
  const match = item.scope === "us" ? findUsAsset(item.symbol) : findDomesticCandidate(item.symbol);
  return stockQualityScore(item, match, hint.signal);
}

function stockManageCandidateSortItem(item = {}) {
  return {
    ...item,
    signalScore: stockCandidateScore(item),
    title: item.name || item.symbol,
  };
}

function stockQualityScore(item = {}, match = null, signalOverride = null) {
  const summary = match?.summary || item.summary || {};
  const signal = signalClass(signalOverride || summary.signal || match?.final_action || match?.trade_signal || item.signal || "watch");
  const rawScore = summary.score ?? match?.score ?? item.score;
  const momentum = summary.ret_21d ?? summary.relative_63d ?? match?.ret_21d ?? item.change_pct;
  return commonSignalScore({
    signal,
    score: rawScore,
    momentum,
    risk_pct: summary.atr_pct ?? match?.atr_pct ?? item.atr_pct,
    liquidityBonus: stockLiquidityBonus(match || item),
    freshSignal: stockFreshSignal(match || item, signal),
  });
}

function stockLiquidityBonus(item = {}) {
  const value = number(
    item.trade_value ??
    item.trading_value ??
    item.dollar_volume ??
    item.amount ??
    item.market_cap ??
    item.volume,
  );
  if (value == null || value <= 0) return 0;
  const magnitude = Math.log10(value);
  if (magnitude >= 12) return 8;
  if (magnitude >= 10) return 6;
  if (magnitude >= 8) return 4;
  if (magnitude >= 6) return 2;
  return 0;
}

function stockFreshSignal(item = {}, signal = "watch") {
  if (["candidate", "buy"].includes(signalClass(signal))) return true;
  const bucket = String(item.bucket || item.group || "").toLowerCase();
  return bucket.includes("1일") || bucket.includes("top") || bucket.includes("candidate");
}

function stockSignalTag(item = {}, score = null, signal = null) {
  const normalized = signalClass(signal || item.signal || "watch");
  const momentum = normalizedMomentum(item.summary?.ret_21d ?? item.ret_21d ?? item.change_pct);
  const currentScore = score ?? stockQualityScore(item, null, normalized);
  if (["warning", "sell", "avoid"].includes(normalized) || currentScore <= 44 || (momentum != null && momentum <= -0.08)) return "약화";
  if (["candidate", "buy"].includes(normalized) || currentScore >= 76) return "신규 부각";
  if (currentScore >= 62) return "관찰 유지";
  return "대기";
}

function stockManageStats(activeItems = [], candidates = []) {
  const combined = [...activeItems, ...candidates];
  const scores = combined.map((item) => commonSignalScore(item)).filter((score) => Number.isFinite(score));
  const avgScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const strong = combined.filter((item) => commonSignalScore(item) >= 72 || ["candidate", "buy"].includes(signalClass(item.signal))).length;
  const risk = combined.filter((item) => ["warning", "sell", "avoid"].includes(signalClass(item.signal)) || commonSignalScore(item) <= 44).length;
  return { avgScore, strong, risk };
}

function cryptoAssetUniverse(crypto = state.assetArchive?.crypto || {}) {
  const seen = new Set();
  return [
    ...(crypto.assets || []),
    ...(crypto.exception_assets || []),
  ].filter((asset) => {
    const key = cryptoAssetKey(asset);
    if (!key || key === "usdt" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cryptoVisibleKeys() {
  return new Set((state.watchlists.crypto || []).map((item) => normalizeCryptoKey(item.key || item.symbol)).filter(Boolean));
}

function cryptoVisibleAssets(assets = []) {
  const visible = cryptoVisibleKeys();
  return (Array.isArray(assets) ? assets : []).filter((asset) => visible.has(cryptoAssetKey(asset)));
}

function cryptoSelectableKeys(crypto = state.assetArchive?.crypto || {}) {
  return cryptoVisibleAssets(cryptoAssetUniverse(crypto)).map((asset) => cryptoAssetKey(asset));
}

function cryptoAssetByKey(key, crypto = state.assetArchive?.crypto || {}) {
  const target = normalizeCryptoKey(key);
  return cryptoAssetUniverse(crypto).find((asset) => cryptoAssetKey(asset) === target) || null;
}

function ensureCryptoTabAvailable(crypto = state.assetArchive?.crypto || {}) {
  if (state.cryptoTab === "all") return;
  if (!cryptoSelectableKeys(crypto).includes(state.cryptoTab)) state.cryptoTab = "all";
}

function cryptoSignalPlanScope(crypto = state.assetArchive?.crypto || {}) {
  return (crypto.assets || []).length ? crypto.assets || [] : cryptoAssetUniverse(crypto);
}

function cryptoPlanForAsset(asset, crypto = state.assetArchive?.crypto || {}) {
  return cryptoSignalPlan(asset, cryptoSignalPlanScope(crypto), { exceptionMode: cryptoAssetProfile(asset).assetType === "exception" });
}

function backendCryptoSignalPlan(asset = {}) {
  const plan = asset?.signal_plan || asset?.backend_signal || null;
  if (!plan || typeof plan !== "object") return null;
  return plan;
}

function backendCryptoSignalComplete(asset = {}) {
  const plan = backendCryptoSignalPlan(asset);
  return Boolean(plan && plan.source === "backend" && plan.calculation_status === "complete" && plan.fallback !== true);
}

function backendCryptoErrorPlan(asset = {}) {
  const key = cryptoAssetKey(asset);
  const name = cryptoAssetName(asset);
  const plan = backendCryptoSignalPlan(asset);
  const message = plan?.message || plan?.reason || "서버 계산값이 없어 임시 신호를 차단했습니다.";
  return {
    key,
    name,
    className: "warning",
    label: plan?.label || "계산 오류",
    message,
    signalSource: "backend_required",
    signalReliability: "error",
    candidateScore: 0,
    sortRank: 3,
    backendAction: plan?.action || "서버 신호 계산을 확인하기 전까지 후보 판단을 사용하지 않습니다.",
  };
}

function applyBackendCryptoSignalPlan(asset = {}, plan = {}) {
  const backend = backendCryptoSignalPlan(asset);
  if (!backendCryptoSignalComplete(asset)) {
    const errorPlan = backendCryptoErrorPlan(asset);
    return {
      ...plan,
      ...errorPlan,
      actionText: errorPlan.backendAction,
    };
  }
  const signal = signalClass(backend.className || backend.signal || "warning");
  const candidateScore = clampScore(backend.candidate_score ?? backend.score ?? 0);
  return {
    ...plan,
    className: signal,
    label: backend.label || plan.label,
    message: backend.message || backend.reason || plan.message,
    score: clampScore(backend.score ?? candidateScore),
    candidateScore,
    sortRank: Number(backend.sort_rank ?? 3),
    signalSource: "backend",
    signalReliability: "complete",
    backendAction: backend.action || "",
    backendReason: backend.reason || backend.message || "",
    signalTimeText: compactDateTime(backend.signal_at) || plan.signalTimeText,
  };
}

function cryptoCandidateScore(plan = {}) {
  if (plan.signalSource === "backend") return clampScore(plan.candidateScore ?? plan.score ?? 0);
  if (plan.signalReliability === "error" || plan.signalSource === "backend_required") return 0;
  let score = cryptoQualityScore(plan);
  const daily = plan.daily || {};
  if (daily.position === "above") score += 10;
  if (daily.chikou === "bullish") score += 8;
  if (daily.position === "below") score -= 8;
  if (daily.chikou === "bearish") score -= 8;
  if (plan.fibBox?.crossed50) score += 4;
  if (plan.fibBox?.crossed618) score -= 3;
  if (plan.trendReversal?.strong || plan.fourHourRisk?.boxBreak) score += 7;
  if (plan.trackingAlert) score -= 18;
  const close = number(plan.close);
  const stop = number(plan.finalStopLevel ?? plan.stop);
  if (close != null && stop != null && close > 0) {
    const stopGapPct = Math.max(-1, (close - stop) / close);
    if (stopGapPct > 0 && stopGapPct <= 0.08) score += 5;
    if (stopGapPct <= 0) score -= 15;
  }
  return clampScore(score);
}

function cryptoManageCandidateSortItem(item = {}) {
  const plan = item.plan || {};
  return {
    ...plan,
    signal: plan.className,
    signalScore: cryptoCandidateScore(plan),
    title: cryptoAssetName(item.asset),
    key: cryptoAssetKey(item.asset),
  };
}

function cryptoWatchedSignalItem(asset, assets = [], options = {}) {
  const plan = cryptoSignalPlan(asset, assets, options);
  return {
    ...plan,
    signal: plan.className,
    signalScore: cryptoQualityScore(plan),
    title: cryptoAssetName(asset),
    key: cryptoAssetKey(asset),
  };
}

function sortCryptoAssetsBySignalPriority(assets = [], scopeAssets = [], options = {}) {
  return [...assets].sort((a, b) => signalPrioritySort(
    cryptoWatchedSignalItem(a, scopeAssets, options),
    cryptoWatchedSignalItem(b, scopeAssets, options),
  ));
}

function cryptoQualityScore(plan = {}) {
  if (plan.signalSource === "backend") return clampScore(plan.score ?? plan.candidateScore ?? 0);
  if (plan.signalReliability === "error" || plan.signalSource === "backend_required") return 0;
  const signal = signalClass(plan.className || "watch");
  let score = commonSignalScore({
    signal,
    score: plan.score,
    momentum: plan.fibBoxPct != null ? (number(plan.fibBoxPct) - 50) / 220 : null,
    trackingAlert: plan.trackingAlert,
    trackingNotice: plan.trackingNotice,
  });
  score += clampNumber((number(plan.slotPct) || 0) * 0.08, 0, 8);
  score += plan.fourHourStrong ? 6 : 0;
  score += plan.exceptionEntryStrong ? 6 : 0;
  score += plan.trendReversal?.strong ? 5 : 0;
  score += plan.weeklyStarter ? 3 : 0;
  score -= plan.trackingAlert ? 16 : 0;
  return clampScore(score);
}

function renderCryptoTabButtons(crypto = state.assetArchive?.crypto || {}) {
  const root = document.querySelector("#cryptoSubTabs");
  if (!root) return;
  const visibleAssets = cryptoVisibleAssets(cryptoAssetUniverse(crypto));
  const plans = visibleAssets.map((asset) => cryptoPlanForAsset(asset, crypto));
  const allPlan = cryptoLatestSignalPlan(plans);
  const buttons = [
    { key: "all", label: "전체", plan: allPlan },
    ...visibleAssets.map((asset) => ({ key: cryptoAssetKey(asset), label: cryptoAssetName(asset), plan: cryptoPlanForAsset(asset, crypto) })),
  ];
  root.innerHTML = buttons.map((item) => {
    const className = signalClass(item.plan?.className || "neutral");
    const active = state.cryptoTab === item.key ? " active" : "";
    const title = item.plan ? `${item.label} · ${item.plan.label || "관찰"}` : item.label;
    return `<button type="button" class="${escapeAttr(`${active.trim()} ${className}`.trim())}" data-crypto-tab="${escapeAttr(item.key)}" title="${escapeAttr(title)}">${escapeHtml(item.label)}</button>`;
  }).join("");
}

function renderCryptoManagePanel(crypto = state.assetArchive?.crypto || {}) {
  const panel = document.querySelector("#cryptoManagePanel");
  if (!panel) return;
  if (state.cryptoTab !== "all") {
    panel.hidden = true;
    panel.open = false;
    return;
  }
  panel.hidden = false;
  const universe = cryptoAssetUniverse(crypto);
  const selected = cryptoVisibleKeys();
  const activeAssets = universe.filter((asset) => selected.has(cryptoAssetKey(asset)));
  const candidates = universe
    .filter((asset) => !selected.has(cryptoAssetKey(asset)))
    .map((asset) => ({ asset, plan: cryptoPlanForAsset(asset, crypto) }))
    .sort((a, b) => signalOpportunitySort(cryptoManageCandidateSortItem(a), cryptoManageCandidateSortItem(b)));
  setText("#cryptoManageSummary", `감시 ${activeAssets.length}개 · 추가 후보 ${candidates.length}개`);
  const candidateRoot = document.querySelector("#cryptoCandidateList");
  if (candidateRoot) {
    const filtered = filteredManageCandidates("crypto", candidates);
    candidateRoot.innerHTML = [
      manageFilterTabs("crypto", candidates),
      filtered.length
        ? filtered.slice(0, 16).map((item) => cryptoCandidateItem(item.asset, item.plan)).join("")
        : `<article class="crypto-manage-empty">선택한 필터에 표시할 코인 후보가 없습니다.</article>`,
    ].join("");
  }
}

function cryptoCandidateItem(asset, plan = {}) {
  const key = cryptoAssetKey(asset);
  const className = signalClass(plan.className || "neutral");
  const score = cryptoCandidateScore(plan);
  const action = signalActionText(className, score, "crypto");
  const selected = asset.selected || asset.latest || {};
  return `
    <article class="search-result crypto-candidate ${escapeAttr(className)}">
      <div>
        <strong>${escapeHtml(cryptoAssetName(asset))}</strong>
        <small>${escapeHtml(asset.label || asset.symbol || key.toUpperCase())} · ${escapeHtml(plan.typeLabel || "코인")}</small>
        <small class="search-hint">${escapeHtml(plan.label || "관찰")} · 공통점수 ${score}점 · ${escapeHtml(action)}</small>
        <span class="recommendation-tags">
          <em>${escapeHtml(signalStatusText(className, score))}</em>
          <em>${escapeHtml(action)}</em>
        </span>
      </div>
      <span class="candidate-price">${selected.close != null ? formatNum(selected.close, priceDigits(selected.close)) : plan.portfolioText || "-"}</span>
      <button class="soft-button crypto-add-button" type="button" data-crypto-add="${escapeAttr(key)}" aria-label="${escapeAttr(`${cryptoAssetName(asset)} 감시군에 추가`)}">+ 추가</button>
    </article>
  `;
}

function addCryptoWatch(key) {
  const asset = cryptoAssetByKey(key);
  if (!asset) return false;
  const current = state.watchlists.crypto || [];
  const target = cryptoAssetKey(asset);
  const focusKey = collectionItemKey("crypto", target);
  state.watchlists.crypto = normalizeCryptoWatchlist([
    ...current,
    {
      key: target,
      symbol: asset.label || asset.symbol || target.toUpperCase(),
      name: cryptoAssetName(asset),
      addedAt: new Date().toISOString(),
    },
  ]);
  state.cryptoTab = "all";
  addCollectionOrderKey(collectionItemKey("crypto", target));
  saveWatchlists();
  renderAssetTabs();
  const managePanel = document.querySelector("#cryptoManagePanel");
  if (managePanel) managePanel.open = false;
  window.setTimeout(() => focusTargetCard(focusKey), 80);
  return true;
}

function removeCryptoWatch(key) {
  const target = normalizeCryptoKey(key);
  if (!target) return;
  const asset = cryptoAssetByKey(target);
  const name = asset ? cryptoAssetName(asset) : CRYPTO_ASSET_META[target]?.name || target.toUpperCase();
  if (!window.confirm(`${name}을(를) 코인 감시군에서 삭제할까요?`)) return;
  state.watchlists.crypto = normalizeCryptoWatchlist((state.watchlists.crypto || []).filter((item) => normalizeCryptoKey(item.key || item.symbol) !== target));
  removeCollectionOrderKey(collectionItemKey("crypto", target));
  if (state.cryptoTab === target) state.cryptoTab = "all";
  saveWatchlists();
  renderAssetTabs();
}

function renderCryptoPanel() {
  const crypto = state.assetArchive?.crypto || {};
  retryEmptyAssetSection("crypto", Boolean(cryptoAssetUniverse(crypto).length));
  const assets = cryptoVisibleAssets(crypto.assets || []);
  const exceptionAssets = cryptoVisibleAssets(crypto.exception_assets || []);
  const cashAssets = crypto.cash_assets || [];
  const detailAssets = [...assets, ...exceptionAssets];
  ensureCryptoTabAvailable(crypto);
  renderCryptoTabButtons(crypto);
  renderCryptoManagePanel(crypto);
  renderCryptoReliability(crypto);
  syncCryptoControls();
  if (state.cryptoTab !== "all") {
    renderCryptoDetailPanel(cryptoSelectedAsset(detailAssets), detailAssets);
    return;
  }
  const summary = crypto.summary || {};
  const cryptoPlans = [
    ...assets.map((asset) => cryptoSignalPlan(asset, assets)),
    ...exceptionAssets.map((asset) => cryptoSignalPlan(asset, assets, { exceptionMode: true })),
  ];
  const latestPlan = cryptoLatestSignalPlan(cryptoPlans);
  const signal = signalClass(latestPlan?.className || summary.signal || "neutral");
  const board = document.querySelector("#cryptoBoard");
  if (board) board.className = `${signalBoardClass(signal)} crypto-overview-board`;
  setText("#cryptoBadge", latestPlan?.label || summary.label || "관찰");
  const badge = document.querySelector("#cryptoBadge");
  if (badge) badge.className = `signal-pill ${signal}`;
  const message = document.querySelector("#cryptoMessage");
  if (message) message.hidden = false;
  setText("#cryptoDateText", cryptoHeaderDateText({ latestPlan }));
  setText("#cryptoMessage", summary.message || "메이저 코인 기본 감시를 표시합니다.");
  setText("#cryptoTitle", "코인");
  clearBoardDecision("#cryptoBoard");
  const metricGrid = document.querySelector("#cryptoMetricGrid");
  if (metricGrid) {
    metricGrid.hidden = true;
    metricGrid.innerHTML = "";
  }
  renderCryptoDetailFocus(null);
  clearCryptoAssetList();
  const sortedAssets = sortCryptoAssetsBySignalPriority(assets, assets);
  const sortedExceptionAssets = sortCryptoAssetsBySignalPriority(exceptionAssets, assets, { exceptionMode: true });
  const cards = [
    ...sortedAssets.map((asset) => cryptoSignalCard(asset, assets, { removable: true })),
    ...sortedExceptionAssets.map((asset) => cryptoSignalCard(asset, assets, { exceptionMode: true, removable: true })),
    cryptoExceptionApprovalCard(exceptionAssets, assets),
  ].filter(Boolean);
  document.querySelector("#cryptoSignalList").innerHTML = cards.length
    ? cards.join("")
    : `<article class="crypto-signal-card watch"><header><h2>감시 코인 없음</h2><span class="signal-pill watch">대기</span></header><details class="crypto-card-details"><summary>상세 조건 보기</summary><div class="crypto-detail-section"><strong>안내</strong><p class="crypto-card-summary">코인 추가 패널에서 감시할 코인을 추가하면 이곳에 한 카드로 정리됩니다.</p></div></details></article>`;
}

function renderCryptoDetailPanel(asset, assets = []) {
  const name = asset ? cryptoAssetName(asset) : CRYPTO_ASSET_META[state.cryptoTab]?.name || "코인";
  const rows = cryptoRowsForFrame(asset, state.cryptoFrame);
  const signal = cryptoSignalPlan(asset, assets, { rows, frame: state.cryptoFrame });
  const boardSignal = signalClass(signal.className || "neutral");
  const board = document.querySelector("#cryptoBoard");
  if (board) board.className = `${signalBoardClass(boardSignal)} crypto-detail-board`;
  setText("#cryptoBadge", signal.label || "관찰");
  const badge = document.querySelector("#cryptoBadge");
  if (badge) badge.className = `signal-pill ${boardSignal}`;
  setText("#cryptoTitle", name);
  setText("#cryptoDateText", cryptoHeaderDateText({ frame: cryptoFrameLabel(state.cryptoFrame), latestPlan: signal }));
  const message = document.querySelector("#cryptoMessage");
  if (message) {
    message.hidden = Boolean(asset && rows.length);
    message.textContent = asset && rows.length
      ? ""
      : `${name} 데이터를 가져오지 못했습니다. 연결 상태를 확인한 뒤 다시 새로고침해 주세요.`;
  }
  clearBoardDecision("#cryptoBoard");
  const metricGrid = document.querySelector("#cryptoMetricGrid");
  if (metricGrid) {
    metricGrid.hidden = true;
    metricGrid.innerHTML = "";
  }
  renderCryptoDetailFocus(null);
  clearCryptoAssetList();
  document.querySelector("#cryptoSignalList").innerHTML = asset
    ? cryptoSignalCard(asset, assets, { rows, frame: state.cryptoFrame })
    : `<article class="crypto-signal-card watch"><header><h2>${name}</h2><span class="signal-pill watch">대기</span></header><details class="crypto-card-details"><summary>상세 조건 보기</summary><div class="crypto-detail-section"><strong>안내</strong><p>분봉 데이터를 기다리는 중입니다.</p></div></details></article>`;
}

function renderCryptoDetailFocus(signal = null, rows = []) {
  const root = document.querySelector("#cryptoDetailFocus");
  if (!root) return;
  if (!signal) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  const daily = signal.daily || {};
  const chikouText = daily.chikou === "bullish" ? "상위" : daily.chikou === "bearish" ? "하위" : "확인";
  const items = [
    {
      label: "일봉 구름",
      value: signal.dailyLabel || daily.label || "-",
      detail: signal.dailySubText || daily.subText || "큰 흐름",
      signal: daily.position === "above" ? "candidate" : daily.position === "below" ? "warning" : "watch",
    },
    {
      label: "후행스팬",
      value: chikouText,
      detail: chikouText === "상위" ? "추세 지지" : chikouText === "하위" ? "비중 제한" : "대기",
      signal: daily.chikou === "bullish" ? "candidate" : daily.chikou === "bearish" ? "warning" : "watch",
    },
    {
      label: "30분 손절",
      value: signal.thirtyBoxStopLevel != null ? formatNum(signal.thirtyBoxStopLevel, priceDigits(signal.thirtyBoxStopLevel)) : signal.stopText || "-",
      detail: signal.thirtySubText || "빠른 위험선",
      signal: signal.trackingAlert ? "warning" : "watch",
    },
    {
      label: "최종손절",
      value: signal.finalStopLevel != null ? formatNum(signal.finalStopLevel, priceDigits(signal.finalStopLevel)) : signal.stopText || "-",
      detail: signal.finalStopReason || "포지션 보호",
      signal: ["sell", "avoid", "warning"].includes(signalClass(signal.className)) ? "warning" : "watch",
    },
    {
      label: "목표비중",
      value: signal.portfolioText || signal.stageText || "-",
      detail: signal.actionText || signal.label || "운용 단계",
      signal: signalClass(signal.className || "watch"),
    },
  ];
  root.hidden = false;
  root.innerHTML = items.map((item) => `
    <article class="${escapeAttr(signalClass(item.signal || "watch"))}">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value || "-")}</strong>
      <small>${escapeHtml(item.detail || "")}</small>
    </article>
  `).join("");
}

function clearCryptoAssetList() {
  const root = document.querySelector("#cryptoAssetList");
  if (!root) return;
  root.hidden = true;
  root.innerHTML = "";
}

function syncCryptoControls() {
  const crypto = state.assetArchive?.crypto || {};
  const normalAssets = cryptoVisibleAssets(crypto.assets || []);
  const exceptionAssets = cryptoVisibleAssets(crypto.exception_assets || []);
  const detailAssets = cryptoVisibleAssets([...normalAssets, ...exceptionAssets]);
  const tabPlans = new Map(detailAssets.map((asset) => {
    const plansInNormalScope = normalAssets.length ? normalAssets : detailAssets;
    const plan = cryptoSignalPlan(asset, plansInNormalScope, { exceptionMode: cryptoAssetProfile(asset).assetType === "exception" });
    return [cryptoAssetKey(asset), plan];
  }));
  const allPlan = cryptoLatestSignalPlan([...tabPlans.values()]);
  const signalClasses = ["neutral", "watch", "warning", "candidate", "buy", "sell", "avoid"];
  document.querySelectorAll("[data-crypto-tab]").forEach((button) => {
    const tab = button.dataset.cryptoTab;
    const plan = tab === "all" ? allPlan : tabPlans.get(tab);
    const className = signalClass(plan?.className || (tab === "all" ? crypto.summary?.signal : "neutral"));
    button.classList.remove(...signalClasses);
    button.classList.add(className);
    button.classList.toggle("active", tab === state.cryptoTab);
    button.title = plan ? `${plan.name || button.textContent.trim()} · ${plan.label || "관찰"}` : button.textContent.trim();
  });
  document.querySelectorAll("[data-crypto-frame]").forEach((button) => {
    button.classList.toggle("active", button.dataset.cryptoFrame === state.cryptoFrame);
  });
  const frameTabs = document.querySelector("#cryptoTimeframeTabs");
  if (frameTabs) frameTabs.hidden = state.cryptoTab === "all";
}

function cryptoHeaderDateText({ frame = "", latestPlan = null } = {}) {
  const modeText = isLiveDate() ? "실시간" : "복기";
  const parts = [state.selectedDate, modeText];
  if (frame) parts.push(frame);
  const latestText = cryptoLatestSignalText(latestPlan);
  if (latestText) parts.push(latestText);
  return parts.join(" · ");
}

function cryptoLatestSignalText(plan = null) {
  if (!plan) return "";
  const name = plan.name ? `${plan.name} ` : "";
  const label = plan.label || plan.stageText || "관찰";
  const timeText = plan.signalTimeText && plan.signalTimeText !== "-" ? ` ${plan.signalTimeText}` : "";
  return `최근 ${name}${label}${timeText}`;
}

function cryptoLatestSignalPlan(plans = []) {
  return (Array.isArray(plans) ? plans : [])
    .filter(Boolean)
    .sort((a, b) => {
      const timeDiff = cryptoSignalTimeValue(b) - cryptoSignalTimeValue(a);
      if (timeDiff) return timeDiff;
      return cryptoSignalPriority(b.className) - cryptoSignalPriority(a.className);
    })[0] || null;
}

function cryptoSignalTimeValue(plan = {}) {
  const text = String(plan.signalTimeText || plan.trackingTime || "");
  const full = text.match(/(\d{4})-(\d{2})-(\d{2}).*?(\d{2}):(\d{2})/);
  if (full) return Date.UTC(Number(full[1]), Number(full[2]) - 1, Number(full[3]), Number(full[4]), Number(full[5]));
  const short = text.match(/(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  const year = Number(String(state.selectedDate || "").slice(0, 4)) || new Date().getFullYear();
  if (short) return Date.UTC(year, Number(short[1]) - 1, Number(short[2]), Number(short[3]), Number(short[4]));
  const time = text.match(/(\d{2}):(\d{2})/);
  if (time) {
    const base = parseDate(state.selectedDate) || new Date();
    return Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), Number(time[1]), Number(time[2]));
  }
  return 0;
}

function cryptoSignalPriority(className) {
  return { sell: 6, avoid: 5, warning: 4, candidate: 3, buy: 3, watch: 2, neutral: 1 }[signalClass(className)] || 0;
}

function cryptoSelectedAsset(assets = []) {
  return assets.find((asset) => cryptoAssetKey(asset) === state.cryptoTab) || null;
}

function cryptoAssetKey(asset = {}) {
  const profileKey = String(asset?.profile?.key || "").toLowerCase();
  if (profileKey) return profileKey;
  const labelKey = String(asset?.label || "").trim().toLowerCase();
  if (CRYPTO_ASSET_META[labelKey]) return labelKey;
  const symbolKey = String(asset?.symbol || "").split("-")[0].trim().toLowerCase();
  return CRYPTO_ASSET_META[symbolKey] ? symbolKey : symbolKey || labelKey || "coin";
}

function cryptoAssetName(asset = {}) {
  const key = cryptoAssetKey(asset);
  return asset?.profile?.name || CRYPTO_ASSET_META[key]?.name || asset?.label || asset?.symbol || "코인";
}

function cryptoAssetProfile(asset = {}) {
  const key = cryptoAssetKey(asset);
  const backend = asset?.profile || {};
  const fallback = CRYPTO_ASSET_META[key] || { name: cryptoAssetName(asset), assetType: "alt", typeLabel: "알트", capPct: 30 };
  const backendCapPct = number(backend.portfolio_cap_pct);
  const capPct = backendCapPct != null
    ? backendCapPct
    : fallback.capPct != null ? fallback.capPct : fallback.assetType === "cash" ? null : 30;
  return {
    key,
    name: backend.name || fallback.name || cryptoAssetName(asset),
    assetType: backend.asset_type || fallback.assetType || "alt",
    typeLabel: backend.type_label || fallback.typeLabel || "알트",
    capPct,
    poolCapPct: number(backend.exception_pool_cap_pct) ?? fallback.poolCapPct ?? null,
    approvedScope: backend.approved_scope ?? fallback.assetType !== "exception",
  };
}

function cryptoVisibleRows(rows = [], selectedDate = state.selectedDate) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.date && (!selectedDate || row.date <= selectedDate) && number(row.close) != null);
}

function ichimokuMid(rows = [], index = -1, period = 9) {
  const end = Math.min(index, rows.length - 1);
  const start = end - period + 1;
  if (start < 0) return null;
  const sample = rows.slice(start, end + 1)
    .map((row) => ({ high: number(row.high), low: number(row.low) }))
    .filter((row) => row.high != null && row.low != null);
  if (sample.length < period) return null;
  return (Math.max(...sample.map((row) => row.high)) + Math.min(...sample.map((row) => row.low))) / 2;
}

function ichimokuCloudAt(rows = [], index = -1) {
  const sourceIndex = index - 26;
  if (sourceIndex < 0) return { upper: null, lower: null, spanA: null, spanB: null };
  const tenkan = ichimokuMid(rows, sourceIndex, 9);
  const kijun = ichimokuMid(rows, sourceIndex, 26);
  const spanA = tenkan != null && kijun != null ? (tenkan + kijun) / 2 : null;
  const spanB = ichimokuMid(rows, sourceIndex, 52);
  const values = [spanA, spanB].filter((value) => value != null);
  return {
    spanA,
    spanB,
    upper: values.length ? Math.max(...values) : null,
    lower: values.length ? Math.min(...values) : null,
  };
}

function cryptoCloudPosition(close, cloud = {}) {
  if (close == null || cloud.upper == null || cloud.lower == null) return "unknown";
  if (close > cloud.upper) return "above";
  if (close < cloud.lower) return "below";
  return "inside";
}

function cryptoChikouState(rows = [], index = -1, close = null) {
  const lagIndex = index - 26;
  if (lagIndex < 0 || close == null) return "unknown";
  const lagCloud = ichimokuCloudAt(rows, lagIndex);
  if (lagCloud.upper == null || lagCloud.lower == null) return "unknown";
  if (close > lagCloud.upper) return "bullish";
  if (close < lagCloud.lower) return "bearish";
  return "inside";
}

function rollingExtremeAt(rows = [], index = -1, size = 20, key = "high", mode = "max", excludeCurrent = false) {
  const end = Math.min((excludeCurrent ? index - 1 : index), rows.length - 1);
  if (end < 0) return null;
  const start = Math.max(0, end - size + 1);
  const values = rows.slice(start, end + 1)
    .map((row) => number(row[key]))
    .filter((value) => value != null);
  if (!values.length) return null;
  return mode === "min" ? Math.min(...values) : Math.max(...values);
}

function movingAverageAt(rows = [], index = -1, size = 20, key = "close") {
  const end = Math.min(index, rows.length - 1);
  if (end < 0) return null;
  const start = Math.max(0, end - size + 1);
  const values = rows.slice(start, end + 1)
    .map((row) => number(row[key]))
    .filter((value) => value != null);
  return values.length >= Math.min(size, end + 1) ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function cryptoDailyAnalysis(rows = [], selectedDate = state.selectedDate) {
  const visible = cryptoVisibleRows(rows, selectedDate);
  const index = visible.length - 1;
  const latest = visible[index] || {};
  const close = number(latest.close);
  const cloud = ichimokuCloudAt(visible, index);
  const position = cryptoCloudPosition(close, cloud);
  const chikou = cryptoChikouState(visible, index, close);
  const low60 = rollingExtremeAt(visible, index, 60, "low", "min");
  const reboundPct = close != null && low60 ? close / low60 - 1 : null;
  const bottomBounce = reboundPct != null && reboundPct >= 0.07;
  const nearLower = close != null && cloud.lower != null && close >= cloud.lower && (close - cloud.lower) / close <= 0.035;

  if (position === "above" && chikou === "bullish") {
    return { label: "상단+후행", subText: "불타기 확인", position, chikou, bottomBounce, nearLower, reboundPct, cloud };
  }
  if (position === "above") {
    return { label: "구름 상단", subText: "기본물량 전환", position, chikou, bottomBounce, nearLower, reboundPct, cloud };
  }
  if (position === "inside") {
    return { label: "구름 내부", subText: "돌파 확인", position, chikou, bottomBounce, nearLower, reboundPct, cloud };
  }
  if (position === "below" && chikou === "bearish") {
    return { label: "하단+후행 이탈", subText: "기초 이하 관리", position, chikou, bottomBounce, nearLower, reboundPct, cloud };
  }
  if (position === "below") {
    return {
      label: "구름 아래",
      subText: bottomBounce ? `바닥 +${formatNum(reboundPct * 100, 1)}%` : "선발대 우선",
      position,
      chikou,
      bottomBounce,
      nearLower,
      reboundPct,
      cloud,
    };
  }
  return { label: "계산 대기", subText: "일봉 부족", position, chikou, bottomBounce, nearLower, reboundPct, cloud };
}

function cryptoDailyFibBoxAnalysis(rows = [], selectedDate = state.selectedDate) {
  const visible = cryptoVisibleRows(rows, selectedDate).slice(-365);
  const index = visible.length - 1;
  if (index < 30) {
    return { valid: false, label: "피보 대기", subText: "일봉 자료 부족", positionPct: null, levels: {} };
  }

  const highIndex = visible.reduce((best, row, rowIndex) => {
    const currentHigh = number(row.high);
    const bestHigh = number(visible[best]?.high);
    if (currentHigh == null) return best;
    if (bestHigh == null || currentHigh > bestHigh) return rowIndex;
    return best;
  }, 0);
  const afterHigh = visible.slice(highIndex);
  const lowOffset = afterHigh.reduce((best, row, rowIndex) => {
    const currentLow = number(row.low);
    const bestLow = number(afterHigh[best]?.low);
    if (currentLow == null) return best;
    if (bestLow == null || currentLow < bestLow) return rowIndex;
    return best;
  }, 0);
  const lowIndex = highIndex + lowOffset;
  if (lowIndex <= highIndex) {
    return { valid: false, label: "피보 대기", subText: "하락 추세 박스 대기", positionPct: null, levels: {} };
  }
  const trendHigh = number(visible[highIndex]?.high);
  const recentLow = number(visible[lowIndex]?.low);
  const close = number(visible[index]?.close);
  if (trendHigh == null || recentLow == null || close == null || trendHigh <= recentLow) {
    return { valid: false, label: "피보 대기", subText: "하락 박스 산출 대기", positionPct: null, levels: {} };
  }

  const downSpan = trendHigh - recentLow;
  const fib77Top = trendHigh - downSpan * 0.77;
  if (fib77Top <= recentLow) {
    return { valid: false, label: "피보 대기", subText: "77% 박스 대기", positionPct: null, levels: {} };
  }

  const boxSpan = fib77Top - recentLow;
  const rawPct = ((close - recentLow) / boxSpan) * 100;
  const positionPct = Math.max(0, Math.min(150, rawPct));
  const levels = {
    low: recentLow,
    box382: recentLow + boxSpan * 0.382,
    box50: recentLow + boxSpan * 0.5,
    box618: recentLow + boxSpan * 0.618,
    top: fib77Top,
    trendHigh,
  };
  const crossed382 = rawPct >= 38.2;
  const crossed50 = rawPct >= 50;
  const crossed618 = rawPct >= 61.8;
  const zone = crossed618 ? "61.8 돌파" : crossed50 ? "50 회복" : crossed382 ? "38.2 추가검토" : "38.2 대기";
  return {
    valid: true,
    label: `피보 ${formatNum(positionPct, 1)}%`,
    subText: `${zone} · 상단 ${formatNum(fib77Top, priceDigits(fib77Top))}`,
    positionPct,
    rawPct,
    zone,
    crossed382,
    crossed50,
    crossed618,
    addWatch: crossed382 && !crossed618,
    levels,
    trendHigh,
    recentLow,
    fib77Top,
  };
}

function cryptoFourHourAnalysis(rows = [], selectedDate = state.selectedDate) {
  const visible = cryptoVisibleRows(rows, selectedDate);
  const index = visible.length - 1;
  const latest = visible[index] || {};
  const close = number(latest.close);
  const closes = visible.slice(0, index + 1).map((row) => number(row.close)).filter((value) => value != null);
  const ma20 = averageLast(closes, 20);
  const ma30 = averageLast(closes, 30);
  const cloud = ichimokuCloudAt(visible, index);
  const position = cryptoCloudPosition(close, cloud);
  const chikou = cryptoChikouState(visible, index, close);
  const boxHigh = rollingExtremeAt(visible, index, 180, "high", "max", true);
  const boxBreak = close != null && boxHigh != null && close > boxHigh;
  const aboveMa20 = close != null && ma20 != null && close >= ma20;
  const aboveMa30 = close != null && ma30 != null && close >= ma30;
  const ma20Recovery = aboveMa20 && visible.slice(Math.max(0, index - 12), index).some((row, offset) => {
    const rowIndex = Math.max(0, index - 12) + offset;
    const rowClose = number(row.close);
    const rowMa20 = movingAverageAt(visible, rowIndex, 20);
    return rowClose != null && rowMa20 != null && rowClose < rowMa20;
  });
  const strong = position === "above" && chikou === "bullish" && boxBreak;

  if (strong) {
    return { label: "수급 돌파", subText: "구름·후행·30일 박스", position, chikou, boxBreak, boxHigh, strong, cloud, ma20, ma30, aboveMa20, aboveMa30, ma20Recovery };
  }
  if (ma20Recovery && aboveMa30) {
    return { label: "4H 20/30회복", subText: "단기파동 50% 후보", position, chikou, boxBreak, boxHigh, strong, cloud, ma20, ma30, aboveMa20, aboveMa30, ma20Recovery };
  }
  if (ma20Recovery || aboveMa20) {
    return { label: "4H 20회복", subText: "기초+10 단기파동", position, chikou, boxBreak, boxHigh, strong, cloud, ma20, ma30, aboveMa20, aboveMa30, ma20Recovery };
  }
  if (position === "above" && chikou === "bullish") {
    return { label: "구름 위", subText: "박스 돌파 대기", position, chikou, boxBreak, boxHigh, strong, cloud, ma20, ma30, aboveMa20, aboveMa30, ma20Recovery };
  }
  if (position === "above") {
    return { label: "상단 회복", subText: "후행 확인", position, chikou, boxBreak, boxHigh, strong, cloud, ma20, ma30, aboveMa20, aboveMa30, ma20Recovery };
  }
  if (position === "inside") {
    return { label: "구름 내부", subText: "수급 대기", position, chikou, boxBreak, boxHigh, strong, cloud, ma20, ma30, aboveMa20, aboveMa30, ma20Recovery };
  }
  if (position === "below") {
    return { label: "구름 아래", subText: "반등 확인", position, chikou, boxBreak, boxHigh, strong, cloud, ma20, ma30, aboveMa20, aboveMa30, ma20Recovery };
  }
  return { label: "계산 대기", subText: "240분봉 부족", position, chikou, boxBreak, boxHigh, strong, cloud, ma20, ma30, aboveMa20, aboveMa30, ma20Recovery };
}

function cryptoThirtyMinuteEntryAnalysis(rows = [], selectedDate = state.selectedDate) {
  const visible = cryptoVisibleRows(rows, selectedDate);
  const index = visible.length - 1;
  const latest = visible[index] || {};
  const close = number(latest.close);
  const cloud = ichimokuCloudAt(visible, index);
  const position = cryptoCloudPosition(close, cloud);
  const chikou = cryptoChikouState(visible, index, close);
  const boxHigh = rollingExtremeAt(visible, index, CRYPTO_INTRADAY_BOX_STOP_BARS, "high", "max", true);
  const boxBreak = close != null && boxHigh != null && close > boxHigh;
  const trendReversal = cryptoTrendReversalAnalysis(visible, index, close, position, chikou, boxBreak);
  const strong = boxBreak && position === "above" && chikou === "bullish";
  if (trendReversal.strong) {
    return { label: "추세전환형", subText: trendReversal.subText, position, chikou, boxBreak, boxHigh, strong: true, trendReversal, time: latest.time || latest.datetime || latest.date || "-" };
  }
  if (strong) {
    return { label: "30분 박스돌파", subText: `구름·후행·${CRYPTO_INTRADAY_BOX_STOP_BARS}봉 박스고점, 빠른진입`, position, chikou, boxBreak, boxHigh, strong, trendReversal, time: latest.time || latest.datetime || latest.date || "-" };
  }
  return { label: "30분 대기", subText: boxHigh != null ? `${CRYPTO_INTRADAY_BOX_STOP_BARS}봉 박스고점 ${formatNum(boxHigh, priceDigits(boxHigh))}, 빠른진입 기준` : "박스 산출 대기", position, chikou, boxBreak, boxHigh, strong, trendReversal, time: latest.time || latest.datetime || latest.date || "-" };
}

function cryptoTrendReversalAnalysis(rows = [], index = -1, close = null, position = null, chikou = null, boxBreak = false) {
  if (!Array.isArray(rows) || index < 0) {
    return { label: "전환 대기", subText: "30분 자료 대기", strong: false, score: 0 };
  }
  const closes = rows.slice(0, index + 1).map((row) => number(row.close)).filter((value) => value != null);
  const currentMa5 = averageLast(closes, 5);
  const currentMa20 = averageLast(closes, 20);
  const currentMa50 = averageLast(closes, 50);
  const currentMa100 = averageLast(closes, 100);
  const priorEnd = Math.max(0, closes.length - 41);
  const prior = closes.slice(0, priorEnd);
  const priorMa5 = averageLast(prior, 5);
  const priorMa20 = averageLast(prior, 20);
  const priorMa50 = averageLast(prior, 50);
  const priorMa100 = averageLast(prior, 100);
  const bullishStack = currentMa5 != null && currentMa20 != null && currentMa50 != null
    && currentMa5 >= currentMa20 && currentMa20 >= currentMa50;
  const longStack = currentMa100 != null && currentMa50 != null && currentMa50 >= currentMa100;
  const priorWeak = priorMa20 != null && priorMa50 != null && priorMa20 <= priorMa50
    || priorMa50 != null && priorMa100 != null && priorMa50 <= priorMa100
    || priorMa5 != null && priorMa20 != null && priorMa5 <= priorMa20;
  const reclaimLong = close != null && currentMa100 != null && close >= currentMa100;
  let score = 0;
  if (position === "above") score += 24;
  if (chikou === "bullish") score += 24;
  if (boxBreak) score += 22;
  if (bullishStack) score += 16;
  if (longStack || reclaimLong) score += 8;
  if (priorWeak) score += 6;
  const strong = score >= 76;
  return {
    label: strong ? "추세전환형" : bullishStack ? "정배열 대기" : "전환 대기",
    subText: strong
      ? `후행·구름·${CRYPTO_INTRADAY_BOX_STOP_BARS}봉 고점·정배열 전환`
      : bullishStack ? "정배열 전환 확인 중" : "역배열 해소 대기",
    strong,
    score,
    bullishStack,
    longStack,
    priorWeak,
    reclaimLong,
    ma5: currentMa5,
    ma20: currentMa20,
    ma50: currentMa50,
    ma100: currentMa100,
  };
}

function cryptoWeeklyTrendAnalysis(rows = [], selectedDate = state.selectedDate) {
  const visible = cryptoVisibleRows(rows, selectedDate);
  const index = visible.length - 1;
  const latest = visible[index] || {};
  const close = number(latest.close);
  if (index < 8 || close == null) {
    return { label: "주봉 대기", subText: "주봉 자료 대기", strong: false, starterOnly: false, score: 0 };
  }
  const closes = visible.slice(0, index + 1).map((row) => number(row.close)).filter((value) => value != null);
  const ma5 = averageLast(closes, 5);
  const ma10 = averageLast(closes, 10);
  const ma20 = averageLast(closes, 20);
  const kijun = ichimokuMid(visible, index, 26);
  const cloud = ichimokuCloudAt(visible, index);
  const position = cryptoCloudPosition(close, cloud);
  const chikou = cryptoChikouState(visible, index, close);
  const shortSupply = rollingExtremeAt(visible, index, 12, "high", "max", true);
  const midSupply = rollingExtremeAt(visible, index, 26, "high", "max", true);
  const aboveKijun = close != null && kijun != null && close >= kijun;
  const shortBreak = close != null && shortSupply != null && close > shortSupply;
  const midBreak = close != null && midSupply != null && close > midSupply;
  const bullishStack = ma5 != null && ma10 != null && ma20 != null && ma5 >= ma10 && ma10 >= ma20;
  const kijunGapPct = close != null && kijun != null && kijun > 0 ? ((close - kijun) / kijun) * 100 : null;
  const maGapPct = close != null && ma10 != null && ma10 > 0 ? ((close - ma10) / ma10) * 100 : null;
  const lateEntry = (kijunGapPct != null && kijunGapPct >= 18) || (maGapPct != null && maGapPct >= 12);
  let score = 0;
  if (aboveKijun) score += 28;
  if (shortBreak) score += 22;
  if (midBreak) score += 14;
  if (position === "above") score += 12;
  if (chikou === "bullish") score += 10;
  if (bullishStack) score += 10;
  if (lateEntry) score += 4;
  const strong = score >= 58 && aboveKijun && shortBreak;
  return {
    label: strong ? (lateEntry ? "주봉 늦은초입" : "주봉 상승초입") : aboveKijun ? "주봉 기준위" : "주봉 대기",
    subText: strong
      ? `기준선 위·단기매물 돌파${lateEntry ? " · 1% 탐색" : ""}`
      : aboveKijun ? "단기 매물대 돌파 확인" : "기준선 회복 대기",
    strong,
    starterOnly: strong && lateEntry,
    score,
    aboveKijun,
    shortBreak,
    midBreak,
    bullishStack,
    lateEntry,
    kijun,
    shortSupply,
    midSupply,
    kijunGapPct,
    maGapPct,
    cloud,
    position,
    chikou,
    time: latest.time || latest.datetime || latest.date || "-",
  };
}

function cryptoThirtyMinuteAnalysis(rows = [], selectedDate = state.selectedDate, options = {}) {
  const visible = cryptoVisibleRows(rows, selectedDate);
  const index = visible.length - 1;
  const latest = visible[index] || {};
  const close = number(latest.close);
  const profile = options.profile || {};
  const closes = visible.map((row) => number(row.close)).filter((value) => value != null);
  const ma5 = averageLast(closes, 5);
  const ma30 = averageLast(closes, 30);
  const cloud = ichimokuCloudAt(visible, index);
  const position = cryptoCloudPosition(close, cloud);
  const chikou = cryptoChikouState(visible, index, close);
  const tenkan = ichimokuMid(visible, index, 9);
  const kijun = ichimokuMid(visible, index, 26);
  const bottomStart = Math.max(0, index - CRYPTO_THIRTY_MINUTE_RISK_BARS);
  let recentBottomIndex = index;
  for (let cursor = bottomStart; cursor <= index; cursor += 1) {
    const currentLow = number(visible[cursor]?.low);
    const bottomLow = number(visible[recentBottomIndex]?.low);
    if (currentLow != null && (bottomLow == null || currentLow < bottomLow)) {
      recentBottomIndex = cursor;
    }
  }
  const bottomCloudUpper = ichimokuCloudAt(visible, recentBottomIndex).upper;
  const belowTenkan = close != null && tenkan != null && close < tenkan;
  const belowKijun = close != null && kijun != null && close < kijun;
  const belowBottomCloud = close != null && bottomCloudUpper != null && close < bottomCloudUpper;
  const boxStop = cryptoIntradayBoxStop(visible, index, CRYPTO_INTRADAY_BOX_STOP_BARS);
  const forcedReduce = cryptoForcedReduceAnalysis(visible, index, profile);
  const intradayFib = cryptoThirtyMinuteFibAnalysis(visible, index, boxStop, close);
  const reentry = cryptoReentryAnalysis(visible, index, profile, boxStop);
  const exceptionBoxStop = profile.assetType === "exception" && boxStop.broken;
  const finalStop = belowKijun && belowBottomCloud;
  const tenkanDistancePct = close != null && tenkan != null ? ((tenkan - close) / close) * 100 : null;
  const tenkanBufferPct = profile.assetType === "exception" ? CRYPTO_EXCEPTION_TENKAN_ALERT_BUFFER_PCT : CRYPTO_TENKAN_ALERT_BUFFER_PCT;
  const tenkanIsClose = tenkanDistancePct != null && tenkanDistancePct >= -tenkanBufferPct;
  const tenkanApproach = close != null && tenkan != null && close <= tenkan * (1 + CRYPTO_TENKAN_NEAR_PCT / 100);
  const belowMa5 = close != null && ma5 != null && close < ma5;
  const kijunTouch = close != null && kijun != null && close <= kijun * (1 + CRYPTO_LINE_TOUCH_BUFFER_PCT / 100);
  const ma30Touch = close != null && ma30 != null && close <= ma30 * (1 + CRYPTO_LINE_TOUCH_BUFFER_PCT / 100);
  const time = latest.time || latest.datetime || latest.date || "-";

  if (forcedReduce.hardTriggered) {
    return {
      label: "고점강제컷",
      subText: `최근 ${CRYPTO_THIRTY_MINUTE_RISK_BARS}봉 고점 대비 저가 -${formatNum(forcedReduce.touchDrawdownPct, 1)}%, ${formatNum(forcedReduce.hardThresholdPct, 1)}% 터치로 확정봉 대기 없이 기초 30% 축소`,
      status: "forced_reduce_hard",
      alert: true,
      alertOnly: false,
      finalStop: true,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      forcedDrawdownPct: forcedReduce.touchDrawdownPct,
      forcedThresholdPct: forcedReduce.hardThresholdPct,
      forcedRecentHigh: forcedReduce.recentHigh,
      close,
      position,
      chikou,
      time,
      targetSlotPct: CRYPTO_SLOT_PCT.starter,
    };
  }

  if (exceptionBoxStop) {
    return {
      label: "박스손절",
      subText: `30분 박스고점 ${formatNum(boxStop.level, priceDigits(boxStop.level))} 이탈, 예외 포지션 최종손절`,
      status: "box_final_stop",
      alert: true,
      alertOnly: false,
      finalStop: true,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      close,
      position,
      chikou,
      time,
      targetSlotPct: CRYPTO_SLOT_PCT.scout,
    };
  }

  if (intradayFib.confirmedBreak) {
    const targetSlotPct = intradayFib.priorTouchRebound ? CRYPTO_SLOT_PCT.scout : CRYPTO_SLOT_PCT.starter;
    return {
      label: intradayFib.priorTouchRebound ? "2차손절" : "피보손절",
      subText: `${intradayFib.label} · 61.8% ${formatNum(intradayFib.levels?.fib618, priceDigits(intradayFib.levels?.fib618))} 확정 이탈, ${targetSlotPct}%까지 축소`,
      status: intradayFib.priorTouchRebound ? "fib618_second_stop" : "fib618_final_stop",
      alert: true,
      alertOnly: false,
      finalStop: true,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      close,
      position,
      chikou,
      time,
      targetSlotPct,
    };
  }

  if (forcedReduce.triggered) {
    return {
      label: "고점컷 점검",
      subText: `최근 ${CRYPTO_THIRTY_MINUTE_RISK_BARS}봉 고점 ${formatNum(forcedReduce.recentHigh, priceDigits(forcedReduce.recentHigh))} 대비 -${formatNum(forcedReduce.drawdownPct, 1)}%, ${formatNum(forcedReduce.thresholdPct, 0)}% 축소 검토`,
      status: "forced_reduce_watch",
      alert: true,
      alertOnly: true,
      finalStop: false,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      forcedDrawdownPct: forcedReduce.drawdownPct,
      forcedThresholdPct: forcedReduce.thresholdPct,
      forcedRecentHigh: forcedReduce.recentHigh,
      close,
      position,
      chikou,
      time,
      targetSlotPct: null,
    };
  }

  if (intradayFib.touchRebound) {
    return {
      label: "손절터치반등",
      subText: `${intradayFib.label} · 61.8% 터치 후 종가 회복, 손절 보류 기록`,
      status: "fib618_touch_rebound",
      alert: true,
      alertOnly: true,
      finalStop: false,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      close,
      position,
      chikou,
      time,
    };
  }

  if (intradayFib.cutWatch) {
    return {
      label: "피보50 점검",
      subText: `${intradayFib.label} · 중심값 50% 이탈 시 컷 준비, 61.8% 재지지 확인`,
      status: "fib50_cut_watch",
      alert: true,
      alertOnly: true,
      finalStop: false,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      close,
      position,
      chikou,
      time,
    };
  }

  if (finalStop) {
    return {
      label: "최종손절",
      subText: "30분 바닥구름상단·기준선 이탈, 기초 30% 축소",
      status: "final_stop",
      alert: true,
      alertOnly: false,
      finalStop: true,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      close,
      position,
      chikou,
      time,
      targetSlotPct: CRYPTO_SLOT_PCT.starter,
    };
  }

  if (reentry.confirmed && (position === "above" || chikou === "bullish" || close != null && ma30 != null && close >= ma30)) {
    return {
      label: reentry.label,
      subText: `${reentry.subText} · 기초+10 40% 재증가 후보`,
      status: "reentry_bounce",
      alert: true,
      alertOnly: true,
      finalStop: false,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      close,
      position,
      chikou,
      time,
      targetSlotPct: CRYPTO_SLOT_PCT.starterPlus10,
    };
  }

  if (kijunTouch) {
    return {
      label: belowKijun ? "기준선 이탈" : "기준선 터치",
      subText: `기준선 ${formatNum(kijun, priceDigits(kijun))} · 2차 리스크 알림`,
      status: belowKijun ? "kijun_break_alert" : "kijun_touch_alert",
      alert: true,
      alertOnly: true,
      finalStop: false,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      close,
      position,
      chikou,
      time,
    };
  }

  if (ma30Touch) {
    return {
      label: close != null && ma30 != null && close < ma30 ? "30이평 이탈" : "30이평 터치",
      subText: `30이평 ${formatNum(ma30, priceDigits(ma30))} · 3차 리스크 알림`,
      status: close != null && ma30 != null && close < ma30 ? "ma30_break_alert" : "ma30_touch_alert",
      alert: true,
      alertOnly: true,
      finalStop: false,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      close,
      position,
      chikou,
      time,
    };
  }

  if (tenkanApproach && tenkanIsClose) {
    const action = belowTenkan ? "이탈" : "접근";
    return {
      label: `전환선 ${action}`,
      subText: `전환선 ${formatNum(tenkan, priceDigits(tenkan))} · ${formatNum(tenkanDistancePct, 1)}%, 알림만`,
      status: belowTenkan ? "tenkan_break_alert" : "tenkan_near_alert",
      alert: true,
      alertOnly: true,
      finalStop: false,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      close,
      position,
      chikou,
      time,
    };
  }

  if (belowTenkan) {
    return {
      label: "전환선 약화",
      subText: `전환선 ${formatNum(tenkan, priceDigits(tenkan))} 이탈, 최종손절선 확인`,
      status: "tenkan_break_watch",
      alert: false,
      alertOnly: true,
      finalStop: false,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      close,
      position,
      chikou,
      time,
    };
  }

  if (close != null && tenkan != null && close >= tenkan) {
    if (belowMa5) {
      return {
        label: "5이평 점검",
        subText: `5이평 ${formatNum(ma5, priceDigits(ma5))} 이탈, 단기물량 출회 주의`,
        status: "ma5_break_alert",
        alert: true,
        alertOnly: true,
        finalStop: false,
        ma5,
        ma30,
        tenkan,
        kijun,
        bottomCloudUpper,
        boxStopLevel: boxStop.level,
        boxStopTime: boxStop.time,
        intradayFib,
        reentry,
        close,
        position,
        chikou,
        time,
      };
    }
    const holdParts = [
      ma5 != null && close >= ma5 ? "5이평 유지" : null,
      "전환선 유지",
      ma30 != null && close >= ma30 ? "30이평 유지" : null,
      position === "above" ? "구름 위" : null,
      chikou === "bullish" ? "후행 유지" : null,
    ].filter(Boolean);
    return {
      label: "홀딩 유효",
      subText: holdParts.join(" · "),
      status: "hold",
      alert: false,
      ma5,
      ma30,
      tenkan,
      kijun,
      bottomCloudUpper,
      boxStopLevel: boxStop.level,
      boxStopTime: boxStop.time,
      intradayFib,
      reentry,
      close,
      position,
      chikou,
      time,
    };
  }

  return { label: "추적 대기", subText: "30분 전환선 확인 중", status: "watch", alert: false, alertOnly: false, finalStop: false, ma5, ma30, tenkan, kijun, bottomCloudUpper, boxStopLevel: boxStop.level, boxStopTime: boxStop.time, intradayFib, reentry, close, position, chikou, time };
}

function cryptoIntradayBoxStop(rows = [], index = -1, size = CRYPTO_INTRADAY_BOX_STOP_BARS) {
  if (!Array.isArray(rows) || index <= 0) return { level: null, time: null, broken: false };
  const start = Math.max(1, index - size + 1);
  let level = null;
  let time = null;
  for (let cursor = start; cursor <= index; cursor += 1) {
    const reference = rollingExtremeAt(rows, cursor, size, "high", "max", true);
    const close = number(rows[cursor]?.close);
    if (reference != null && close != null && close > reference) {
      level = reference;
      time = rows[cursor]?.time || rows[cursor]?.datetime || rows[cursor]?.date || null;
    }
  }
  const close = number(rows[index]?.close);
  return {
    level,
    time,
    broken: close != null && level != null && close < level,
  };
}

function cryptoThirtyMinuteFibAnalysis(rows = [], index = -1, boxStop = {}, close = null) {
  if (!Array.isArray(rows) || index <= 0 || close == null) {
    return { valid: false, label: "피보 대기", subText: "30분 박스 대기", levels: {} };
  }
  const latest = rows[index] || {};
  const latestLow = number(latest.low);
  const recentHigh = rollingExtremeAt(rows, index, CRYPTO_THIRTY_MINUTE_RISK_BARS, "high", "max", false);
  const rangeLow = rollingExtremeAt(rows, index, CRYPTO_THIRTY_MINUTE_RISK_BARS, "low", "min", true);
  const baseLevel = number(boxStop?.level) ?? rangeLow;
  if (recentHigh == null || baseLevel == null || recentHigh <= baseLevel) {
    return { valid: false, label: "피보 대기", subText: "돌파 박스 산출 대기", levels: {} };
  }
  const span = recentHigh - baseLevel;
  const fib382 = recentHigh - span * 0.382;
  const fib50 = recentHigh - span * 0.5;
  const fib618 = recentHigh - span * 0.618;
  const retracePct = ((recentHigh - close) / span) * 100;
  const supportLabel = close >= fib382
    ? "38.2 지지"
    : close >= fib50 ? "50 기준선 점검" : close >= fib618 ? "61.8 재지지" : "61.8 이탈";
  const cutWatch = close < fib50;
  const confirmedBreak = close < fib618;
  const touchRebound = latestLow != null && latestLow <= fib618 && close >= fib618;
  const priorTouchRebound = rows.slice(Math.max(0, index - 12), index).some((row) => {
    const low = number(row.low);
    const rowClose = number(row.close);
    return low != null && rowClose != null && low <= fib618 && rowClose >= fib618;
  });
  const pyramidWatch = close >= fib50 && close <= fib382;
  return {
    valid: true,
    label: `피보 ${formatNum(Math.max(0, Math.min(100, retracePct)), 1)}%`,
    subText: `${supportLabel} · 50% ${formatNum(fib50, priceDigits(fib50))}`,
    supportLabel,
    retracePct,
    cutWatch,
    confirmedBreak,
    touchRebound,
    priorTouchRebound,
    pyramidWatch,
    levels: {
      high: recentHigh,
      base: baseLevel,
      fib382,
      fib50,
      fib618,
    },
  };
}

function cryptoForcedReduceAnalysis(rows = [], index = -1, profile = {}) {
  const latest = Array.isArray(rows) ? rows[index] || {} : {};
  const close = number(latest.close);
  const low = number(latest.low);
  const recentHigh = rollingExtremeAt(rows, index, CRYPTO_THIRTY_MINUTE_RISK_BARS, "high", "max", false);
  const thresholdPct = CRYPTO_FORCED_REDUCE_DRAWDOWN_PCT[profile.assetType] ?? CRYPTO_FORCED_REDUCE_DRAWDOWN_PCT.alt;
  const hardThresholdPct = thresholdPct * CRYPTO_FORCED_REDUCE_HARD_MULTIPLIER;
  const drawdownPct = close != null && recentHigh != null && recentHigh > 0
    ? ((recentHigh - close) / recentHigh) * 100
    : null;
  const touchDrawdownPct = low != null && recentHigh != null && recentHigh > 0
    ? ((recentHigh - low) / recentHigh) * 100
    : drawdownPct;
  return {
    recentHigh,
    thresholdPct,
    hardThresholdPct,
    drawdownPct,
    touchDrawdownPct,
    hardTriggered: touchDrawdownPct != null && touchDrawdownPct >= hardThresholdPct,
    triggered: drawdownPct != null && drawdownPct >= thresholdPct,
  };
}

function cryptoReentryAnalysis(rows = [], index = -1, profile = {}, boxStop = {}) {
  if (!Array.isArray(rows) || index < 0) {
    return { confirmed: false, hardTrigger: false, label: "반등 대기", subText: "30분 자료 대기" };
  }
  const latest = rows[index] || {};
  const close = number(latest.close);
  const open = number(latest.open);
  const low = number(latest.low);
  const recentLow = rollingExtremeAt(rows, index, CRYPTO_REENTRY_LOOKBACK_BARS, "low", "min", false);
  const thresholdPct = CRYPTO_REENTRY_BOUNCE_PCT[profile.assetType] ?? CRYPTO_REENTRY_BOUNCE_PCT.alt;
  const reboundPct = close != null && recentLow != null && recentLow > 0 ? ((close - recentLow) / recentLow) * 100 : null;
  const wickPct = open != null && close != null && low != null && low > 0
    ? ((Math.min(open, close) - low) / low) * 100
    : null;
  const stopLine = number(boxStop.level);
  const lineWasBroken = stopLine != null && rows.slice(Math.max(0, index - 24), index).some((row) => {
    const rowClose = number(row.close);
    return rowClose != null && rowClose < stopLine;
  });
  const lineReclaimed = stopLine != null && close != null && close >= stopLine && lineWasBroken;
  const recentHigh = rollingExtremeAt(rows, index, CRYPTO_THIRTY_MINUTE_RISK_BARS, "high", "max", false);
  const drawdownFromHighPct = recentLow != null && recentHigh != null && recentHigh > 0
    ? ((recentHigh - recentLow) / recentHigh) * 100
    : null;
  const reduceThresholdPct = CRYPTO_FORCED_REDUCE_DRAWDOWN_PCT[profile.assetType] ?? CRYPTO_FORCED_REDUCE_DRAWDOWN_PCT.alt;
  const recoveryContext = lineWasBroken || (drawdownFromHighPct != null && drawdownFromHighPct >= reduceThresholdPct);
  const hardThresholdPct = thresholdPct * CRYPTO_REENTRY_HARD_MULTIPLIER;
  const hardTrigger = reboundPct != null && reboundPct >= hardThresholdPct;
  const confirmed = recoveryContext && (lineReclaimed || hardTrigger || (reboundPct != null && reboundPct >= thresholdPct) || (wickPct != null && wickPct >= thresholdPct));
  return {
    confirmed,
    hardTrigger,
    lineReclaimed,
    lineWasBroken,
    recoveryContext,
    stopLine,
    thresholdPct,
    reduceThresholdPct,
    hardThresholdPct,
    drawdownFromHighPct,
    reboundPct,
    wickPct,
    recentHigh,
    recentLow,
    targetSlotPct: CRYPTO_SLOT_PCT.starterPlus10,
    label: confirmed ? (hardTrigger ? "반등강제" : "바닥반등") : "반등 대기",
    subText: confirmed
      ? `${lineReclaimed ? `손절선 ${formatNum(stopLine, priceDigits(stopLine))} 회복 · ` : ""}저점대비 ${formatNum(reboundPct, 1)}% · 밑꼬리 ${formatNum(wickPct, 1)}%`
      : `${profile.typeLabel || "코인"} 기준 ${formatNum(thresholdPct, 0)}% 반등 대기`,
    time: latest.time || latest.datetime || latest.date || "-",
  };
}

function cryptoFourHourRiskAnalysis(rows = [], selectedDate = state.selectedDate) {
  const visible = cryptoVisibleRows(rows, selectedDate);
  const index = visible.length - 1;
  const close = number(visible[index]?.close);
  if (index < 12 || close == null) {
    return { valid: false, label: "4H방어 대기", subText: "자료 부족" };
  }
  const recentHigh = rollingExtremeAt(visible, index, 60, "high", "max", false);
  const recentLow = rollingExtremeAt(visible, index, 60, "low", "min", false);
  if (recentHigh == null || recentLow == null || recentHigh <= recentLow) {
    return { valid: false, label: "4H방어 대기", subText: "박스 산출 대기" };
  }
  const span = recentHigh - recentLow;
  const center = recentHigh - span * 0.5;
  const fib618 = recentHigh - span * 0.618;
  const centerBroken = close < center;
  const fib618Broken = close < fib618;
  return {
    valid: true,
    label: fib618Broken ? "4H 61.8 이탈" : centerBroken ? "4H 중심 이탈" : "4H 중심 지지",
    subText: centerBroken
      ? `중심 ${formatNum(center, priceDigits(center))} 아래, 추가 축소 검토`
      : `중심 ${formatNum(center, priceDigits(center))} 지지 확인`,
    recentHigh,
    recentLow,
    center,
    fib618,
    centerBroken,
    fib618Broken,
  };
}

function cryptoAllocationPlan(profile, daily, fourHour, thirtyEntry = {}, weekly = {}, context = {}) {
  if (profile.assetType === "cash") {
    return {
      slotPct: 0,
      portfolioPct: null,
      stageText: "현금성",
      className: "neutral",
      label: "현금성",
      capText: "현금 합산",
      slotText: "매수대상 아님",
      portfolioText: "현금+USDT",
      message: "USDT는 매매 코인이 아니라 현금과 합산하는 현금성 자산으로 분류합니다.",
    };
  }

  if (profile.assetType === "exception") {
    const weeklyStarter = Boolean(weekly.starterOnly);
    const entrySignal = (fourHour.strong || thirtyEntry.strong) && !weeklyStarter;
    const probePct = Math.min(CRYPTO_EXCEPTION_WEEKLY_PROBE_PORTFOLIO_PCT, profile.capPct || CRYPTO_EXCEPTION_WEEKLY_PROBE_PORTFOLIO_PCT);
    const slotPct = entrySignal
      ? CRYPTO_SLOT_PCT.base
      : weeklyStarter && profile.capPct ? (probePct / profile.capPct) * 100 : CRYPTO_SLOT_PCT.none;
    const portfolioPct = entrySignal
      ? (profile.capPct || 0) * slotPct / 100
      : weeklyStarter ? probePct : 0;
    return {
      slotPct,
      portfolioPct,
      weeklyStarter,
      wideStopPct: weeklyStarter ? CRYPTO_EXCEPTION_WEEKLY_WIDE_STOP_PCT : null,
      stageText: entrySignal ? (fourHour.strong ? "예외 기본" : "30분 예외") : weeklyStarter ? "주봉 탐색" : "대상외",
      className: entrySignal ? "candidate" : weeklyStarter ? "watch" : "neutral",
      label: entrySignal ? `예외 ${formatNum(slotPct, 0)}%` : weeklyStarter ? "탐색 1%" : "예외 대기",
      capText: `예외 ${formatNum(profile.capPct, 1)}%`,
      slotText: entrySignal ? `한도의 ${formatNum(slotPct, 0)}%` : weeklyStarter ? `주봉 탐색 ${formatNum(portfolioPct, 2)}%` : "4H/30분 돌파 전",
      portfolioText: portfolioPct ? `전체 ${formatNum(portfolioPct, 2)}%` : "전체 0%",
      message: entrySignal
        ? (fourHour.strong
          ? `정상 운용 감시군 밖의 코인이지만 4시간봉 후행스팬과 ${CRYPTO_INTRADAY_BOX_STOP_BARS}봉 박스 돌파가 나와 예외 한도의 65%만 허용합니다. 수익으로 비중이 커지는 부분은 허용하되 추가 운용은 사용자가 조정합니다.`
          : `정상 운용 감시군 밖의 코인이지만 30분봉 구름·후행·${CRYPTO_INTRADAY_BOX_STOP_BARS}봉 박스고점 돌파가 나와 예외 한도의 65%만 허용합니다. 수익으로 비중이 커지는 부분은 허용하되 추가 운용은 사용자가 조정합니다.`)
        : weeklyStarter
          ? `주봉 기준선 위에서 단기 매물대를 돌파한 상승초입입니다. 다만 이미 진입이 늦은 자리라 전체 ${formatNum(portfolioPct, 2)}% 탐색 진입만 보고 손절 폭은 ${formatNum(CRYPTO_EXCEPTION_WEEKLY_WIDE_STOP_PCT, 0)}% 이상 넓게 둡니다. 예외풀 5%를 넘기면 사용자 승인 후 6~10% 범위에서만 확장하고 최대 15%는 넘기지 않습니다. 응답이 없으면 기계적으로 +1%만 임시 허용합니다.`
        : "사용자 지정 감시군 밖의 코인은 4시간봉 또는 30분봉 박스 돌파 전까지 운용 대상에서 제외합니다.",
    };
  }

  let slotPct = CRYPTO_SLOT_PCT.scout;
  let stageText = "선발대";
  let message = "일봉이 구름 아래이거나 계산 자료가 부족해 선발대 5%만 유지합니다.";
  let baseRebuildNeeded = false;
  const majorRecoveryWave = profile.assetType === "major" && daily.position === "below" && (fourHour.ma20Recovery || fourHour.aboveMa20);

  if (daily.position === "above" && daily.chikou === "bullish") {
    slotPct = CRYPTO_SLOT_PCT.full;
    stageText = "맥스";
    message = "일봉 구름 상단과 후행스팬 상단 돌파가 같이 확인되어 맥스 100% 후보입니다.";
  } else if (daily.position === "above") {
    slotPct = CRYPTO_SLOT_PCT.base;
    stageText = "기본";
    message = "일봉이 구름 상단을 돌파해 기초물량에서 기본물량으로 전환합니다.";
    baseRebuildNeeded = true;
  } else if (daily.position === "inside" || daily.nearLower || daily.bottomBounce) {
    slotPct = CRYPTO_SLOT_PCT.starter;
    stageText = "기초";
    message = daily.bottomBounce
      ? "일봉은 아직 구름 아래지만 바닥 대비 7% 이상 반등해 기초물량을 셋업합니다."
      : "일봉이 구름대 안쪽 또는 하단 근처라 기초물량 중심으로 관리합니다.";
  }

  if (daily.position === "below" && daily.chikou === "bearish" && slotPct > CRYPTO_SLOT_PCT.starter) {
    slotPct = CRYPTO_SLOT_PCT.starter;
    stageText = "축소";
    message = "일봉 하단 이탈에 후행스팬 약세가 겹쳐 기초물량 이하로 축소 관리합니다.";
    baseRebuildNeeded = false;
  }

  if ((fourHour.ma20Recovery || fourHour.aboveMa20) && profile.assetType === "major" && slotPct < CRYPTO_SLOT_PCT.starterPlus10) {
    slotPct = CRYPTO_SLOT_PCT.starterPlus10;
    stageText = "기초+10";
    message = "메이저 코인이 4시간봉 20이평을 종가 회복해 기초물량에서 10%만 추가한 단기파동 후보입니다.";
  }

  if (
    profile.assetType === "major"
    && fourHour.aboveMa20
    && (thirtyEntry.boxBreak || thirtyEntry.trendReversal?.strong)
    && slotPct < CRYPTO_SLOT_PCT.starterPlus20
  ) {
    slotPct = CRYPTO_SLOT_PCT.starterPlus20;
    stageText = "기초+20";
    message = "4시간봉 20이평 위에서 30분봉 전고·구름·후행 돌파가 붙어 기초+20%까지 단기파동을 허용합니다. 아직 기본물량은 아닙니다.";
  }

  if (fourHour.strong && slotPct < CRYPTO_SLOT_PCT.base) {
    slotPct = CRYPTO_SLOT_PCT.base;
    stageText = "4H 기본";
    message = "4시간봉이 구름 위에 있고 후행스팬 상단과 30일 박스 상단을 돌파해 일봉 위치와 별개로 기본물량까지 허용합니다.";
    baseRebuildNeeded = true;
  }

  if (thirtyEntry.strong && slotPct < CRYPTO_SLOT_PCT.base && !majorRecoveryWave) {
    slotPct = CRYPTO_SLOT_PCT.base;
    stageText = "30분 기본";
    message = "30분봉 구름·후행·박스고점 돌파가 동시에 확인되어 기초물량에서 기본물량 65%로 늘리는 후보입니다.";
    baseRebuildNeeded = true;
  }

  const reentryCapActive = context.thirtyMinute?.status === "reentry_bounce" && context.reentry?.confirmed;
  if (reentryCapActive) {
    slotPct = CRYPTO_SLOT_PCT.starterPlus10;
    stageText = "재진입+10";
    message = "손절선 또는 최근 저점에서 강한 반등이 나와 바로 기본물량으로 복귀하지 않고 기초+10%까지만 재증가 후보로 봅니다.";
    baseRebuildNeeded = false;
  }

  const portfolioPct = profile.capPct * slotPct / 100;
  const className = slotPct >= CRYPTO_SLOT_PCT.base
    ? "candidate"
    : slotPct >= CRYPTO_SLOT_PCT.starter ? "watch" : "warning";
  return {
    slotPct,
    portfolioPct,
    stageText,
    className,
    label: `${stageText} ${formatNum(slotPct, 0)}%`,
    capText: `${profile.typeLabel} ${formatNum(profile.capPct, 0)}%`,
    slotText: `종목 ${formatNum(slotPct, 0)}%`,
    portfolioText: `전체 ${formatNum(portfolioPct, 1)}%`,
    message,
    baseRebuildNeeded,
  };
}

function cryptoBaseRebuildOrderPlan(profile = {}, allocation = {}, context = {}) {
  const slotPct = number(allocation.slotPct);
  const capPct = number(profile.capPct);
  if (profile.assetType === "cash" || profile.assetType === "exception" || capPct == null) {
    return { active: false, text: "-", subText: "기본증가 대상 아님" };
  }
  if (!allocation.baseRebuildNeeded || slotPct == null || slotPct < CRYPTO_SLOT_PCT.base || slotPct >= CRYPTO_SLOT_PCT.full) {
    return { active: false, text: "대기", subText: `기초 30%에서 기본 65% 전환 시 시장 ${formatNum(CRYPTO_BASE_REBUILD_MARKET_SLOT_PCT, 0)}%+지정 20%` };
  }

  const addSlotPct = CRYPTO_SLOT_PCT.base - CRYPTO_SLOT_PCT.starter;
  const marketSlotPct = Math.min(CRYPTO_BASE_REBUILD_MARKET_SLOT_PCT, addSlotPct);
  const limitSlotPct = Math.max(0, addSlotPct - marketSlotPct);
  const close = number(context.close);
  const cloudUpper = number(context.cloudUpper);
  const lowDiscountPct = CRYPTO_BASE_REBUILD_LIMIT_DISCOUNT_PCT[0];
  const highDiscountPct = CRYPTO_BASE_REBUILD_LIMIT_DISCOUNT_PCT[1];
  const limitHigh = close != null ? close * (1 - lowDiscountPct / 100) : cloudUpper;
  const limitLow = close != null ? close * (1 - highDiscountPct / 100) : null;
  const cloudText = cloudUpper != null ? `구름상단 ${formatNum(cloudUpper, priceDigits(cloudUpper))}` : "구름대 대기";
  const limitText = limitHigh != null && limitLow != null
    ? `${formatNum(limitHigh, priceDigits(limitHigh))}~${formatNum(limitLow, priceDigits(limitLow))}`
    : "2~7% 아래";
  return {
    active: true,
    addSlotPct,
    marketSlotPct,
    limitSlotPct,
    marketPortfolioPct: capPct * marketSlotPct / 100,
    limitPortfolioPct: capPct * limitSlotPct / 100,
    limitHigh,
    limitLow,
    cloudUpper,
    text: `시장 ${formatNum(marketSlotPct, 0)}%+지정 ${formatNum(limitSlotPct, 0)}%`,
    subText: `${limitText} · ${cloudText}`,
    message: `기초 30%에서 기본 65%로 늘릴 때 추가 ${formatNum(addSlotPct, 0)}% 중 ${formatNum(marketSlotPct, 0)}%는 즉시 시장가, ${formatNum(limitSlotPct, 0)}%는 현재가 2~7% 아래 또는 구름대 근처 지정가로 나눕니다. 가격이 도망가면 지정가를 시장가로 수정합니다.`,
  };
}

function cryptoPyramidOrderPlan(profile = {}, allocation = {}, context = {}) {
  const slotPct = number(allocation.slotPct);
  const capPct = number(profile.capPct);
  if (profile.assetType === "cash" || capPct == null) {
    return { active: false, text: "-", subText: "매수대상 아님" };
  }
  if (slotPct == null || slotPct < CRYPTO_SLOT_PCT.base) {
    return { active: false, text: "대기", subText: `기본 65% 이후 예약 ${formatNum(CRYPTO_PYRAMID_ADD_SLOT_PCT, 1)}% · +${formatNum(CRYPTO_PYRAMID_VERTICAL_RISE_PCT, 0)}%/+${formatNum(CRYPTO_PYRAMID_SECOND_RISE_PCT, 0)}%/${formatNum(CRYPTO_PYRAMID_PULLBACK_PCT, 0)}%눌림` };
  }
  const remainingSlotPct = Math.max(0, CRYPTO_SLOT_PCT.full - slotPct);
  if (remainingSlotPct <= 0) {
    return { active: false, complete: true, text: "완료", subText: "100% 투입 상태" };
  }
  if (!context.trendConfirmed) {
    return {
      active: false,
      text: "추세대기",
      subText: `일봉 구름·후행 확인 후 +${formatNum(CRYPTO_PYRAMID_VERTICAL_RISE_PCT, 0)}%/+${formatNum(CRYPTO_PYRAMID_SECOND_RISE_PCT, 0)}%/${formatNum(CRYPTO_PYRAMID_PULLBACK_PCT, 0)}% 눌림`,
    };
  }

  const reserveSlotPct = Math.min(CRYPTO_PYRAMID_ADD_SLOT_PCT, remainingSlotPct);
  const marketSlotPct = Math.min(CRYPTO_PYRAMID_MARKET_SLOT_PCT, reserveSlotPct);
  const reservePortfolioPct = capPct * reserveSlotPct / 100;
  const marketPortfolioPct = capPct * marketSlotPct / 100;
  const close = number(context.close);
  const averagePrice = number(context.averagePrice) ?? number(context.orderPrice) ?? close;
  const recentHigh = number(context.recentHigh) ?? close;
  const firstTriggerPrice = averagePrice != null ? averagePrice * (1 + CRYPTO_PYRAMID_VERTICAL_RISE_PCT / 100) : null;
  const secondTriggerPrice = averagePrice != null ? averagePrice * (1 + CRYPTO_PYRAMID_SECOND_RISE_PCT / 100) : null;
  const pullbackPrice = recentHigh != null && averagePrice != null && recentHigh > averagePrice
    ? recentHigh - (recentHigh - averagePrice) * (CRYPTO_PYRAMID_PULLBACK_PCT / 100)
    : null;
  const marketTrigger = close != null && firstTriggerPrice != null && close >= firstTriggerPrice;
  const continuationTrigger = close != null && secondTriggerPrice != null && close >= secondTriggerPrice;
  const pullbackTrigger = close != null && pullbackPrice != null && close <= pullbackPrice;
  const priceDigitsForOrder = priceDigits(averagePrice ?? close);
  const firstText = firstTriggerPrice != null ? `+${formatNum(CRYPTO_PYRAMID_VERTICAL_RISE_PCT, 0)}% ${formatNum(firstTriggerPrice, priceDigitsForOrder)}` : "+10% 대기";
  const secondText = secondTriggerPrice != null ? `+${formatNum(CRYPTO_PYRAMID_SECOND_RISE_PCT, 0)}% ${formatNum(secondTriggerPrice, priceDigitsForOrder)}` : "+20% 대기";
  const pullbackText = pullbackPrice != null ? `${formatNum(CRYPTO_PYRAMID_PULLBACK_PCT, 0)}%눌림 ${formatNum(pullbackPrice, priceDigitsForOrder)}` : "77%눌림 대기";
  const subText = `${firstText} · ${secondText} · ${pullbackText}`;
  const text = continuationTrigger
    ? `추세추가 ${formatNum(marketSlotPct, 1)}%`
    : marketTrigger
    ? `시장가 ${formatNum(marketSlotPct, 1)}%`
    : pullbackTrigger ? `눌림 ${formatNum(marketSlotPct, 1)}%` : `대기 ${formatNum(marketSlotPct, 1)}%+${formatNum(marketSlotPct, 1)}%`;
  return {
    active: true,
    marketTrigger: marketTrigger || continuationTrigger,
    continuationTrigger,
    pullbackTrigger,
    orderPrice: pullbackPrice,
    triggerPrice: firstTriggerPrice,
    firstTriggerPrice,
    secondTriggerPrice,
    pullbackPrice,
    averagePrice,
    recentHigh,
    reserveSlotPct,
    marketSlotPct,
    reservePortfolioPct,
    marketPortfolioPct,
    text,
    subText,
    message: continuationTrigger
      ? `진입 대비 +${formatNum(CRYPTO_PYRAMID_SECOND_RISE_PCT, 0)}% 이상 추세가 이어져 남은 불타기 ${formatNum(marketSlotPct, 1)}%까지 최종 맥스 비중 후보입니다. 예외 코인은 수익 증가분은 허용하되 추가 운용은 사용자 확인이 필요합니다.`
      : marketTrigger
      ? `초기 65% 이후 +${formatNum(CRYPTO_PYRAMID_VERTICAL_RISE_PCT, 0)}% 상승 트리거입니다. 남은 ${formatNum(CRYPTO_PYRAMID_ADD_SLOT_PCT, 1)}% 중 ${formatNum(marketSlotPct, 1)}%는 시장가 추가 매수 신호입니다.`
      : pullbackTrigger
        ? `최고점과 평균단가 사이 ${formatNum(CRYPTO_PYRAMID_PULLBACK_PCT, 0)}% 눌림 자리입니다. 남은 ${formatNum(CRYPTO_PYRAMID_ADD_SLOT_PCT, 1)}% 중 나머지 ${formatNum(marketSlotPct, 1)}% 추가 진입 신호입니다.`
        : `불타기는 무조건이 아니라 일봉 구름·후행 추세 확인 상태에서 +${formatNum(CRYPTO_PYRAMID_VERTICAL_RISE_PCT, 0)}% 1차, +${formatNum(CRYPTO_PYRAMID_SECOND_RISE_PCT, 0)}% 추세지속 또는 ${formatNum(CRYPTO_PYRAMID_PULLBACK_PCT, 0)}% 눌림 2차로 나눕니다.`,
  };
}

function cryptoExceptionExposureSummary(exceptionAssets = [], normalAssets = []) {
  const plans = (Array.isArray(exceptionAssets) ? exceptionAssets : [])
    .map((asset) => cryptoSignalPlan(asset, normalAssets, { exceptionMode: true }));
  const activePlans = plans.filter((plan) => number(plan.portfolioPct) != null && number(plan.portfolioPct) > 0);
  const plannedPct = activePlans.reduce((sum, plan) => sum + (number(plan.portfolioPct) || 0), 0);
  const requiresApproval = plannedPct > CRYPTO_EXCEPTION_APPROVAL_DEFAULT_POOL_PCT;
  const suggestedPct = requiresApproval
    ? Math.min(CRYPTO_EXCEPTION_ABSOLUTE_MAX_POOL_PCT, Math.max(CRYPTO_EXCEPTION_APPROVAL_RANGE[0], Math.ceil(plannedPct)))
    : CRYPTO_EXCEPTION_APPROVAL_DEFAULT_POOL_PCT;
  return {
    plans,
    activePlans,
    plannedPct,
    requiresApproval,
    suggestedPct,
    rangeText: `${CRYPTO_EXCEPTION_APPROVAL_RANGE.join("·")}%`,
    maxPct: CRYPTO_EXCEPTION_ABSOLUTE_MAX_POOL_PCT,
  };
}

function cryptoMetricItems(assets = [], exceptionAssets = [], cashAssets = []) {
  const plans = assets.map((asset) => cryptoSignalPlan(asset, assets));
  const exceptionPlans = exceptionAssets.map((asset) => cryptoSignalPlan(asset, assets, { exceptionMode: true }));
  const exceptionExposure = cryptoExceptionExposureSummary(exceptionAssets, assets);
  const baseOrHigher = plans.filter((plan) => plan.slotPct >= CRYPTO_SLOT_PCT.base).length;
  const exceptionEntries = exceptionPlans.filter((plan) => plan.slotPct >= CRYPTO_SLOT_PCT.base).length;
  const strongest = plans
    .filter((plan) => number(plan.portfolioPct) != null)
    .sort((a, b) => (b.portfolioPct || 0) - (a.portfolioPct || 0))[0];
  const cashText = cashAssets.length ? cashAssets.map((asset) => asset.label || cryptoAssetName(asset)).join("+") : "USDT";
  return [
    { label: "감시군", value: formatNum(assets.length, 0), text: "BTC·ETH·XRP·XLM" },
    { label: "메이저 한도", value: "70%", text: "BTC/ETH 종목별" },
    { label: "알트 한도", value: "30%", text: "XRP/XLM 종목별" },
    { label: "예외풀", value: `${formatNum(exceptionExposure.plannedPct || 0, 1)}%`, text: exceptionExposure.requiresApproval ? `${exceptionExposure.rangeText} 승인 필요` : `기본 5% · ${exceptionEntries}개 신호` },
    { label: "현금성", value: cashText, text: "현금과 합산" },
    { label: "기본 이상", value: `${baseOrHigher}개`, text: strongest ? `${strongest.name} ${strongest.portfolioText}` : "수급 대기" },
  ];
}

function cryptoSignalGridItems(items = []) {
  return items.map((item) => `
    <article>
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      ${item.text ? `<small>${escapeHtml(item.text)}</small>` : ""}
    </article>
  `).join("");
}

function cryptoExceptionApprovalCard(exceptionAssets = [], normalAssets = []) {
  const exposure = cryptoExceptionExposureSummary(exceptionAssets, normalAssets);
  if (!exposure.requiresApproval) return "";
  const activeNames = exposure.activePlans.map((plan) => plan.name).join("·") || "예외 후보";
  return `
    <article class="crypto-signal-card warning">
      <header>
        <h2>예외풀 승인</h2>
        <span class="signal-pill warning">사용자 확인</span>
      </header>
      <p class="crypto-card-summary">예외 후보 합산 ${formatNum(exposure.plannedPct, 2)}% · 승인 전 기본 ${formatNum(CRYPTO_EXCEPTION_APPROVAL_DEFAULT_POOL_PCT, 0)}%를 넘는 구간입니다.</p>
      <details class="crypto-card-details">
        <summary>승인 조건 보기</summary>
        <p>예외 코인 후보를 더 편입하면 기본 5% 한도를 넘습니다. 허용 범위는 ${exposure.rangeText} 중에서 사용자 승인으로 정하고, 응답이 없으면 +1%만 임시 허용합니다. 어떤 경우에도 전체 포트의 ${formatNum(exposure.maxPct, 0)}%는 넘기지 않습니다.</p>
        <div class="crypto-signal-grid">
          ${cryptoSignalGridItems([
          { label: "후보합산", value: `${formatNum(exposure.plannedPct, 2)}%`, text: activeNames },
          { label: "기본한도", value: `${formatNum(CRYPTO_EXCEPTION_APPROVAL_DEFAULT_POOL_PCT, 0)}%`, text: "승인 전 기준" },
          { label: "승인범위", value: exposure.rangeText, text: "단계별 허용" },
          { label: "절대상한", value: `${formatNum(exposure.maxPct, 0)}%`, text: "초과 금지" },
        ])}
        </div>
      </details>
    </article>
  `;
}

function cryptoDetailMetricItems(asset, allAssets = [], signal = null, rows = []) {
  const selected = cryptoLatestRow(rows) || asset?.selected || asset?.latest || {};
  const close = number(selected.close);
  const selectedTimeText = cryptoSignalTimeText(selected);
  const btc = allAssets.find((item) => String(item.label || "").toUpperCase() === "BTC");
  const btcPlan = btc ? cryptoSignalPlan(btc, allAssets) : null;
  const btcText = cryptoAssetKey(asset) === "btc"
    ? "시장 기준"
    : btcPlan?.slotPct < CRYPTO_SLOT_PCT.starter
      ? "BTC 약세 반영"
      : "BTC 필터 통과";
  const finalStopValue = signal?.weeklyStarter
    ? signal?.stopText || "-"
    : signal?.trackingRule?.startsWith?.("fib618") && signal?.thirtyFib?.levels?.fib618 != null ? formatNum(signal.thirtyFib.levels.fib618, priceDigits(signal.thirtyFib.levels.fib618))
    : signal?.finalStopLevel != null ? formatNum(signal.finalStopLevel, priceDigits(signal.finalStopLevel))
    : signal?.thirtyBoxStopLevel != null ? formatNum(signal.thirtyBoxStopLevel, priceDigits(signal.thirtyBoxStopLevel)) : signal?.thirtyKijun != null ? formatNum(signal.thirtyKijun, priceDigits(signal.thirtyKijun)) : "-";
  const finalStopText = signal?.weeklyStarter
    ? `주봉 탐색 ${formatNum(CRYPTO_EXCEPTION_WEEKLY_WIDE_STOP_PCT, 0)}% 손절`
    : signal?.trackingRule?.startsWith?.("fib618") ? "30분 피보 61.8%"
    : signal?.thirtyBoxStopLevel != null ? "30분 돌파 박스고점" : signal?.thirtyBottomCloudUpper != null ? `바닥구름상단 ${formatNum(signal.thirtyBottomCloudUpper, priceDigits(signal.thirtyBottomCloudUpper))}` : "30분 기준선 대기";
  const items = [
    { label: "현재가", value: formatNum(close, priceDigits(close)), text: selectedTimeText || selected.date || "-" },
    { label: "신호시각", value: signal?.signalTimeText || "-", text: "시간·분 기준" },
    { label: "구분", value: signal?.typeLabel || "-", text: signal?.capText || btcText },
    { label: "목표비중", value: signal?.portfolioText || "-", text: signal?.slotText || "-" },
    { label: "목표축소", value: signal?.riskTargetText || "-", text: signal?.trackingAlert ? "손절 후 유지 비중" : "위험 시 기준" },
    { label: "기본증가", value: signal?.baseBuildOrderText || "-", text: signal?.baseBuildOrderSubText || "-" },
    { label: "불타기주문", value: signal?.pyramidOrderText || "-", text: signal?.pyramidOrderSubText || "-" },
    { label: "일봉 위치", value: signal?.dailyText || "-", text: signal?.dailySubText || "-" },
    { label: "피보박스", value: signal?.fibBoxText || "-", text: signal?.fibBoxSubText || "-" },
    { label: "주봉 전환", value: signal?.weeklyTrendText || "-", text: signal?.weeklyTrendSubText || "기준선·단기매물 돌파 확인" },
    { label: "4H 수급", value: signal?.fourHourText || "-", text: signal?.fourHourSubText || "-" },
    { label: "4H 방어", value: signal?.fourHourRiskText || "-", text: signal?.fourHourRiskSubText || "-" },
    { label: "추세전환", value: signal?.trendReversalText || "-", text: signal?.trendReversalSubText || "후행·구름·정배열 전환 대기" },
    { label: "30분 추적", value: signal?.thirtyText || "-", text: signal?.thirtySubText || "-" },
    { label: "30분 진입", value: signal?.thirtyEntryText || "-", text: signal?.thirtyEntrySubText || "-" },
    { label: "30분 피보", value: signal?.thirtyFibText || "-", text: signal?.thirtyFibSubText || "38.2·50·61.8 지지 확인" },
    { label: "고점컷", value: signal?.forcedReduceText || "-", text: signal?.forcedReduceSubText || "메이저15·알트20·예외25%" },
    { label: "최종손절선", value: finalStopValue, text: finalStopText },
  ];
  return items.filter((item, index) => [0, 3, 4, 5, 10, 11, 13, 17].includes(index));
}

function cryptoSignalCard(asset, allAssets = [], options = {}) {
  const signal = cryptoSignalPlan(asset, allAssets, options);
  const score = cryptoQualityScore(signal);
  const decision = signalDecisionSummary({
    scope: "crypto",
    signal: signal.className,
    signalScore: score,
    badge: signal.label,
    detail: signal.message || signal.thirtySubText,
    actionText: signal.backendAction || "",
  });
  const focusKey = collectionItemKey("crypto", signal.key);
  const removeButton = options.removable
    ? `<button class="mini-remove" type="button" data-crypto-remove="${escapeAttr(signal.key)}">삭제</button>`
    : "";
  const coreItems = [
    { label: "현재가", value: formatNum(signal.close, priceDigits(signal.close)), text: signal.signalTimeText },
    { label: "목표비중", value: signal.portfolioText, text: signal.slotText },
    { label: "목표축소", value: signal.riskTargetText, text: signal.trackingAlert ? "손절 후 유지 비중" : "위험 때 기준" },
    { label: "최종손절", value: signal.stopText, text: signal.trailText },
  ];
  const detailItems = [
    { label: "허용한도", value: signal.capText },
    { label: "신호시각", value: signal.signalTimeText },
    { label: "목표축소", value: signal.riskTargetText },
    { label: "기본증가", value: signal.baseBuildOrderText },
    { label: "불타기주문", value: signal.pyramidOrderText },
    { label: "일봉", value: signal.dailyText },
    { label: "피보박스", value: signal.fibBoxText },
    { label: "주봉", value: signal.weeklyTrendText },
    { label: "4시간", value: signal.fourHourText },
    { label: "4H방어", value: signal.fourHourRiskText },
    { label: "추세전환", value: signal.trendReversalText },
    { label: "30분", value: signal.thirtyText },
    { label: "30분진입", value: signal.thirtyEntryText },
    { label: "30분피보", value: signal.thirtyFibText },
    { label: "고점컷", value: signal.forcedReduceText },
    { label: "익절1", value: signal.take1Text },
    { label: "익절2", value: signal.take2Text },
  ];
  const summaryText = [
    signal.message,
    signal.baseBuildOrder?.active ? signal.baseBuildOrderSubText : "",
    signal.pyramidOrder?.active ? signal.pyramidOrderSubText : "",
  ].filter(Boolean).join(" ");
  const focusClass = state.cryptoTab === signal.key ? " is-chart-focus" : "";
  return `
    <article class="crypto-signal-card ${escapeAttr(signal.className)}${focusClass}" data-focus-key="${escapeAttr(focusKey)}" data-crypto-focus="${escapeAttr(signal.key)}">
      <header>
        <h2>${escapeHtml(signal.name)}</h2>
        <span class="signal-pill ${escapeAttr(signal.className)}">${escapeHtml(signal.label)}</span>
        ${scoreBadgeHtml(score, signal.className)}
        ${removeButton}
      </header>
      <details class="crypto-card-details">
        <summary>상세 조건 보기</summary>
        <div class="crypto-detail-section">
          <strong>핵심 판단</strong>
          <p class="crypto-card-summary">${escapeHtml(summaryText || "코인 감시 조건을 요약합니다.")}</p>
          ${decisionDetailHtml(decision)}
        </div>
        <div class="crypto-detail-section">
          <strong>비중/리스크</strong>
          <div class="crypto-signal-grid">
            ${cryptoSignalGridItems(coreItems)}
          </div>
        </div>
        <div class="crypto-detail-section">
          <strong>차트 조건</strong>
          <div class="crypto-signal-grid">
            ${cryptoSignalGridItems(detailItems)}
          </div>
        </div>
      </details>
    </article>
  `;
}

function cryptoSignalPlan(asset, allAssets = [], options = {}) {
  const displayFrame = options.frame || "1d";
  const displayRows = Array.isArray(options.rows) ? options.rows : Array.isArray(asset?.history) ? asset.history : [];
  const selected = options.selected || cryptoLatestRow(displayRows) || asset?.selected || asset?.latest || {};
  const signalRow = cryptoLatestRow(cryptoRowsForFrame(asset, "30m")) || selected;
  const close = number(selected.close);
  const profile = cryptoAssetProfile(asset);
  const daily = cryptoDailyAnalysis(asset?.history || [], state.selectedDate);
  const fibBox = cryptoDailyFibBoxAnalysis(asset?.history || [], state.selectedDate);
  const thirtyRows = cryptoRowsForFrame(asset, "30m");
  const weekly = cryptoWeeklyTrendAnalysis(cryptoRowsForFrame(asset, "1w"), state.selectedDate);
  const fourHourRows = cryptoRowsForFrame(asset, "240m");
  const fourHour = cryptoFourHourAnalysis(fourHourRows, state.selectedDate);
  const fourHourRisk = cryptoFourHourRiskAnalysis(fourHourRows, state.selectedDate);
  const thirtyEntry = cryptoThirtyMinuteEntryAnalysis(thirtyRows, state.selectedDate);
  const thirtyMinute = cryptoThirtyMinuteAnalysis(thirtyRows, state.selectedDate, { profile });
  const allocation = cryptoAllocationPlan(profile, daily, fourHour, thirtyEntry, weekly, { reentry: thirtyMinute.reentry, thirtyMinute });
  const entered = allocation.slotPct >= CRYPTO_SLOT_PCT.base || allocation.weeklyStarter;
  const noticeAfterExit = ["reentry_bounce", "fib618_touch_rebound"].includes(thirtyMinute.status);
  const trackingExit = entered && !allocation.weeklyStarter && thirtyMinute.finalStop;
  const trackingNotice = !allocation.weeklyStarter && thirtyMinute.alert && thirtyMinute.alertOnly && (entered || noticeAfterExit);
  const addPyramidCandidate = Boolean(fibBox.addWatch && entered && thirtyMinute.status === "hold");
  const trendConfirmed = daily.position === "above" && daily.chikou === "bullish";
  const className = trackingExit ? "sell" : trackingNotice ? "warning" : allocation.className;
  const requestedTargetSlotPct = number(thirtyMinute.targetSlotPct) ?? CRYPTO_SLOT_PCT.starter;
  const riskTargetSlotPct = trackingExit && requestedTargetSlotPct === CRYPTO_SLOT_PCT.starter && (fourHourRisk.centerBroken || fourHourRisk.fib618Broken)
    ? CRYPTO_SLOT_PCT.reduced
    : requestedTargetSlotPct;
  const riskTargetText = `${formatNum(riskTargetSlotPct, 0)}%`;
  const trackingExitLabel = {
    box_final_stop: "박스손절",
    forced_reduce_hard: "강제축소",
    fib618_second_stop: "2차손절",
    fib618_final_stop: "61.8손절",
    final_stop: "최종손절",
  }[thirtyMinute.status] || "최종손절";
  const label = trackingExit ? trackingExitLabel : trackingNotice ? thirtyMinute.label : allocation.label;
  const tracksThirtyMinute = entered || trackingNotice || allocation.slotPct >= CRYPTO_SLOT_PCT.starterPlus10;
  const thirtyDisplayText = allocation.weeklyStarter && thirtyMinute.finalStop
    ? "주봉관찰"
    : tracksThirtyMinute ? thirtyMinute.label : "진입 전";
  const thirtyDisplaySubText = allocation.weeklyStarter && thirtyMinute.finalStop
    ? `주봉 탐색 1%는 30분 박스손절보다 ${formatNum(CRYPTO_EXCEPTION_WEEKLY_WIDE_STOP_PCT, 0)}% 이상 넓은 손절을 우선 적용하고, 박스 이탈은 참고 알림으로 봅니다.`
    : tracksThirtyMinute ? thirtyMinute.subText : "30분봉 추적은 진입 후 적용";
  const stopActionText = {
    box_final_stop: `예외 포지션은 선발대 ${riskTargetText}만 남기는 최종손절 기준입니다.`,
    forced_reduce_hard: `메이저15·알트20·예외25% 기준을 10% 넘게 터치해 확정봉을 기다리지 않고 ${riskTargetText}까지 즉시 축소합니다.`,
    fib618_second_stop: `앞서 61.8% 터치 반등을 기록한 뒤 재이탈했으므로 ${riskTargetText}까지 2차 축소합니다.`,
    fib618_final_stop: `30분 61.8% 확정 이탈로 ${riskTargetText}까지 축소하고 손절선 회복 여부를 추적합니다.`,
  }[thirtyMinute.status] || `${fourHourRisk.centerBroken ? "4시간 중심값 회복이 약해 " : ""}${riskTargetText}까지 축소하고, 손절선 회복 여부를 추적합니다.`;
  const trackingNoticeText = {
    forced_reduce_watch: `${cryptoAssetName(asset)} 30분봉 ${thirtyMinute.label}: ${thirtyMinute.subText}. 늦은 진입 보호용 알림입니다. 즉시 최종손절 확정이 아니라 비중축소 여부와 다음 대응을 판단할 구간입니다.`,
    fib618_touch_rebound: `${cryptoAssetName(asset)} 30분봉 ${thirtyMinute.label}: ${thirtyMinute.subText}. 손절선 터치 후 반등을 기록하고, 다음 61.8% 확정 이탈 때는 더 강한 축소 기준으로 봅니다.`,
    reentry_bounce: `${cryptoAssetName(asset)} 30분봉 ${thirtyMinute.label}: ${thirtyMinute.subText}. 손절 후 회복 신호라 기본물량으로 바로 복귀하지 않고 기초+10 40%까지만 재증가 후보로 봅니다.`,
    kijun_break_alert: `${cryptoAssetName(asset)} 30분봉 ${thirtyMinute.label}: ${thirtyMinute.subText}. 기준선 이탈은 2차 리스크 단계입니다.`,
    kijun_touch_alert: `${cryptoAssetName(asset)} 30분봉 ${thirtyMinute.label}: ${thirtyMinute.subText}. 기준선 터치 구간이라 2차 리스크를 점검합니다.`,
    ma30_break_alert: `${cryptoAssetName(asset)} 30분봉 ${thirtyMinute.label}: ${thirtyMinute.subText}. 30이평 이탈은 3차 리스크 단계입니다.`,
    ma30_touch_alert: `${cryptoAssetName(asset)} 30분봉 ${thirtyMinute.label}: ${thirtyMinute.subText}. 30이평 터치 구간이라 3차 리스크를 점검합니다.`,
  }[thirtyMinute.status] || `${cryptoAssetName(asset)} 30분봉 ${thirtyMinute.label}: ${thirtyMinute.subText}. 전환선이 너무 가까운 구간이라 즉시 비중축소 사유는 아니고 리스크관리 알림입니다.`;
  let message = trackingExit
    ? `${cryptoAssetName(asset)} 30분봉 ${trackingExitLabel} 기준: ${thirtyMinute.subText}. ${stopActionText}`
    : trackingNotice
      ? trackingNoticeText
    : allocation.message;
  if (!trackingExit && fibBox.valid) {
    if (addPyramidCandidate) {
      message = `${message} 일봉 피보박스 ${formatNum(fibBox.positionPct, 1)}%: 38.2~61.8 구간이라 30분 추세 유지 시 추가 불타기 검토입니다.`;
    } else if (fibBox.crossed618) {
      message = `${message} 일봉 피보박스는 61.8%를 넘겨 과열/돌파 지속 여부를 확인합니다.`;
    } else if (fibBox.crossed50) {
      message = `${message} 일봉 피보박스는 중심값 50%를 회복했습니다.`;
    } else if (fibBox.crossed382) {
      message = `${message} 일봉 피보박스 38.2% 회복 구간입니다. 30분 추세가 붙는지 확인합니다.`;
    }
  }
  if (!trackingExit && profile.assetType === "exception" && weekly.strong) {
    message = `${message} 주봉은 ${weekly.label}: ${weekly.subText}. 후행스팬·구름·정배열 전환형 후보는 사용자가 직관적으로 판단할 수 있게 계속 브리핑합니다.`;
  }
  if (!trackingExit && entered && thirtyMinute.intradayFib?.valid) {
    if (thirtyMinute.intradayFib.pyramidWatch) {
      message = `${message} 30분 피보는 ${thirtyMinute.intradayFib.supportLabel} 구간입니다. 중심값 50%를 지키고 반등하면 추가 불타기 검토가 가능합니다.`;
    } else if (thirtyMinute.intradayFib.cutWatch) {
      message = `${message} 30분 피보 중심값을 이탈해 61.8% 재지지와 전량 컷 준비 여부를 같이 봅니다.`;
    }
  }
  const visibleRows = cryptoVisibleRows(displayRows, state.selectedDate);
  const visibleIndex = visibleRows.length - 1;
  const closes = visibleRows.map((row) => number(row.close)).filter((value) => value != null);
  const high20 = rollingExtremeAt(visibleRows, visibleIndex, 20, "high", "max", true);
  const high55 = rollingExtremeAt(visibleRows, visibleIndex, 55, "high", "max", true);
  const ma20 = averageLast(closes, 20);
  const ma60 = averageLast(closes, 60);
  const atrPct = atrPercent(displayRows, state.selectedDate, 14);
  const entry = cryptoEntryPrice(close, ma20, ma60, high20, high55, allocation.className);
  const stop = allocation.wideStopPct && entry != null
    ? entry * (1 - allocation.wideStopPct / 100)
    : cryptoStopPrice(close, entry, atrPct, allocation.className);
  const risk = entry != null && stop != null ? Math.max(entry - stop, entry * 0.02) : null;
  const take1 = entry != null && risk != null ? entry + risk : null;
  const take2 = entry != null && risk != null ? entry + risk * 2 : null;
  const finalStopLevel = trackingRuleFinalStopLevel(thirtyMinute, profile, stop);
  const orderRows = cryptoVisibleRows(thirtyRows, state.selectedDate);
  const orderIndex = orderRows.length - 1;
  const orderSelected = orderRows[orderIndex] || signalRow || selected;
  const orderClose = number(orderSelected?.close) ?? close;
  const orderCloses = orderRows.map((row) => number(row.close)).filter((value) => value != null);
  const orderMa30 = averageLast(orderCloses, 30);
  const orderCloud = orderIndex >= 0 ? ichimokuCloudAt(orderRows, orderIndex) : {};
  const orderHigh20 = rollingExtremeAt(orderRows, orderIndex, 20, "high", "max", true);
  const orderHigh55 = rollingExtremeAt(orderRows, orderIndex, 55, "high", "max", true);
  const recentHighForPyramid = rollingExtremeAt(orderRows, orderIndex, CRYPTO_THIRTY_MINUTE_RISK_BARS, "high", "max", false);
  const orderPriceCandidates = [orderHigh20, orderHigh55, orderCloud.upper, orderMa30]
    .map((value) => number(value))
    .filter((value) => value != null && value > 0);
  const baseBuildOrder = cryptoBaseRebuildOrderPlan(profile, allocation, {
    close: orderClose,
    cloudUpper: orderCloud.upper,
  });
  if (!trackingExit && baseBuildOrder.active) {
    message = `${message} ${baseBuildOrder.message}`;
  }
  const pyramidOrder = cryptoPyramidOrderPlan(profile, allocation, {
    close: orderClose,
    orderPrice: orderPriceCandidates.length ? Math.max(...orderPriceCandidates) : entry,
    averagePrice: entry,
    recentHigh: recentHighForPyramid,
    trendConfirmed,
  });
  if (!trackingExit && pyramidOrder.active) {
    message = `${message} ${pyramidOrder.message}`;
  }
  const lineLabel = displayFrame === "1w" ? "20주선" : displayFrame !== "1d" ? "20선" : "20일선";
  const displayCloud = visibleIndex >= 0 ? ichimokuCloudAt(visibleRows, visibleIndex) : {};
  const trail = displayCloud?.lower != null
    ? `${cryptoFrameLabel(displayFrame)} 구름하단 ${formatNum(displayCloud.lower, priceDigits(close))}`
    : ma20 != null ? `${lineLabel} ${formatNum(ma20, priceDigits(close))}` : lineLabel;
  const plan = {
    key: profile.key,
    name: cryptoAssetName(asset),
    assetType: profile.assetType,
    className,
    label,
    message,
    typeLabel: profile.typeLabel,
    capPct: profile.capPct,
    poolCapPct: profile.poolCapPct,
    capText: allocation.capText,
    slotPct: allocation.slotPct,
    portfolioPct: allocation.portfolioPct,
    portfolioText: allocation.portfolioText,
    slotText: allocation.slotText,
    stageText: allocation.stageText,
    baseBuildOrder,
    baseBuildOrderText: baseBuildOrder.text || "-",
    baseBuildOrderSubText: baseBuildOrder.subText || "-",
    pyramidOrder,
    pyramidOrderText: pyramidOrder.text || "-",
    pyramidOrderSubText: pyramidOrder.subText || "-",
    pyramidMarketTrigger: Boolean(pyramidOrder.marketTrigger || pyramidOrder.pullbackTrigger),
    dailyText: daily.label,
    dailySubText: daily.subText,
    fibBoxText: fibBox.valid ? fibBox.label : "-",
    fibBoxSubText: fibBox.valid ? fibBox.subText : "일봉 피보박스 대기",
    fibBoxPct: fibBox.positionPct,
    fibBox,
    addPyramidCandidate,
    fourHourText: fourHour.label,
    fourHourSubText: fourHour.subText,
    fourHourStrong: Boolean(fourHour.strong),
    fourHourMa20: fourHour.ma20,
    fourHourMa30: fourHour.ma30,
    fourHourBoxHigh: fourHour.boxHigh,
    fourHourRisk,
    fourHourRiskText: fourHourRisk.label || "-",
    fourHourRiskSubText: fourHourRisk.subText || "-",
    weeklyTrend: weekly,
    weeklyTrendText: weekly.label || "-",
    weeklyTrendSubText: weekly.subText || "주봉 기준선·매물대 확인",
    weeklyStarter: Boolean(allocation.weeklyStarter),
    exceptionEntryStrong: profile.assetType === "exception" && Boolean(fourHour.strong || thirtyEntry.strong || allocation.weeklyStarter),
    thirtyEntryText: thirtyEntry.label,
    thirtyEntrySubText: thirtyEntry.subText,
    trendReversal: thirtyEntry.trendReversal,
    trendReversalText: thirtyEntry.trendReversal?.label || "-",
    trendReversalSubText: thirtyEntry.trendReversal?.subText || "후행·구름·정배열 전환 대기",
    thirtyText: thirtyDisplayText,
    thirtySubText: thirtyDisplaySubText,
    thirtyStatus: tracksThirtyMinute ? thirtyMinute.status : "pending",
    trackingAlert: trackingExit,
    trackingNotice,
    thirtyAlert: tracksThirtyMinute && thirtyMinute.alert,
    thirtyAlertOnly: Boolean(thirtyMinute.alertOnly),
    trackingRule: thirtyMinute.status,
    trackingTime: thirtyMinute.time,
    riskTargetSlotPct,
    riskTargetText,
    thirtyTenkan: thirtyMinute.tenkan,
    thirtyMa5: thirtyMinute.ma5,
    thirtyKijun: thirtyMinute.kijun,
    thirtyBottomCloudUpper: thirtyMinute.bottomCloudUpper,
    thirtyFib: thirtyMinute.intradayFib,
    thirtyFibText: thirtyMinute.intradayFib?.valid ? thirtyMinute.intradayFib.label : "-",
    thirtyFibSubText: thirtyMinute.intradayFib?.valid ? thirtyMinute.intradayFib.subText : "30분 피보 대기",
    thirtyBoxStopLevel: profile.assetType === "exception" ? thirtyMinute.boxStopLevel : null,
    thirtyBoxStopTime: profile.assetType === "exception" ? thirtyMinute.boxStopTime : null,
    forcedDrawdownPct: thirtyMinute.forcedDrawdownPct,
    forcedThresholdPct: thirtyMinute.forcedThresholdPct,
    forcedRecentHigh: thirtyMinute.forcedRecentHigh,
    forcedReduceText: thirtyMinute.forcedDrawdownPct != null ? `-${formatNum(thirtyMinute.forcedDrawdownPct, 1)}%` : "-",
    forcedReduceSubText: thirtyMinute.forcedThresholdPct != null ? `${profile.typeLabel} 고점컷 ${formatNum(thirtyMinute.forcedThresholdPct, 0)}%` : `메이저15·알트20·예외25%`,
    signalTimeText: cryptoSignalTimeText(signalRow),
    close,
    entry,
    stop,
    finalStopLevel,
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
  return applyBackendCryptoSignalPlan(asset, plan);
}

function cryptoEntryPrice(close, ma20, ma60, high20, high55, className) {
  if (close == null) return null;
  if (className === "candidate") return Math.max(close, high20 || close);
  if (className === "watch") return Math.max(ma20 || close, high20 || close);
  return Math.max(ma20 || close, ma60 || close, high20 || close, high55 || close);
}

function trackingRuleFinalStopLevel(thirtyMinute = {}, profile = {}, fallback = null) {
  if (thirtyMinute.status?.startsWith?.("fib618") && thirtyMinute.intradayFib?.levels?.fib618 != null) {
    return thirtyMinute.intradayFib.levels.fib618;
  }
  if (profile.assetType === "exception" && thirtyMinute.boxStopLevel != null) return thirtyMinute.boxStopLevel;
  if (thirtyMinute.bottomCloudUpper != null) return thirtyMinute.bottomCloudUpper;
  if (thirtyMinute.kijun != null) return thirtyMinute.kijun;
  return fallback;
}

function cryptoStopPrice(close, entry, atrPct, className) {
  if (entry == null) return null;
  const atrStopPct = Math.max((atrPct || 3) * (className === "candidate" ? 2 : 1.6), className === "candidate" ? 4 : 3);
  const reference = close != null ? Math.min(close, entry) : entry;
  return Math.max(0, reference * (1 - atrStopPct / 100));
}

function priceDigits(value) {
  const parsed = Math.abs(number(value) || 0);
  if (parsed >= 1000) return 0;
  if (parsed >= 100) return 1;
  if (parsed >= 1) return 2;
  if (parsed > 0) return 4;
  return 2;
}

function cryptoRowsForFrame(asset, frame = state.cryptoFrame) {
  if (!asset) return [];
  if (frame === "1d") return Array.isArray(asset.history) ? asset.history : [];
  if (frame === "1w") return aggregateCryptoDailyRows(Array.isArray(asset.history) ? asset.history : []);
  const sourceRows = Array.isArray(asset.intraday?.history) && asset.intraday.history.length
    ? asset.intraday.history
    : Array.isArray(asset.history) ? asset.history : [];
  if (frame === "30m") return sourceRows;
  if (frame === "60m" && asset.intraday?.history?.length) return aggregateCryptoRows(sourceRows, 1);
  if (frame === "240m" && asset.intraday?.history?.length) return aggregateCryptoRows(sourceRows, 4);
  return sourceRows;
}

function aggregateCryptoDailyRows(rows = []) {
  const buckets = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const close = number(row.close);
    const open = number(row.open);
    const high = number(row.high);
    const low = number(row.low);
    if (close == null || open == null || high == null || low == null || !row.date) return;
    const match = String(row.date).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - mondayOffset);
    const key = date.toISOString().slice(0, 10);
    const current = buckets.get(key);
    if (!current) {
      buckets.set(key, {
        date: key,
        time: "00:00",
        datetime: `${key}T00:00:00+09:00`,
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
  return [...buckets.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
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
        end_time: row.time || time,
        display_time: row.time && row.time !== time ? `${time}-${row.time}` : time,
        datetime: row.datetime || `${row.date}T${time}:00+09:00`,
        end_datetime: row.datetime || `${row.date}T${row.time || time}:00+09:00`,
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
    current.end_time = row.time || current.end_time || current.time;
    current.display_time = current.end_time && current.end_time !== current.time ? `${current.time}-${current.end_time}` : current.time;
    current.end_datetime = row.datetime || `${row.date}T${current.end_time || current.time}:00+09:00`;
  });
  return [...buckets.values()].sort((a, b) => String(a.datetime || `${a.date} ${a.time}`).localeCompare(String(b.datetime || `${b.date} ${b.time}`)));
}

function cryptoLatestRow(rows = []) {
  const filtered = (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.date && (!state.selectedDate || row.date <= state.selectedDate) && number(row.close) != null);
  return filtered.length ? filtered[filtered.length - 1] : null;
}

function cryptoSignalTimeText(row = {}) {
  if (!row) return "-";
  const dateText = row.date ? shortDate(row.date) : "";
  const displayTime = String(row.display_time || "").trim();
  if (dateText && /^\d{2}:\d{2}(?:-\d{2}:\d{2})?$/.test(displayTime)) return `${dateText} ${displayTime}`;
  const minuteText = minuteTimeText(row.end_time || row.time || row.end_datetime || row.datetime);
  if (dateText && minuteText) return `${dateText} ${minuteText}`;
  if (minuteText) return minuteText;
  return row.date || "-";
}

function minuteTimeText(value) {
  const text = String(value || "");
  const match = text.match(/(?:T|\s|^)(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "";
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
    "30m": "30분봉",
    "60m": "60분봉",
    "240m": "240분봉",
    "1d": "일봉",
    "1w": "주봉",
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

function focusedStockItem(scope) {
  const key = manageScopeKey(scope);
  const symbol = state.focusedAssets[key];
  if (!symbol) return null;
  if (key === "us") {
    return findUsAsset(symbol) || usManageCandidateUniverse().find((item) => normalizeSearchText(item.symbol) === symbol) || null;
  }
  return findDomesticCandidate(symbol) || domesticManageCandidateUniverse().find((item) => normalizeSearchText(item.symbol) === symbol) || null;
}

function stockFocusLabel(item, fallback = "") {
  return String(item?.label || item?.name || item?.symbol || fallback || "").trim();
}

function drawStocksChart() {
  const market = state.assetArchive?.market || {};
  const focus = focusedStockItem("domestic");
  const instrument = market.index_proxy || market.kospi200 || state.assetArchive?.etf;
  drawAssetTrendChart({
    canvasSelector: "#stocksChart",
    legendSelector: "#stocksLegend",
    instrument,
    label: instrument?.proxy_for ? `${instrument.label || "KODEX200"} 대체지표` : instrument?.label || "지수 필터",
    emptyTitle: "국장 종목 차트 자료 없음",
    emptyDetail: "지수 필터 일봉 데이터가 아직 없습니다.",
    extraBadges: focus ? [{ label: "선택", value: stockFocusLabel(focus) }] : [],
  });
}

function drawUsStocksChart() {
  const usStocks = state.assetArchive?.us_stocks || {};
  const assets = usStocks.assets || [];
  const focus = focusedStockItem("us");
  const focusAsset = Array.isArray(focus?.history) && focus.history.length ? focus : null;
  const watchAsset = (state.watchlists.us || []).map((item) => findUsAsset(item.symbol)).find((asset) => asset?.history?.length);
  const benchmark = assets.find((asset) => asset.symbol === "SPY") || assets.find((asset) => asset.symbol === "QQQ");
  const instrument = focusAsset || watchAsset || benchmark || assets.find((asset) => asset?.history?.length);
  drawAssetTrendChart({
    canvasSelector: "#usStocksChart",
    legendSelector: "#usStocksLegend",
    instrument,
    label: instrument?.label || instrument?.symbol || "미장 추세",
    emptyTitle: "미장 차트 자료 없음",
    emptyDetail: usStocks.archive_note || "미장 핵심 추적군 일봉 데이터를 아직 가져오지 못했습니다.",
    averageSet: "us",
    extraBadges: focus ? [{ label: "선택", value: stockFocusLabel(focus) }] : [],
  });
}

function drawCryptoChart() {
  const canvas = document.querySelector("#cryptoChart");
  const crypto = state.assetArchive?.crypto || {};
  const assets = cryptoVisibleAssets(crypto.assets || []);
  const exceptionAssets = cryptoVisibleAssets(crypto.exception_assets || []);
  const comparisonAssets = [...assets, ...exceptionAssets];
  const detailAssets = comparisonAssets;
  if (state.cryptoTab !== "all") {
    drawCryptoDetailChart(canvas, cryptoSelectedAsset(detailAssets), detailAssets);
    return;
  }
  const points = cryptoComparisonPoints(comparisonAssets, state.selectedDate, 180);
  if (!points.length) {
    drawEmptyChart(canvas, "코인 차트 자료 없음", 260, "메이저 코인 일봉 데이터가 아직 없습니다.");
    renderCryptoLegend([]);
    if (canvas) canvas.setAttribute("aria-label", "메이저 코인 비교 차트");
    return;
  }
  if (canvas) canvas.setAttribute("aria-label", "메이저 코인 비교 차트");
  const series = cryptoComparisonSeries(comparisonAssets);
  renderCryptoLegend(series.map((item) => ({ label: `${item.label} 기준 100`, color: item.color })));
  const primary = series[0] || { key: "btc" };
  drawLineChart(canvas, {
    height: 230,
    padding: { top: 38, right: 50, bottom: 46, left: 28 },
    points,
    valueKey: primary.key,
    timeKey: "date",
    compactLatestLabel: true,
    chartBadges: [
      { label: "상대비교", value: "기준 100" },
      { label: "감시", value: `${comparisonAssets.length}개` },
    ],
    extraSeries: series.slice(1).map((item) => ({ key: item.key, label: item.label, color: item.color, width: 2.1 })),
  });
}

function drawCryptoDetailChart(canvas, asset, assets = []) {
  const name = asset ? cryptoAssetName(asset) : CRYPTO_ASSET_META[state.cryptoTab]?.name || "코인";
  const rows = cryptoRowsForFrame(asset, state.cryptoFrame);
  const detailLimit = state.cryptoFrame === "1d" ? 180 : state.cryptoFrame === "1w" ? 80 : 160;
  const points = cryptoDetailPoints(rows, state.cryptoFrame, detailLimit);
  if (!points.length) {
    drawEmptyChart(canvas, `${name} 차트 자료 없음`, 260, `${cryptoFrameLabel(state.cryptoFrame)} 데이터를 확인하는 중입니다.`);
    renderCryptoLegend([]);
    return;
  }
  if (canvas) canvas.setAttribute("aria-label", `${name} ${cryptoFrameLabel(state.cryptoFrame)} 신호 차트`);
  const signal = cryptoSignalPlan(asset, assets, { rows, frame: state.cryptoFrame });
  const fibLevels = state.cryptoFrame === "1d" && signal.fibBox?.valid
    ? [
      { label: "F38", value: signal.fibBox.levels?.box382, color: "#b07a2a" },
      { label: "F50", value: signal.fibBox.levels?.box50, color: "#9aa8b8" },
      { label: "F61", value: signal.fibBox.levels?.box618, color: "#82a7e6" },
      { label: "F77", value: signal.fibBox.levels?.top, color: "#d5a04e" },
    ]
    : [];
  const pyramidLevels = signal.pyramidOrder?.active
    ? [
      { label: "+10%", value: signal.pyramidOrder.firstTriggerPrice, color: "#df7a72" },
      { label: "+20%", value: signal.pyramidOrder.secondTriggerPrice, color: "#a95f59" },
      { label: "77눌림", value: signal.pyramidOrder.pullbackPrice, color: "#d5a04e" },
    ]
    : [];
  const baseBuildLevels = state.cryptoFrame === "30m" && signal.baseBuildOrder?.active
    ? [
      { label: "기본지정상", value: signal.baseBuildOrder.limitHigh, color: "#4eb7b1" },
      { label: "기본지정하", value: signal.baseBuildOrder.limitLow, color: "#2f918c" },
      { label: "구름지정", value: signal.baseBuildOrder.cloudUpper, color: "#82a7e6" },
    ]
    : [];
  const intradayFibLevels = state.cryptoFrame === "30m" && signal.thirtyFib?.valid
    ? [
      { label: "F38", value: signal.thirtyFib.levels?.fib382, color: "#b07a2a" },
      { label: "F50", value: signal.thirtyFib.levels?.fib50, color: "#9aa8b8" },
      { label: "F61", value: signal.thirtyFib.levels?.fib618, color: "#82a7e6" },
    ]
    : [];
  const stopLevels = state.cryptoFrame === "30m"
    ? [
      { label: "5이평", value: signal.thirtyMa5, color: themeColor("--green", "#5fc79b") },
      { label: "전환선", value: signal.thirtyTenkan, color: "#b07a2a" },
      { label: "기준선", value: signal.thirtyKijun, color: "#9aa8b8" },
      { label: "바닥구름", value: signal.thirtyBottomCloudUpper, color: "#82a7e6" },
      { label: "박스손절", value: signal.thirtyBoxStopLevel, color: "#df7a72" },
    ]
    : [];
  const cardChartLevels = [
    ...(state.cryptoFrame === "240m"
      ? [
        { label: "4H중심", value: signal.fourHourRisk?.center, color: "#f0c781", dash: [5, 4] },
        { label: "4H61.8", value: signal.fourHourRisk?.fib618, color: "#df7a72", dash: [5, 4] },
        { label: "4H30선", value: signal.fourHourMa30, color: "#82a7e6", dash: [3, 4] },
      ]
      : []),
    { label: "최종손절", value: signal.finalStopLevel, color: "#f1aaa5", dash: [8, 4] },
  ];
  const levels = [
    { label: "진입", value: signal.entry, color: themeColor("--green", "#5fc79b") },
    { label: "손절", value: signal.stop, color: themeColor("--red", "#df7a72") },
    { label: "1차", value: signal.take1, color: themeColor("--blue", "#82a7e6") },
    { label: "2차", value: signal.take2, color: themeColor("--teal", "#4eb7b1") },
    ...cardChartLevels,
    ...fibLevels,
    ...intradayFibLevels,
    ...baseBuildLevels,
    ...pyramidLevels,
    ...stopLevels,
  ].filter((level) => number(level.value) != null);
  const markerKind = signal.className === "candidate" ? "entry" : signal.className === "warning" ? "risk" : "watch";
  const averageKey = state.cryptoFrame === "30m" ? "ma30" : "ma20";
  const averageLabel = state.cryptoFrame === "30m" ? "30이평" : state.cryptoFrame === "1w" ? "20주선" : "20선";
  const boxLabel = state.cryptoFrame === "1w" ? "26주 박스" : "30일 박스";
  renderCryptoLegend([
    { label: `${name} 종가`, color: themeColor("--chart-line", "#e8eef5") },
    { label: "구름상단", color: themeColor("--amber", "#d5a04e") },
    { label: "구름하단", color: themeColor("--blue", "#82a7e6") },
    { label: boxLabel, color: themeColor("--teal", "#4eb7b1") },
    { label: averageLabel, color: themeColor("--green", "#5fc79b") },
    ...(state.cryptoFrame === "30m"
      ? [
        { label: "5이평", color: themeColor("--green", "#5fc79b") },
        { label: "전환선", color: "#b07a2a" },
        { label: "기준선", color: "#9aa8b8" },
      ]
      : []),
    ...(fibLevels.length ? [{ label: "피보박스", color: "#d5a04e" }] : []),
    ...(intradayFibLevels.length ? [{ label: "30분 피보", color: "#b07a2a" }] : []),
    ...(baseBuildLevels.length ? [{ label: "기본증가주문", color: "#4eb7b1" }] : []),
    ...(pyramidLevels.length ? [{ label: "불타기주문", color: "#df7a72" }] : []),
    ...(stopLevels.length ? [{ label: "최종손절선/박스", color: "#9aa8b8" }] : []),
    ...(cardChartLevels.length ? [{ label: "카드 기준선", color: "#f1aaa5" }] : []),
  ]);
  drawLineChart(canvas, {
    height: 230,
    padding: { top: 38, right: 50, bottom: 46, left: 28 },
    points,
    valueKey: "close",
    timeKey: "date",
    compactLatestLabel: true,
    levels,
    chartBadges: [
      { label: "선택", value: name },
      { label: cryptoFrameLabel(state.cryptoFrame), value: signal.label || "관찰" },
      { label: "일봉", value: signal.dailyLabel || signal.daily?.label || "-" },
      { label: "후행", value: signal.daily?.chikou === "bullish" ? "우위" : signal.daily?.chikou === "bearish" ? "이탈" : "확인" },
    ],
    extraSeries: [
      { key: "cloudUpper", label: "구름상단", color: themeColor("--amber", "#d5a04e"), width: 1.35, dash: [5, 4] },
      { key: "cloudLower", label: "구름하단", color: themeColor("--blue", "#82a7e6"), width: 1.35, dash: [5, 4] },
      { key: "boxHigh", label: boxLabel, color: themeColor("--teal", "#4eb7b1"), width: 1.2, dash: [2, 4] },
      ...(state.cryptoFrame === "30m" ? [
        { key: "ma5", label: "5이평", color: themeColor("--green", "#5fc79b"), width: 1.25, dash: [3, 3] },
        { key: "tenkan", label: "전환선", color: "#b07a2a", width: 1.35 },
        { key: "kijun", label: "기준선", color: "#9aa8b8", width: 1.35 },
      ] : []),
      ...(state.cryptoFrame === "240m" ? [
        { key: "ma30", label: "30선", color: themeColor("--blue", "#82a7e6"), width: 1.2, dash: [4, 4] },
      ] : []),
      { key: averageKey, label: averageLabel, color: themeColor("--green", "#5fc79b"), width: 1.4 },
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

function drawAssetTrendChart({ canvasSelector, legendSelector, instrument, label, emptyTitle, emptyDetail, averageSet = "default", extraBadges = [] }) {
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
  const latestPoint = points[points.length - 1] || {};
  const chartBadges = [
    { label: "현재", value: formatNum(latestPoint.close, 2) },
    { label: "20일", value: latestPoint.ma20 != null && latestPoint.close >= latestPoint.ma20 ? "위" : "아래" },
    { label: "자료", value: `${points.length}봉` },
    ...extraBadges,
  ];
  drawLineChart(canvas, {
    height: 260,
    padding: { top: 42, right: 50, bottom: 38, left: 28 },
    points,
    valueKey: "close",
    timeKey: "date",
    extraSeries: averages,
    chartBadges,
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
  const source = cryptoVisibleRows(rows, state.selectedDate);
  const start = Math.max(0, source.length - limit);
  const filtered = source.slice(start);
  const closes = [];
  const highs = [];
  const boxWindow = cryptoBoxWindowForFrame(frame);
  return filtered.map((row, offset) => {
    const sourceIndex = start + offset;
    const close = number(row.close);
    const high = number(row.high);
    closes.push(close);
    highs.push(high);
    const cloud = ichimokuCloudAt(source, sourceIndex);
    return {
      date: frame === "1d" || frame === "1w" ? shortDate(row.date) : `${shortDate(row.date)} ${row.time || ""}`.trim(),
      close,
      ma5: averageLast(closes, 5),
      ma20: averageLast(closes, 20),
      ma30: averageLast(closes, 30),
      ma60: averageLast(closes, 60),
      tenkan: ichimokuMid(source, sourceIndex, 9),
      kijun: ichimokuMid(source, sourceIndex, 26),
      high20: maxLast(highs, 20),
      high55: maxLast(highs, 55),
      cloudUpper: cloud.upper,
      cloudLower: cloud.lower,
      boxHigh: rollingExtremeAt(source, sourceIndex, boxWindow, "high", "max", true),
    };
  });
}

function cryptoBoxWindowForFrame(frame = state.cryptoFrame) {
  return {
    "30m": 1440,
    "60m": 720,
    "240m": 180,
    "1d": 30,
    "1w": 26,
  }[frame] || 180;
}

function cryptoComparisonPoints(assets, selectedDate, limit = 180) {
  const series = cryptoComparisonSeries(assets);
  const rowMaps = series.map((item) => ({ ...item, rows: assetRowsByDate(item.asset, selectedDate) }));
  const commonDates = rowMaps
    .reduce((dates, item) => dates.filter((date) => item.rows.has(date)), rowMaps[0] ? [...rowMaps[0].rows.keys()] : [])
    .sort()
    .slice(-limit);
  if (!commonDates.length) return [];
  const bases = Object.fromEntries(rowMaps.map((item) => [item.key, number(item.rows.get(commonDates[0])?.close)]));
  if (!rowMaps.every((item) => bases[item.key])) return [];
  return commonDates.map((date) => {
    const point = { date: shortDate(date) };
    rowMaps.forEach((item) => {
      point[item.key] = (number(item.rows.get(date)?.close) / bases[item.key]) * 100;
    });
    return point;
  });
}

function cryptoComparisonSeries(assets = []) {
  return (Array.isArray(assets) ? assets : [])
    .filter((asset) => Array.isArray(asset?.history) && asset.history.length)
    .map((asset, index) => {
      const colorSpec = CRYPTO_COMPARE_COLORS[index % CRYPTO_COMPARE_COLORS.length];
      return {
        asset,
        key: cryptoAssetKey(asset),
        label: asset.label || cryptoAssetName(asset),
        color: themeColor(colorSpec[0], colorSpec[1]),
      };
    });
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
  const score = hint.score ?? commonSignalScore({ signal });
  const tag = hint.tag || stockSignalTag(item, score, signal);
  const badgeText = stockBadgeText(hint.badge, signal, score);
  const priceText = item.close != null ? `${formatNum(item.close, 0)} · ${formatPercent(item.change_pct)}` : item.group || item.market || "";
  return `
    <article class="search-result ${escapeAttr(signal)}${active ? " active" : ""}" data-search-result="${escapeAttr(item.symbol)}">
      <div>
        <strong>${escapeHtml(item.name || item.symbol)}</strong>
        <small>${escapeHtml(item.symbol)} · ${escapeHtml(item.market || item.group || "")}</small>
        <small class="search-hint">${escapeHtml(badgeText)} · 공통점수 ${score}점 · ${escapeHtml(hint.detail)}</small>
        <span class="recommendation-tags">
          <em>${escapeHtml(tag)}</em>
          <em>${escapeHtml(signalActionText(signal, score, item.scope))}</em>
        </span>
      </div>
      <span>${escapeHtml(priceText || "-")}</span>
      <button class="soft-button" type="button" data-search-scope="${escapeAttr(item.scope)}" data-search-add="${escapeAttr(item.symbol)}" ${item.alreadyAdded ? "disabled" : ""}>
        ${item.alreadyAdded ? "추가됨" : "추가"}
      </button>
    </article>
  `;
}

function stockCandidateItem(item) {
  const hint = searchSignalHint(item);
  const signal = signalClass(item.signal || hint.signal || "watch");
  const score = stockCandidateScore(item);
  const tag = stockSignalTag(item, score, signal);
  const action = signalActionText(signal, score, item.scope);
  const badgeText = stockBadgeText(hint.badge, signal, score);
  const close = number(item.close);
  const priceText = close != null
    ? `${formatNum(close, item.scope === "us" ? 2 : 0)} · ${formatPercent(item.change_pct)}`
    : item.group || item.market || "-";
  const focusScope = manageScopeKey(item.scope);
  const focusSymbol = normalizeSearchText(item.symbol);
  const focusClass = state.focusedAssets[focusScope] === focusSymbol ? " is-chart-focus" : "";
  return `
    <article class="search-result stock-candidate ${escapeAttr(signal)}${focusClass}" data-focus-key="${escapeAttr(collectionItemKey(focusScope, focusSymbol))}" data-stock-focus-scope="${escapeAttr(focusScope)}" data-stock-focus-symbol="${escapeAttr(focusSymbol)}">
      <div>
        <strong>${escapeHtml(item.name || item.symbol)}</strong>
        <small>${escapeHtml(item.symbol)} · ${escapeHtml(item.market || item.group || "")}</small>
        <small class="search-hint">${escapeHtml(badgeText || tag)} · 공통점수 ${score}점 · ${escapeHtml(hint.detail || action)}</small>
        <span class="recommendation-tags">
          <em>${escapeHtml(tag)}</em>
          <em>${escapeHtml(action)}</em>
        </span>
      </div>
      <span>${escapeHtml(priceText)}</span>
      <button class="soft-button" type="button" data-search-scope="${escapeAttr(item.scope)}" data-search-add="${escapeAttr(item.symbol)}">추가</button>
    </article>
  `;
}

function stockBadgeText(value, signal = "watch", score = null) {
  const text = String(value || "").trim();
  const internalSignals = new Set(["neutral", "watch", "candidate", "buy", "warning", "sell", "avoid"]);
  if (!text || internalSignals.has(text.toLowerCase())) {
    return signalStatusText(signal, score);
  }
  return text;
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
    const signal = signalClass(rawSignal);
    const score = stockQualityScore(item, match, signal);
    const detail = match?.score != null
      ? `${stockSignalTag(match, score, signal)} · 후보 ${formatNum(match.score, 1)}`
      : indexFilter.message || "국장 지수 필터 기준으로 관찰";
    return { signal, badge, detail, score, tag: stockSignalTag(match || item, score, signal) };
  }
  const match = findUsAsset(item.symbol);
  if (match) {
    const summary = match.summary || {};
    const signal = signalClass(summary.signal || "watch");
    const score = stockQualityScore(item, match, signal);
    return {
      signal,
      badge: summary.label || match.group || "미장 관찰",
      detail: summary.score != null ? `${stockSignalTag(match, score, signal)} · 원점수 ${formatNum(summary.score, 1)} · RS ${formatPercent(summary.relative_63d)}` : summary.message || "미장 추세 확인",
      score,
      tag: stockSignalTag(match, score, signal),
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
    "코인 관련": "메이저 코인 흐름과 같이 확인",
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
  const score = stockQualityScore(item, null, "watch");
  return { signal: "watch", badge: group, detail, score, tag: stockSignalTag(item, score, "watch") };
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
    const signalScore = stockQualityScore(item, match, signal);
    return {
      scope,
      kind: "국장",
      title: item.name || item.symbol,
      symbol: item.symbol,
      signal,
      signalScore,
      statusLabel: signalStatusText(signal, signalScore),
      actionText: signalActionText(signal, signalScore, scope),
      badge: match?.final_action || match?.trade_signal || indexFilter.label || "관찰",
      value: `${signalScore}점`,
      detail: match?.reason || indexFilter.message || "국장 지수 필터 기준으로 관찰합니다.",
      jumpTab: "stocks",
      focusKey: collectionItemKey(scope, item.symbol),
      metrics: [
        { label: "공통", value: `${signalScore}점` },
        { label: "가격", value: match?.close != null ? formatNum(match.close, 0) : item.symbol },
        { label: "신호", value: match?.final_action || match?.trade_signal || indexFilter.label || "관찰" },
        { label: "분류", value: match?.bucket || item.market || "국장" },
      ],
    };
  }
  const match = findUsAsset(item.symbol);
  const summary = match?.summary || {};
  const selected = match?.selected || match?.latest || {};
  const signal = signalClass(summary.signal || "watch");
  const signalScore = stockQualityScore(item, match, signal);
  return {
    scope,
    kind: "미장",
    title: item.name || item.symbol,
    symbol: item.symbol,
    signal,
    signalScore,
    statusLabel: signalStatusText(signal, signalScore),
    actionText: signalActionText(signal, signalScore, scope),
    badge: summary.label || "관찰",
    value: `${signalScore}점`,
    detail: match ? usSignalDetail(match) : "SPY/QQQ 상대강도와 20/50/200일선 신호를 기다립니다.",
    jumpTab: "usStocks",
    focusKey: collectionItemKey(scope, item.symbol),
    metrics: [
      { label: "공통", value: `${signalScore}점` },
      { label: "가격", value: selected.close != null ? formatNum(selected.close, 2) : item.symbol },
      { label: "21D", value: summary.ret_21d != null ? formatPercent(summary.ret_21d) : "-" },
      { label: "RS", value: summary.relative_63d != null ? formatPercent(summary.relative_63d) : "-" },
    ],
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
  const decision = signalDecisionSummary(item);
  return `
    <article class="asset-item ${escapeAttr(signal)}" data-focus-key="${escapeAttr(collectionItemKey(item.scope, item.symbol))}">
      <div class="asset-main">
        <strong>${escapeHtml(item.title || item.symbol || "-")}</strong>
        <small>${escapeHtml(decision.status)} · ${escapeHtml(item.detail || "")}</small>
        <small class="next-action">${escapeHtml(decision.action)}</small>
      </div>
      <div class="asset-side">
        ${scoreBadgeHtml(decision.score, signal)}
        <button class="mini-remove" type="button" data-watch-scope="${escapeAttr(item.scope)}" data-watch-remove="${escapeAttr(item.symbol)}">제거</button>
      </div>
    </article>
  `;
}

function findDomesticCandidate(symbol) {
  const text = String(symbol || "").trim().toUpperCase();
  const rows = domesticSignalRows();
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
  const symbol = String(item.symbol || "").toUpperCase();
  state.watchlists[scope] = normalizeWatchlist([
    {
      symbol,
      name: item.name || item.symbol,
      market: item.market || item.group || "",
      addedAt: new Date().toISOString(),
    },
    ...current,
  ]);
  addCollectionOrderKey(collectionItemKey(scope, symbol));
}

function clearSearchResults(scope) {
  resetSearchCursor(scope);
  const root = document.querySelector(scope === "us" ? "#usSearchResults" : "#domesticSearchResults");
  if (root) root.innerHTML = "";
}

function removeWatchSymbol(scope, symbol) {
  if (!state.watchlists[scope]) return;
  const target = normalizeSearchText(symbol);
  if (!target) return;
  const current = state.watchlists[scope] || [];
  const item = current.find((entry) => normalizeSearchText(entry.symbol) === target);
  const scopeLabel = scope === "us" ? "미장" : "국장";
  const name = item?.name || symbol;
  if (!window.confirm(`${name}을(를) ${scopeLabel} 관심종목에서 삭제할까요?`)) return;
  state.watchlists[scope] = current.filter((entry) => normalizeSearchText(entry.symbol) !== target);
  if (state.focusedAssets[manageScopeKey(scope)] === target) state.focusedAssets[manageScopeKey(scope)] = "";
  removeCollectionOrderKey(collectionItemKey(scope, target));
  saveWatchlists();
  renderAssetTabs();
}

function jumpToCardTarget(card) {
  const target = card.dataset.jumpTab;
  if (!APP_TABS.includes(target)) return;
  if (card.dataset.signalKey) markSignalInboxRead(card.dataset.signalKey);
  const focusKey = card.dataset.jumpFocus || "";
  if (card.dataset.jumpCrypto) {
    state.cryptoTab = card.dataset.jumpCrypto;
    state.cryptoFrame = "240m";
  }
  setActiveTab(target);
  if (focusKey) window.setTimeout(() => focusTargetCard(focusKey), 120);
  if (state.activeModal === "signals") closeModal();
}

function focusTargetCard(focusKey) {
  if (!focusKey) return false;
  const target = document.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.remove("focus-flash");
  void target.offsetWidth;
  target.classList.add("focus-flash");
  window.setTimeout(() => target.classList.remove("focus-flash"), 1800);
  return true;
}

function stockItem(row) {
  const type = signalClass(row.final_action || row.trade_signal || "watch");
  const score = stockQualityScore(row, row, type);
  return `
    <article class="asset-item ${escapeAttr(type)}" data-focus-key="${escapeAttr(collectionItemKey("domestic", row.symbol))}">
      <div class="asset-main">
        <strong>${escapeHtml(row.name || row.symbol || "-")}</strong>
        <small>${escapeHtml(signalStatusText(type, score))} · ${escapeHtml(row.bucket || "주식")} · ${escapeHtml(row.reason || "후보")}</small>
        <small class="next-action">${escapeHtml(signalActionText(type, score, "domestic"))}</small>
      </div>
      <div class="asset-side">
        ${scoreBadgeHtml(score, type)}
        <small>${escapeHtml(row.symbol || "")}</small>
      </div>
    </article>
  `;
}

function usStockItem(asset) {
  const summary = asset.summary || {};
  const type = signalClass(summary.signal || "watch");
  const score = stockQualityScore(asset, asset, type);
  return `
    <article class="asset-item ${escapeAttr(type)}" data-focus-key="${escapeAttr(collectionItemKey("us", asset.symbol))}">
      <div class="asset-main">
        <strong>${escapeHtml(asset.label || asset.symbol || "-")}</strong>
        <small>${escapeHtml(signalStatusText(type, score))} · ${escapeHtml(asset.group || "미장")} · ${escapeHtml(usSignalDetail(asset))}</small>
        <small class="next-action">${escapeHtml(signalActionText(type, score, "us"))}</small>
      </div>
      <div class="asset-side">
        ${scoreBadgeHtml(score, type)}
        <small>${escapeHtml(asset.symbol || "")}</small>
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

function replayQualitySummary(stats = {}) {
  const entries = number(stats.entries) || 0;
  const takes = number(stats.takes) || 0;
  const stops = number(stats.stops) || 0;
  const ambiguous = number(stats.ambiguous) || 0;
  const winRate = number(stats.winRate) || 0;
  const netProfit = number(stats.netProfit) || 0;
  let score = 50 + clampNumber(winRate - 45, -18, 28);
  score += clampNumber(netProfit * 8, -18, 18);
  score += entries ? 6 : -5;
  score += takes ? 4 : 0;
  score -= stops * 5 + ambiguous * 3;
  score = clampScore(score);
  return {
    score,
    label: score >= 72 ? "전략 유지" : score >= 55 ? "조건 확인" : "튜닝 필요",
  };
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
    crypto: {
      assets: [],
      exception_assets: [],
      cash_assets: [],
      summary: { signal: "neutral", label: "코인 대기", message: "메이저 코인 데이터를 기다리고 있습니다." },
      allocation_policy: {
        approved_scope_symbols: ["BTC", "ETH", "XRP", "XLM"],
        exception_pool_cap_pct: 5,
        exception_symbol_cap_pct: 2.5,
        exception_entry_slot_pct: 65,
        exception_weekly_probe_pct: 1,
        exception_weekly_stop_pct: 30,
        exception_pool_approval_range_pct: [6, 7, 8, 9, 10],
        exception_pool_absolute_max_pct: 15,
        cash_like_symbols: ["USDT"],
      },
    },
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
  const assetAlertMode = document.querySelector("#assetAlertMode");
  if (assetAlertMode) assetAlertMode.value = state.settings.assetAlertMode || "all";
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
  setText("#androidBackendStatus", "이 폰의 로컬 서버 주소를 적용했습니다.");
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
  if (name === "signals") renderSignalInbox();
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

async function maybeRefreshLiveAssetArchive() {
  if (!isLiveDate()) return;
  if (!state.alertsEnabled && state.activeTab !== "crypto") return;
  const now = Date.now();
  if (now - (state.lastAssetArchiveRefreshAt || 0) < ASSET_ARCHIVE_POLL_MS) return;
  await refreshAssetArchive(state.selectedDate, (state.activeTab === "crypto" || state.alertsEnabled) ? ["crypto"] : assetSectionsForTab(state.activeTab));
  renderAssetTabs();
}

function maybeFireCryptoAlerts() {
  if (!state.alertsEnabled) return;
  if (!isLiveDate()) return;
  const crypto = state.assetArchive?.crypto || {};
  const normalAssets = cryptoVisibleAssets(crypto.assets || []);
  const exceptionAssets = cryptoVisibleAssets(crypto.exception_assets || []);
  const plans = [
    ...normalAssets.map((asset) => cryptoSignalPlan(asset, normalAssets)),
    ...exceptionAssets.map((asset) => cryptoSignalPlan(asset, normalAssets, { exceptionMode: true })),
  ];
  const alertPlan = plans.find((plan) => {
    if (plan.trackingAlert) return true;
    if (plan.trackingNotice) return true;
    if (plan.pyramidMarketTrigger) return true;
    if (plan.weeklyStarter) return true;
    return plan.assetType === "exception" && plan.exceptionEntryStrong && plan.slotPct >= CRYPTO_SLOT_PCT.base;
  });
  if (!alertPlan) return;
  const alertKind = alertPlan.trackingAlert
    ? alertPlan.trackingRule
    : alertPlan.trackingNotice ? alertPlan.trackingRule : alertPlan.pyramidMarketTrigger ? "pyramid_market" : alertPlan.weeklyStarter ? "weekly_probe" : "exception_entry";
  const key = `crypto:${alertPlan.key}:${alertKind}:${alertPlan.trackingTime || alertPlan.close || ""}`;
  if (state.lastCryptoAlertKey === key) return;
  state.lastCryptoAlertKey = key;
  const exitTitle = {
    box_final_stop: "박스손절",
    forced_reduce_hard: "강제축소",
    fib618_second_stop: "2차손절",
    fib618_final_stop: "61.8손절",
    final_stop: "최종손절",
  }[alertPlan.trackingRule] || "최종손절";
  const noticeTitle = {
    forced_reduce_watch: "고점컷 알림",
    fib618_touch_rebound: "61.8 반등",
    reentry_bounce: "재진입 반등",
    kijun_break_alert: "기준선 이탈",
    kijun_touch_alert: "기준선 터치",
    ma30_break_alert: "30이평 이탈",
    ma30_touch_alert: "30이평 터치",
  }[alertPlan.trackingRule] || "전환선 알림";
  const noticeRule = {
    forced_reduce_watch: "CRYPTO_DRAWDOWN_NOTICE",
    fib618_touch_rebound: "CRYPTO_FIB618_REBOUND",
    reentry_bounce: "CRYPTO_REENTRY_BOUNCE",
    kijun_break_alert: "CRYPTO_KIJUN_NOTICE",
    kijun_touch_alert: "CRYPTO_KIJUN_NOTICE",
    ma30_break_alert: "CRYPTO_MA30_NOTICE",
    ma30_touch_alert: "CRYPTO_MA30_NOTICE",
  }[alertPlan.trackingRule] || "CRYPTO_TENKAN_NOTICE";
  fireAlert({
    type: alertPlan.trackingAlert ? "sell" : alertPlan.trackingNotice ? "warning" : "candidate",
    scope: "crypto",
    title: alertPlan.trackingAlert
      ? `${alertPlan.name} ${exitTitle}`
      : alertPlan.trackingNotice
        ? `${alertPlan.name} ${noticeTitle}`
      : alertPlan.pyramidMarketTrigger
        ? `${alertPlan.name} ${alertPlan.pyramidOrder?.pullbackTrigger ? "불타기 77% 눌림" : "불타기 시장가"}`
        : alertPlan.weeklyStarter
        ? `${alertPlan.name} 주봉 탐색진입`
        : `${alertPlan.name} 예외 진입 후보`,
    label: alertPlan.label,
    message: alertPlan.trackingAlert
      ? `${alertPlan.name}: ${alertPlan.thirtySubText}. 목표 축소 ${alertPlan.riskTargetText || "30%"} 기준을 확인하세요.`
      : alertPlan.trackingNotice
        ? `${alertPlan.name}: ${alertPlan.thirtySubText}. ${alertPlan.trackingRule === "reentry_bounce" ? "기초+10 40% 재증가 후보입니다." : alertPlan.trackingRule === "forced_reduce_watch" ? "비중축소 여부를 판단할 구간이며 계속 추적합니다." : "알림만 발송하며 즉시 비중축소 사유는 아닙니다."}`
      : alertPlan.pyramidMarketTrigger
        ? `${alertPlan.name}: ${alertPlan.pyramidOrderSubText}. 추가 물량 중 ${formatNum(alertPlan.pyramidOrder?.marketSlotPct, 1)}% 대응 신호입니다.`
        : alertPlan.weeklyStarter
        ? `${alertPlan.name}: 주봉 기준선 위·매물대 돌파 후보입니다. 늦은 진입이므로 전체 ${formatNum(alertPlan.portfolioPct, 2)}% 탐색만 보고 손절 폭은 ${formatNum(CRYPTO_EXCEPTION_WEEKLY_WIDE_STOP_PCT, 0)}% 이상으로 넓게 둡니다.`
        : `${alertPlan.name}: 정상 감시군 밖 예외 신호입니다. 예외 한도 ${alertPlan.capText}, 투입 후보 ${alertPlan.portfolioText}.`,
    rule: alertPlan.trackingAlert
      ? `CRYPTO_30M_EXIT_${alertPlan.key}`
      : alertPlan.trackingNotice
        ? `${noticeRule}_${alertPlan.key}`
        : alertPlan.pyramidMarketTrigger ? `CRYPTO_PYRAMID_MARKET_${alertPlan.key}` : alertPlan.weeklyStarter ? `CRYPTO_WEEKLY_PROBE_${alertPlan.key}` : `CRYPTO_EXCEPTION_ENTRY_${alertPlan.key}`,
  });
}

function maybeFireSignalInboxAlerts() {
  if (!state.alertsEnabled) return;
  if (!isLiveDate()) return;
  const now = Date.now();
  const items = signalInboxItems()
    .filter((item) => !["options", "crypto"].includes(item.jumpTab))
    .filter(signalInboxIsUnread)
    .filter(signalInboxAlertAllowed)
    .filter((item) => !state.signalInboxAlertedKeys.has(item.key))
    .filter((item) => now - (state.signalInboxAlertThrottle.get(item.sourceKey) || 0) >= SIGNAL_ALERT_THROTTLE_MS);
  if (!items.length) return;
  const alertItem = items.find((item) => ["candidate", "buy", "warning", "sell", "avoid"].includes(signalClass(item.signal))) || items[0];
  if (!alertItem?.key) return;
  state.signalInboxAlertedKeys.add(alertItem.key);
  state.signalInboxAlertThrottle.set(alertItem.sourceKey, now);
  [...state.signalInboxAlertThrottle.entries()].forEach(([key, time]) => {
    if (now - time > SIGNAL_ALERT_THROTTLE_MS * 6) state.signalInboxAlertThrottle.delete(key);
  });
  if (state.signalInboxAlertedKeys.size > 120) {
    state.signalInboxAlertedKeys = new Set([...state.signalInboxAlertedKeys].slice(-80));
  }
  fireAlert({
    type: signalClass(alertItem.signal),
    scope: "asset",
    title: `${alertItem.kind || "신호"} ${alertItem.title || ""}`.trim(),
    label: alertItem.badge,
    message: alertItem.detail || `${alertItem.kind || "자산"} 신호를 확인하세요.`,
    rule: `SIGNAL_INBOX_${alertItem.key}`,
  });
}

function signalInboxAlertAllowed(item = {}) {
  const mode = state.settings.assetAlertMode || "all";
  const signal = signalClass(item.signal || "watch");
  if (mode === "off") return false;
  if (mode === "risk") return ["warning", "sell", "avoid"].includes(signal);
  if (mode === "strong") return ["candidate", "buy", "warning", "sell", "avoid"].includes(signal);
  return true;
}

async function fireAlert(signal, force = false) {
  if (!force && !state.alertsEnabled) return;
  playTone(signal.type);
  vibrate(signal.type);

  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const prefix = signal.scope === "crypto" ? "코인 감시" : signal.scope === "asset" ? "신호 알림" : "옵션 감시";
  const title = `${prefix}: ${signal.title || signal.label || "신호"}`;
  const body = signal.message || (signal.scope === "crypto" ? "코인 신호를 확인하세요." : signal.scope === "asset" ? "알림함에서 신호를 확인하세요." : "KOSPI200 5분봉 신호를 확인하세요.");
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
      signal.message || "서버 주소와 로컬 서버 실행 상태를 확인하세요.",
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
    chartBadges: [
      { label: "신호", value: state.monitor?.signal?.label || "대기" },
      { label: "최신", value: state.monitor?.main?.latest?.time || "-" },
      { label: "61.8", value: formatNum(liveSession.levels?.fib_618, 2) },
    ],
  });
}

function drawReplayChart(session, tradePlan = null) {
  const canvas = document.querySelector("#replayChart");
  if (!session?.series?.length) {
    drawEmptyChart(canvas, "복기 자료 없음", 360, "날짜 또는 서버 연결 상태를 확인하세요.");
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
      <button type="button" data-chart-action="reset" aria-label="차트 초기화" title="초기화">↺</button>
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
  drawChartBadges(context, options.chartBadges || [], padding, width);
  (options.levels || []).forEach((level) => drawHorizontalLevel(context, width, padding, yFor(number(level.value)), level));
  (options.extraSeries || []).forEach((series) => {
    drawSeries(context, points.map((point) => number(point[series.key])), xFor, yFor, series.color, series.width || 1.5, series.dash || []);
  });
  drawSeries(context, values, xFor, yFor, themeColor("--chart-line", "#e8eef5"), 2.6, []);
  drawLatestPoint(context, points, values, xFor, yFor, options, padding, height);
  if (options.tradeMarkers?.length) {
    drawTradeMarkers(context, points, xFor, yFor, options);
  } else {
    drawSignalMarkers(context, points, xFor, yFor, options);
  }
  drawAxisLabels(context, width, height, padding, axisPoints, scaleValues.length ? scaleValues : values, options.timeKey);
}

function drawChartBadges(context, badges = [], padding = {}, canvasWidth = 0) {
  const items = (Array.isArray(badges) ? badges : [])
    .filter((item) => item?.label && item?.value != null && item.value !== "-")
    .slice(0, 4);
  if (!items.length) return;
  context.save();
  context.font = "bold 11px Segoe UI, sans-serif";
  let x = padding.left || 8;
  const y = Math.max(12, (padding.top || 32) - 28);
  items.forEach((item) => {
    const text = `${item.label} ${item.value}`;
    const width = Math.ceil(context.measureText(text).width) + 16;
    if (x + width > canvasWidth - (padding.right || 8)) return;
    fillRoundRect(context, x, y, width, 20, 6, "rgba(13, 20, 29, 0.78)");
    context.strokeStyle = "rgba(154, 168, 184, 0.32)";
    context.strokeRect(x + 0.5, y + 0.5, width - 1, 19);
    context.fillStyle = themeColor("--chart-line", "#e8eef5");
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, x + width / 2, y + 10.5);
    x += width + 6;
  });
  context.restore();
}

function drawLatestPoint(context, points, values, xFor, yFor, options, padding = {}, height = 210) {
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
  const label = options.compactLatestLabel
    ? formatNum(latest, 2)
    : `${compactAxisTimeLabel(points[lastIndex][options.timeKey], context.canvas.getBoundingClientRect().width || 360)} ${formatNum(latest, 2)}`;
  const safeY = Math.max((padding.top || 0) + 12, Math.min(y - 9, height - (padding.bottom || 0) - 10));
  context.fillText(label, x, safeY);
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
  const firstLabel = compactAxisTimeLabel(points[0]?.[timeKey], width);
  const lastLabel = compactAxisTimeLabel(points[points.length - 1]?.[timeKey], width);
  const y = height - Math.max(13, Math.min(18, padding.bottom * 0.42));
  drawAxisLabelChip(context, firstLabel, padding.left, y, "left");
  drawAxisLabelChip(context, lastLabel, width - padding.right, y, "right");
  context.fillStyle = themeColor("--muted", "#9aa8b8");
  context.font = "10px Segoe UI, sans-serif";
  context.textAlign = "right";
  context.fillText(formatNum(Math.max(...values), 2), width - padding.right, padding.top - 12);
}

function compactAxisTimeLabel(value, width = 360) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) return text.length > 12 && width < 430 ? text.slice(-11) : text;
  const date = width < 520 ? `${match[2]}-${match[3]}` : `${match[1]}-${match[2]}-${match[3]}`;
  return match[4] ? `${date} ${match[4]}:${match[5]}` : date;
}

function drawAxisLabelChip(context, text, x, y, align = "left") {
  if (!text) return;
  context.save();
  context.font = "10px Segoe UI, sans-serif";
  const paddingX = 5;
  const width = Math.ceil(context.measureText(text).width) + paddingX * 2;
  const height = 17;
  const chipX = align === "right" ? x - width : x;
  fillRoundRect(context, chipX, y - height / 2, width, height, 5, "rgba(13, 20, 29, 0.72)");
  context.fillStyle = themeColor("--muted", "#9aa8b8");
  context.textAlign = align === "right" ? "right" : "left";
  context.textBaseline = "middle";
  context.fillText(text, align === "right" ? x - paddingX : x + paddingX, y + 0.5);
  context.restore();
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
  context.setLineDash(level.dash || (level.label === "105" ? [4, 4] : []));
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
  const cssWidth = Math.max(1, Math.min(frameWidth || measuredWidth, viewportWidth));
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

function formatCryptoTradeValue(value) {
  const parsed = number(value);
  if (parsed == null) return "-";
  const abs = Math.abs(parsed);
  if (abs >= 1_000_000_000) return `${formatNum(parsed / 1_000_000_000, 1)}B`;
  if (abs >= 1_000_000) return `${formatNum(parsed / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${formatNum(parsed / 1_000, 1)}K`;
  return formatNum(parsed, 0);
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
