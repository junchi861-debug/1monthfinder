const state = {
  latest: null,
  history: null,
  prices: null,
  filteredRows: [],
};

const topbar = document.querySelector(".topbar");
const formatPct = (value) => (value == null ? "-" : `${(Number(value) * 100).toFixed(1)}%`);
const formatNum = (value, digits = 2) => (value == null ? "-" : Number(value).toLocaleString("ko-KR", { maximumFractionDigits: digits }));
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
  updateTopbar();

  document.querySelector("#searchInput")?.addEventListener("input", renderRawRows);
  document.querySelector("#actionFilter")?.addEventListener("change", renderRawRows);
  document.querySelector("#symbolSelect")?.addEventListener("change", renderPriceChart);

  try {
    const [latest, history, prices] = await Promise.all([
      loadJson("data/latest.json"),
      loadJson("data/history.json"),
      loadJson("data/prices.json"),
    ]);
    state.latest = latest;
    state.history = history;
    state.prices = prices;
    renderDashboard();
  } catch (error) {
    renderOffline(error);
  }
}

function renderOffline(error) {
  const message = "아직 배포 데이터가 없습니다. GitHub Actions가 한 번 실행되면 자동으로 표시됩니다.";
  document.querySelector("#heroStatus").innerHTML = `<span class="status-label">대기</span><strong>데이터 준비 전</strong><span>${message}</span>`;
  document.querySelector("#finalCallout").innerHTML = `<strong>데이터 파일을 불러오지 못했습니다.</strong><span>${message}</span>`;
  document.querySelector("#finalRows").innerHTML = `<tr><td colspan="8">${error.message}</td></tr>`;
  document.querySelector("#rawRows").innerHTML = `<tr><td colspan="11">${message}</td></tr>`;
}

function renderDashboard() {
  const summary = state.latest.summary;
  const candidates = state.latest.top_candidates || [];
  const displayRows = candidates.length ? candidates : state.latest.watch || [];

  document.querySelector("#heroStatus").innerHTML = `
    <span class="status-label">최신 기준</span>
    <strong>${summary.as_of || summary.generated_date}</strong>
    <span>${summary.candidate_count}개 최종 후보, ${summary.watch_count}개 관찰 대상</span>
  `;
  document.querySelector("#candidateCount").textContent = summary.candidate_count;
  document.querySelector("#watchCount").textContent = summary.watch_count;
  document.querySelector("#universeCount").textContent = summary.universe_count;
  document.querySelector("#asOfDate").textContent = summary.as_of || "-";

  renderFinalCallout(summary, candidates);
  renderFinalRows(displayRows);
  renderFunnel();
  renderRawRows();
  renderHistoryChart();
  setupPriceSelect();
}

function renderFinalCallout(summary, candidates) {
  const callout = document.querySelector("#finalCallout");
  if (!candidates.length) {
    callout.className = "final-callout empty";
    callout.innerHTML = `
      <strong>오늘 최종 후보는 없습니다.</strong>
      <span>관찰 대상 ${summary.watch_count}개를 확인하고, 내일 밤 자동 갱신 결과를 다시 봅니다.</span>
    `;
    return;
  }

  const names = candidates.slice(0, 3).map((row) => `${row.symbol} ${row.name || ""}`.trim()).join(", ");
  callout.className = "final-callout";
  callout.innerHTML = `
    <strong>오늘 최종 후보: ${names}</strong>
    <span>최고 점수는 ${summary.top_symbol} ${formatScore(summary.top_score)}점입니다.</span>
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
      <td>${formatPct(row.ret_21d)}</td>
      <td>${formatPct(row.ret_63d)}</td>
      <td>${formatPct(row.vol_21d)} / ${formatPct(row.max_drawdown_63d)}</td>
      <td>${row.reason || "-"}</td>
    </tr>
  `).join("");
}

function renderFunnel() {
  const grid = document.querySelector("#funnelGrid");
  const maxCount = Math.max(...state.latest.funnel.map((stage) => stage.before_count || stage.count || 1), 1);
  grid.innerHTML = state.latest.funnel.map((stage, index) => {
    const width = Math.max(8, Math.round((stage.count / maxCount) * 100));
    return `
      <article class="funnel-step">
        <div class="step-top">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${stage.label}</strong>
        </div>
        <div class="funnel-bar" aria-hidden="true"><i style="width:${width}%"></i></div>
        <p>${stage.description}</p>
        <dl>
          <div><dt>통과</dt><dd>${stage.count}개</dd></div>
          <div><dt>탈락</dt><dd>${stage.drop_count}개</dd></div>
        </dl>
        <small>${stage.symbols.length ? stage.symbols.join(", ") : "통과 종목 없음"}</small>
      </article>
    `;
  }).join("");
}

