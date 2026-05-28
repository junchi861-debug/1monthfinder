const state = {
  report: null,
  chartConfig: null,
  indexStrategy: null,
  weeklyOptions: null,
  period: "1d",
  algorithm: null,
  selectedSymbol: null,
  holdings: [],
  mode: initialMode(),
};

const STORAGE_KEY = "1monthfinder.holdings";

const defaultChartConfig = {
  palette: {
    equity: "#008c8c",
    grid: "#dfe5ea",
    text: "#637083",
    candidate: "#2d8f64",
    warning: "#d89216",
    sell: "#b6504a",
  },
  charts: {
    stock_price: {
      height: 260,
      padding: 22,
      empty_message: "차트 자료가 없습니다.",
      lines: [
        { key: "close", label: "가격", formula: "close", color: "#17202a", width: 2.6 },
        { key: "ma5", label: "단기선", formula: "sma(close, 5)", color: "#008c8c", width: 1.8 },
        { key: "ma20", label: "기준선", formula: "sma(close, 20)", color: "#d89216", width: 1.8 },
        { key: "risk_floor", label: "경고선", formula: "last_close * 0.94", color: "#b6504a", width: 1.4, dash: [5, 5] },
      ],
      signal_rules: [
        {
          condition: "close > ma5 && ma5 > ma20 && score >= 58",
          signal: "buy",
          label: "매수 후보",
          text: "가격이 단기선 위에 있고 단기선이 기준선보다 높습니다. 알고리즘 점수도 후보 기준을 넘어 매수 후보로 볼 수 있습니다.",
        },
        {
          condition: "close < risk_floor || risk_score < 0.25",
          signal: "sell",
          label: "매도/제외",
          text: "가격이 경고선 아래로 내려왔거나 리스크 점수가 낮습니다. 신규 매수보다 제외 또는 축소 관점이 우선입니다.",
        },
        {
          condition: "close < ma5 || issue_score >= 0.45",
          signal: "warning",
          label: "경고/관찰",
          text: "단기선 이탈 또는 이슈성 급등 신호가 있어 추격 매수보다 확인이 필요합니다.",
        },
      ],
    },
  },
  display: {
    top_candidate_cards: 8,
  },
};

const defaultIndexStrategy = {
  title: "지수 매매 전략",
  status: "draft",
  asset_scope: "KOSPI200 지수/선물",
  purpose: "KOSPI200 지수 방향과 진입·청산 신호를 계산합니다.",
  timeframes: {
    context: "30분봉",
    execution: "5분봉",
    fibonacci_lookback: "최근 3거래일 고점/저점",
  },
  formulas: [
    {
      key: "gma_30",
      label: "30봉 기하이평",
      formula: "exp(avg(log(close), 30))",
      role: "상위 방향과 잔량 운용 기준",
    },
    {
      key: "gma_50",
      label: "50봉 기하이평",
      formula: "exp(avg(log(close), 50))",
      role: "30봉 기하이평과 함께 진입 위치 판단",
    },
    {
      key: "tenkan_5m",
      label: "5분봉 전환선",
      formula: "(highest(high, 9) + lowest(low, 9)) / 2",
      role: "진입 확인과 이탈 경고",
    },
    {
      key: "kijun_5m",
      label: "5분봉 기준선",
      formula: "(highest(high, 26) + lowest(low, 26)) / 2",
      role: "70% 청산 기준",
    },
    {
      key: "reset_fib_618",
      label: "리셋 61.8%",
      formula: "previous_low",
      role: "핵심 자리 이탈 후 직전 저가를 새 61.8% 라인으로 맞춘다.",
    },
    {
      key: "reset_fib_100",
      label: "리셋 100%",
      formula: "reset_high - ((reset_high - previous_low) / 0.618)",
      role: "직전 저가가 61.8%가 되도록 새 100% 자리를 다시 계산한다.",
    },
    {
      key: "reset_mid_618_100",
      label: "리셋 중심라인",
      formula: "(reset_fib_618 + reset_fib_100) / 2",
      role: "리셋된 61.8%와 100% 라인의 중심값으로, 프리미엄 1.5~1.8 콜을 2~3계약 재시작 후보로 본다.",
    },
    {
      key: "lower_wick_5m",
      label: "5분봉 밑꼬리",
      formula: "min(open_5m, close_5m) - low_5m",
      role: "원하는 자리 근처에서 아래로 찔렀다가 말아올린 흔적을 계산한다.",
    },
    {
      key: "lower_wick_ratio_5m",
      label: "밑꼬리 비율",
      formula: "lower_wick_5m / max(high_5m - low_5m, tick_size)",
      role: "밑꼬리가 전체 5분봉 범위에서 차지하는 비율로, 진입 확인 강도를 판단한다.",
    },
  ],
  fibonacci: {
    levels: [
      { key: "fib_618", label: "61.8%", formula: "high_3d - (high_3d - low_3d) * 0.618", role: "상방 진입 1차 관찰" },
      { key: "fib_809", label: "80.9%", formula: "high_3d - (high_3d - low_3d) * 0.809", role: "61.8%와 100% 바닥의 절반값" },
      { key: "fib_100", label: "100%", formula: "low_3d", role: "휩소 감시선" },
      { key: "fib_103", label: "103%", formula: "high_3d - (high_3d - low_3d) * 1.03", role: "밑꼬리 후 추가 진입 후보" },
      { key: "fib_105", label: "105%", formula: "high_3d - (high_3d - low_3d) * 1.05", role: "확정 이탈 시 손절 후보" },
    ],
    reset_on_break: {
      status: "draft",
      trigger: "critical_spot_breakdown",
      reset_high_source: "current_swing_high_after_break",
      previous_low_as: "reset_fib_618",
      reset_100_formula: "reset_high - ((reset_high - previous_low) / 0.618)",
      reset_mid_formula: "(reset_fib_618 + reset_fib_100) / 2",
      description: "핵심 자리가 무너지면 고가와 저가를 다시 셋업하고, 직전 저가를 새 61.8% 라인으로 맞춘 뒤 100% 자리를 다시 계산합니다.",
      example: {
        reset_high: 1309.36,
        previous_low_reset_618: 1276.8,
        reset_100: 1256.63,
        reset_mid_618_100: 1266.72,
      },
      call_retry_prepare: {
        status: "draft",
        line: "reset_mid_618_100",
        direction: "call",
        target_premium_range: [1.5, 1.8],
        contracts_range: [2, 3],
        restart_mode: "fresh_initial_entry",
        description: "리셋된 61.8%~100% 사이의 중심라인을 다시 설정하고, 그 자리에서 프리미엄 1.5~1.8 콜옵션을 2~3계약으로 새 초기 진입처럼 재시작하는 후보로 봅니다.",
        wick_confirmation: {
          status: "draft",
          label: "원하는 자리 밑꼬리",
          target_line: "reset_mid_618_100",
          near_tolerance: "TODO",
          lower_wick_ratio_threshold: "TODO",
          confirmation: "low_5m pierces_or_touches target_line AND close_5m reclaims target_line",
          effect: "entry_confidence_up",
          description: "거의 원하는 자리에서 밑꼬리가 나오면 리셋 중심 콜 재시작 후보의 신뢰도를 높입니다.",
        },
      },
    },
  },
  position_sizing: {
    first_entry_pct: 70,
    add_entry_pct: 30,
    first_exit_pct: 70,
    runner_pct: 30,
  },
  states: [
    { key: "WAIT", label: "대기", description: "조건이 아직 맞지 않는다." },
    { key: "WATCH_ENTRY", label: "진입 대기", description: "기하이평과 피보나치 진입 구간 접근을 본다." },
    { key: "DOWNSIDE_PRESSURE", label: "하락 압력", description: "5분봉이 30이평, 전환선, 기준선 아래이면 보수 관찰로 전환한다." },
    { key: "DOUBLE_BOTTOM_MIN_TRY", label: "쌍바닥 최소 트라이", description: "하락 압력 중 쌍바닥 후보에서는 최소 물량만 시도한다." },
    { key: "PRE_100_FRONT_RUN", label: "100% 앞선 트라이", description: "우측 바닥이 100%보다 높은 자리에서 돌 수 있으므로 앞선 자리도 최소 물량 후보로 본다." },
    { key: "CRITICAL_BREAK_WAIT", label: "핵심 이탈 대기", description: "쌍바닥, 100% 앞선 자리 등 방어해야 할 핵심 자리가 무너지면 재진입보다 대기한다." },
    { key: "FIBONACCI_RESET", label: "피보나치 리셋", description: "핵심 자리가 무너지면 고가와 저가를 다시 셋업하고, 직전 저가를 새 61.8% 라인으로 맞춘 뒤 100% 자리를 다시 계산한다." },
    { key: "RESET_MID_CALL_PREPARE", label: "리셋 중심 콜 재시작", description: "리셋된 61.8%~100% 사이의 중심라인에서 프리미엄 1.5~1.8 콜옵션을 2~3계약으로 새 초기 진입처럼 검토한다." },
    { key: "RESET_MID_WICK_CONFIRM", label: "중심 밑꼬리 확인", description: "거의 원하는 리셋 중심라인에서 밑꼬리가 나오면 콜 재시작 후보의 확인 강도가 높아진다." },
    { key: "ENTRY_70", label: "70% 1차 진입", description: "전환선 회복 확인 후 70%만 먼저 진입한다." },
    { key: "WICK_WATCH", label: "밑꼬리 감시", description: "100~103% 휩소 여부를 감시한다." },
    { key: "ADD_30", label: "30% 추가 진입", description: "말아올림 확인 후 잔여 30%를 추가한다." },
    { key: "SELL_70", label: "70% 청산", description: "기준선 위에 올라타면 70%를 청산한다." },
    { key: "HOLD_RUNNER", label: "잔량 운용", description: "30기하이평 돌파 후 잔량을 운용한다." },
    { key: "SELL_REST", label: "잔량 청산", description: "30기하이평과 일목선 이탈 시 잔량을 청산한다." },
    { key: "STOP_LOSS", label: "손절", description: "105% 라인 확정 이탈 시 손절한다." },
  ],
  signals: [
    {
      key: "downside_pressure_filter",
      label: "하락 압력 보수 필터",
      conditions: ["close_5m < gma_30_5m", "close_5m < tenkan_5m", "close_5m < kijun_5m"],
      message: "5분봉이 30이평, 전환선, 기준선 아래에 있으면 아직 더 눌리는 상황으로 보고 일반 진입을 보류합니다.",
    },
    {
      key: "double_bottom_min_try",
      label: "쌍바닥 최소 물량 트라이",
      conditions: ["downside_pressure_filter == true", "low_5m tests previous_intraday_low", "close_5m >= previous_intraday_low", "position_size == minimum"],
      message: "하락 압력 중 이전 저점을 지키는 쌍바닥 후보에서는 최소 물량만 시도하고, 저점을 깨면 즉시 방어합니다.",
    },
    {
      key: "pre_100_front_run_try",
      label: "100% 앞선 반전 트라이",
      conditions: ["downside_pressure_filter == true", "price approaches fib_100 but low_5m > fib_100", "right_bottom_candidate > previous_intraday_low", "position_size == minimum"],
      message: "우측 바닥이 100% 자리까지 정확히 내려오지 않고 조금 위에서 돌 수 있으므로, 100%보다 앞선 자리도 최소 물량 트라이로 허용합니다.",
    },
    {
      key: "critical_break_wait",
      label: "핵심 자리 이탈 대기",
      conditions: ["critical_spot_breakdown == true", "switch_attempts >= 2", "current_loss == small_loss"],
      message: "핵심 자리가 무너지고 자리이동을 두 번 시도한 뒤 약손실이면 추가 트라이를 중단하고 대기합니다.",
    },
    {
      key: "fibonacci_reset",
      label: "피보나치 리셋",
      conditions: ["critical_spot_breakdown == true", "new_swing_high is confirmed", "previous_low becomes reset_fib_618"],
      message: "핵심 자리가 무너지면 고가와 저가를 다시 잡고, 직전 저가를 61.8% 라인으로 맞춘 뒤 새 100% 자리를 계산합니다.",
    },
    {
      key: "reset_mid_call_prepare",
      label: "리셋 중심 콜 재시작",
      conditions: ["fibonacci_reset == true", "price approaches reset_mid_618_100", "call_option_premium between 1.5 and 1.8", "call_retry_contracts between 2 and 3", "restart_mode == fresh_initial_entry"],
      message: "리셋 중심라인에 접근하면 프리미엄 1.5~1.8 콜옵션을 찾아 2~3계약으로 새 초기 진입처럼 재시작하는 후보로 봅니다.",
    },
    {
      key: "reset_mid_wick_confirm",
      label: "원하는 자리 밑꼬리",
      conditions: ["price near reset_mid_618_100", "low_5m pierces_or_touches reset_mid_618_100", "close_5m reclaims reset_mid_618_100", "lower_wick_ratio_5m >= configured_threshold"],
      message: "원하는 자리 근처에서 밑꼬리가 나오면 콜 재시작 후보의 신뢰도를 높이고, 2~3계약 진입 준비를 강화합니다.",
    },
  ],
  questions: [
    "105% 손절 확정은 터치 기준인지, 5분봉 종가 이탈 기준인지 확인이 필요하다.",
    "103% 밑꼬리 확인 조건을 명확히 해야 한다.",
    "지수 신호를 위클리 옵션 행사가 선택으로 연결하는 별도 기준이 필요하다.",
    "쌍바닥 판정과 이탈 기준을 저점 터치, 종가, 유지 봉 수 중 무엇으로 볼지 확인이 필요하다.",
    "하락 압력 구간의 최소 물량이 옵션 1계약인지 예정 자금 비율인지 확인이 필요하다.",
    "100% 앞선 트라이의 허용 범위가 몇 포인트 또는 몇 퍼센트인지 확인이 필요하다.",
    "핵심 자리 이탈 기준과 약손실 기준, 자리이동 2회 카운트 기준 확인이 필요하다.",
    "피보나치 리셋에 사용할 새 고가 기준과 콜/풋 양방향 적용 방식을 확인해야 한다.",
    "리셋 중심라인에서 2계약과 3계약을 나누는 기준, 지정가 가격, 5분봉 전환선 회복 확인 여부가 필요하다.",
    "원하는 자리 밑꼬리 확인은 저가 터치만 볼지, 5분봉 종가가 중심라인 위로 회복해야 하는지 확인이 필요하다.",
    "밑꼬리 비율 임계값과 원하는 자리 근처 허용 오차를 포인트 또는 퍼센트로 정해야 한다.",
  ],
};

