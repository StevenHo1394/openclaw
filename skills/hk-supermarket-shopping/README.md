# HK Supermarket Shopping Skill (v1.0.0)

A clean, secure OpenClaw skill for querying Hong Kong supermarket prices from the Consumer Council pricewatch (English CSV).

## Features

- Price lookup across major HK supermarkets
- Cheapest comparison and $100 quantity calculator
- Multilingual responses (English/Chinese auto-detected)
- Auto data refresh with 7-day retention
- Secure: SSL verification, input limits, safe parsing

## Usage

```bash
python3 supermarket.py "Coke Zero"
```

Returns JSON with `query` and `answer`. The `answer` is ready to display to users.

## Data

Source: https://online-price-watch.consumer.org.hk/opw/opendata/pricewatch_en.csv

## Installation

Copy the entire `hk-supermarket-shopping-v1.0.0` folder to your OpenClaw `skills/` directory.

## Notes

This package is **standalone**. It does not depend on any other skills or versions. All data files are stored internally and housekept automatically.

---

**Version:** 1.0.0  
**Author:** Jax
