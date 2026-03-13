# HK Supermarket Shopping Skill (v1.0.0)

**Real-time price comparison for Hong Kong supermarkets** – powered by the Consumer Council's official daily pricewatch.

## What This Skill Actually Does

- **Searches** 6,000+ products across **Wellcome, ParknShop, AEON, Jasons, and more**
- **Finds the cheapest price** for any product you name (e.g., "Coke Zero", "soy milk", "frozen shrimp")
- **Tells you how many you can buy with $100** (or any budget) based on the cheapest price
- **Speaks your language** – if you ask in English, you get English; if you ask in Chinese (Traditional or Simplified), you get Chinese
- **Auto-updates daily** – downloads the latest CSV automatically; keeps 7 days of history and cleans up old files

## Practical Examples (What You Can Actually Ask)

| Your Question | What You Get |
|---------------|--------------|
| "Coke Zero price" | Cheapest supermarket + price per 500ml bottle, and how many you can buy with $100 |
| "milk" | All milk products, cheapest option (e.g., $13/L soy milk), quantity calculation |
| "鸡蛋" | Chinese reply: cheapest eggs, supermarket, price, quantity for $100 |
| "frozen seafood" | Cheapest frozen fish/shrimp items, pack sizes, totals |
| "橄欖油" | Olive oil options compared, best value per ml |
| "bread" | List of bread items, cheapest per loaf or per pack |

## 📊 Data Source Details

- **Source:** Consumer Council Hong Kong – Price Watch (English CSV)
- **URL:** https://online-price-watch.consumer.org.hk/opw/opendata/pricewatch_en.csv
- **Coverage:** Daily updated prices from major supermarkets in HK
- **Products:** ~6,000 items (food, beverages, household goods)
- **Fields:** Category, Brand, Product Name, Supermarket Code, Price, Offers

## How It Works (Behind the Scenes)

1. **First query of the day** → downloads fresh CSV (SSL verified, 2 retries)
2. **Subsequent queries** → uses cached file (no re-download)
3. **Search** → case-insensitive match on product name, brand, or category
4. **Comparison** → finds cheapest price per supermarket and overall cheapest
5. **Housekeeping** → automatically deletes CSV files older than 7 days (runs silently)
6. **Response** → formatted answer in your language, no debug noise

## 🏬 Supermarket Code Reference

| Code | Supermarket |
|------|-------------|
| WELLCOME | 惠康 |
| PARKNSHOP | 百佳 |
| AEON | AEON |
| JASONS | Jasons |
| DCHFOOD | 大昌食品 |
| LUNGFUNG | 龍豐 |
| MANNINGS | 萬寧 |
| WATSONS | 屈臣氏 |
| SASA | SASA |

## 📈 Sample Output

```
'Coke Zero' Cheapest options:
- PARKNSHOP: Coca-Cola Zero Sugar 500ml @ $9.50
- JASONS: Coca-Cola Zero Sugar 500ml @ $10.00
- WELLCOME: Coca-Cola Zero Sugar 500ml @ $10.00

🏆 Overall cheapest: PARKNSHOP - Coca-Cola Zero Sugar 500ml ($9.50)

💰 With $100 you can buy 10 items (remaining $5.00)
```

## Security & Reliability

- ✅ SSL certificate verification enforced (no `-k` bypass)
- ✅ Query length limited to 200 characters
- ✅ No shell command injection (safe subprocess calls)
- ✅ File operations confined to skill's own `data/` directory
- ✅ CSV parsing safe (Python `csv` module, no `eval`)
- ✅ All internal errors logged to stderr only; user sees clean error messages

## 🛠️ Installation & Testing

1. Extract `hk-supermarket-shopping-v1.0.0.tar.gz` to your OpenClaw `skills/` directory
2. Restart OpenClaw or reload skills
3. Test with: `python3 supermarket.py "milk"`
4. The skill will auto-download data on first run

**Test script included:** `test_skill.py` – run with `python3 test_skill.py` to verify functionality.

## 📝 Notes

- The dataset is **daily** – today's file is named `pricewatch_en_YYYY-MM-DD.csv`
- If download fails, skill falls back to the most recent file (up to 7 days old)
- Some niche products may not be listed; the skill will politely say "not found"
- Prices are in HK dollars ($)
- Supermarket codes are shown as-is (you can recognize them by the table above)

## Known Limitations

- Only includes products stocked by participating supermarkets (no wet markets, small grocers)
- Price data reflects the date in the filename – may be 1 day old if download failed
- Does not account for membership discounts or bulk-buy pricing beyond listed offers
- No real-time stock availability – prices are listed but item may be out of stock

## Support

For issues or feature requests, contact Jax. This skill is standalone and does not depend on other OpenClaw skills.

---

**Version:** 1.0.0 (Public Release)  
**Author:** Jax  
**License:** MIT  
**Created:** 2025-03-13  
**Status:** Production-ready
