const state = {
  report: null,
  asset: "kr",
  period: "1m",
  view: "overview",
};

const validViews = new Set(["overview", "candidates", "funnel", "validation", "raw", "method"]);
const topbar = document.querySelector(".topbar");
const formatPct = (value) => (value == null ? "-" : `${(Number(value) * 100).toFixed(1)}%`);
const formatNum = (value, digits = 2) =>
  value == null ? "-" : Number(value).toLocaleString("ko-KR", { maximumFractionDigits: digits });
const formatScore = (value) => (value == null ? "-" : Number(value).toFixed(2));

function updateTopbar() {
  if (!topbar) return;
  topbar.classList.toggle("is-scrolled", window.scrollY > 20);
}

function actionLabel(action) {
  return {
    candidate: "최종 후보",
    watch: "관찰",
    avoid: "제외",
    error: "오류",
    unscored: "미분석",
  }[action] || "-";
}

function badge(action) {
  return `<span class="badge ${action || "unknown"}">${actionLabel(action)}</span>`;
}

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} 로드 실패`);
  return response.json();
}

async function init() {
  window.addEventListener("scroll", updateTopbar, { passive: true });
  window.addEventListener("hashchange", () => {
    const hashView = viewFromHash();
    if (hashView) setActiveView(hashView, true);
  });
  updateTopbar();

  state.view = viewFromHash() || state.view;

  document.querySelector("#searchInput")?.addEventListener("input", renderRawRows);
  document.querySelector("#actionFilter")?.addEventListener("change", renderRawRows);

  document.querySelectorAll("[data-asset]").forEach((button) => {
    button.addEventListener("click", () => {
      state.asset = button.dataset.asset;
      renderDashboard();
    });
  });

  document.querySelectorAll("[data-period]").forEach((button) => {
    button.addEventListener("click", () => {
      state.period = button.dataset.period;
      renderDashboard();
    });
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view, true, true));
  });

  document.querySelectorAll("[data-view-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveView(link.dataset.viewLink, false, true);
      document.querySelector("#workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  try {
    state.report = await loadJson("data/market_report.json");
    renderDashboard();
  } catch (error) {
    renderOffline(error);
  }
}

function currentAsset() {
  if (!state.report) return null;
  if (state.asset === "kr") return state.report.domestic;
  return state.report[state.asset];
}

function currentPeriod() {
  const asset = currentAsset();
  return asset?.periods?.[state.period] || null;
}

function viewFromHash() {
  const key = window.location.hash.replace("#", "");
  return validViews.has(key) ? key : null;
}

function setActiveView(view, scrollToTabs = false, updateHash = false) {
  if (!validViews.has(view)) view = "overview";
  state.view = view;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll("[data-view-link]").forEach((link) => {
    link.classList.toggle("active", link.dataset.viewLink === view);
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const active = panel.dataset.panel === view;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });

  if (updateHash && window.location.hash !== `#${view}`) {
    window.history.replaceState(null, "", `#${view}`);
  }

  if (view === "validation") {
    const period = currentPeriod();
    if (period) window.requestAnimationFrame(() => renderBacktest(period));
  }

  if (scrollToTabs) {
    document.querySelector(".view-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderOffline(error) {
  const message = "시장 리포트가 아직 없습니다. GitHub Actions가 한 번 실행되면 자동으로 표시됩니다.";
  document.querySelector("#heroStatus").innerHTML =
    `<span class="status-label">대기</span><strong>데이터 준비 전</strong><span>${message}</span>`;
  document.querySelector("#finalCallout").innerHTML =
    `<strong>데이터 파일을 불러오지 못했습니다.</strong><span>${error.message}</span>`;
  document.querySelector("#finalRows").innerHTML = `<tr><td colspan="8">${message}</td></tr>`;
  document.querySelector("#rawRows").innerHTML = `<tr><td colspan="11">${message}</td></tr>`;
}

function renderDashboard() {
  updateSwitches();
  setActiveView(state.view, false);

  const asset = currentAsset();
  const period = currentPeriod();
  const assetInfo = state.report.asset_classes[state.asset];

  if (!period) {
    renderPlannedAsset(assetInfo, asset);
    return;
  }

  const summary = asset.universe_summary;
  const metrics = period.backtest.metrics;
  const candidates = period.final_candidates || [];
  const displayRows = candidates.length ? candidates : period.watch || [];

  document.querySelector("#heroStatus").innerHTML = `
    <span class="status-label">${assetInfo.label} · ${period.label}</span>
    <strong>${summary.total_count.toLocaleString("ko-KR")}개 모데이터</strong>
    <span>가격 이력 ${summary.history_ready_count.toLocaleString("ko-KR")}개, 최종 후보 ${candidates.length}개</span>
  `;
  document.querySelector("#candidateCount").textContent = candidates.length;
  document.querySelector("#watchCount").textContent = formatPct(metrics.win_rate);
  document.querySelector("#universeCount").textContent = summary.total_count.toLocaleString("ko-KR");
  document.querySelector("#asOfDate").textContent = state.report.generated_at.slice(0, 10);

  renderFinalCallout(period, candidates);
  renderFinalRows(displayRows);
  renderFunnel(period);
  renderRawRows();
  renderBacktest(period);
  renderFilterNotes();
}

function renderPlannedAsset(assetInfo, asset) {
  document.querySelector("#heroStatus").innerHTML = `
    <span class="status-label">${assetInfo.label}</span>
    <strong>데이터 모듈 준비 중</strong>
    <span>${asset.summary}</span>
  `;
  document.querySelector("#candidateCount").textContent = "-";
  document.querySelector("#watchCount").textContent = "-";
  document.querySelector("#universeCount").textContent = "-";
  document.querySelector("#asOfDate").textContent = "-";
  document.querySelector("#finalCallout").className = "final-callout empty";
  document.querySelector("#finalCallout").innerHTML =
    `<strong>${assetInfo.label}은 세분화 구조만 먼저 열어두었습니다.</strong><span>${asset.summary}</span>`;
  document.querySelector("#finalRows").innerHTML = `<tr><td colspan="8">아직 연결된 데이터가 없습니다.</td></tr>`;
  document.querySelector("#funnelGrid").innerHTML = "";
  document.querySelector("#rawRows").innerHTML = `<tr><td colspan="11">아직 연결된 데이터가 없습니다.</td></tr>`;
  renderEmptyBacktest();
}

function updateSwitches() {
  document.querySelectorAll("[data-asset]").forEach((button) => {
    button.classList.toggle("active", button.dataset.asset === state.asset);
  });
  document.querySelectorAll("[data-period]").forEach((button) => {
    button.classList.toggle("active", button.dataset.period === state.period);
  });
}

function renderFinalCallout(period, candidates) {
  const callout = document.querySelector("#finalCallout");
  const validation = period.backtest.validation;
  if (!candidates.length) {
    callout.className = "final-callout empty";
    callout.innerHTML = `
      <strong>${period.label} 기준 최종 후보는 없습니다.</strong>
      <span>관찰 대상과 검증 지표를 확인하세요. 검증 상태: ${validation.reasons.join(", ")}</span>
    `;
    return;
  }

  const names = candidates.slice(0, 3).map((row) => `${row.symbol} ${row.name || ""}`.trim()).join(", ");
  callout.className = "final-callout";
  callout.innerHTML = `
    <strong>${period.label} 최종 후보: ${names}</strong>
    <span>과거 동일 규칙 검증: ${validation.passed ? "통과" : validation.reasons.join(", ")}</span>
  `;
}

function renderFinalRows(rows) {
  const body = document.querySelector("#finalRows");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8">표시할 후보가 없습니다.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.rank || "-"}</td>
      <td><strong>${row.symbol}</strong><span>${row.name || ""}</span></td>
      <td>${badge(row.final_action)}</td>
      <td>${formatScore(row.score)}</td>
      <td>${formatPct(row.ret_21d ?? row.ret_1d)}</td>
      <td>${formatPct(row.ret_63d ?? row.ret_5d)}</td>
      <td>${formatPct(row.vol_21d ?? row.vol_5d)} / ${formatPct(row.max_drawdown_63d ?? row.max_drawdown_252d)}</td>
      <td>${row.reason || "-"}</td>
    </tr>
  `).join("");
}

function renderFunnel(period) {
  const grid = document.querySelector("#funnelGrid");
  const maxCount = Math.max(...period.funnel.map((stage) => stage.before_count || stage.count || 1), 1);
  grid.innerHTML = period.funnel.map((stage, index) => {
    const width = Math.max(5, Math.round((stage.count / maxCount) * 100));
    return `
      <article class="funnel-step">
        <div class="step-top">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${stage.label}</strong>
        </div>
        <div class="funnel-bar" aria-hidden="true"><i style="width:${width}%"></i></div>
        <p>${stage.description}</p>
        <dl>
          <div><dt>통과</dt><dd>${stage.count.toLocaleString("ko-KR")}개</dd></div>
          <div><dt>탈락</dt><dd>${stage.drop_count.toLocaleString("ko-KR")}개</dd></div>
        </dl>
        <small>${stage.symbols.length ? stage.symbols.slice(0, 16).join(", ") : "통과 종목 없음"}</small>
      </article>
    `;
  }).join("");
}

function renderRawRows() {
  if (!state.report || state.asset !== "kr") return;
  const asset = currentAsset();
  const period = currentPeriod();
  const analyzed = new Map((period?.rows || []).map((row) => [row.symbol, row]));
  const query = (document.querySelector("#searchInput")?.value || "").trim().toLowerCase();
  const action = document.querySelector("#actionFilter")?.value || "all";
  const rows = asset.raw_universe.filter((row) => {
    const scored = analyzed.get(row.symbol);
    const finalAction = scored?.final_action || "unscored";
    const text = `${row.symbol} ${row.name || ""} ${row.market || ""}`.toLowerCase();
    const queryMatch = !query || text.includes(query);
    const actionMatch = action === "all" || finalAction === action;
    return queryMatch && actionMatch;
  }).slice(0, 500);

  const body = document.querySelector("#rawRows");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="11">조건에 맞는 종목이 없습니다.</td></tr>`;
    return;
  }

  body.innerHTML = rows.map((row) => {
    const scored = analyzed.get(row.symbol);
    const finalAction = scored?.final_action || "unscored";
    return `
      <tr>
        <td><strong>${row.symbol}</strong></td>
        <td>${row.name || "-"}</td>
        <td>${badge(finalAction)}</td>
        <td>${formatScore(scored?.score)}</td>
        <td>${formatNum(row.close, 0)}</td>
        <td>${formatPct(scored?.ret_21d ?? row.change_pct)}</td>
        <td>${formatPct(scored?.ret_63d)}</td>
        <td>${formatPct(scored?.vol_21d)}</td>
        <td>${formatPct(scored?.max_drawdown_63d)}</td>
        <td>${formatNum(scored?.issue_score, 2)}</td>
        <td>${row.market}${row.tags?.length ? ` · ${row.tags.join(", ")}` : ""}</td>
      </tr>
    `;
  }).join("");
}

