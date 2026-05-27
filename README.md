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

## 설명 웹사이트와 GitHub Pages

설명 웹사이트는 `site/` 폴더에 있습니다.

로컬에서는 `site/index.html`을 브라우저로 열면 됩니다. GitHub에 push하면 `.github/workflows/pages.yml` 워크플로가 `site/` 폴더를 GitHub Pages로 배포합니다.

GitHub 저장소에서 Pages를 처음 켤 때는 **Settings > Pages > Build and deployment > Source**를 **GitHub Actions**로 설정하세요.
