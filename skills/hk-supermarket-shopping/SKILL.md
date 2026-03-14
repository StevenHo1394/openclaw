id: hk-supermarket-shopping
name: HK Supermarket Shopping
description: |
  Provides real-time price comparison for Hong Kong supermarkets.
  Data source: Consumer Council daily pricewatch (English CSV).
  For any product query, returns:
  - The cheapest supermarket
  - The lowest price
  - How many items you can buy with $100 (or remaining budget)

  The skill auto-detects query language (English or Chinese) and responds in the same language.
  No authentication required; data downloads automatically on first use.

version: 1.1.0
author: Steven Ho
license: MIT
tags:
  - shopping
  - hong-kong
  - price-comparison
  - consumer
  - multilingual

tools:
  - name: price_lookup
    description: |
      Query Hong Kong supermarket prices.
      Accepts product names, brands, or categories in English or Chinese.
      Returns a concise plain-text answer containing the cheapest option and budget quantity.
    parameters:
      type: object
      properties:
        query:
          type: string
          description: |
            What you want to buy.
            Examples: "Coke Zero", "milk", "雞蛋", "橄欖油", "frozen shrimp"
          maxLength: 200
      required: [query]
    returns:
      type: string
      description: |
        Plain-text, single-line answer.
        Example: "Overall cheapest: PARKNSHOP - Coca-Cola Zero Sugar 500ml ($9.50). With $100 you can buy 10 items (remaining $5.00)."
    example:
      input: "Coke Zero"
      output: "Overall cheapest: PARKNSHOP - Coca-Cola Zero Sugar 500ml ($9.50). With $100 you can buy 10 items (remaining $5.00)."

requirements:
  - command: python3
    description: Python 3.8+ runtime
  - command: curl
    description: For downloading the pricewatch CSV

setup: |
  1. Copy the skill folder into your OpenClaw `skills/` directory.
  2. No configuration needed.
  3. On first query, the skill downloads the latest CSV to its internal `data/` directory.
  4. Data is housekept automatically – only today's file is retained (older than 1 day removed).
  5. All downloads use SSL verification; no proxy bypass.

capabilities:
  offline_after_initial: true   # Works offline after first download
  auto_refresh: daily           # Refreshes data each day
  multilingual: true            # English / Chinese auto-detection
  secure: true                  # No command injection, SSL enforced

example_queries:
  - price lookup: "How much is milk?"
  - brand search: "Coke Zero price"
  - Chinese: "雞蛋", "橄欖油"
  - category: "frozen seafood", "olive oil"

dependencies: []
conflicts: []
priority: 100
enabled: true