function renderBacktest(period) {
  const metrics = period.backtest.metrics;
  document.querySelector("#tradeCount").textContent = (metrics.trade_count || 0).toLocaleString("ko-KR");
  document.querySelector("#winRate").textContent = formatPct(metrics.win_rate);
  document.querySelector("#avgReturn").textContent = formatPct(metrics.average_return);
  document.querySelector("#maxDrawdown").textContent = formatPct(metrics.max_drawdown);
  document.querySelector("#validationStatus").textContent =
    period.backtest.validation.passed ? "검증 기준 통과" : period.backtest.validation.reasons.join(", ");
  drawLineChart(document.querySelector("#historyChart"), period.backtest.equity_curve || [], "equity", "#008c8c");
  renderTradeCases("#bestTrades", period.backtest.best_trades || []);
  renderTradeCases("#worstTrades", period.backtest.worst_trades || []);
}

function renderEmptyBacktest() {
  document.querySelector("#tradeCount").textContent = "-";
  document.querySelector("#winRate").textContent = "-";
  document.querySelector("#avgReturn").textContent = "-";
  document.querySelector("#maxDrawdown").textContent = "-";
  drawLineChart(document.querySelector("#historyChart"), [], "equity", "#008c8c");
  document.querySelector("#bestTrades").innerHTML = "";
  document.querySelector("#worstTrades").innerHTML = "";
}

