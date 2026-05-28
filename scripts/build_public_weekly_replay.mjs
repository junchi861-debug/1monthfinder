import fs from "node:fs";

const RAW_PATH = "site/data/ks200_public_5m_raw.json";
const OUT_PATH = "site/data/public_weekly_replay.json";
const TIME_ZONE = "Asia/Seoul";
const BASE_SOURCE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/%5EKS200";

function publicSourceUrl() {
  const now = new Date();
  const end = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000);
  const start = end - 9 * 24 * 60 * 60;
  return `${BASE_SOURCE_URL}?period1=${start}&period2=${end}&interval=5m&includePrePost=false`;
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

async function readRawChart() {
  if (fs.existsSync(RAW_PATH)) return readJson(RAW_PATH);
  const url = publicSourceUrl();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Yahoo chart fetch failed: ${response.status}`);
  return response.json();
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function number(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function kstParts(timestamp) {
  const date = new Date(timestamp * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    time: `${byType.hour}:${byType.minute}`,
    weekday: byType.weekday.toUpperCase(),
  };
}

function geometricAverage(values, length) {
  if (values.length < length) return null;
  const slice = values.slice(-length).filter((value) => Number.isFinite(value) && value > 0);
  if (slice.length !== length) return null;
  const logSum = slice.reduce((sum, value) => sum + Math.log(value), 0);
  return Math.exp(logSum / length);
}

function rangeAverage(records, length, key) {
  if (records.length < length) return null;
  const slice = records.slice(-length);
  const highs = slice.map((item) => item.high).filter(Number.isFinite);
  const lows = slice.map((item) => item.low).filter(Number.isFinite);
  if (highs.length !== length || lows.length !== length) return null;
  return (Math.max(...highs) + Math.min(...lows)) / 2;
}

function buildRecords(raw) {
  const result = raw.chart?.result?.[0];
  if (!result) throw new Error("Yahoo chart result is empty.");
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const closes = [];
  const records = [];

  timestamps.forEach((timestamp, index) => {
    const close = number(quote.close?.[index]);
    const open = number(quote.open?.[index]);
    const high = number(quote.high?.[index]);
    const low = number(quote.low?.[index]);
    if (![open, high, low, close].every(Number.isFinite)) return;
    const parts = kstParts(timestamp);
    closes.push(close);
    const withCurrent = [...records, { high, low }];
    records.push({
      timestamp,
      date: parts.date,
      time: parts.time,
      weekday: parts.weekday,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: number(quote.volume?.[index]) || 0,
      gma30: round(geometricAverage(closes, 30)),
      gma50: round(geometricAverage(closes, 50)),
      tenkan: round(rangeAverage(withCurrent, 9)),
      kijun: round(rangeAverage(withCurrent, 26)),
    });
  });

  return records;
}

function groupByDate(records) {
  return records.reduce((groups, record) => {
    if (!groups.has(record.date)) groups.set(record.date, []);
    groups.get(record.date).push(record);
    return groups;
  }, new Map());
}

function weekdayLabel(weekday) {
  return {
    MON: "월",
    TUE: "화",
    WED: "수",
    THU: "목",
    FRI: "금",
  }[weekday] || weekday;
}

function profileFor(weekday) {
  if (weekday === "MON") {
    return {
      key: "weekly_start",
      label: "월요일 위클리",
      note: "월요일은 위클리 전략 사용일이다. 만기까지 남은 프리미엄이 있어 D-2/D-1 보정 확인이 필요하다.",
    };
  }
  if (weekday === "THU") {
    return {
      key: "expiry",
      label: "목요일 만기",
      note: "목요일은 만기일로 보고 시간대별 프리미엄 급감과 줄먹 규칙을 강하게 적용한다.",
    };
  }
  if (weekday === "FRI") {
    return {
      key: "next_cycle_watch",
      label: "금요일 관찰",
      note: "금요일은 다음 위클리 사이클 기준이 아직 미확정이라 지수 자리만 복기한다.",
    };
  }
  return {
    key: "d_minus_adjusted",
    label: "화·수 보정",
    note: "큰 지수 자리는 같게 보되 프리미엄과 행사가 거리는 D-1/D-2 보정값으로 다르게 잡는다.",
  };
}

function compactSeries(records) {
  const step = Math.max(1, Math.floor(records.length / 18));
  const selected = records.filter((_, index) => index % step === 0);
  const last = records.at(-1);
  if (last && selected.at(-1)?.timestamp !== last.timestamp) selected.push(last);
  return selected.map((record) => ({
    time: record.time,
    index: record.close,
    gma30: record.gma30,
    gma50: record.gma50,
    tenkan: record.tenkan,
    kijun: record.kijun,
    volume: record.volume,
  }));
}

function nearestSeriesIndex(series, time) {
  const index = series.findIndex((point) => point.time >= time);
  return index >= 0 ? index : Math.max(0, series.length - 1);
}

function firstAfter(records, fromIndex, predicate) {
  for (let index = fromIndex + 1; index < records.length; index += 1) {
    if (predicate(records[index], index)) return { record: records[index], index };
  }
  return null;
}

function buildSignals(records, series, levels) {
  const highIndex = records.reduce(
    (best, record, index) => (record.high > records[best].high ? index : best),
    0,
  );
  const lowIndex = records.reduce(
    (best, record, index) => (record.low < records[best].low ? index : best),
    0,
  );
  const high = records[highIndex];
  const low = records[lowIndex];
  const pressure = firstAfter(records, highIndex, (record) => {
    const belowGma = Number.isFinite(record.gma30) ? record.close < record.gma30 : false;
    const belowTenkan = Number.isFinite(record.tenkan) ? record.close < record.tenkan : false;
    return belowGma && belowTenkan;
  });
  const rebound618 = firstAfter(records, lowIndex, (record) => record.high >= levels.fib_618);
  const rebound50 = firstAfter(records, lowIndex, (record) => record.high >= levels.fib_50);
  const end = records.at(-1);
  const lowWick = low.close - low.low;
  const strongWick = lowWick >= 3;
  const highAfterLow = Math.max(...records.slice(lowIndex).map((record) => record.high));
  const bouncePct = ((highAfterLow - low.low) / Math.max(levels.day_high - low.low, 1)) * 100;

  const signals = [
    {
      time: records[0].time,
      point_index: 0,
      type: "watch",
      label: "장 시작 관찰",
      action: "WAIT",
      index_value: records[0].close,
      message: "공개 KOSPI200 5분봉으로 당일 고저와 이평을 계산한다. 옵션 프리미엄은 아직 추정하지 않는다.",
      alert: "지수 자리 계산 시작",
    },
    {
      time: high.time,
      point_index: nearestSeriesIndex(series, high.time),
      type: "watch",
      label: "당일 고점 기준",
      action: "ANCHOR_HIGH",
      index_value: high.high,
      message: `당일 고점 ${round(high.high)} 기준으로 61.8%, 50%, 38.2% 목표선을 계산한다.`,
      alert: "전구간 피보나치 준비",
    },
  ];

  if (pressure) {
    signals.push({
      time: pressure.record.time,
      point_index: nearestSeriesIndex(series, pressure.record.time),
      type: "warning",
      label: "하락 압력",
      action: "NO_FULL_SIZE",
      index_value: pressure.record.close,
      message: "가격이 30이평과 전환선 아래로 밀려 풀 3계약 진입을 금지하고 최소 물량만 허용한다.",
      alert: "쌍바닥/밑꼬리만 감시",
    });
  }

  signals.push({
    time: low.time,
    point_index: nearestSeriesIndex(series, low.time),
    type: strongWick ? "buy" : "warning",
    label: strongWick ? "밑꼬리 트라이" : "저점 접근",
    action: strongWick ? "CALL_RETRY" : "MIN_TRY_ONLY",
    index_value: low.low,
    message: strongWick
      ? `저점에서 ${round(lowWick, 1)}p 밑꼬리 회복이 나와 즉시 콜 재진입/자리이동 후보로 본다.`
      : "저점권이지만 3~5p 밑꼬리 확인이 약해 최소 물량 또는 관찰만 허용한다.",
    alert: strongWick ? "2~3계약 재시작 후보" : "1계약 이하 보수 후보",
  });

  if (rebound618) {
    signals.push({
      time: rebound618.record.time,
      point_index: nearestSeriesIndex(series, rebound618.record.time),
      type: "sell",
      label: "61.8% 도달",
      action: "TAKE_PARTIAL",
      index_value: levels.fib_618,
      message: "바닥 바운딩 뒤 61.8% 라인에 닿으면 안전마진 물량 청산 후보로 본다.",
      alert: "부분청산 후보",
    });
  }

  if (rebound50) {
    signals.push({
      time: rebound50.record.time,
      point_index: nearestSeriesIndex(series, rebound50.record.time),
      type: "runner",
      label: "50% 도전",
      action: "RUNNER_OR_EXIT",
      index_value: levels.fib_50,
      message: "61.8% 이후 전환선 위 흐름이 유지되면 50% 라인 또는 50이평 근처까지 잔량을 끌고 갈 수 있다.",
      alert: "잔량 청산/러너 판단",
    });
  }

  if (end.time >= "14:50") {
    signals.push({
      time: end.time,
      point_index: series.length - 1,
      type: "stop",
      label: "복권 제한",
      action: "LOTTERY_LIMIT",
      index_value: end.close,
      message: "만기 20분 전 이후 복권 플레이는 수수료 차감 후 순수익 10% 이하만 허용한다.",
      alert: "수익이 충분하지 않으면 종료",
    });
  }

  return {
    signals: signals.sort((a, b) => a.time.localeCompare(b.time)),
    summaryStats: {
      high_time: high.time,
      low_time: low.time,
      low_wick_points: round(lowWick, 1),
      bounce_pct: round(bouncePct, 1),
      reached_618: Boolean(rebound618),
      reached_50: Boolean(rebound50),
    },
  };
}

function buildTradePlan(day, levels, signalResult) {
  const stats = signalResult.summaryStats;
  if (stats.reached_50) {
    return {
      result: "runner_exit_ready",
      label: "저점 콜 트라이 후 잔량 청산 후보",
      text: `저점 ${stats.low_time} 이후 61.8%와 50% 목표를 모두 확인했다. 안전마진 청산 뒤 잔량은 50%/50이평 터치 올청 후보로 표시한다.`,
    };
  }
  if (stats.reached_618) {
    return {
      result: "partial_exit_only",
      label: "부분청산 후 잔량 관찰",
      text: `저점 ${stats.low_time} 이후 61.8% 목표는 도달했지만 50%까지는 부족했다. 안전마진 물량 청산 후 잔량은 전환선/30이평 이탈을 본다.`,
    };
  }
  if (stats.low_wick_points >= 3) {
    return {
      result: "entry_without_target",
      label: "밑꼬리 진입 후보, 목표 미달",
      text: `저점에서 ${stats.low_wick_points}p 밑꼬리는 확인됐지만 공개 지수 기준 목표 도달은 부족했다. 실제 옵션 프리미엄 확인 전에는 보수 처리한다.`,
    };
  }
  return {
    result: "watch_only",
    label: "관찰 우선",
    text: `${day} 공개 지수 흐름만으로는 기계적 콜 진입 신뢰도가 낮다. 최소 물량 또는 관찰 신호만 낸다.`,
  };
}

function buildDaySession(date, records) {
  const first = records[0];
  const last = records.at(-1);
  const high = Math.max(...records.map((record) => record.high));
  const low = Math.min(...records.map((record) => record.low));
  const range = high - low;
  const levels = {
    day_high: round(high),
    day_low: round(low),
    fib_382: round(high - range * 0.382),
    fib_50: round((high + low) / 2),
    fib_618: round(high - range * 0.618),
    fib_100: round(low),
    reset_mid_618_100: round((high - range * 0.618 + low) / 2),
  };
  const series = compactSeries(records);
  const signalResult = buildSignals(records, series, levels);
  const profile = profileFor(first.weekday);
  const change = last.close - first.open;
  const changePct = (change / first.open) * 100;
  const labelDate = date.slice(5).replace("-", "/");
  const tradePlan = buildTradePlan(date, levels, signalResult);

  return {
    id: date,
    label: `${labelDate} ${weekdayLabel(first.weekday)}`,
    date,
    weekday: first.weekday,
    weekday_label: weekdayLabel(first.weekday),
    status: "public_reviewed",
    action: "PUBLIC_REPLAY_READY",
    summary: `${profile.label} · ${tradePlan.label}`,
    profile,
    signal_count: signalResult.signals.length,
    source: "Yahoo Finance ^KS200 5m",
    day_open: round(first.open),
    day_close: round(last.close),
    day_change: round(change),
    day_change_pct: round(changePct, 2),
    levels,
    series,
    signals: signalResult.signals,
    trade_plan: tradePlan,
    stats: signalResult.summaryStats,
  };
}

const raw = await readRawChart();
const records = buildRecords(raw);
const sessions = Array.from(groupByDate(records).entries())
  .filter(([, dayRecords]) => dayRecords.length >= 20)
  .map(([date, dayRecords]) => buildDaySession(date, dayRecords));

const output = {
  status: "public_data",
  label: "최근 1주 공개 차트 복기",
  date_range: `${sessions[0]?.date || ""}~${sessions.at(-1)?.date || ""}`,
  data_basis: "public_kospi200_5m_index_only",
  active_session_id: sessions.at(-1)?.id || "",
  notice:
    "REST API 연결 전 임시 화면이다. Yahoo Finance의 공개 KOSPI200 5분봉으로 지수 자리와 신호를 복기하며, 옵션 프리미엄/체결가/계좌 손익은 표시하지 않는다.",
  source: {
    provider: "Yahoo Finance chart API",
    symbol: "^KS200",
    interval: "5m",
    timezone: TIME_ZONE,
    url: publicSourceUrl(),
  },
  sessions,
};

fs.writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`wrote ${OUT_PATH} (${sessions.length} sessions)`);
