---
id: hk-supermarket-shopping
name: HK Supermarket Shopping
description: Real-time price comparison for Hong Kong supermarkets using the Consumer Council's daily pricewatch. Returns cheapest options, quantity calculations, and multilingual responses.
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
    description: Query supermarket prices in Hong Kong. Returns cheapest options and quantity estimates. Automatically detects query language.
    parameters:
      type: object
      properties:
        query:
          type: string
          description: Product name, brand, or category.
          maxLength: 200
      required: [query]
    returns:
      type: string
      description: Human-readable answer with cheapest supermarket, price, and quantity for a fixed budget.
    example:
      input: "Coke Zero"
      output: "❤ Overall cheapest: PARKNSHOP - Coca-Cola Zero Sugar 500ml ($9.50)\n💸 With $100 you can buy 10 items (remaining $5.00)"

requirements:
  - command: python3
  - command: curl

setup: |
  1. Install by copying the folder to OpenClaw's skills directory.
  2. No configuration needed – data downloads automatically on first use.
  3. Data is stored in the skill's internal `data/` directory and housekept (older than 1 day removed).
  4. The skill uses SSL-verified downloads.

capabilities:
  - offline_after_initial: true
  - auto_refresh: daily
  - multilingual: true
  - secure: true

example_queries:
  - "How much is milk?"
  - "Coke Zero price"
  - "雞蛋"
  - "橄欖油"

dependencies: []
conflicts: []
priority: 100
enabled: true

---