function renderTradeCases(selector, trades) {
  const list = document.querySelector(selector);
  if (!trades.length) {
    list.innerHTML = "<li>표본 없음</li>";
    return;
  }
  list.innerHTML = trades.map((trade) => `
    <li>
      <strong>${trade.symbol} ${trade.name || ""}</strong>
      <span>${trade.date} → ${trade.exit_date} · ${formatPct(trade.net_return)}</span>
    </li>
  `).join("");
}

function renderFilterNotes() {
  document.querySelector("#validatedFilters").textContent = state.report.validated_filters.slice(0, 4).join(" / ");
  document.querySelector("#issueFilters").textContent = state.report.issue_filters.slice(0, 3).join(" / ");
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(Number(canvas.getAttribute("height")) * scale));
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  return { context, width: rect.width, height: Number(canvas.getAttribute("height")) };
}

function drawLineChart(canvas, points, key, color) {
  const { context, width, height } = setupCanvas(canvas);
  context.clearRect(0, 0, width, height);
  if (!points.length || width <= 1) {
    drawEmpty(context, width, height, "검증 자료가 없습니다.");
    return;
  }

  const padding = 34;
  const values = points.map((point) => Number(point[key])).filter((value) => Number.isFinite(value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  context.strokeStyle = "#dfe5ea";
  context.beginPath();
  context.moveTo(padding, height - padding);
  context.lineTo(width - padding, height - padding);
  context.stroke();

  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  points.forEach((point, index) => {
    const x = padding + index * ((width - padding * 2) / Math.max(points.length - 1, 1));
    const y = height - padding - ((Number(point[key]) - min) / span) * (height - padding * 2);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  drawChartLabel(context, padding, 20, `${formatNum(min, 2)} - ${formatNum(max, 2)}`);
}

function drawEmpty(context, width, height, message) {
  context.fillStyle = "#5b6776";
  context.font = "14px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.fillText(message, Math.max(width / 2, 120), height / 2);
}

function drawChartLabel(context, x, y, label) {
  context.fillStyle = "#5b6776";
  context.font = "12px Segoe UI, sans-serif";
  context.fillText(label, x, y);
}

window.addEventListener("resize", () => {
  const period = currentPeriod();
  if (period && state.view === "validation") renderBacktest(period);
});

init();
