const MONITOR_POLL_MS = 60000;
const SIGNAL_LOG_KEY = "1monthfinder.options.signalLog";
const SETTINGS_KEY = "1monthfinder.options.settings";
const TRADE_COLORS = {
  entry: "#2f7f83",
  stop: "#a95f59",
  tp1: "#5275ad",
  tp2: "#315f9d",
  exit: "#657186",
  mixed: "#b07a2a",
  watch: "#a97022",
  test: "#a97022",
  risk: "#a95f59",
  take_profit: "#5275ad",
};

const state = {
  weeklyOptions: null,
  replay: null,
  monitor: null,
  monitorTimer: null,
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
  wakeLock: null,
};

const modalMeta = {
  replay: { eyebrow: "차트 검증", title: "설계선과 복기" },
  design: { eyebrow: "옵션 프리미엄", title: "설계선" },
  guide: { eyebrow: "전략 기준", title: "설명" },
  settings: { eyebrow: "알림", title: "설정" },
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
      { key: "entry_average", label: "평균 진입", formula: "avg_entry", color: "#17202a" },
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
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"),
    };
  } catch (error) {
    return { repeatStrongAlerts: true, vibrationEnabled: true, saveSignalLog: true, alertsEnabled: false };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadSignalLog() {
  try {
    const log = JSON.parse(localStorage.getItem(SIGNAL_LOG_KEY) || "[]");
    return Array.isArray(log) ? log.slice(0, 12) : [];
  } catch (error) {
    return [];
  }
}

function saveSignalLog() {
  if (!state.settings.saveSignalLog) return;
  localStorage.setItem(SIGNAL_LOG_KEY, JSON.stringify(state.signalLog.slice(0, 12)));
}

async function init() {
  state.alertsEnabled = Boolean(state.settings.alertsEnabled);
  bindControls();
  await registerServiceWorker();

  const [weeklyOptions, replayPayload, publicReplay] = await Promise.all([
    loadOptionalJson("data/weekly_options.json"),
    loadOptionalJson("/api/options-replay"),
    loadOptionalJson("data/public_weekly_replay.json"),
  ]);

  state.weeklyOptions = weeklyOptions || fallbackWeeklyOptions;
  state.replay = normalizeReplayPayload(replayPayload) || publicReplay || state.weeklyOptions.signal_replay || {};
  state.activeReplayDate = activeReplaySession()?.date || state.replay.active_session_id || null;

  renderSignalLog();
  renderStaticPanels();
  renderSettings();
  await loadMonitor(true);
  startPolling();
}

async function loadOptionalJson(path) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path} 로드 실패`);
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

async function loadReplayDate(date) {
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
  renderReplay();
}

function bindControls() {
  document.querySelector("#refreshMonitor")?.addEventListener("click", () => loadMonitor(true));
  document.querySelector("#enableAlerts")?.addEventListener("click", requestAlertToggle);
  document.querySelector("#testAlert")?.addEventListener("click", testAlert);
  document.querySelector("#toggleWakeLock")?.addEventListener("click", toggleWakeLock);
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
    if (state.activeReplayDate) state.replayCursors[state.activeReplayDate] = 0;
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
  document.querySelector("#clearSignalLog")?.addEventListener("click", () => {
    state.signalLog = [];
    localStorage.removeItem(SIGNAL_LOG_KEY);
    renderSignalLog();
  });
  window.addEventListener("resize", redrawCharts);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    state.serviceWorkerRegistration = await navigator.serviceWorker.register("sw.js");
  } catch (error) {
    state.serviceWorkerRegistration = null;
  }
}

function startPolling() {
  if (state.monitorTimer) window.clearInterval(state.monitorTimer);
  state.monitorTimer = window.setInterval(() => loadMonitor(), MONITOR_POLL_MS);
}

async function loadMonitor(manual = false) {
  if (manual) setTopStatus("조회 중");
  try {
    const response = await fetch("/api/options-monitor", { cache: "no-store" });
    const snapshot = await response.json();
    state.monitor = snapshot;
    renderMonitor();
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
    board.className = `signal-board ${signalType}`;
  }
  setText("#signalBadge", signal.label || "대기");
  document.querySelector("#signalBadge").className = `signal-pill ${signalType}`;
  setText("#signalTitle", signal.title || signal.label || "신호 대기");
  setText("#signalMessage", signal.message || "KOSPI200 5분봉 데이터를 기다리고 있습니다.");
  setText("#latestCandleTime", `최신봉 ${latest.time || "-"}`);
  setText("#delayText", Number.isFinite(age) ? `지연 ${age}분` : "지연 -");
  setTopStatus(statusText(snapshot, signal));
  renderPriceGrid(latest, secondaryLatest, levels);
  renderLiveLegend(levels);
  const livePlan = buildLiveTradePlan(snapshot);
  renderLiveTradePlan(livePlan);
  drawLiveChart(livePlan);
  renderSettings();
}

function statusText(snapshot, signal) {
  if (!snapshot.ok) return "데이터 오류";
  if (signal?.type === "warning" && signal?.rule === "DATA_STALE_DURING_MARKET") return "데이터 지연";
  return `${snapshot.source?.key_required === false ? "키 없음" : "데이터"} · ${signal?.label || "대기"}`;
}

function setTopStatus(text) {
  setText("#topStatusText", text);
}

function renderPriceGrid(latest, secondaryLatest, levels) {
  const items = [
    { label: "메인", value: formatNum(latest.close, 2), text: "KOSPI200" },
    { label: "보조", value: formatNum(secondaryLatest.close, 0), text: "KODEX200" },
    { label: "기준", value: formatNum(levels.fib_618, 2), text: "61.8%" },
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
    { label: "KOSPI200", color: "#17202a" },
    { label: `61.8 ${formatNum(levels.fib_618, 2)}`, color: "#3b8f70" },
    { label: `50 ${formatNum(levels.fib_50, 2)}`, color: "#5275ad" },
    { label: `105 ${formatNum(levels.fib_105, 2)}`, color: "#a95f59" },
  ];
  document.querySelector("#liveLegend").innerHTML = entries.map(legendItem).join("");
}

function legendItem(item) {
  return `<span style="color:${escapeAttr(item.color)}"><i></i>${escapeHtml(item.label)}</span>`;
}

function maybeRecordSignal(snapshot) {
  const signal = snapshot.signal || {};
  if (!signal.rule || signal.rule === "WAIT" || signal.alert_level === "silent") return;
  const latest = snapshot.main?.latest || {};
  const tradePlan = buildLiveTradePlan(snapshot);
  const key = `${signal.rule}:${latest.datetime || signal.time}:${latest.close || ""}`;
  if (state.signalLog[0]?.key === key) return;
  state.signalLog.unshift({
    key,
    type: signal.type || "watch",
    title: signal.title || signal.label || "신호",
    message: signal.message || "",
    time: signal.time || latest.time || "-",
    close: latest.close,
    trade: tradePlan?.status ? {
      status: tradePlan.status,
      entry: tradePlan.entry,
      stop: tradePlan.stop,
      tp1: tradePlan.tp1,
      tp2: tradePlan.tp2,
    } : null,
    createdAt: new Date().toISOString(),
  });
  state.signalLog = state.signalLog.slice(0, 12);
  saveSignalLog();
  renderSignalLog();
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
    .slice(0, 5)
    .map((item) => {
      const tradeText = item.trade
        ? `ENTRY ${formatNum(item.trade.entry, 2)} · STOP ${formatNum(item.trade.stop, 2)} · TP1 ${formatNum(item.trade.tp1, 2)}`
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
  renderReplay();
  renderDesign();
  renderGuide();
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
  if (state.replayCursors[key] == null) state.replayCursors[key] = 0;
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
  const series = Array.isArray(session?.series) ? session.series.slice(0, cursorIndex + 1) : [];
  const signals = (Array.isArray(session?.signals) ? session.signals : []).filter((signal) => Number(signal.point_index || 0) <= cursorIndex);
  return {
    ...session,
    series,
    signals,
    levels: levelsForVisibleSeries(series),
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
  return {
    day_high: high,
    day_low: low,
    fib_382: high - span * 0.382,
    fib_50: high - span * 0.5,
    fib_618: high - span * 0.618,
    fib_100: low,
    fib_105: high - span * 1.05,
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
        <small>${missing ? "저장된 공개 복기 날짜를 선택하세요." : "ENTRY 조건이 없어 가상 매매 로그를 만들지 않았습니다."}</small>
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
    { label: "계획손절", value: formatNum(current.stop, 2) },
    { label: "계획TP1", value: formatNum(current.tp1, 2) },
    { label: "계획TP2", value: formatNum(current.tp2, 2) },
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
    { label: "ENTRY", value: missing ? "-" : `${stats.entries}회`, className: stats.entries ? "good" : "" },
    { label: "TEST", value: missing ? "-" : `${stats.tests}회` },
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
      status: setup.contracts > 1 ? "CALL ENTRY" : "CALL TEST",
      entry: setup.entry,
      stop: setup.stop,
      tp1: setup.tp1,
      tp2: setup.tp2,
      markers: [tradeEvent(eventKind, 1, candles[pointIndex] || latest, pointIndex, setup)],
    };
  }

  if (signal.type === "sell" || String(signal.rule || "").includes("BREAK")) {
    const premium = optionPremiumPlan(signal);
    return {
      tone: "sell",
      status: "STOP/EXIT",
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
      ...standbyTradePlan("WATCH"),
      tone: "warning",
      markers: [tradeEvent("watch", 1, candles[pointIndex] || latest, pointIndex, { ...premium, indexEntry: close, indexStop: close, indexTp1: close, indexTp2: close, risk: 1 })],
    };
  }

  return standbyTradePlan("대기");
}

function buildReplayTradePlan(session) {
  if (!session?.series?.length) return emptyReplayTradePlan();
  const plan = emptyReplayTradePlan();
  const series = session.series;
  const signalsByIndex = groupSignalsByIndex(session.signals, series.length);
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

      plan.events.push(signalEvent(signal, point, index, activeTrade));
    });
  });

  if (activeTrade) {
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
  if (decision === "test") return "test";
  if (decision === "take_profit") return "take_profit";
  if (decision === "risk") return "risk";
  if (decision === "stop") return "stop";
  if (decision === "watch") return "watch";
  return signalClass(signal?.type);
}

function signalLabel(kind) {
  return {
    test: "TEST",
    take_profit: "TP CHECK",
    risk: "RISK",
    stop: "STOP",
    watch: "WATCH",
    warning: "WATCH",
  }[kind] || tradeLabel(kind);
}

function signalTitle(kind, signal, activeTrade) {
  if (kind === "take_profit" && activeTrade) return `#${activeTrade.id} TP CHECK`;
  if (kind === "stop" && activeTrade) return `#${activeTrade.id} STOP CHECK`;
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
  const reference = action.includes("FIB_50") ? number(levels.fib_50) : number(levels.fib_618);
  const candleLow = number(signal.candle?.low);
  const stopCandidates = [candleLow, reference]
    .filter((value) => value != null)
    .map((value) => value - buffer)
    .filter((value) => value < indexEntry);

  let indexStop = stopCandidates.length ? Math.min(...stopCandidates) : indexEntry - minRisk;
  let risk = indexEntry - indexStop;
  if (!Number.isFinite(risk) || risk < minRisk) {
    risk = minRisk;
    indexStop = indexEntry - risk;
  }
  const indexTp1 = targetAbove(indexEntry, [levels.fib_50, levels.fib_382, levels.day_high], risk);
  const indexTp2 = targetAbove(indexTp1, [levels.fib_382, levels.day_high], risk * 0.8);
  const premium = optionPremiumPlan(signal);
  const mode = signal.trade_decision === "test" ? "test" : "entry";
  const tp1Contracts = premium.contracts > 1 ? 1 : 0;

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
    stop: base * profile.stopMultiplier,
    tp1: base * profile.tp1Multiplier,
    tp2: base * profile.tp2Multiplier,
    contracts,
  };
}

