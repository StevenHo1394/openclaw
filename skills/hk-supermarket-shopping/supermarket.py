#!/usr/bin/env python3
"""
HK Supermarket Shopping Skill v1.0.0
Uses English Consumer Council pricewatch data. Secure, multilingual.
"""

import json, sys, os, time, subprocess, re, datetime
from pathlib import Path

DATA_DIR = Path("/home/node/.openclaw/workspace/skills/hk-supermarket-shopping-v1.0.0/data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATA_URL = "https://online-price-watch.consumer.org.hk/opw/opendata/pricewatch_en.csv"
TODAY = datetime.date.today()
MAX_QUERY_LENGTH = 200

def detect_language(text):
    if any('\u4e00' <= c <= '\u9fff' for c in text):
        return 'zh-HK'
    return 'en'

LOCALE = {
    'en': {
        'not_found': "Sorry, I couldn't find any products matching '{query}'.",
        'cheapest': "Cheapest options for '{query}':",
        'overall_cheapest': "🏆 Overall cheapest: {supermarket} - {product} (${price:.2f})",
        'budget_calc': "\n💰 With $100 you can buy {qty} items (remaining ${remain:.2f})",
        'no_price': "No price data available."
    },
    'zh-HK': {
        'not_found': "抱歉，找不到與'{query}'相關的產品。",
        'cheapest': "最平選項：",
        'overall_cheapest': "🏆 整體最平：{supermarket} - {product} (${price:.2f})",
        'budget_calc': "\n💰 用 $100 可以買 {qty} 件（剩餘 ${remain:.2f}）",
        'no_price': "沒有價格資料。"
    }
}

def log(msg):
    print(f"[{datetime.datetime.now().isoformat()}] {msg}", file=sys.stderr)

def download_pricewatch():
    for attempt in range(1, 3):
        try:
            log("Downloading pricewatch...")
            cmd = ["curl", "-s", "-S", "--http1.1", "-4",
                   "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                   "-H", "Accept: text/csv", DATA_URL]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise RuntimeError(f"curl error {result.returncode}")
            if not result.stdout.strip():
                raise ValueError("Empty response")
            return result.stdout
        except Exception as e:
            log(f"Download failed: {e}")
            if attempt < 2:
                time.sleep(2)
            return None

def ensure_data():
    today_file = DATA_DIR / f"pricewatch_en_{TODAY.strftime('%Y-%m-%d')}.csv"
    if today_file.exists() and today_file.stat().st_size > 1000:
        return str(today_file)
    content = download_pricewatch()
    if content:
        with open(today_file, 'w', encoding='utf-8') as f:
            f.write(content)
        return str(today_file)
    # fallback to any recent
    candidates = sorted(DATA_DIR.glob("pricewatch_en_*.csv"), key=lambda p: p.stat().st_mtime, reverse=True)
    if candidates:
        return str(candidates[0])
    return None

def housekeep():
    try:
        cutoff = TODAY - datetime.timedelta(days=7)
        for fp in DATA_DIR.glob("pricewatch_en_*.csv"):
            try:
                date_str = fp.stem.replace('pricewatch_en_', '')
                file_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
                if file_date < cutoff:
                    fp.unlink()
            except:
                continue
    except:
        pass

def load_csv(path):
    import csv
    data = []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i >= 10000:
                    break
                data.append(row)
        return data
    except:
        return []

def search_items(data, query):
    q = query.lower()
    results = []
    for item in data:
        name = item.get('Product Name', '').lower()
        brand = item.get('Brand', '').lower()
        cat1 = item.get('Category 1', '').lower()
        cat2 = item.get('Category 2', '').lower()
        if q in name or q in brand or q in cat1 or q in cat2:
            price_str = item.get('Price', '').replace('$', '').strip()
            try:
                price = float(price_str)
            except:
                price = None
            results.append({
                'name': item.get('Product Name', '').strip(),
                'supermarket': item.get('Supermarket Code', '').strip(),
                'price': price
            })
    return results

def cheapest_by_supermarket(results):
    by_sup = {}
    for r in results:
        if r['price'] is None:
            continue
        sup = r['supermarket']
        if sup not in by_sup or r['price'] < by_sup[sup]['price']:
            by_sup[sup] = r
    return dict(sorted(by_sup.items()))

def overall_cheapest(results):
    valid = [r for r in results if r['price'] is not None]
    return min(valid, key=lambda x: x['price']) if valid else None

def format_answer(query, results, lang):
    loc = LOCALE[lang]
    if not results:
        return loc['not_found'].format(query=query)
    by_sup = cheapest_by_supermarket(results)
    cheapest = overall_cheapest(results)
    lines = [f"'{query}' {loc['cheapest']}"]
    for sup, item in by_sup.items():
        lines.append(f"- {sup}: {item['name']} @ ${item['price']:.2f}")
    if cheapest:
        lines.append(loc['overall_cheapest'].format(
            supermarket=cheapest['supermarket'],
            product=cheapest['name'],
            price=cheapest['price']
        ))
        qty = int(100 // cheapest['price']) if cheapest['price'] > 0 else 0
        if qty > 0:
            lines.append(loc['budget_calc'].format(qty=qty, remain=100 - qty*cheapest['price']))
    else:
        lines.append(loc['no_price'])
    return "\n".join(lines)

def answer(query):
    if not query or len(query) > MAX_QUERY_LENGTH:
        return "Invalid query."
    data_path = ensure_data()
    if not data_path:
        return "Unable to retrieve price data. Please try again later."
    housekeep()
    data = load_csv(data_path)
    if not data:
        return "Data load failed."
    results = search_items(data, query)
    lang = detect_language(query)
    return format_answer(query, results, lang)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing query"}))
        sys.exit(1)
    query = sys.argv[1]
    try:
        reply = answer(query)
        print(json.dumps({"query": query, "answer": reply}, ensure_ascii=False))
    except:
        print(json.dumps({"error": "Internal error"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
