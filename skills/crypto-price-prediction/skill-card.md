# Crypto Price Prediction Skill Card

## Overview
Fetches next-hour predicted price for BTC/ETH from external API (zeabur). Simple API wrapper — not a local model.

## Compatibility
- **OpenClaw**: ✅ Native plugin (Node.js calls Python)
- **Hermes Agent**: ✅ Skill directory with SKILL.md + Python script
- **Runtime**: Python 3.8+ / Node.js 18+

## Installation

### OpenClaw
```bash
cp -r crypto-price-prediction ~/.openclaw/workspace/skills/
# No npm install needed
# Add to agent config or use openclaw configure
```

### Hermes Agent
```bash
# Auto-discovered at /opt/data/skills/mlops/crypto-price-prediction/
hermes skill run crypto-price-prediction --symbol BTCUSDT --hours 1
```

## Usage

### OpenClaw API
```javascript
const { predictPrice } = require('./skill.js').tools;
const result = await predictPrice({ symbol: 'BTCUSDT', hours: 1 });
```

### Hermes CLI
```bash
hermes skill run crypto-price-prediction --symbol BTCUSDT --hours 1
hermes skill run crypto-price-prediction --symbol ETHUSDT --hours 1
```

### Direct Python
```bash
python3 scripts/predict.py --coin BTC
python3 scripts/predict.py --coin ETH
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | `BTCUSDT` | `BTCUSDT` or `ETHUSDT` only |
| `hours` | number | `1.0` | Fixed at 1h (API limitation) |

## Output Schema

```json
{
  "timestamp": "2026-07-20 18:00 HKT",
  "symbol": "BTCUSDT",
  "horizonHours": 1,
  "currentPrice": null,
  "predictedPrice": 64063.70,
  "changePercent": null,
  "direction": "UNKNOWN",
  "confidence": "API",
  "dataSource": "zeabur-api",
  "signals": {}
}
```

## Supported Symbols
- `BTCUSDT` → queries BTC endpoint
- `ETHUSDT` → queries ETH endpoint

## Algorithm
1. Map symbol to coin (BTCUSDT→BTC, ETHUSDT→ETH)
2. Call `https://myfastapi.zeabur.app/v1/demo/predictions/next_hour/{coin}`
3. Parse float response: `{"BTC predicted price (next_hour)": 64063.6992}`
4. Return structured result with HKT timestamp for next hour mark

## Requirements
- Python 3.8+ (stdlib: `urllib`, `json`, `argparse`, `datetime`)
- Node.js 18+ (OpenClaw wrapper only)
- Internet access to `myfastapi.zeabur.app`

## Disclaimer
**Not financial advice.** External API predictions — methodology unknown. Use at your own risk.

## License
MIT