function premiumProfile(signal = {}, entry = {}) {
  if (signal.trade_decision === "test") {
    return {
      entry: 1.0,
      contracts: 1,
      stopMultiplier: 0.6,
      tp1Multiplier: 1.3,
      tp2Multiplier: 1.45,
    };
  }

  const base = averageEntry(entry);
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
    entry: "ENTRY",
    stop: "STOP",
    tp1: "TP1",
    tp2: "TP2",
    mixed: "MIX",
    exit: "EXIT",
    watch: "WATCH",
    test: "TEST",
    risk: "RISK",
    take_profit: "TP CHECK",
  }[kind] || "SIGNAL";
}

function tradeTitle(kind, tradeId) {
  const prefix = `#${tradeId}`;
  return {
    entry: `${prefix} CALL ENTRY`,
    stop: `${prefix} STOP`,
    tp1: `${prefix} TP1`,
    tp2: `${prefix} TP2 EXIT`,
    mixed: `${prefix} MIXED 5M`,
    exit: `${prefix} TIME EXIT`,
    watch: "WATCH",
    test: `${prefix} CALL TEST`,
    risk: "RISK",
    take_profit: "TP CHECK",
  }[kind] || `${prefix} SIGNAL`;
}

function tradeDetail(kind, setup, outputR) {
  if (kind === "entry" || kind === "test") {
    const tp1Text = setup.tp1Contracts ? `TP1 ${setup.tp1Contracts}계약` : "TP1 본전스탑";
    return `${setup.contracts}계약 · 계획손절 ${formatNum(setup.stop, 2)} · ${tp1Text} · TP2 ${formatNum(setup.tp2, 2)}`;
  }
  if (kind === "tp1") {
    return setup.tp1Contracts
      ? `계획프리 ${formatNum(outputR, 2)} · ${setup.tp1Contracts}계약 청산 · 잔량 본전스탑`
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
  const entries = [
    { label: "지수", color: "#17202a" },
    { label: "ENTRY", color: TRADE_COLORS.entry },
    { label: "TEST", color: TRADE_COLORS.test },
    { label: "STOP", color: TRADE_COLORS.stop },
    { label: "TP", color: TRADE_COLORS.tp1 },
    { label: "MIX", color: TRADE_COLORS.mixed },
    { label: "RISK", color: TRADE_COLORS.risk },
  ];
  document.querySelector("#replayLegend").innerHTML = entries.map(legendItem).join("");
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
    color: line.color || "#17202a",
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
  const alertText = `${state.alertsEnabled ? "알림 켜짐" : "알림 꺼짐"} · 브라우저 ${permission} · ${wakeText}`;
  setText("#alertStatus", alertText);
  setText("#boardStatus", `${soundText} · ${vibrationText} · 알림센터 ${permission} · ${wakeText}`);
  setText("#enableAlerts", state.alertsEnabled ? "알림 끄기" : "알림 켜기");
  setText("#toggleWakeLock", state.wakeLock ? "화면유지 끄기" : "화면유지 켜기");
  setChecked("#repeatStrongAlerts", state.settings.repeatStrongAlerts);
  setChecked("#vibrationEnabled", state.settings.vibrationEnabled);
  setChecked("#saveSignalLog", state.settings.saveSignalLog);
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
  redrawCharts();
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

function drawLiveChart(livePlan = buildLiveTradePlan(state.monitor)) {
  const canvas = document.querySelector("#liveChart");
  const candles = Array.isArray(state.monitor?.main?.candles) ? state.monitor.main.candles.slice(-48) : [];
  if (!candles.length) {
    drawEmptyChart(canvas, "5분봉 대기");
    return;
  }
  const levels = state.monitor?.main?.levels || {};
  const values = candles.map((candle) => number(candle.close)).filter((value) => value != null);
  const levelEntries = [
    { key: "fib_618", label: "61.8", color: "#3b8f70" },
    { key: "fib_50", label: "50", color: "#5275ad" },
    { key: "fib_100", label: "100", color: "#a97022" },
    { key: "fib_105", label: "105", color: "#a95f59" },
  ]
    .map((level) => ({ ...level, value: number(levels[level.key]) }))
    .filter((level) => level.value != null);
  drawLineChart(canvas, {
    height: 210,
    points: candles,
    valueKey: "close",
    timeKey: "time",
    levels: levelEntries,
    marker: state.monitor?.signal?.type !== "neutral",
    tradeMarkers: livePlan?.markers || [],
  });
}

function drawReplayChart(session, tradePlan = null) {
  const canvas = document.querySelector("#replayChart");
  if (!session?.series?.length) {
    drawEmptyChart(canvas, "복기 자료 없음", 320);
    return;
  }
  const levels = session.levels || {};
  const levelEntries = [
    { key: "fib_618", label: "61.8", color: "#3b8f70", value: levels.fib_618 },
    { key: "fib_50", label: "50", color: "#5275ad", value: levels.fib_50 },
    { key: "fib_100", label: "100", color: "#a97022", value: levels.fib_100 },
    { key: "fib_382", label: "38.2", color: "#a95f59", value: levels.fib_382 },
  ].filter((level) => number(level.value) != null);
  drawLineChart(document.querySelector("#replayChart"), {
    height: 320,
    points: session.series,
    valueKey: "index",
    timeKey: "time",
    levels: levelEntries,
    extraSeries: [
      { key: "gma30", color: "#2f7f83", width: 1.5, dash: [] },
      { key: "gma50", color: "#95a3b7", width: 1.5, dash: [5, 4] },
    ],
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
      color: line.color || "#17202a",
      value: formulaValue(line.formula, scope),
    }))
    .filter((level) => number(level.value) != null);
  drawLineChart(canvas, {
    height: 300,
    points,
    valueKey: "value",
    timeKey: "time",
    levels,
  });
}

function drawLineChart(canvas, options) {
  if (!canvas) return;
  const points = (options.points || []).filter((point) => number(point[options.valueKey]) != null);
  const { context, width, height } = setupCanvas(canvas, options.height || 210);
  context.clearRect(0, 0, width, height);
  if (!points.length) {
    drawEmpty(context, width, height, "차트 자료 없음");
    return;
  }

  const padding = 24;
  const rightPadding = 46;
  const values = points.map((point) => number(point[options.valueKey]));
  const extraValues = (options.extraSeries || []).flatMap((series) => points.map((point) => number(point[series.key]))).filter((value) => value != null);
  const levelValues = (options.levels || []).map((level) => number(level.value)).filter((value) => value != null);
  const allValues = values.concat(extraValues, levelValues).filter((value) => value != null);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const xFor = (index) => padding + index * ((width - padding - rightPadding) / Math.max(points.length - 1, 1));
  const yFor = (value) => height - padding - ((value - min) / span) * (height - padding * 2);

  drawGrid(context, width, height, padding);
  (options.levels || []).forEach((level) => drawHorizontalLevel(context, width, padding, yFor(number(level.value)), level, rightPadding));
  (options.extraSeries || []).forEach((series) => {
    drawSeries(context, points.map((point) => number(point[series.key])), xFor, yFor, series.color, series.width || 1.5, series.dash || []);
  });
  drawSeries(context, values, xFor, yFor, "#17202a", 2.6, []);
  drawLatestPoint(context, points, values, xFor, yFor, options);
  if (options.tradeMarkers?.length) {
    drawTradeMarkers(context, points, xFor, yFor, options);
  } else {
    drawSignalMarkers(context, points, xFor, yFor, options);
  }
  drawAxisLabels(context, width, height, padding, points, values, options.timeKey);
}

function drawLatestPoint(context, points, values, xFor, yFor, options) {
  const lastIndex = values.length - 1;
  const latest = values[lastIndex];
  if (latest == null) return;
  const x = xFor(lastIndex);
  const y = yFor(latest);
  context.fillStyle = options.marker ? "#a95f59" : "#2f7f83";
  context.beginPath();
  context.arc(x, y, options.marker ? 5 : 4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#17202a";
  context.font = "11px Segoe UI, sans-serif";
  context.textAlign = "right";
  context.fillText(`${points[lastIndex][options.timeKey] || ""} ${formatNum(latest, 2)}`, x, Math.max(13, y - 9));
}

function drawSignalMarkers(context, points, xFor, yFor, options) {
  const signals = options.signals || [];
  signals.forEach((signal, index) => {
    const pointIndex = Math.max(0, Math.min(points.length - 1, Number(signal.point_index ?? 0)));
    const point = points[pointIndex];
    const value = number(signal.index_value ?? point?.[options.valueKey]);
    if (value == null) return;
    const x = xFor(pointIndex);
    const y = yFor(value);
    context.fillStyle = signalClass(signal.type) === "buy" ? "#3b8f70" : signalClass(signal.type) === "sell" ? "#a95f59" : "#a97022";
    context.beginPath();
    context.arc(x, y, 4.5, 0, Math.PI * 2);
    context.fill();
    if (index % 2 === 0) {
      context.font = "10px Segoe UI, sans-serif";
      context.textAlign = "center";
      context.fillText(signal.label || "신호", x, Math.max(12, y - 8));
    }
  });
}

function drawTradeMarkers(context, points, xFor, yFor, options) {
  const markers = options.tradeMarkers || [];
  markers.forEach((marker, index) => {
    const pointIndex = clampIndex(marker.point_index, points.length);
    const point = points[pointIndex];
    const value = number(marker.index_value ?? point?.[options.valueKey]);
    if (value == null) return;

    const x = xFor(pointIndex);
    const y = yFor(value);
    const color = marker.color || TRADE_COLORS[marker.kind] || TRADE_COLORS.watch;
    drawTradeShape(context, x, y, marker.kind, color);
    drawTradeChip(context, x, y, marker.label || tradeLabel(marker.kind), color, marker.kind, index);
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
  } else if (kind === "tp1" || kind === "tp2") {
    context.arc(x, y, 7, 0, Math.PI * 2);
  } else {
    context.rect(x - 6, y - 6, 12, 12);
  }
  context.fill();
  context.stroke();
  context.restore();
}

function drawTradeChip(context, x, y, label, color, kind, index) {
  const rect = context.canvas.getBoundingClientRect();
  const canvasWidth = rect.width || context.canvas.width;
  const canvasHeight = rect.height || context.canvas.height;
  const above = kind !== "stop";
  const laneOffset = (index % 3) * 16;
  const text = String(label || "SIGNAL");

  context.save();
  context.font = "bold 11px Segoe UI, sans-serif";
  const width = Math.ceil(context.measureText(text).width) + 14;
  const height = 18;
  const rawY = above ? y - 31 - laneOffset : y + 13 + laneOffset;
  const chipX = Math.max(4, Math.min(canvasWidth - width - 4, x - width / 2));
  const chipY = Math.max(4, Math.min(canvasHeight - height - 4, rawY));

  fillRoundRect(context, chipX, chipY, width, height, 5, color);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, chipX + width / 2, chipY + height / 2 + 0.5);
  context.restore();
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
  context.fillStyle = "#657186";
  context.font = "10px Segoe UI, sans-serif";
  context.textAlign = "left";
  context.fillText(points[0]?.[timeKey] || "", padding, height - 6);
  context.textAlign = "right";
  context.fillText(points[points.length - 1]?.[timeKey] || "", width - padding, height - 6);
  context.fillText(formatNum(Math.max(...values), 2), width - padding, 13);
}

function drawGrid(context, width, height, padding) {
  context.save();
  context.strokeStyle = "#dfe5ea";
  context.lineWidth = 1;
  for (let index = 0; index < 4; index += 1) {
    const y = padding + index * ((height - padding * 2) / 3);
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }
  context.restore();
}

function drawHorizontalLevel(context, width, padding, y, level, rightPadding) {
  if (!Number.isFinite(y)) return;
  context.save();
  context.strokeStyle = level.color || "#657186";
  context.lineWidth = 1;
  context.setLineDash(level.label === "105" ? [4, 4] : []);
  context.beginPath();
  context.moveTo(padding, y);
  context.lineTo(width - rightPadding, y);
  context.stroke();
  context.fillStyle = level.color || "#657186";
  context.font = "10px Segoe UI, sans-serif";
  context.textAlign = "right";
  context.fillText(level.label || "", width - padding, Math.max(12, y - 3));
  context.restore();
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

function drawEmptyChart(canvas, message, height = 210) {
  if (!canvas) return;
  const { context, width, height: canvasHeight } = setupCanvas(canvas, height);
  context.clearRect(0, 0, width, canvasHeight);
  drawEmpty(context, width, canvasHeight, message);
}

function drawEmpty(context, width, height, message) {
  context.fillStyle = "#657186";
  context.font = "14px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.fillText(message, width / 2, height / 2);
}

function setupCanvas(canvas, height) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width || canvas.parentElement?.clientWidth || 320;
  const cssHeight = rect.height && rect.height > 20 ? rect.height : height;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(cssWidth * scale));
  canvas.height = Math.max(1, Math.floor(cssHeight * scale));
  canvas.setAttribute("height", String(Math.round(cssHeight)));
  const context = canvas.getContext("2d");
  context.setTransform(scale, 0, 0, scale, 0, 0);
  return { context, width: cssWidth, height: cssHeight };
}

function redrawCharts() {
  drawLiveChart();
  if (state.activeModal === "replay") drawReplayChart(activeReplaySession());
  if (state.activeModal === "design") drawDesignChart();
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
