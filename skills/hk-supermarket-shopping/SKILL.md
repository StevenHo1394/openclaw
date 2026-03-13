---
id: hk-supermarket-shopping
name: HK Supermarket Shopping
description: Real-time price comparison for Hong Kong supermarkets using the Consumer Council's daily pricewatch. Returns cheapest options, quantity calculations, and multilingual responses.
version: 1.0.0
author: Jax
license: MIT
tags:
  - shopping
  - hong-kong
  - price-comparison
  - consumer
  - multilingual

tools:
  - name: price_lookup
    description: Query supermarket prices in Hong Kong. Returns cheapest options, per-supermarket comparisons, and $100 quantity estimates. Automatically detects query language (English/Chinese) and responds accordingly.
    parameters:
      type: object
      properties:
        query:
          type: string
          description: Product name, brand, or category (e.g., "Coke Zero", "milk", "鸡蛋", "橄欖油", "frozen shrimp")
          maxLength: 200
      required: [query]
    returns:
      type: string
      description: |
        Human-readable answer containing:
        - List of cheapest options by supermarket
        - Overall cheapest item with price
        - Quantity calculation for $100 (if applicable)
        Response language matches the query language (English or Traditional/Simplified Chinese).
    example:
      input: "Coke Zero"
      output: "'Coke Zero' Cheapest options:\n- PARKNSHOP: Coca-Cola Zero Sugar 500ml @ $9.50\n- JASONS: Coca-Cola Zero Sugar 500ml @ $10.00\n- WELLCOME: Coca-Cola Zero Sugar 500ml @ $10.00\n\n🏆 Overall cheapest: PARKNSHOP - Coca-Cola Zero Sugar 500ml ($9.50)\n\n💰 With $100 you can buy 10 items (remaining $5.00)"

requirements:
  - command: python3
    description: Python 3.8+
  - command: curl
    description: For downloading CSV data

setup: |
  1. Install the skill by copying the folder to OpenClaw's skills directory.
  2. No configuration needed – data downloads automatically on first use.
  3. Data is stored in the skill's internal `data/` directory and housekept (older than 7 days removed).
  4. The skill uses SSL-verified downloads; ensure system CA certificates are up to date.

capabilities:
  - offline_after_initial: true  # after first download, works offline
  - auto_refresh: daily
  - multilingual: true
  - secure: true

example_queries:
  - price queries: "How much is milk?", "Coke Zero price", "egg price"
  - category searches: "frozen seafood", "olive oil", "bread"
  - Chinese: "牛奶", "雞蛋", "橄欖油", "雪糕"
  - budget planning: "cheapest ice cream", "best value coffee"

dependencies: []
conflicts: []
priority: 100
enabled: true

---

## Implementation Notes (for Developers)

- **Data format:** English CSV with headers: Category 1, Category 2, Category 3, Product Code, Brand, Product Name, Supermarket Code, Price, Offers
- **Search:** Case-insensitive substring matching across Product Name, Brand, and Category fields
- **Scoring:** Cheapest = lowest price; $100 quantity = floor(100 / cheapest_price)
- **Language detection:** Presence of any CJK characters → Chinese (Traditional/Simplified); else English
- **Error handling:** All exceptions caught; user-friendly messages; logs to stderr
- **Performance:** Loads up to 10,000 rows; memory-efficient for typical CSV size (~6k rows)

This skill is designed to be **plug-and-play** – just drop it in and start asking price questions. No API keys, no external services beyond the initial CSV download.

---

**End of SKILL.md**