const defaultWeeklyOptions = {
  title: "위클리 옵션 전략",
  status: "draft",
  asset_scope: "KOSPI200 위클리 옵션",
  depends_on: "index_trading",
  purpose: "지수 매매 신호를 옵션 상품 선택과 주문 계획으로 변환합니다.",
  risk_limits: {
    daily_max_loss_krw: 3000000,
    per_stop_loss_krw_range: [300000, 500000],
    per_stop_loss_description: "1회 손절당 30~50만원 손실이 날 수 있으나, 손절 및 자리이동으로 반등 시 수익 회수를 빠르게 노립니다.",
    on_breach: "STOP_TRADING_FOR_DAY",
    description: "당일 최대 손실 300만원에 걸리면 그날은 신규 진입을 중단합니다.",
    loss_basis: "TODO",
  },
  money_management: {
    status: "draft",
    daily_profit_lock: {
      base_contracts: 3,
      profit_krw_range: [500000, 1000000],
      mode: "CONSERVATIVE_AFTER_PROFIT",
      description: "3계약 운용으로 당일 50~100만원 수익을 내면 이후는 보수 모드로 전환합니다.",
    },
    after_lock: {
      entry_filter: "only_critical_spot",
      max_contracts: 1,
      avoid_full_size_contracts: 3,
      use_profit_as_safety_margin: true,
      description: "수익 잠금 이후에는 아주 급소자리 외에는 진입하지 않고, 하더라도 당일 수익금을 담보로 1계약만 안전하게 운용합니다.",
    },
    downside_pressure_filter: {
      status: "draft",
      timeframe: "5m",
      conditions: ["close_5m < gma_30_5m", "close_5m < tenkan_5m", "close_5m < kijun_5m"],
      interpretation: "5분봉이 30이평, 전환선, 기준선 아래이면 아직 눌림이 진행 중인 것으로 봅니다.",
      allowed_action: "double_bottom_minimum_try_only",
      max_contracts: 1,
      break_risk: "쌍바닥을 깨면 오늘 고점에서 바닥까지의 하락 길이가 50% 이상 더 길어질 수 있다고 보고 방어합니다.",
      description: "하락 압력 중에는 더블바텀 후보라도 아주 보수적으로 최소 물량만 사용합니다.",
    },
    rationale: "당일 수익금을 안전마진으로 삼고 수익극대화 물량인 1계약만으로 추가 기회를 봅니다.",
  },
  entry: {
    initial_contracts: 3,
    entry_source: "index_trading.new_entry_zone",
    strike_selection: {
      call_strike_offset_pct: 2.5,
      example_index: 1280,
      example_call_strike_zone: "1312~1320",
      target_premium: 1.6,
      target_premium_range: [1.5, 1.7],
      description: "현재 중심가격에서 약 2.5% 위 행사가 중 프리미엄 1.6 근처 콜옵션을 찾습니다.",
    },
    double_bottom_entry_timing: {
      status: "draft",
      anchor: "fib_100",
      allow_front_run_before_exact_100: true,
      position_size: "minimum",
      description: "쌍바닥은 100%를 정석적으로 찍을 수도 있지만 우측 바닥이 더 높은 자리에서 돌 수 있어 조금 앞선 자리도 최소 물량 트라이로 봅니다.",
    },
    expiry_day_time_adjustments: {
      status: "draft",
      morning: {
        until: "12:00",
        strike_offset_pct: 2.5,
        target_premium_range: [1.5, 1.7],
        description: "만기일 장초에는 2.5% 위치, 프리미엄 1.5~1.7 구간을 트라이합니다.",
      },
      after_noon: {
        from: "12:00",
        strike_offset_pct: 1.5,
        target_premium_range: [0.6, 1.0],
        stop_loss_pct: 40,
        position_switch_required: true,
        description: "만기일 12시 이후에는 1.5% 위치, 프리미엄 0.6~1.0 옵션으로 낮추고 손절 40% 기준으로 자리이동합니다.",
      },
    },
    order_ladder: [
      { contracts: 1, limit_price: 1.7, label: "1차 매수" },
      { contracts: 1, limit_price: 1.6, label: "2차 매수" },
      { contracts: 1, limit_price: 1.45, label: "3차 매수" },
    ],
    expected_average_if_all_filled: 1.58,
  },
  visual_chart: {
    title: "옵션 프리미엄 전략선",
    height: 300,
    base_price_source: "expected_average_if_all_filled",
    description: "평균 진입가를 기준으로 손실 방어선, 자리이동 준비선, 빠른 청산선, 목표 청산선을 미리 그립니다.",
    lines: [
      { key: "stop_30", label: "-30% 손실선", formula: "avg_entry * 0.70", color: "#b6504a", role: "손절 또는 자리이동 판단" },
      { key: "switch_prepare_25", label: "-25% 자리이동", formula: "avg_entry * 0.75", color: "#d89216", role: "기존 옵션 자리이동 준비" },
      { key: "entry_average", label: "평균 진입", formula: "avg_entry", color: "#17202a", role: "3분할 체결 평균 기준" },
      { key: "quick_take_20", label: "+20% 빠른 청산", formula: "avg_entry * 1.20", color: "#2d8f64", role: "급반등 시 최소 1계약 청산" },
      { key: "safe_margin_30", label: "+30% 안전마진", formula: "avg_entry * 1.30", color: "#008c8c", role: "2계약 청산 후 잔량 운용" },
      { key: "target_35", label: "+35% 1차 청산", formula: "avg_entry * 1.35", color: "#2d8f64", role: "첫 목표 청산선" },
      { key: "target_45", label: "+45% 2차 청산", formula: "avg_entry * 1.45", color: "#006f73", role: "두 번째 목표 청산선" },
    ],
    sample_path_multipliers: [1.08, 1, 0.92, 0.78, 0.75, 0.86, 1.03, 1.2, 1.32, 1.45, 1.38],
  },
  index_reset_reference: {
    source: "index_trading.fibonacci.reset_on_break",
    label: "지수 피보나치 리셋",
    value: "중심라인 콜 2~3계약 재시작",
    description: "지수의 핵심 자리가 무너지면 고가와 저가를 다시 셋업하고, 61.8%~100% 사이 중심라인에서 프리미엄 1.5~1.8 콜옵션을 2~3계약으로 새 초기 진입처럼 재시작하는 후보로 봅니다.",
    call_retry_prepare: {
      line: "reset_mid_618_100",
      direction: "call",
      target_premium_range: [1.5, 1.8],
      contracts_range: [2, 3],
      restart_mode: "fresh_initial_entry",
      description: "리셋 중심라인 접근 시 프리미엄 1.5~1.8 콜옵션을 찾고, 2~3계약으로 다시 초기 진입하듯 접근합니다.",
      wick_confirmation: {
        source: "index_trading.signals.reset_mid_wick_confirm",
        label: "원하는 자리 밑꼬리",
        effect: "entry_confidence_up",
        description: "거의 원하는 자리에서 밑꼬리가 나오면 리셋 중심라인 콜 재시작 후보의 신뢰도를 높이고 2~3계약 준비를 강화합니다.",
      },
    },
  },
  position_roles: {
    status: "draft",
    description: "초기 2계약, 즉 약 70% 물량은 안전마진을 만들고, 남은 1계약은 수익극대화를 위한 잔량입니다.",
    safety_margin: {
      contracts: 2,
      position_pct: 70,
      role: "최소 안전마진 확보",
      description: "초기 두 개의 물량은 급반등 시 빠르게 일부 수익을 실현해 남은 잔량을 편하게 끌고 가기 위한 안전마진 물량입니다.",
    },
    profit_runner: {
      contracts: 1,
      position_pct: 30,
      role: "수익극대화",
      description: "남은 잔량은 손익 부담을 줄인 뒤 추세가 이어질 때 수익을 극대화하기 위한 물량입니다.",
    },
  },
  exit: {
    loss_control: {
      hold_until_loss_pct: 30,
      stop_price_formula: "average_entry_price * 0.70",
      example_entry_price: 2.1,
      example_stop_price: 1.47,
      description: "진입 이후 더 밀려도 30% 손실구간까지 밀리지 않으면 홀딩합니다.",
    },
    quick_rebound: {
      status: "draft",
      purpose: "반등 자리에서 급반전하는 콜옵션 프리미엄을 빠르게 확보합니다.",
      trigger: "rebound_zone_call_premium_fast_reverse",
      minimum_take_profit: {
        profit_pct_range: [20, 30],
        min_position_pct: 30,
        contracts: 1,
        description: "순간 반등으로 20~30% 수익권에 들어오면 최소 1계약은 청산합니다.",
      },
      free_runner_plan: {
        condition: "no_initial_stop_loss",
        profit_pct: 30,
        exit_position_pct: 70,
        exit_contracts: 2,
        remaining_contracts: 1,
        concept: "초기 손절 전 2계약을 +30%에 청산하면 남은 1계약을 무위험 잔량 개념으로 운용합니다.",
        arithmetic_check: "TODO",
      },
    },
    targets: [
      { contracts: 1, profit_pct: 35, price_formula: "average_entry_price * 1.35", example_entry_price: 2.1, example_target_price: 2.84, label: "1차 청산" },
      { contracts: 1, profit_pct: 45, price_formula: "average_entry_price * 1.45", example_entry_price: 2.1, example_target_price: 3.05, label: "2차 청산" },
    ],
    runner: {
      contracts: 1,
      management: "trailing_stop_or_index_exit_signal",
      description: "남은 1계약은 수익극대화 물량으로 두고 트레일링 스탑 또는 지수 청산 신호까지 운용합니다.",
      trailing_stop_formula: "TODO",
    },
  },
  position_switch: {
    status: "draft",
    rationale: "손절 및 자리이동을 하면서 더 안쪽 콜옵션으로 당겨와야 시장이 반등할 때 수익 전환을 빠르게 가져올 수 있습니다.",
    trigger: {
      index_push_points: "5~10",
      fibonacci_zone: "100%~103%",
      loss_prepare_pct_range: [20, 25],
      description: "시장이 피보나치 진입 구간 이후 5~10포인트 더 밀리고 기존 옵션이 20~25% 손실권이면 자리이동을 준비합니다.",
    },
    replacement_selection: {
      direction: "call",
      strike_shift: "deeper_inside_call",
      example_old_strike: 1315,
      example_new_strike_zone: "1310~1305",
      target_premium_min: 1.8,
      target_premium_max: 2.2,
      preferred_entry_price: 2.1,
      avoid_market_order: true,
      description: "더 안쪽 콜옵션 중 프리미엄 1.8~2.2 상품을 찾고, 저렴한 구간에서 지정가 진입을 노립니다.",
    },
    execution: {
      new_contracts: 3,
      old_contracts_to_close: 3,
      old_position_exit_loss_pct: 25,
      sequence: "fill_replacement_then_close_existing",
      description: "새 3계약이 지정가로 체결되면 기존 손실 포지션 3계약을 즉시 청산합니다.",
    },
    retry_limit: {
      max_switch_attempts: 2,
      after_limit_action: "WAIT_NO_MORE_TRY",
      loss_after_limit: "small_loss",
      description: "핵심 자리가 무너지면 자리이동은 최대 2번까지만 시도하고, 두 번 이후 약손실이면 더 트라이하지 않고 대기합니다.",
    },
    critical_breakdown: {
      trigger: "critical_spot_breakdown",
      risk: "large_breakdown_possible",
      action: "stop_retry_and_wait_after_two_switches",
      description: "방어해야 할 자리가 무너지면 추가 하락이 커질 수 있어 무한 재진입하지 않습니다.",
    },
  },
  states: [
    { key: "WAIT_INDEX_SIGNAL", label: "지수 신호 대기", description: "지수 매매 탭의 신규 진입 위치를 기다립니다." },
    { key: "SELECT_OPTION", label: "옵션 선택", description: "2.5% 위 콜 행사가와 프리미엄 1.6 근처 상품을 찾습니다." },
    { key: "PLACE_ENTRY_LADDER", label: "3분할 주문", description: "1.70, 1.60, 1.45에 각 1계약 주문합니다." },
    { key: "PLACE_TARGETS", label: "부분 청산 예약", description: "+35%, +45%에 각 1계약 청산 주문을 냅니다." },
    { key: "HOLD_OR_STOP", label: "손실선 전 홀딩", description: "30% 손실구간 전까지는 홀딩합니다." },
    { key: "QUICK_REBOUND_EXIT", label: "급반등 1차 청산", description: "초기 2계약, 즉 70% 물량은 최소 안전마진을 만들기 위한 청산 후보입니다." },
    { key: "FREE_RUNNER", label: "무위험 잔량 전환", description: "초기 손절 전 2계약을 +30%에 청산하면 남은 1계약은 수익극대화 잔량으로 운용합니다." },
    { key: "SWITCH_PREPARE", label: "자리이동 준비", description: "100%~103% 구간과 -20~-25% 손실권이 겹치면 더 안쪽 콜을 찾습니다." },
    { key: "SWITCH_EXECUTE", label: "자리이동 실행", description: "새 안쪽 콜 3계약 체결 후 기존 3계약을 청산합니다." },
    { key: "SWITCH_LIMIT_2", label: "자리이동 2회 제한", description: "핵심 자리 이탈 구간에서는 자리이동을 최대 두 번까지만 허용합니다." },
    { key: "WAIT_AFTER_SMALL_LOSS", label: "약손실 후 대기", description: "두 번 자리이동 후 약손실이면 더 트라이하지 않고 대기합니다." },
    { key: "RESET_MID_RESTART_ENTRY", label: "중심라인 재시작", description: "리셋 중심라인에서 프리미엄 1.5~1.8 콜옵션을 2~3계약으로 새 초기 진입처럼 다시 시작하는 후보로 봅니다." },
    { key: "RESET_MID_WICK_CONFIRM", label: "중심 밑꼬리 확인", description: "거의 원하는 자리에서 밑꼬리가 나오면 중심라인 콜 재시작 후보의 신뢰도를 높입니다." },
    { key: "RUNNER_MANAGE", label: "잔량 운용", description: "남은 1계약은 추세를 따라갑니다." },
    { key: "DOWNSIDE_PRESSURE_MIN_TRY", label: "하락 압력 최소 트라이", description: "5분봉이 30이평, 전환선, 기준선 아래이면 더블바텀 후보라도 최소 물량만 시도합니다." },
    { key: "PRE_100_FRONT_RUN", label: "100% 앞선 트라이", description: "우측 바닥이 100%보다 높은 자리에서 돌 수 있어 앞선 자리도 최소 물량 후보로 봅니다." },
    { key: "EXPIRY_AFTER_NOON_REPRICE", label: "만기일 12시 후 재선정", description: "12시 이후에는 1.5% 위치, 프리미엄 0.6~1.0 옵션으로 낮추고 손절 40% 기준으로 자리이동합니다." },
    { key: "PROFIT_LOCK", label: "당일 수익 잠금", description: "3계약 운용으로 당일 50~100만원 수익을 내면 보수 모드로 전환합니다." },
    { key: "REDUCED_SIZE_PLAY", label: "1계약 보수 플레이", description: "수익 잠금 이후에는 급소자리에서만 수익담보 내 1계약으로 진입합니다." },
    { key: "DAILY_STOP", label: "당일 중단", description: "손실 300만원 도달 시 중단합니다." },
  ],
  questions: [
    "당일 최대 손실 300만원의 계산 기준 확인이 필요합니다.",
    "부분 체결 시 청산 주문 배분 기준 확인이 필요합니다.",
    "트레일링 스탑 공식 확인이 필요합니다.",
    "자리이동 시 새 3계약 체결 전후로 기존 3계약 청산 순서를 확인해야 합니다.",
    "2계약을 +30%에 청산하면 남은 1계약이 실제로 무위험이 되는 산식을 확인해야 합니다.",
    "계약수가 달라질 때 70% 안전마진 물량과 30% 수익극대화 물량의 반올림 기준을 확인해야 합니다.",
    "당일 50~100만원 수익 잠금 기준과 이후 급소자리 조건을 확인해야 합니다.",
    "하락 압력 구간의 더블바텀 트라이는 1계약 고정인지, 쌍바닥 이탈 기준은 무엇인지 확인해야 합니다.",
    "100% 앞선 트라이 허용 폭과 만기일 12시 이후 40% 손절 기준을 확인해야 합니다.",
    "약손실 기준, 자리이동 2회 카운트 방식, 핵심 자리 이탈 기준을 확인해야 합니다.",
    "리셋 중심라인에서 2계약과 3계약을 나누는 기준과 프리미엄 1.5~1.8 주문가 분할 기준을 확인해야 합니다.",
    "거의 원하는 자리에서 밑꼬리가 나왔을 때 바로 진입할지, 다음 5분봉 확인 후 들어갈지 확인해야 합니다.",
  ],
};

