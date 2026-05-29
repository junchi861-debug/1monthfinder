# 1개월 보유 주식 후보 탐색기

티커 목록을 넣으면 과거 가격 데이터를 내려받아 **약 1개월(기본 21거래일) 보유 후 매도**를 전제로 후보를 점수화하고 리포트를 만드는 작은 리서치 도구입니다.

> 주의: 이 프로젝트는 투자 조언이나 수익 보장을 위한 도구가 아닙니다. 매매 전에는 반드시 본인 기준의 리스크 관리, 수수료/세금, 유동성, 뉴스/공시 확인이 필요합니다.

## 설치

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 티커 준비

`config/watchlist.csv`에 분석할 티커를 넣습니다.

```csv
symbol,name
AAPL,Apple
MSFT,Microsoft
005930.KS,Samsung Electronics
```

한국 주식은 Yahoo Finance 기준으로 코스피 `.KS`, 코스닥 `.KQ` 접미사를 붙입니다.

## 후보 리포트 생성

```powershell
python -m stock_finder.cli candidates --watchlist config/watchlist.csv --out reports/candidates.csv
```

주요 출력 컬럼:

- `score`: 0~100 후보 점수
- `expected_action`: 기본 판단값. `candidate`, `watch`, `avoid`
- `ret_21d`, `ret_63d`: 최근 1개월/3개월 수익률
- `vol_21d`: 최근 1개월 변동성
- `max_drawdown_63d`: 최근 3개월 최대 낙폭
- `rsi_14`: RSI
- `liquidity_score`: 거래대금 기반 유동성 점수

## 간단 백테스트

과거 특정 시점마다 상위 후보를 샀다가 21거래일 후 매도했다고 가정합니다.

```powershell
python -m stock_finder.cli backtest --watchlist config/watchlist.csv --out reports/backtest.csv
```

## 기본 전략 아이디어

이 MVP의 점수는 다음 성향을 선호합니다.

- 최근 1개월/3개월 모멘텀이 양호한 종목
- 단기 변동성과 낙폭이 과도하지 않은 종목
- RSI가 과열 구간에 치우치지 않은 종목
- 거래대금이 너무 작지 않은 종목

처음에는 이 규칙을 그대로 믿기보다, 백테스트 결과를 보고 시장/업종별로 기준을 조정하는 식으로 쓰는 것이 좋습니다.

## 모바일 웹앱 실행

웹앱은 `site/` 폴더에 있는 정적 화면을 로컬 장치가 직접 서빙합니다.

웹사이트는 첫 화면에서 `위클리 옵션` 전략을 보여줍니다. KOSPI200 지수 매매 조건을 옵션 행사가, 프리미엄, 분할진입, 청산, 손절 기준으로 바꿔 확인하는 화면입니다.

국내 주식 후보와 보유 종목 차트는 `종목 신호` 탭에서 계속 확인할 수 있습니다. 이 데이터는 `site/data/market_report.json`을 우선 읽으며, KOSPI/KOSDAQ 전체를 모데이터로 가져온 뒤 거래대금 상위 분석군에 대해 1일, 1주, 1달, 1년 전략을 계산합니다.

PC에서 바로 실행하려면 PowerShell에서 다음 명령을 사용합니다.

```powershell
.\scripts\run_pc_server.ps1
```

브라우저에서 `http://localhost:8000/site/`를 열면 됩니다.

처음 접속하면 위클리 옵션 탭이 열립니다. 지수 매매 화면은 `http://localhost:8000/site/#index`, 국내 주식 후보 화면은 `http://localhost:8000/site/#stocks` 또는 `http://localhost:8000/site/#overview`로 바로 열 수 있습니다.

다른 기기에서 같은 Wi-Fi로 접속하려면 PC의 내부 IP를 확인한 뒤 `http://PC_IP:8000/site/`로 접속합니다.

시작할 때 데이터를 한 번 다시 만들고 싶으면 다음처럼 실행합니다.

```powershell
.\scripts\run_pc_server.ps1 -BuildOnStart
```

일정 간격으로 PC가 직접 데이터를 다시 만들게 하려면 분 단위 간격을 지정합니다.

```powershell
.\scripts\run_pc_server.ps1 -RefreshMinutes 5
```

Android 스마트폰에서는 Termux 같은 Python 실행 환경에서 저장소를 받은 뒤 다음 명령을 사용합니다.

```sh
sh scripts/run_phone_server.sh
```

처음 설치하는 폰이라면 웹앱의 `설정 -> 안드로이드 백엔드 -> 설치 복사`를 누른 뒤 Termux에 붙여넣어 실행할 수 있습니다. 같은 명령을 직접 입력하려면 다음과 같습니다.

```sh
pkg update -y && pkg upgrade -y && pkg install -y git python
python - <<'PY'
from pathlib import Path
from urllib.request import urlopen
url = 'https://raw.githubusercontent.com/junchi861-debug/1monthfinder/main/scripts/install_android_backend.sh'
Path.home().joinpath('install_1monthfinder.sh').write_bytes(urlopen(url, timeout=60).read())
PY
NO_START=1 sh "$HOME/install_1monthfinder.sh"
```

