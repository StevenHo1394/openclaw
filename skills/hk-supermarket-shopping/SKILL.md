---
id: hk-supermarket-shopping
name: HK Supermarket Shopping
description: Price lookup and comparison for Hong Kong supermarkets using Consumer Council data. Multilingual responses.
version: 1.0.0
author: Jax
license: MIT
tags:
  - shopping
  - hong-kong
  - price-comparison
  - consumer

tools:
  - name: price_lookup
    description: Get price information and comparison for HK supermarket products
    parameters:
      type: object
      properties:
        query:
          type: string
          description: Product or category to search (e.g., "Coke Zero", "milk", "eggs")
      required: [query]
    returns:
      type: string
      description: Formatted answer with price comparisons in the same language as the query

requirements:
  - python3
  - curl

setup: |
  Uses pricewatch_en.csv (English dataset) from Consumer Council.
  Auto-downloads daily; keeps 7 days; secure (SSL verification, input validation).

example_queries:
  - "How much is Coke Zero?"
  - "Cheapest milk"
  - "Eggs price"
  - "橄欖油"
  - "牛奶"

---

Standalone skill. No dependencies on other skills. Output contains only final answers.