const formatPct = (value) => (value == null ? "-" : `${(Number(value) * 100).toFixed(1)}%`);
const formatNum = (value, digits = 2) =>
  value == null ? "-" : Number(value).toLocaleString("ko-KR", { maximumFractionDigits: digits });
const formatWon = (value) => (value == null ? "-" : `${Number(value).toLocaleString("ko-KR")}원`);
const formatScore = (value) => (value == null ? "-" : Number(value).toFixed(1));

function initialMode() {
  if (window.location.hash === "#overview" || window.location.hash === "#stocks") return "stocks";
  if (window.location.hash === "#index") return "index";
  if (window.location.hash === "#weekly" || window.location.hash === "#options") return "weekly";
  return "weekly";
}

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} 로드 실패`);
  return response.json();
}

async function loadOptionalJson(path) {
  try {
    return await loadJson(path);
  } catch (error) {
    return null;
  }
}

async function init() {
  bindModeTabs();
  document.querySelector("#periodSelect")?.addEventListener("change", (event) => {
    state.period = event.target.value;
    state.algorithm = null;
    renderDashboard();
  });
  document.querySelector("#algorithmSelect")?.addEventListener("change", (event) => {
    state.algorithm = event.target.value;
    renderDashboard();
  });
  document.querySelector("#holdingForm")?.addEventListener("submit", addHolding);

  state.holdings = loadHoldings();

  try {
    const [report, chartConfig, indexStrategy, weeklyOptions] = await Promise.all([
      loadJson("data/market_report.json"),
      loadOptionalJson("data/chart_config.json"),
      loadOptionalJson("data/index_trading.json"),
      loadOptionalJson("data/weekly_options.json"),
    ]);
    state.report = report;
    state.chartConfig = mergeChartConfig(chartConfig || report.chart_config || {});
    state.indexStrategy = indexStrategy || defaultIndexStrategy;
    state.weeklyOptions = weeklyOptions || defaultWeeklyOptions;
    renderDashboard();
  } catch (error) {
    state.chartConfig = defaultChartConfig;
    state.indexStrategy = defaultIndexStrategy;
    state.weeklyOptions = defaultWeeklyOptions;
    renderError(error);
  }

  setMode(state.mode, false);
}

function bindModeTabs() {
  document.querySelectorAll("[data-mode-tab]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.modeTab));
  });
}

function setMode(mode, updateHash = true) {
  state.mode = ["index", "weekly"].includes(mode) ? mode : "stocks";

  document.querySelectorAll("[data-mode-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.modePanel !== state.mode;
  });

  document.querySelectorAll("[data-mode-tab]").forEach((button) => {
    const active = button.dataset.modeTab === state.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  if (updateHash) {
    const hash = state.mode === "index" ? "#index" : state.mode === "weekly" ? "#weekly" : "#overview";
    window.history.replaceState(null, "", hash);
  }

  if (state.mode === "index") {
    renderIndexHero();
    renderIndexPanel();
  } else if (state.mode === "weekly") {
    renderWeeklyHero();
    renderWeeklyPanel();
  } else if (state.report && currentPeriod()) {
    renderSummary(currentPeriod(), recommendationRows(currentPeriod()));
    renderSelectedChart();
  }
}

function currentAsset() {
  return state.report?.domestic || null;
}

function currentPeriodBase() {
  return currentAsset()?.periods?.[state.period] || null;
}

function currentPeriod() {
  const base = currentPeriodBase();
  if (!base) return null;
  const algorithm = activeAlgorithm(base);
  const variant = base.algorithms?.[algorithm];
  if (!variant) return base;
  return {
    ...base,
    ...variant,
    label: base.label,
    description: base.description,
    algorithm,
    default_algorithm: base.default_algorithm,
    algorithm_options: base.algorithm_options,
    algorithms: base.algorithms,
  };
}

function activeAlgorithm(periodBase = currentPeriodBase()) {
  if (!periodBase?.algorithms) return state.algorithm;
  if (state.algorithm && periodBase.algorithms[state.algorithm]) return state.algorithm;
  return periodBase.default_algorithm || Object.keys(periodBase.algorithms)[0];
}

function updateAlgorithmSelect(periodBase) {
  const select = document.querySelector("#algorithmSelect");
  const description = document.querySelector("#algorithmDescription");
  if (!select || !description) return;

  const options = periodBase?.algorithm_options || algorithmOptionsFromReport();
  if (!options.length) {
    select.innerHTML = `<option>준비 중</option>`;
    select.disabled = true;
    description.textContent = "알고리즘 데이터가 아직 없습니다.";
    return;
  }

  const selected = activeAlgorithm(periodBase);
  state.algorithm = selected;
  select.disabled = false;
  select.innerHTML = options.map((option) => `<option value="${escapeAttr(option.key)}">${escapeHtml(option.label)}</option>`).join("");
  select.value = selected;
  const option = options.find((item) => item.key === selected);
  description.textContent = option?.description || "선택한 알고리즘 기준으로 후보를 다시 봅니다.";
}

function algorithmOptionsFromReport() {
  return Object.entries(state.report?.algorithms || {}).map(([key, value]) => ({
    key,
    label: value.label || key,
    description: value.description || "",
  }));
}

function renderDashboard() {
  const periodBase = currentPeriodBase();
  updateAlgorithmSelect(periodBase);

  const period = currentPeriod();
  if (!state.report || !period) {
    renderError(new Error("국내 주식 데이터가 없습니다."));
    return;
  }

  const periodSelect = document.querySelector("#periodSelect");
  if (periodSelect) periodSelect.value = state.period;
  document.querySelector("#asOfDate").textContent = (state.report.generated_at || "").slice(0, 10) || "-";

  const rows = recommendationRows(period);
  if (!state.selectedSymbol || !findRow(state.selectedSymbol)) {
    state.selectedSymbol = rows[0]?.symbol || state.holdings[0] || null;
  }

  if (state.mode === "stocks") renderSummary(period, rows);
  renderCandidateList(rows);
  renderHoldingList();
  renderMetrics(period);
  renderSelectedChart();
}

function renderSummary(period, rows) {
  const summary = currentAsset()?.universe_summary || {};
  const top = rows[0];
  const algorithmLabel = period.algorithm_label || state.report.algorithms?.[period.algorithm]?.label || "알고리즘";
  document.querySelector("#assetLabel").textContent = "국내 주식";
  document.querySelector("#appTitle").textContent = "오늘의 신호";
  document.querySelector("#marketSummary").textContent =
    `${period.label} · ${algorithmLabel} 기준, 국내 ${formatNum(summary.total_count, 0)}개 종목 중 ${rows.length}개를 우선 확인합니다.`;

  const card = document.querySelector("#topSignalCard");
  if (!top) {
    card.innerHTML = `<span class="signal-badge neutral">대기</span><strong>후보 없음</strong><small>조건을 통과한 종목이 없습니다.</small>`;
    return;
  }

  const signal = signalForRow(top);
  card.innerHTML = `
    <span class="signal-badge ${signal.className}">${escapeHtml(signal.label)}</span>
    <strong>${escapeHtml(top.name || top.symbol)}</strong>
    <small>${escapeHtml(top.symbol)} · 점수 ${formatScore(top.score)} · ${escapeHtml(top.reason || "신호 확인 필요")}</small>
  `;
}

function recommendationRows(period) {
  const candidates = period?.final_candidates || [];
  const watch = period?.watch || [];
  return (candidates.length ? candidates : watch).slice(0, displaySetting("top_candidate_cards", 8));
}

function renderCandidateList(rows) {
  const list = document.querySelector("#candidateList");
  document.querySelector("#candidateCount").textContent = rows.length;
  if (!rows.length) {
    list.innerHTML = `<button class="stock-row empty" type="button">현재 조건의 추천 종목이 없습니다.</button>`;
    return;
  }
  list.innerHTML = rows.map((row) => stockButton(row, false)).join("");
  bindStockButtons(list);
}

function renderHoldingList() {
  const list = document.querySelector("#holdingList");
  if (!state.holdings.length) {
    list.innerHTML = `<button class="stock-row empty" type="button">보유 종목을 추가하면 여기서 바로 차트를 볼 수 있습니다.</button>`;
    return;
  }
  list.innerHTML = state.holdings.map((symbol) => stockButton(findRow(symbol) || holdingFallback(symbol), true)).join("");
  bindStockButtons(list);
}

function stockButton(row, compact) {
  const signal = signalForRow(row);
  const active = row.symbol === state.selectedSymbol ? " active" : "";
  const metrics = compact
    ? ""
    : `
      <div class="stock-metrics">
        <div><span>점수</span><strong>${formatScore(row.score)}</strong></div>
        <div><span>1일</span><strong>${formatPct(row.ret_1d)}</strong></div>
        <div><span>1주</span><strong>${formatPct(row.ret_5d)}</strong></div>
        <div><span>위험</span><strong>${formatScore(row.risk_score)}</strong></div>
      </div>
    `;

  return `
    <button class="stock-row${active}" data-symbol="${escapeAttr(row.symbol)}" type="button">
      <span class="stock-main">
        <strong>${escapeHtml(row.name || row.symbol)}</strong>
        <span>${escapeHtml(row.symbol)} · ${escapeHtml(row.reason || "차트 신호 확인")}</span>
      </span>
      <span class="signal-badge ${signal.className}">${escapeHtml(signal.label)}</span>
      ${metrics}
    </button>
  `;
}

function bindStockButtons(root) {
  root.querySelectorAll("[data-symbol]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSymbol = button.dataset.symbol;
      renderCandidateList(recommendationRows(currentPeriod()));
      renderHoldingList();
      renderSelectedChart();
    });
  });
}

function renderMetrics(period) {
  const metrics = period.backtest?.metrics || {};
  document.querySelector("#winRate").textContent = formatPct(metrics.win_rate);
  document.querySelector("#avgReturn").textContent = formatPct(metrics.average_return);
  document.querySelector("#tradeCount").textContent = formatNum(metrics.trade_count, 0);
  document.querySelector("#maxDrawdown").textContent = formatPct(metrics.max_drawdown);
}

function renderSelectedChart() {
  const row = findRow(state.selectedSymbol) || holdingFallback(state.selectedSymbol);
  const title = document.querySelector("#chartTitle");
  const symbol = document.querySelector("#selectedSymbol");
  const badge = document.querySelector("#chartSignalBadge");
  const signalText = document.querySelector("#chartSignalText");
  const canvas = document.querySelector("#stockChart");

  if (!row?.symbol) {
    title.textContent = "종목 차트";
    symbol.textContent = "-";
    badge.className = "signal-badge neutral";
    badge.textContent = "대기";
    signalText.textContent = "추천 또는 보유 종목을 선택하면 공식선과 신호 설명을 표시합니다.";
    drawEmptyChart(canvas, chartDefinition("stock_price").empty_message);
    return;
  }

  const points = pricePointsForRow(row);
  const lines = computeChartLines(points, row);
  const chartSignal = evaluateChartSignal(row, lines);
  title.textContent = row.name || row.symbol;
  symbol.textContent = row.symbol;
  badge.className = `signal-badge ${chartSignal.className}`;
  badge.textContent = chartSignal.label;
  signalText.textContent = chartSignal.text;
  renderLegend(lines);
  drawStockChart(canvas, points, lines);
}

function findRow(symbol) {
  if (!symbol) return null;
  const period = currentPeriod();
  const rows = [
    ...(period?.final_candidates || []),
    ...(period?.watch || []),
    ...(period?.rows || []),
  ];
  return rows.find((row) => row.symbol === symbol) || null;
}

function holdingFallback(symbol) {
  if (!symbol) return null;
  const raw = currentAsset()?.raw_universe?.find((row) => row.symbol === symbol);
  return {
    symbol,
    name: raw?.name || symbol,
    last_close: raw?.close || null,
    final_action: raw ? "unscored" : "unscored",
    score: null,
    reason: raw ? "원자료에 있는 보유 종목입니다." : "현재 데이터에서 찾지 못한 보유 종목입니다.",
  };
}

function addHolding(event) {
  event.preventDefault();
  const input = document.querySelector("#holdingInput");
  const symbol = normalizeSymbol(input.value);
  if (!symbol) return;
  state.holdings = [symbol, ...state.holdings.filter((item) => item !== symbol)].slice(0, 12);
  state.selectedSymbol = symbol;
  input.value = "";
  saveHoldings();
  renderDashboard();
}

function loadHoldings() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data.map(normalizeSymbol).filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function saveHoldings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.holdings));
}

function normalizeSymbol(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "";
  return /^\d{1,6}$/.test(text) ? text.padStart(6, "0") : text;
}

function signalForRow(row) {
  const action = row?.trade_signal || row?.final_action || "neutral";
  return {
    buy: { label: "매수 후보", className: "buy" },
    candidate: { label: "매수 후보", className: "buy" },
    warning: { label: "경고/관찰", className: "warning" },
    watch: { label: "경고/관찰", className: "warning" },
    sell: { label: "매도/제외", className: "sell" },
    avoid: { label: "매도/제외", className: "sell" },
    unscored: { label: "미분석", className: "neutral" },
  }[action] || { label: "관망", className: "neutral" };
}

function renderIndexHero() {
  const strategy = state.indexStrategy || defaultIndexStrategy;
  const date = (state.report?.generated_at || "").slice(0, 10) || "공식 정리";
  document.querySelector("#assetLabel").textContent = strategy.asset_scope || "KOSPI200";
  document.querySelector("#asOfDate").textContent = date;
  document.querySelector("#appTitle").textContent = "지수 매매";
  document.querySelector("#marketSummary").textContent =
    `${strategy.timeframes?.context || "30분봉"} 방향과 ${strategy.timeframes?.execution || "5분봉"} 진입·청산을 분리해 봅니다.`;
  document.querySelector("#topSignalCard").innerHTML = `
    <span class="signal-badge neutral">설계중</span>
    <strong>옵션과 분리 완료</strong>
    <small>이 탭은 지수 매매 조건 전용입니다. 위클리 옵션 행사가 선택은 별도 전략으로 확정합니다.</small>
  `;
}

function renderIndexPanel() {
  const strategy = state.indexStrategy || defaultIndexStrategy;
  const sizing = strategy.position_sizing || {};
  document.querySelector("#indexScope").textContent = strategy.asset_scope || "KOSPI200 지수/선물";
  document.querySelector("#indexStatusBadge").textContent = strategy.status === "active" ? "활성" : "설계중";
  document.querySelector("#indexChartSignalText").textContent =
    `현재 공식은 ${sizing.first_entry_pct || 70}% 1차 진입, ${sizing.add_entry_pct || 30}% 추가 진입, 핵심 이탈 시 직전 저가를 새 61.8%로 맞추는 리셋 구조입니다.`;

  const formulas = [
    ...(strategy.formulas || []),
    ...(strategy.fibonacci?.levels || []),
  ];
  document.querySelector("#indexFormulaList").innerHTML = formulas.map((item) => `
    <article class="formula-item">
      <div>
        <span>${escapeHtml(item.key)}</span>
        <strong>${escapeHtml(item.label)}</strong>
      </div>
      <code>${escapeHtml(item.formula)}</code>
      <small>${escapeHtml(item.role || "")}</small>
    </article>
  `).join("");

  document.querySelector("#indexLevelList").innerHTML = (strategy.fibonacci?.levels || []).map((level) => `
    <article class="level-item ${level.key === "fib_105" ? "danger" : level.key === "fib_103" || level.key === "fib_100" ? "watch" : ""}">
      <span>${escapeHtml(level.label)}</span>
      <strong>${escapeHtml(level.role || "")}</strong>
      <small>${escapeHtml(level.formula)}</small>
    </article>
  `).join("");

  document.querySelector("#indexStateFlow").innerHTML = (strategy.states || []).map((step, index) => `
    <article class="state-step">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>${escapeHtml(step.label)}</strong>
        <code>${escapeHtml(step.key)}</code>
        <small>${escapeHtml(step.description || "")}</small>
      </div>
    </article>
  `).join("");

  document.querySelector("#indexSignalRules").innerHTML = (strategy.signals || []).map((rule) => `
    <article class="rule-item">
      <div>
        <span>${escapeHtml(rule.key)}</span>
        <strong>${escapeHtml(rule.label)}</strong>
      </div>
      <p>${escapeHtml(rule.message || "")}</p>
      <ul>${(rule.conditions || []).map((condition) => `<li>${escapeHtml(condition)}</li>`).join("")}</ul>
    </article>
  `).join("");

  document.querySelector("#indexQuestions").innerHTML = (strategy.questions || [])
    .map((question) => `<li>${escapeHtml(question)}</li>`)
    .join("");

  renderIndexLegend();
  requestAnimationFrame(() => drawIndexBlueprint());
}

function renderWeeklyHero() {
  const strategy = state.weeklyOptions || defaultWeeklyOptions;
  const risk = strategy.risk_limits || {};
  const indexReset = strategy.index_reset_reference || {};
  const resetPrepare = indexReset.call_retry_prepare || {};
  const resetWick = resetPrepare.wick_confirmation || {};
  const money = strategy.money_management || {};
  const profitLock = money.daily_profit_lock || {};
  const afterLock = money.after_lock || {};
  const pressureFilter = money.downside_pressure_filter || {};
  const entry = strategy.entry || {};
  const date = (state.report?.generated_at || "").slice(0, 10) || "공식 정리";
  document.querySelector("#assetLabel").textContent = strategy.asset_scope || "KOSPI200 위클리 옵션";
  document.querySelector("#asOfDate").textContent = date;
  document.querySelector("#appTitle").textContent = "위클리 옵션";
  document.querySelector("#marketSummary").textContent =
    `지수 매매 진입 위치를 ${entry.initial_contracts || 3}계약 분할 주문과 부분 청산 계획으로 바꿉니다.`;
  document.querySelector("#topSignalCard").innerHTML = `
    <span class="signal-badge sell">손실 제한</span>
    <strong>${formatWon(risk.daily_max_loss_krw || 3000000)} 도달 시 중단</strong>
    <small>이 탭은 실제 주문 실행 전 전략 확인용입니다. 자동 주문은 아직 연결하지 않습니다.</small>
  `;
}

function renderWeeklyPanel() {
  const strategy = state.weeklyOptions || defaultWeeklyOptions;
  const risk = strategy.risk_limits || {};
  const indexReset = strategy.index_reset_reference || {};
  const resetPrepare = indexReset.call_retry_prepare || {};
  const resetWick = resetPrepare.wick_confirmation || {};
  const money = strategy.money_management || {};
  const profitLock = money.daily_profit_lock || {};
  const afterLock = money.after_lock || {};
  const pressureFilter = money.downside_pressure_filter || {};
  const entry = strategy.entry || {};
  const rolePlan = strategy.position_roles || {};
  const safetyRole = rolePlan.safety_margin || {};
  const profitRole = rolePlan.profit_runner || {};
  const strike = entry.strike_selection || {};
  const entryTiming = entry.double_bottom_entry_timing || {};
  const expiryTiming = entry.expiry_day_time_adjustments || {};
  const morningPlan = expiryTiming.morning || {};
  const afterNoonPlan = expiryTiming.after_noon || {};
  const exit = strategy.exit || {};
  const loss = exit.loss_control || {};
  const quickRebound = exit.quick_rebound || {};
  const minTake = quickRebound.minimum_take_profit || {};
  const freeRunner = quickRebound.free_runner_plan || {};
  const runner = exit.runner || {};
  const switchRule = strategy.position_switch || {};
  const switchTrigger = switchRule.trigger || {};
  const switchReplacement = switchRule.replacement_selection || {};
  const switchExecution = switchRule.execution || {};
  const switchRetry = switchRule.retry_limit || {};
  const criticalBreakdown = switchRule.critical_breakdown || {};
  const perStopRange = Array.isArray(risk.per_stop_loss_krw_range)
    ? `${formatWon(risk.per_stop_loss_krw_range[0])}~${formatWon(risk.per_stop_loss_krw_range[1])}`
    : "300,000~500,000원";
  const profitLockRange = Array.isArray(profitLock.profit_krw_range)
    ? `${formatWon(profitLock.profit_krw_range[0])}~${formatWon(profitLock.profit_krw_range[1])}`
    : "500,000원~1,000,000원";
  const formatPremiumRange = (range) => Array.isArray(range)
    ? `${Number(range[0]).toFixed(1)}~${Number(range[1]).toFixed(1)}`
    : "-";
  const formatContractRange = (range, fallback = 3) => Array.isArray(range)
    ? `${formatNum(range[0], 0)}~${formatNum(range[1], 0)}계약`
    : `${formatNum(fallback, 0)}계약`;
  const morningPremiumRange = formatPremiumRange(morningPlan.target_premium_range || strike.target_premium_range);
  const afterNoonPremiumRange = formatPremiumRange(afterNoonPlan.target_premium_range);
  const resetPremiumRange = formatPremiumRange(resetPrepare.target_premium_range || resetPrepare.premium_range);
  const resetContractRange = formatContractRange(resetPrepare.contracts_range, resetPrepare.contracts || 3);

  document.querySelector("#weeklyStopBadge").textContent = formatWon(risk.daily_max_loss_krw || 3000000);
  document.querySelector("#weeklyRiskGrid").innerHTML = [
    { label: "당일 최대 손실", value: formatWon(risk.daily_max_loss_krw || 3000000), text: risk.description || "" },
    { label: "1회 손절 비용", value: perStopRange, text: risk.per_stop_loss_description || "손절과 자리이동을 감수해 반등 시 수익 회수를 빠르게 노립니다." },
    { label: "수익 잠금", value: profitLockRange, text: profitLock.description || "당일 수익 달성 후 보수 모드로 전환합니다." },
    { label: "이후 진입", value: `${afterLock.max_contracts || 1}계약만`, text: afterLock.description || "급소자리 외에는 진입하지 않고 수익담보 내에서만 운용합니다." },
    { label: "하락 압력", value: `${pressureFilter.max_contracts || 1}계약`, text: pressureFilter.description || "5분봉이 30이평, 전환선, 기준선 아래이면 최소 물량만 시도합니다." },
    { label: "100% 앞선 자리", value: "최소 물량", text: entryTiming.description || "우측 바닥이 더 높게 돌 수 있어 100%를 딱 기다리지 않고 앞선 자리도 봅니다." },
    { label: "만기 12시 후", value: `${formatNum(afterNoonPlan.strike_offset_pct || 1.5, 1)}% / ${afterNoonPremiumRange}`, text: afterNoonPlan.description || "프리미엄 급감 구간에서는 더 가까운 행사가와 낮은 프리미엄으로 재선정합니다." },
    { label: "12시 후 손절", value: `-${formatNum(afterNoonPlan.stop_loss_pct || 40, 0)}%`, text: afterNoonPlan.position_switch_required ? "손절 범위를 40%로 두고 자리이동을 전제로 운용합니다." : "손절 기준 확인이 필요합니다." },
    { label: "자리이동 한도", value: `${formatNum(switchRetry.max_switch_attempts || 2, 0)}회`, text: switchRetry.description || "핵심 자리 이탈 구간에서는 자리이동을 최대 두 번까지만 허용합니다." },
    { label: "이후 대기", value: "약손실 후 중단", text: criticalBreakdown.description || "방어해야 할 자리가 무너지면 추가 하락이 커질 수 있어 무한 재진입하지 않습니다." },
    { label: "도달 시", value: "오늘 중단", text: "신규 진입과 추가 진입을 멈춥니다." },
    { label: "초기 계약", value: `${entry.initial_contracts || 3}계약`, text: "1계약씩 3분할 주문을 기본값으로 둡니다." },
    { label: "기준 신호", value: "지수 매매", text: "지수 탭의 신규 진입 위치를 옵션 선택의 출발점으로 씁니다." },
    { label: indexReset.label || "지수 피보나치 리셋", value: indexReset.value || "중심라인 콜 2~3계약 재시작", text: indexReset.description || "핵심 자리가 무너지면 리셋 중심라인에서 프리미엄 1.5~1.8 콜을 2~3계약 재시작 후보로 봅니다." },
    { label: resetWick.label || "원하는 자리 밑꼬리", value: "확인 강도 상승", text: resetWick.description || "거의 원하는 자리에서 밑꼬리가 나오면 중심라인 콜 재시작 후보의 신뢰도를 높입니다." },
  ].map(optionMetricCard).join("");

  document.querySelector("#weeklyEntrySummary").innerHTML = `
    <article class="option-summary-card">
      <span>장초 선택</span>
      <strong>중심가격 +${formatNum(strike.call_strike_offset_pct, 1)}%</strong>
      <small>예: 지수 ${formatNum(strike.example_index, 0)}이면 콜 ${escapeHtml(strike.example_call_strike_zone || "-")} 구간, 만기일 장초 프리미엄 ${morningPremiumRange} 근처를 찾습니다.</small>
    </article>
    <article class="option-summary-card">
      <span>12시 이후</span>
      <strong>중심가격 +${formatNum(afterNoonPlan.strike_offset_pct || 1.5, 1)}%</strong>
      <small>프리미엄 ${afterNoonPremiumRange} 구간 · 손절 ${formatNum(afterNoonPlan.stop_loss_pct || 40, 0)}% · 자리이동 전제</small>
    </article>
    <article class="option-summary-card">
      <span>리셋 중심라인</span>
      <strong>콜 ${resetContractRange}</strong>
      <small>프리미엄 ${resetPremiumRange} · 새 초기 진입처럼 재시작</small>
    </article>
    <article class="option-summary-card">
      <span>밑꼬리 확인</span>
      <strong>진입 후보 강화</strong>
      <small>${escapeHtml(resetWick.description || "거의 원하는 자리에서 밑꼬리가 나오면 콜 재시작 후보의 신뢰도를 높입니다.")}</small>
    </article>
    <article class="option-summary-card">
      <span>쌍바닥 타이밍</span>
      <strong>100% 앞선 자리 허용</strong>
      <small>${escapeHtml(entryTiming.description || "우측 바닥이 더 높은 자리에서 돌 수 있어 최소 물량으로 먼저 시도할 수 있습니다.")}</small>
    </article>
  `;

  document.querySelector("#weeklyOrderLadder").innerHTML = (entry.order_ladder || []).map((order, index) => `
    <article class="order-step">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>${escapeHtml(order.label || `${index + 1}차 매수`)}</strong>
        <small>${formatNum(order.limit_price, 2)}에 ${formatNum(order.contracts, 0)}계약 주문</small>
      </div>
    </article>
  `).join("") + `
    <article class="order-step average">
      <span>평균</span>
      <div>
        <strong>${formatNum(entry.expected_average_if_all_filled, 2)}</strong>
        <small>3계약 모두 체결됐을 때 예상 평균단가</small>
      </div>
    </article>
  `;

  const lossItem = `
    <article class="target-item stop">
      <span>손실 방어</span>
      <strong>-${formatNum(loss.hold_until_loss_pct || 30, 0)}% 전까지 홀딩</strong>
      <small>${escapeHtml(loss.stop_price_formula || "average_entry_price * 0.70")} · 진입 ${formatNum(loss.example_entry_price, 2)} 예시 ${formatNum(loss.example_stop_price, 2)}</small>
    </article>
  `;

  const reboundProfitRange = Array.isArray(minTake.profit_pct_range)
    ? `+${formatNum(minTake.profit_pct_range[0], 0)}~+${formatNum(minTake.profit_pct_range[1], 0)}%`
    : "+20~+30%";
  const quickReboundItems = quickRebound.status ? `
    <article class="target-item quick">
      <span>급반등 1차 청산</span>
      <strong>${reboundProfitRange} · 최소 ${formatNum(minTake.contracts || 1, 0)}계약</strong>
      <small>${formatNum(minTake.min_position_pct || 30, 0)}% 물량 확보 · ${escapeHtml(quickRebound.purpose || "급반전 프리미엄을 빠르게 확보합니다.")}</small>
    </article>
    <article class="target-item quick">
      <span>무위험 잔량 전환</span>
      <strong>+${formatNum(freeRunner.profit_pct || 30, 0)}%에서 ${formatNum(freeRunner.exit_contracts || 2, 0)}계약 청산</strong>
      <small>남은 ${formatNum(freeRunner.remaining_contracts || 1, 0)}계약은 무위험 잔량 개념 · 산식 확인 필요</small>
    </article>
  ` : "";

  const roleItems = rolePlan.status ? `
    <article class="target-item role">
      <span>안전마진 물량</span>
      <strong>${formatNum(safetyRole.contracts || 2, 0)}계약 · ${formatNum(safetyRole.position_pct || 70, 0)}%</strong>
      <small>${escapeHtml(safetyRole.description || "초기 두 개 물량은 최소한의 안전마진을 만들기 위한 물량입니다.")}</small>
    </article>
    <article class="target-item role">
      <span>수익극대화 물량</span>
      <strong>${formatNum(profitRole.contracts || 1, 0)}계약 · ${formatNum(profitRole.position_pct || 30, 0)}%</strong>
      <small>${escapeHtml(profitRole.description || "남은 잔량은 수익극대화를 위한 물량입니다.")}</small>
    </article>
  ` : "";

  const switchLossRange = Array.isArray(switchTrigger.loss_prepare_pct_range)
    ? `-${formatNum(switchTrigger.loss_prepare_pct_range[0], 0)}~-${formatNum(switchTrigger.loss_prepare_pct_range[1], 0)}%`
    : "-20~-25%";
  const marketOrderText = switchReplacement.avoid_market_order ? "시장가 금지" : "지정가 우선";
  const switchItems = switchRule.status ? `
    <article class="target-item switch">
      <span>자리이동 준비</span>
      <strong>${switchLossRange} 손실권</strong>
      <small>지수 ${escapeHtml(switchTrigger.index_push_points || "5~10")} 추가 하락 · 피보나치 ${escapeHtml(switchTrigger.fibonacci_zone || "100%~103%")}</small>
    </article>
    <article class="target-item switch">
      <span>교체 옵션</span>
      <strong>${escapeHtml(String(switchReplacement.example_old_strike || "1315"))}콜 → ${escapeHtml(switchReplacement.example_new_strike_zone || "1310~1305")}콜</strong>
      <small>${marketOrderText} · 프리미엄 ${formatNum(switchReplacement.target_premium_min, 1)}~${formatNum(switchReplacement.target_premium_max, 1)}, 선호 진입 ${formatNum(switchReplacement.preferred_entry_price, 1)}</small>
    </article>
    <article class="target-item switch">
      <span>실행 순서</span>
      <strong>새 ${formatNum(switchExecution.new_contracts, 0)}계약 체결 후 기존 ${formatNum(switchExecution.old_contracts_to_close, 0)}계약 청산</strong>
      <small>기존 포지션이 약 -${formatNum(switchExecution.old_position_exit_loss_pct, 0)}% 손실권이면 자리이동 확정 시 즉시 정리</small>
    </article>
    <article class="target-item switch">
      <span>자리이동 제한</span>
      <strong>최대 ${formatNum(switchRetry.max_switch_attempts || 2, 0)}회</strong>
      <small>${escapeHtml(switchRetry.description || "핵심 자리 이탈 구간에서는 자리이동을 최대 두 번까지만 허용합니다.")}</small>
    </article>
    <article class="target-item switch">
      <span>약손실 후 대기</span>
      <strong>더 트라이 금지</strong>
      <small>${escapeHtml(criticalBreakdown.description || "방어해야 할 자리가 무너지면 추가 하락이 커질 수 있어 대기합니다.")}</small>
    </article>
    <article class="target-item switch">
      <span>자리이동 목적</span>
      <strong>반등 수익 회수 속도</strong>
      <small>${escapeHtml(switchRule.rationale || "더 안쪽 옵션으로 당겨와 반등 시 수익 전환을 빠르게 노립니다.")}</small>
    </article>
  ` : "";

  const targetItems = (exit.targets || []).map((target) => {
    const exampleBase = target.example_entry_price ?? 2.1;
    const exampleTarget = target.example_target_price ?? target.example_from_1_58;
    return `
    <article class="target-item">
      <span>${escapeHtml(target.label)}</span>
      <strong>+${formatNum(target.profit_pct, 0)}% · ${formatNum(target.contracts, 0)}계약</strong>
      <small>${escapeHtml(target.price_formula)} · 진입 ${formatNum(exampleBase, 2)} 예시 ${formatNum(exampleTarget, 2)}</small>
    </article>
  `;
  }).join("");

  document.querySelector("#weeklyTargetList").innerHTML = lossItem + roleItems + quickReboundItems + switchItems + targetItems + `
    <article class="target-item runner">
      <span>잔량 운용</span>
      <strong>${formatNum(runner.contracts || 1, 0)}계약</strong>
      <small>${escapeHtml(runner.description || "트레일링 스탑 또는 지수 청산 신호까지 보유합니다.")}</small>
    </article>
  `;

  document.querySelector("#weeklyStateFlow").innerHTML = (strategy.states || []).map((step, index) => `
    <article class="state-step">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>${escapeHtml(step.label)}</strong>
        <code>${escapeHtml(step.key)}</code>
        <small>${escapeHtml(step.description || "")}</small>
      </div>
    </article>
  `).join("");

  document.querySelector("#weeklyQuestions").innerHTML = (strategy.questions || [])
    .map((question) => `<li>${escapeHtml(question)}</li>`)
    .join("");

  const visual = strategy.visual_chart || defaultWeeklyOptions.visual_chart || {};
  document.querySelector("#weeklyChartTitle").textContent = visual.title || "옵션 전략선";
  document.querySelector("#weeklyChartSignalText").textContent =
    visual.description || "평균 진입가 기준으로 손실선, 자리이동선, 청산선을 먼저 그립니다.";
  renderWeeklyLegend(visual);
  requestAnimationFrame(() => drawWeeklyBlueprint(strategy));
}

function optionMetricCard(item) {
  return `
    <article>
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <small>${escapeHtml(item.text)}</small>
    </article>
  `;
}

function renderIndexLegend() {
  const legend = document.querySelector("#indexChartLegend");
  legend.innerHTML = [
    { label: "가격 흐름", color: "#17202a" },
    { label: "61.8/80.9 진입", color: "#2d8f64" },
    { label: "100/103 휩소", color: "#d89216" },
    { label: "105 손절", color: "#b6504a" },
    { label: "리셋 61.8/중심/100", color: "#6d5bd0" },
  ].map((item) => `<span style="color:${item.color}"><i></i>${item.label}</span>`).join("");
}

function renderWeeklyLegend(visual) {
  const legend = document.querySelector("#weeklyChartLegend");
  if (!legend) return;
  const lines = visual?.lines?.length ? visual.lines : defaultWeeklyOptions.visual_chart.lines;
  legend.innerHTML = [
    { label: "예상 프리미엄 흐름", color: "#17202a" },
    ...lines.map((line) => ({ label: line.label || line.key, color: line.color || "#637083" })),
  ].map((item) => `<span style="color:${escapeAttr(item.color)}"><i></i>${escapeHtml(item.label)}</span>`).join("");
}

function drawWeeklyBlueprint(strategy = state.weeklyOptions || defaultWeeklyOptions) {
  const canvas = document.querySelector("#weeklyChart");
  if (!canvas) return;

  const visual = strategy.visual_chart || defaultWeeklyOptions.visual_chart;
  const entry = strategy.entry || {};
  const exit = strategy.exit || {};
  const loss = exit.loss_control || {};
  const switchRule = strategy.position_switch || {};
  const switchRetry = switchRule.retry_limit || {};
  const { context, width, height } = setupCanvas(canvas, visual.height || 300);
  context.clearRect(0, 0, width, height);

  const avgEntry = weeklyAverageEntry(entry, loss);
  const scope = {
    avg_entry: avgEntry,
    average_entry_price: avgEntry,
    stop_loss_pct: number(loss.hold_until_loss_pct) ?? 30,
    max_switch_attempts: number(switchRetry.max_switch_attempts) ?? 2,
  };
  const lineConfigs = visual.lines?.length ? visual.lines : defaultWeeklyOptions.visual_chart.lines;
  const levels = lineConfigs
    .map((line) => ({
      ...line,
      value: number(safeEvaluate(line.formula || "avg_entry", scope, null)),
    }))
    .filter((line) => Number.isFinite(line.value));
  const multipliers = Array.isArray(visual.sample_path_multipliers) && visual.sample_path_multipliers.length > 1
    ? visual.sample_path_multipliers
    : defaultWeeklyOptions.visual_chart.sample_path_multipliers;
  const pathValues = multipliers.map((multiplier) => avgEntry * Number(multiplier));
  const orderValues = (entry.order_ladder || [])
    .map((order) => number(order.limit_price))
    .filter((value) => Number.isFinite(value));
  const allValues = [...pathValues, ...levels.map((level) => level.value), ...orderValues];
  if (!allValues.length) {
    drawEmpty(context, width, height, "전략선 자료가 없습니다.");
    return;
  }

  const padding = 26;
  const rightPadding = 86;
  const min = Math.min(...allValues) * 0.95;
  const max = Math.max(...allValues) * 1.05;
  const span = max - min || 1;
  const xFor = (index) => padding + index * ((width - padding - rightPadding) / Math.max(pathValues.length - 1, 1));
  const yFor = (value) => height - padding - ((value - min) / span) * (height - padding * 2);
  const drawableLevels = [
    ...orderValues.map((value, index) => ({
      key: `order_${index + 1}`,
      label: `${index + 1}차 주문`,
      value,
      color: "#95a3b7",
      dash: [2, 4],
    })),
    ...levels,
  ];
  const arrangedLevels = arrangeWeeklyLevelLabels(drawableLevels, yFor, height);

  drawGrid(context, width, height, padding);
  drawWeeklyRiskBand(context, width, padding, rightPadding, levels, yFor);
  arrangedLevels.forEach((level) => {
    drawWeeklyLevel(context, width, padding, rightPadding, yFor(level.value), level, level.labelY);
  });

  drawSeries(context, pathValues, xFor, yFor, "#17202a", 2.8, []);
  drawWeeklyPoints(context, pathValues, xFor, yFor);

  context.fillStyle = "#637083";
  context.font = "11px Segoe UI, sans-serif";
  context.textAlign = "left";
  context.fillText(`평균 ${formatNum(avgEntry, 2)}`, padding, 15);
  context.textAlign = "right";
  context.fillText(`자리이동 최대 ${formatNum(scope.max_switch_attempts, 0)}회`, width - padding, height - 8);
}

function weeklyAverageEntry(entry, loss) {
  const explicitAverage = number(entry.expected_average_if_all_filled);
  if (explicitAverage) return explicitAverage;
  const ladder = entry.order_ladder || [];
  const weighted = ladder.reduce((sum, order) => sum + (number(order.limit_price) || 0) * (number(order.contracts) || 0), 0);
  const contracts = ladder.reduce((sum, order) => sum + (number(order.contracts) || 0), 0);
  if (contracts > 0) return weighted / contracts;
  return number(loss.example_entry_price) || 1.58;
}

function drawWeeklyRiskBand(context, width, padding, rightPadding, levels, yFor) {
  const stop = levels.find((level) => level.key === "stop_30");
  const switchLine = levels.find((level) => level.key === "switch_prepare_25");
  if (!stop || !switchLine) return;
  const top = Math.min(yFor(stop.value), yFor(switchLine.value));
  const bottom = Math.max(yFor(stop.value), yFor(switchLine.value));
  context.save();
  context.fillStyle = "rgba(182, 80, 74, 0.08)";
  context.fillRect(padding, top, Math.max(0, width - padding - rightPadding), bottom - top);
  context.fillStyle = "#9b3c36";
  context.font = "10px Segoe UI, sans-serif";
  context.textAlign = "left";
  context.fillText("방어/자리이동 구간", padding + 6, Math.min(bottom - 4, top + 13));
  context.restore();
}

function arrangeWeeklyLevelLabels(levels, yFor, height) {
  const minGap = 17;
  const top = 14;
  const bottom = height - 15;
  const arranged = levels
    .map((level) => ({ ...level, lineY: yFor(level.value), labelY: Math.max(top, Math.min(yFor(level.value), bottom)) }))
    .sort((a, b) => a.labelY - b.labelY);
  for (let index = 1; index < arranged.length; index += 1) {
    if (arranged[index].labelY - arranged[index - 1].labelY < minGap) {
      arranged[index].labelY = arranged[index - 1].labelY + minGap;
    }
  }
  const overflow = arranged.length ? arranged[arranged.length - 1].labelY - bottom : 0;
  if (overflow > 0) {
    for (let index = arranged.length - 1; index >= 0; index -= 1) {
      arranged[index].labelY -= overflow;
      if (index < arranged.length - 1 && arranged[index + 1].labelY - arranged[index].labelY < minGap) {
        arranged[index].labelY = arranged[index + 1].labelY - minGap;
      }
    }
  }
  return arranged.map((level) => ({
    ...level,
    labelY: Math.max(top, Math.min(level.labelY, bottom)),
  }));
}

function drawWeeklyLevel(context, width, padding, rightPadding, y, level, labelY = y) {
  const color = level.color || "#637083";
  context.save();
  context.strokeStyle = color;
  context.lineWidth = level.key === "entry_average" ? 1.5 : 1.05;
  context.setLineDash(level.dash || (level.key?.includes("stop") || level.key?.includes("switch") ? [5, 4] : []));
  context.beginPath();
  context.moveTo(padding, y);
  context.lineTo(width - rightPadding, y);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = color;
  context.font = "10px Segoe UI, sans-serif";
  context.textAlign = "left";
  if (Math.abs(labelY - y) > 7) {
    context.strokeStyle = "rgba(99, 112, 131, 0.35)";
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(width - rightPadding + 1, y);
    context.lineTo(width - rightPadding + 4, labelY);
    context.stroke();
  }
  context.fillText(`${level.label || level.key}`, width - rightPadding + 5, labelY - 2);
  context.fillText(formatNum(level.value, 2), width - rightPadding + 5, labelY + 10);
  context.restore();
}

function drawWeeklyPoints(context, values, xFor, yFor) {
  const labels = {
    0: "관찰",
    3: "방어",
    4: "이동",
    7: "청산",
    9: "목표",
  };
  context.save();
  values.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    context.fillStyle = index >= 7 ? "#2d8f64" : index >= 3 && index <= 4 ? "#d89216" : "#17202a";
    context.beginPath();
    context.arc(x, y, 3.5, 0, Math.PI * 2);
    context.fill();
    if (labels[index]) {
      context.font = "10px Segoe UI, sans-serif";
      context.textAlign = "center";
      context.fillText(labels[index], x, Math.max(11, y - 8));
    }
  });
  context.restore();
}

function drawIndexBlueprint() {
  const canvas = document.querySelector("#indexChart");
  if (!canvas) return;
  const { context, width, height } = setupCanvas(canvas, 280);
  context.clearRect(0, 0, width, height);

  const high = 1344.55;
  const low = 1276.8;
  const levels = {
    "61.8": high - (high - low) * 0.618,
    "80.9": high - (high - low) * 0.809,
    "100": low,
    "103": high - (high - low) * 1.03,
    "105": high - (high - low) * 1.05,
  };
  const resetRule = (state.indexStrategy || defaultIndexStrategy).fibonacci?.reset_on_break || {};
  const resetExample = resetRule.example || {};
  const resetHigh = number(resetExample.reset_high) || 1309.36;
  const reset618 = number(resetExample.previous_low_reset_618) || levels["100"];
  const reset100 = number(resetExample.reset_100) || resetHigh - ((resetHigh - reset618) / 0.618);
  const resetMid = number(resetExample.reset_mid_618_100) || (reset618 + reset100) / 2;
  const resetLevels = {
    "리셋 61.8": reset618,
    "리셋 중심": resetMid,
    "리셋 100": reset100,
  };
  const prices = [1298, 1306, 1320, 1332, 1325, 1311, 1301, 1290, 1278, 1274, 1283, 1292, 1300, 1308];
  const gma30 = prices.map((value, index) => 1286 + index * 1.35);
  const gma50 = prices.map((value, index) => 1274 + index * 0.82);
  const allValues = [...prices, ...gma30, ...gma50, ...Object.values(levels), resetHigh, ...Object.values(resetLevels)];
  const padding = 26;
  const min = Math.min(...allValues) - 4;
  const max = Math.max(...allValues) + 4;
  const span = max - min || 1;
  const xFor = (index) => padding + index * ((width - padding * 2) / Math.max(prices.length - 1, 1));
  const yFor = (value) => height - padding - ((value - min) / span) * (height - padding * 2);

  drawGrid(context, width, height, padding);
  drawHorizontalLevel(context, width, padding, yFor(levels["61.8"]), "61.8", levels["61.8"], "#2d8f64");
  drawHorizontalLevel(context, width, padding, yFor(levels["80.9"]), "80.9", levels["80.9"], "#2d8f64");
  drawHorizontalLevel(context, width, padding, yFor(levels["100"]), "100", levels["100"], "#d89216");
  drawHorizontalLevel(context, width, padding, yFor(levels["103"]), "103", levels["103"], "#d89216");
  drawHorizontalLevel(context, width, padding, yFor(levels["105"]), "105", levels["105"], "#b6504a");
  drawHorizontalLevel(context, width, padding, yFor(resetLevels["리셋 61.8"]), "리셋 61.8", resetLevels["리셋 61.8"], "#6d5bd0");
  drawHorizontalLevel(context, width, padding, yFor(resetLevels["리셋 중심"]), "리셋 중심", resetLevels["리셋 중심"], "#8a63d2");
  drawHorizontalLevel(context, width, padding, yFor(resetLevels["리셋 100"]), "리셋 100", resetLevels["리셋 100"], "#6d5bd0");
  drawSeries(context, gma50, xFor, yFor, "#95a3b7", 2, [6, 4]);
  drawSeries(context, gma30, xFor, yFor, "#008c8c", 2.2, []);
  drawSeries(context, prices, xFor, yFor, "#17202a", 2.8, []);
  drawResetBlueprint(context, width, padding, xFor, yFor, resetHigh, reset618, resetMid, reset100);

  const lastX = xFor(prices.length - 1);
  const lastY = yFor(prices[prices.length - 1]);
  context.fillStyle = "#008c8c";
  context.beginPath();
  context.arc(lastX, lastY, 4, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#637083";
  context.font = "11px Segoe UI, sans-serif";
  context.textAlign = "left";
  context.fillText("샘플 흐름", padding, 15);
  context.textAlign = "right";
  context.fillText("실시간 데이터 연결 전", width - padding, height - 8);
}

function drawResetBlueprint(context, width, padding, xFor, yFor, resetHigh, reset618, resetMid, reset100) {
  const anchorX = xFor(9);
  const highX = xFor(6);
  const midX = xFor(10.6);
  const lowX = xFor(12);
  context.save();
  context.strokeStyle = "rgba(109, 91, 208, 0.58)";
  context.lineWidth = 1.2;
  context.setLineDash([5, 4]);
  context.beginPath();
  context.moveTo(highX, yFor(resetHigh));
  context.lineTo(anchorX, yFor(reset618));
  context.lineTo(midX, yFor(resetMid));
  context.lineTo(lowX, yFor(reset100));
  context.stroke();

  const wickX = xFor(11.15);
  const wickTop = yFor(resetMid + 3);
  const wickLow = yFor(resetMid - 5);
  const bodyTop = yFor(resetMid + 2);
  const bodyBottom = yFor(resetMid + 0.3);
  context.setLineDash([]);
  context.strokeStyle = "#008c8c";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(wickX, wickTop);
  context.lineTo(wickX, wickLow);
  context.stroke();
  context.fillStyle = "#008c8c";
  context.fillRect(wickX - 4, Math.min(bodyTop, bodyBottom), 8, Math.max(4, Math.abs(bodyBottom - bodyTop)));
  context.fillStyle = "#17202a";
  context.font = "10px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.fillText("밑꼬리 확인", wickX, Math.min(wickTop, bodyTop) - 7);

  context.fillStyle = "#6d5bd0";
  [
    { x: highX, y: yFor(resetHigh), label: "새 고가" },
    { x: anchorX, y: yFor(reset618), label: "직전 저가=61.8" },
    { x: midX, y: yFor(resetMid), label: "콜 2~3계약" },
    { x: lowX, y: yFor(reset100), label: "새 100" },
  ].forEach((point) => {
    context.beginPath();
    context.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
    context.fill();
    context.font = "10px Segoe UI, sans-serif";
    context.textAlign = point.x > width * 0.72 ? "right" : "center";
    context.fillText(point.label, point.x, Math.max(11, point.y - 8));
  });
  context.fillStyle = "#637083";
  context.textAlign = "left";
  context.fillText("이탈 시 고저 재셋업", padding, 29);
  context.restore();
}

function drawHorizontalLevel(context, width, padding, y, label, value, color) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1.1;
  context.setLineDash(label === "105" ? [4, 4] : []);
  context.beginPath();
  context.moveTo(padding, y);
  context.lineTo(width - padding, y);
  context.stroke();
  context.fillStyle = color;
  context.font = "10px Segoe UI, sans-serif";
  context.textAlign = "right";
  context.fillText(`${label} ${formatNum(value, 2)}`, width - padding, Math.max(12, y - 3));
  context.restore();
}

function drawSeries(context, values, xFor, yFor, color, width, dash) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.setLineDash(dash);
  context.beginPath();
  values.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.restore();
}

function pricePointsForRow(row) {
  if (Array.isArray(row.price_history) && row.price_history.length >= 2) {
    return row.price_history
      .map((point, index) => ({
        date: point.date || `D-${row.price_history.length - index - 1}`,
        close: number(point.close),
      }))
      .filter((point) => point.close != null);
  }
  return synthesizePricePoints(row);
}

function synthesizePricePoints(row) {
  const lastClose = number(row.last_close ?? row.close) ?? 100;
  const anchors = [
    { index: 0, value: historicalClose(lastClose, row.ret_63d ?? row.ret_21d) },
    { index: 42, value: historicalClose(lastClose, row.ret_21d) },
    { index: 58, value: historicalClose(lastClose, row.ret_5d) },
    { index: 62, value: historicalClose(lastClose, row.ret_1d) },
    { index: 63, value: lastClose },
  ];
  const points = [];
  for (let index = 0; index <= 63; index += 1) {
    let leftIndex = 0;
    for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex += 1) {
      if (anchors[anchorIndex].index <= index) leftIndex = anchorIndex;
    }
    const left = anchors[leftIndex];
    const right = anchors[Math.min(leftIndex + 1, anchors.length - 1)];
    const span = Math.max(1, right.index - left.index);
    const ratio = Math.min(1, Math.max(0, (index - left.index) / span));
    const close = left.value + (right.value - left.value) * ratio;
    points.push({ date: index === 63 ? "현재" : `D-${63 - index}`, close: round(close, 4) });
  }
  return points;
}

function historicalClose(lastClose, returnValue) {
  const ret = number(returnValue) ?? 0;
  if (ret <= -0.95) return lastClose;
  return lastClose / (1 + ret);
}

function computeChartLines(points, row) {
  const chart = chartDefinition("stock_price");
  const close = points.map((point) => point.close);
  return (chart.lines || defaultChartConfig.charts.stock_price.lines).map((config) => ({
    ...config,
    values: valuesForFormula(config.formula, close, row),
  }));
}

function valuesForFormula(formula, close, row) {
  const text = String(formula || "close").trim();
  if (text === "close") return close;

  const movingAverage = text.match(/^(sma|ema)\(\s*close\s*,\s*(\d+)\s*\)$/i);
  if (movingAverage) {
    const windowSize = Number(movingAverage[2]);
    return movingAverage[1].toLowerCase() === "ema" ? ema(close, windowSize) : sma(close, windowSize);
  }

  const value = evaluateNumberFormula(text, row);
  return close.map(() => value);
}

function sma(values, windowSize) {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const sample = values.slice(start, index + 1).filter((value) => value != null);
    return sample.length ? sample.reduce((sum, value) => sum + value, 0) / sample.length : null;
  });
}

function ema(values, windowSize) {
  const multiplier = 2 / (windowSize + 1);
  let previous = values[0] ?? null;
  return values.map((value) => {
    if (value == null) return previous;
    previous = previous == null ? value : value * multiplier + previous * (1 - multiplier);
    return previous;
  });
}

function evaluateChartSignal(row, lines) {
  if (row.final_action === "unscored" || row.score == null) {
    return {
      label: "미분석",
      className: "neutral",
      text: "현재 알고리즘 결과가 없는 종목입니다. 데이터가 생성되면 같은 공식선으로 신호를 다시 계산합니다.",
    };
  }

  const latest = latestScope(row, lines);
  const rules = chartDefinition("stock_price").signal_rules || [];
  const matched = rules.find((rule) => evaluateCondition(rule.condition, latest));
  if (matched) {
    return {
      label: matched.label,
      className: signalClass(matched.signal),
      text: matched.text,
    };
  }

  const fallback = signalForRow(row);
  return {
    label: fallback.label,
    className: fallback.className,
    text: `${row.reason || "알고리즘 신호를 확인하세요."} 공식선을 바꾸면 설명도 새 조건 기준으로 달라집니다.`,
  };
}

function latestScope(row, lines) {
  const scope = {
    score: number(row.score) ?? 0,
    risk_score: number(row.risk_score) ?? 0,
    issue_score: number(row.issue_score) ?? 0,
    momentum_score: number(row.momentum_score) ?? 0,
    liquidity_score: number(row.liquidity_score) ?? 0,
    last_close: number(row.last_close ?? row.close) ?? 0,
  };
  lines.forEach((line) => {
    scope[line.key] = latestFinite(line.values) ?? 0;
  });
  if (scope.close == null) scope.close = scope.last_close;
  return scope;
}

function evaluateNumberFormula(formula, row) {
  const scope = {
    last_close: number(row.last_close ?? row.close) ?? 0,
    score: number(row.score) ?? 0,
    risk_score: number(row.risk_score) ?? 0,
    issue_score: number(row.issue_score) ?? 0,
    momentum_score: number(row.momentum_score) ?? 0,
    liquidity_score: number(row.liquidity_score) ?? 0,
  };
  return safeEvaluate(formula, scope, 0);
}

function evaluateCondition(condition, scope) {
  if (!condition) return false;
  return Boolean(safeEvaluate(condition, scope, false));
}

function safeEvaluate(expression, scope, fallback) {
  const normalized = String(expression)
    .replace(/\band\b/gi, "&&")
    .replace(/\bor\b/gi, "||");
  if (!/^[\w\s.<>=!&|()+\-*/%]+$/.test(normalized)) return fallback;
  try {
    const keys = Object.keys(scope);
    const values = keys.map((key) => scope[key]);
    return Function(...keys, `"use strict"; return (${normalized});`)(...values);
  } catch (error) {
    return fallback;
  }
}

function drawStockChart(canvas, points, lines) {
  if (!canvas) return;
  const chart = chartDefinition("stock_price");
  const { context, width, height } = setupCanvas(canvas, chart.height || 260);
  context.clearRect(0, 0, width, height);
  if (!points.length) {
    drawEmpty(context, width, height, chart.empty_message || "차트 자료가 없습니다.");
    return;
  }

  const padding = Number(chart.padding ?? 22);
  const allValues = lines.flatMap((line) => line.values).filter((value) => Number.isFinite(value));
  if (!allValues.length) {
    drawEmpty(context, width, height, chart.empty_message || "차트 자료가 없습니다.");
    return;
  }
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const xFor = (index) => padding + index * ((width - padding * 2) / Math.max(points.length - 1, 1));
  const yFor = (value) => height - padding - ((value - min) / span) * (height - padding * 2);

  drawGrid(context, width, height, padding);
  lines.forEach((line) => {
    context.save();
    context.strokeStyle = line.color || "#17202a";
    context.lineWidth = Number(line.width || 1.6);
    context.setLineDash(line.dash || []);
    context.beginPath();
    let started = false;
    line.values.forEach((value, index) => {
      if (!Number.isFinite(value)) return;
      const x = xFor(index);
      const y = yFor(value);
      if (!started) {
        context.moveTo(x, y);
        started = true;
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
    context.restore();
  });

  context.fillStyle = paletteColor("text", "#637083");
  context.font = "11px Segoe UI, sans-serif";
  context.textAlign = "left";
  context.fillText(formatNum(min, 0), padding, height - 6);
  context.textAlign = "right";
  context.fillText(formatNum(max, 0), width - padding, 14);
}

function drawGrid(context, width, height, padding) {
  context.strokeStyle = paletteColor("grid", "#dfe5ea");
  context.lineWidth = 1;
  context.setLineDash([]);
  for (let index = 0; index < 4; index += 1) {
    const y = padding + index * ((height - padding * 2) / 3);
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }
}

function drawEmptyChart(canvas, message) {
  if (!canvas) return;
  const { context, width, height } = setupCanvas(canvas, chartDefinition("stock_price").height || 260);
  context.clearRect(0, 0, width, height);
  drawEmpty(context, width, height, message || "차트 자료가 없습니다.");
}

function setupCanvas(canvas, height) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width || canvas.parentElement?.clientWidth || 320;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(cssWidth * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  canvas.setAttribute("height", String(height));
  const context = canvas.getContext("2d");
  context.setTransform(scale, 0, 0, scale, 0, 0);
  return { context, width: cssWidth, height };
}

function drawEmpty(context, width, height, message) {
  context.fillStyle = paletteColor("text", "#637083");
  context.font = "14px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.fillText(message, width / 2, height / 2);
}

function renderLegend(lines) {
  const legend = document.querySelector("#chartLegend");
  legend.innerHTML = lines.map((line) => `
    <span style="color:${escapeAttr(line.color || "#17202a")}"><i></i>${escapeHtml(line.label || line.key)}</span>
  `).join("");
}

function chartDefinition(name) {
  return state.chartConfig?.charts?.[name] || defaultChartConfig.charts[name] || {};
}

function displaySetting(key, fallback) {
  const value = state.chartConfig?.display?.[key] ?? defaultChartConfig.display[key];
  return value == null ? fallback : value;
}

function paletteColor(key, fallback) {
  return state.chartConfig?.palette?.[key] || defaultChartConfig.palette[key] || fallback;
}

function mergeChartConfig(config) {
  return {
    ...defaultChartConfig,
    ...config,
    palette: { ...defaultChartConfig.palette, ...(config.palette || {}) },
    charts: { ...defaultChartConfig.charts, ...(config.charts || {}) },
    display: { ...defaultChartConfig.display, ...(config.display || {}) },
  };
}

function signalClass(signal) {
  return {
    buy: "buy",
    candidate: "buy",
    warning: "warning",
    watch: "warning",
    sell: "sell",
    avoid: "sell",
  }[signal] || "neutral";
}

function latestFinite(values) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) return values[index];
  }
  return null;
}

function number(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits) {
  return Number(value.toFixed(digits));
}

function renderError(error) {
  document.querySelector("#marketSummary").textContent = error.message;
  document.querySelector("#candidateList").innerHTML = `<button class="stock-row empty" type="button">데이터를 불러오지 못했습니다.</button>`;
  drawEmptyChart(document.querySelector("#stockChart"), "데이터를 불러오지 못했습니다.");
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

window.addEventListener("resize", () => {
  if (state.mode === "index") drawIndexBlueprint();
  else if (state.mode === "weekly") drawWeeklyBlueprint();
  else if (state.mode === "stocks") renderSelectedChart();
});

init();
