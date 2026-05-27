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

웹사이트는 `site/data/market_report.json`을 우선 읽어 국내 주식, 미국 주식, 코인으로 나눈 대시보드를 보여줍니다. 현재 자동 계산이 연결된 자산군은 국내 주식이며, KOSPI/KOSDAQ 전체를 모데이터로 가져온 뒤 거래대금 상위 분석군에 대해 1일, 1주, 1달, 1년 전략을 계산합니다.

국내 주식 대시보드 데이터는 다음 명령으로 만들 수 있습니다.

```powershell
.\.venv\Scripts\python.exe -m stock_finder.cli market --out-dir site/data --domestic-limit 250 --years 3
```

기존 샘플 watchlist 기반 데이터는 다음 명령으로 만들 수 있습니다.

```powershell
.\.venv\Scripts\python.exe -m stock_finder.cli daily --watchlist config/watchlist.csv --out-dir site/data
```

GitHub Pages 배포는 `.github/workflows/pages.yml`이 담당합니다. 이 워크플로는 다음 경우 실행됩니다.

- `main` 브랜치에 push
- 매일 23:30 KST
- GitHub Actions에서 수동 실행

웹에서 확인할 수 있는 항목:

- KOSPI/KOSDAQ 전체 모데이터 규모
- 1일, 1주, 1달, 1년 기간별 최종 후보
- 모데이터에서 후보군이 좁혀지는 단계
- 전체 원자료와 분석 여부
- 과거 동일 규칙으로 거래했을 때의 승률, 평균 수익률, 최대 낙폭, 성공/실패 사례
- 검증된 필터와 이슈/커뮤니티형 관심도 보조 필터

GitHub 저장소에서 Pages를 처음 켤 때는 **Settings > Pages > Build and deployment > Source**를 **GitHub Actions**로 설정하세요.
