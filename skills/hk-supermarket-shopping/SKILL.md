---
name: hk-supermarket-shopping
description: Helps users find the best deals at Hong Kong supermarkets using real-time Consumer Council price data. For any product, get the cheapest store, current price, and $100 budget breakdown. Supports English/Chinese queries automatically.
---

# HK Supermarket Shopping

This skill provides instant price comparisons across Hong Kong supermarkets like PARKNSHOP, Wellcome, and U Select, powered by the Consumer Council's daily pricewatch CSV.

## When to Use This Skill

Use this skill when the user:

- Asks for product prices in Hong Kong supermarkets ("milk price HK", "雞蛋多少錢")
- Wants the cheapest option for groceries or household items
- Needs budget calculations ("how much X can I buy with $100")
- Queries in Chinese or English (auto-detects language)
- Seeks real-time deals on branded products like Coke Zero or frozen shrimp

## What is the Consumer Council Pricewatch?

The Consumer Council publishes daily CSV files with prices from major HK chains. This skill downloads the latest data automatically (SSL verified, daily refresh) and matches user queries against 1000+ products.

**Key features:**
- Covers groceries, drinks, frozen foods, household items
- Multilingual search (English/Chinese product names)
- Offline after first download (auto-housekeeps old data)
- No authentication or API keys needed

**Data source:** Consumer Council daily pricewatch CSV

## How the Skill Works

### The `price_lookup` Tool

Single tool that handles all queries:

```yaml
tools:
  - name: price_lookup
    parameters:
      query: string  # "Coke Zero", "milk", "雞蛋", "橄欖油"
    returns: string # "PARKNSHOP - Coca-Cola Zero Sugar 500ml ($9.50). $100 buys 10 (剩$5.00)."
