markdown
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
    description: Query supermarket prices in Hong Kong. Returns cheapest option, price, and how many you can buy with $100. Auto-detects query language (English/Chinese).
    parameters:
      type: object
      properties:
        query:
          type: string
          description: Product name, brand, or category (e.g., "Coke Zero", "milk", "鸡蛋", "橄欖油").
          maxLength: 200
      required: [query]
    returns:
      type: string
      description: Plain-text answer. Example: "Overall cheapest: PARKNSHOP - Coca-Cola Zero Sugar 500ml ($9.50). With $100 you can buy 10 items (remaining $5.00)."
    example:
      input: "Coke Zero"
      output: "Overall cheapest: PARKNSHOP - Coca-Cola Zero Sugar 500ml ($9.50). With $100 you can buy 10 items (remaining $5.00)."

requirements:
  - command: python3
  - command: curl

setup: |
  1. Copy this folder to your OpenClaw skills directory.
  2. No config needed – data downloads automatically.
  3. Data stored in internal data/; housekept (older than 1 day removed).
  4. SSL-verified downloads.

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
