#!/usr/bin/env python3
"""Fetch next-hour predicted price for BTC/ETH from external API."""
import sys
import argparse
import urllib.request
import json
from datetime import datetime, timezone, timedelta

API_BASE = "https://myfastapi.zeabur.app/v1/demo/predictions/next_hour"
VALID_COINS = ["BTC", "ETH"]

def get_hkt_now():
    return datetime.now(timezone(timedelta(hours=8)))

def fetch_prediction(coin: str) -> float:
    url = f"{API_BASE}/{coin.upper()}"
    req = urllib.request.Request(url, headers={"User-Agent": "crypto-price-prediction/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
        key = f"{coin.upper()} predicted price (next_hour)"
        return data[key]

def main():
    parser = argparse.ArgumentParser(description="Fetch next-hour predicted price")
    parser.add_argument("--coin", required=True, choices=VALID_COINS, help="Coin: BTC or ETH")
    args = parser.parse_args()

    try:
        price = fetch_prediction(args.coin)
        next_hour = get_hkt_now().replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        print(f"Predicted price of {args.coin} at {next_hour.strftime('%Y-%m-%d %H:%M')} HKT: ${price:,.2f}")
    except urllib.error.HTTPError as e:
        print(f"API error ({e.code}): {e.read().decode()}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()