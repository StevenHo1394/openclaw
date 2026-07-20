---
name: "crypto-price-prediction"
description: "Fetches next-hour predicted price for BTC/ETH from external API (zeabur). Supports BTCUSDT and ETHUSDT symbols only."
version: "1.0.0"
author: "Hermes Agent"
license: "MIT"
metadata:
  hermes:
    tags: [mlops, crypto, prediction, trading, api]
    related_skills: []
---

# Crypto Price Prediction Skill

Fetches **next-hour predicted price** for BTC or ETH from an external prediction API (hosted on zeabur). Not a local technical analysis model — just an API wrapper.

- **API source**: `https://myfastapi.zeabur.app/v1/demo/predictions/next_hour/{BTC|ETH}`
- **Symbols supported**: `BTCUSDT`, `ETHUSDT` only
- **Horizon**: 1 hour (fixed — API limitation)
- **Output**: Predicted price at next hour mark (HKT)

**Repository:** https://github.com/StevenHo1394/openclaw/tree/main/skills/crypto-price-prediction

## When to Use

- Quick next-hour price check for BTC/ETH
- When you want an external model's prediction instead of local TA

## Not For

- Other symbols (SOL, BNB, etc.)
- Horizons other than 1 hour
- Local technical analysis (no Binance/CoinGecko fallback here)

## Installation

Self-contained. Python 3.8+ stdlib only. Node.js 18+ for OpenClaw wrapper.

## Usage

### Hermes CLI
```bash
# BTC next-hour prediction
hermes skill run crypto-price-prediction --symbol BTCUSDT --hours 1

# ETH next-hour prediction
hermes skill run crypto-price-prediction --symbol ETHUSDT --hours 1
```

### OpenClaw API
```javascript
const { predictPrice } = require('./skill.js').tools;

const result = await predictPrice({ symbol: 'BTCUSDT', hours: 1 });
// Returns structured prediction object
```

### Direct Python
```bash
cd /opt/data/skills/mlops/crypto-price-prediction
TZ=Asia/Hong_Kong python3 scripts/predict.py --coin BTC
TZ=Asia/Hong_Kong python3 scripts/predict.py --coin ETH
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `--symbol` | string | `BTCUSDT` | Trading pair: `BTCUSDT` or `ETHUSDT` |
| `--hours` | number | `1.0` | Horizon (API only supports 1h) |

## Output Example

```
Predicted price of BTC at 2026-07-20 18:00 HKT: $64,063.70
```

Structured JSON (OpenClaw):
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

## API Details

- **Endpoint**: `GET https://myfastapi.zeabur.app/v1/demo/predictions/next_hour/{BTC|ETH}`
- **Response**: `{"BTC predicted price (next_hour)": 64063.6992}` (float)
- **Rate limit**: Unknown — use reasonably
- **Timezone**: Predictions target next hour mark in HKT (UTC+8)

## Troubleshooting

- **API timeout/unreachable**: Check network access to `myfastapi.zeabur.app`
- **Invalid symbol**: Only `BTCUSDT`/`ETHUSDT` accepted
- **Non-1h horizon**: API only provides next-hour; `--hours` other than 1 logs warning

## Version History

### v1.0.0 (Initial)
- BTC/ETH next-hour prediction via external API
- Hermes CLI + OpenClaw plugin
- HKT timezone handling

## Disclaimer

**Not financial advice.** External API predictions are opaque — no visibility into methodology. Use at your own risk.

## License

MIT