설치가 끝난 뒤에는 Termux에서 아래 명령으로 다시 켤 수 있습니다.

```sh
export PATH="$PREFIX/bin:$HOME/.local/bin:$PATH"
BACKEND_BIN="$(command -v 1monthfinder-backend || printf "%s" "${PREFIX:-$HOME/.local}/bin/1monthfinder-backend")"
echo "$BACKEND_BIN"
"$BACKEND_BIN" doctor
"$BACKEND_BIN" status || "$BACKEND_BIN"
```

현재 옵션 감시는 공개 분봉만 사용하므로 API 키가 필요 없습니다. 향후 키움 API를 붙일 때 사용할 환경 변수 초안은 `config/backend.env.example`에 있으며, 모바일 웹앱 설정의 `향후 API 크레덴셜` 칸에도 같은 템플릿을 저장해 둘 수 있습니다.

같은 스마트폰 브라우저에서는 `http://127.0.0.1:8000/site/`로 접속하고, 같은 Wi-Fi의 다른 기기에서는 `http://스마트폰IP:8000/site/`로 접속합니다.

직접 명령을 실행하고 싶다면 공통 서버 명령은 다음과 같습니다.

```powershell
python -m stock_finder.cli serve --host 0.0.0.0 --port 8000
```

데이터 갱신까지 같이 돌릴 때는 다음 옵션을 붙입니다.

```powershell
python -m stock_finder.cli serve --host 0.0.0.0 --port 8000 --build-on-start --refresh-minutes 5
```

## 설정 JSON 위치

알고리즘 공식과 차트 표시 기준은 찾기 쉽게 `config/` 아래에 분리했습니다.

- `config/algorithms/market_signals.json`: 기간, 알고리즘 목록, 점수 구성요소, 가중치, 매수/경고/매도 신호 기준, 후보 임계값, 백테스트 검증 기준
- `config/algorithms/index_trading.json`: KOSPI200 지수/선물 매매용 30/50 기하이평, 피보나치, 일목선, 분할진입, 청산, 손절 상태 정의
- `config/algorithms/weekly_options.json`: 위클리 옵션용 당일 손실 한도, 3계약 분할진입, 행사가/프리미엄 선택, 부분청산, 잔량 운용 기준
- `config/charts/dashboard.json`: 종목 차트 공식선, 신호 설명 규칙, 차트 색상, 차트 높이, 후보 표시 수
- `site/data/index_trading.json`: 웹앱의 `지수 매매` 탭에서 바로 읽는 표시용 설정
- `site/data/weekly_options.json`: 웹앱의 `위클리 옵션` 탭에서 바로 읽는 표시용 설정

## 증권 API 연결 제안

증권 API를 붙여 실제 조회와 주문까지 확장하는 것은 가능합니다. 다만 초기에는 바로 자동주문으로 가지 않고 `조회 전용 -> 모의/가상 주문 -> 수동 승인 주문 -> 제한적 자동주문` 순서로 가는 것을 권장합니다.

구체적인 연결 구조와 안전장치는 `broker_api_plan.txt`에 정리했습니다.

공식을 바꾼 뒤에는 대시보드 데이터를 다시 생성합니다.

```powershell
.\.venv\Scripts\python.exe -m stock_finder.cli market --out-dir site/data --domestic-limit 250 --years 3
```

다른 JSON 파일을 실험하고 싶으면 다음처럼 경로를 넘길 수 있습니다.

```powershell
.\.venv\Scripts\python.exe -m stock_finder.cli market --strategy-config config/algorithms/market_signals.json --chart-config config/charts/dashboard.json --out-dir site/data
```

GitHub Actions는 더 이상 데이터 생성이나 배포에 사용하지 않습니다. 장중 신호는 PC 또는 스마트폰이 직접 계산하고, 화면도 같은 장치가 서빙하는 구조로 가져갑니다.

국내 주식 대시보드 데이터는 다음 명령으로 만들 수 있습니다.

```powershell
.\.venv\Scripts\python.exe -m stock_finder.cli market --out-dir site/data --domestic-limit 250 --years 3
```

기존 샘플 watchlist 기반 데이터는 다음 명령으로 만들 수 있습니다.

```powershell
.\.venv\Scripts\python.exe -m stock_finder.cli daily --watchlist config/watchlist.csv --out-dir site/data
```

웹에서 확인할 수 있는 항목:

- KOSPI/KOSDAQ 전체 모데이터 규모
- 1일, 1주, 1달, 1년 기간별 최종 후보
- 모데이터에서 후보군이 좁혀지는 단계
- 전체 원자료와 분석 여부
- 과거 동일 규칙으로 거래했을 때의 승률, 평균 수익률, 최대 낙폭, 성공/실패 사례
- 검증된 필터와 이슈/커뮤니티형 관심도 보조 필터