function renderRawRows() {
  if (!state.latest) return;
  const query = (document.querySelector("#searchInput")?.value || "").trim().toLowerCase();
  const action = document.querySelector("#actionFilter")?.value || "all";
  const rows = state.latest.rows.filter((row) => {
    const text = `${row.symbol} ${row.name || ""}`.toLowerCase();
    const queryMatch = !query || text.includes(query);
    const actionMatch = action === "all" || row.final_action === action;
    return queryMatch && actionMatch;
  });

  const body = document.querySelector("#rawRows");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="11">조건에 맞는 종목이 없습니다.</td></tr>`;
    return;
  }

  body.innerHTML = rows.map((row) => `
    <tr>
      <td><strong>${row.symbol}</strong></td>
      <td>${row.name || "-"}</td>
      <td>${badge(row.final_action)}</td>
      <td>${formatScore(row.score)}</td>
      <td>${formatNum(row.last_close, 4)}</td>
      <td>${formatPct(row.ret_21d)}</td>
      <td>${formatPct(row.ret_63d)}</td>
      <td>${formatPct(row.vol_21d)}</td>
      <td>${formatPct(row.max_drawdown_63d)}</td>
      <td>${formatNum(row.rsi_14, 1)}</td>
      <td>${stageLabel(row.stop_stage)}</td>
    </tr>
  `).join("");
}

function stageLabel(id) {
  if (!id) return "통과";
  const stage = state.latest.pipeline_rules.find((item) => item.id === id);
  return stage ? stage.label : id;
}

function setupPriceSelect() {
  const select = document.querySelector("#symbolSelect");
  const symbols = Object.keys(state.prices.symbols || {});
  select.innerHTML = symbols.map((symbol) => {
    const name = state.prices.symbols[symbol].name || "";
    return `<option value="${symbol}">${symbol} ${name}</option>`;
  }).join("");
  renderPriceChart();
}

function renderHistoryChart() {
  const canvas = document.querySelector("#historyChart");
  const snapshots = state.history.snapshots || [];
  document.querySelector("#historyMeta").textContent = `${snapshots.length}개 기준일`;
  drawComboChart(canvas, snapshots);
}

function renderPriceChart() {
  if (!state.prices) return;
  const select = document.querySelector("#symbolSelect");
  const symbol = select.value || Object.keys(state.prices.symbols || {})[0];
  const prices = state.prices.symbols?.[symbol]?.prices || [];
  drawLineChart(document.querySelector("#priceChart"), prices, "close", "#008c8c");
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

function drawComboChart(canvas, points) {
  const { context, width, height } = setupCanvas(canvas);
  context.clearRect(0, 0, width, height);
  if (!points.length) {
    drawEmpty(context, width, height, "1년 점수 이력이 없습니다.");
    return;
  }

  const padding = 34;
  const maxCandidates = Math.max(...points.map((point) => point.candidate_count || 0), 1);
  context.strokeStyle = "#dfe5ea";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(padding, height - padding);
  context.lineTo(width - padding, height - padding);
  context.stroke();

  const barWidth = Math.max(2, (width - padding * 2) / points.length - 1);
  points.forEach((point, index) => {
    const x = padding + index * ((width - padding * 2) / points.length);
    const barHeight = ((point.candidate_count || 0) / maxCandidates) * (height - padding * 2);
    context.fillStyle = "rgba(0, 140, 140, 0.26)";
    context.fillRect(x, height - padding - barHeight, barWidth, barHeight);
  });

  context.strokeStyle = "#d89216";
  context.lineWidth = 2;
  context.beginPath();
  points.forEach((point, index) => {
    const x = padding + index * ((width - padding * 2) / Math.max(points.length - 1, 1));
    const y = height - padding - ((point.top_score || 0) / 100) * (height - padding * 2);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  drawChartLabel(context, padding, 20, "막대: 후보 수 / 선: 최고 점수");
}

function drawLineChart(canvas, points, key, color) {
  const { context, width, height } = setupCanvas(canvas);
  context.clearRect(0, 0, width, height);
  if (!points.length) {
    drawEmpty(context, width, height, "가격 자료가 없습니다.");
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
  context.fillText(message, width / 2, height / 2);
}

function drawChartLabel(context, x, y, label) {
  context.fillStyle = "#5b6776";
  context.font = "12px Segoe UI, sans-serif";
  context.fillText(label, x, y);
}

window.addEventListener("resize", () => {
  if (!state.latest) return;
  renderHistoryChart();
  renderPriceChart();
});

init();
