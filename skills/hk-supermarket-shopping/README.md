# HK Supermarket Shopping Skill (v1.2.2)

Simple, fast price lookup for Hong Kong supermarkets.

## Usage

Ask for any product (in English or Chinese). The skill will:

- Compare prices among supermarkets
- Identify the cheapest option
- Tell you how many you can buy with a fixed budget

Example: `"Coke Zero"` → returns cheapest supermarket, price, and quantity for your budget.

Data is updated daily (CSV kept for 1 day only).

## GitHub

Source code and releases: https://github.com/StevenHo1394/openclaw/tree/main/skills/hk-supermarket-shopping

## Version History

v1.2.2 (latest)

- Improved auto-refresh logic:
  - Checks for existing today's file → uses if valid
  - Downloads with 4 retries if missing
  - Removes old dated files after successful download
  - Fallback to most recent file if download fails
- Fixed housekeeping to prevent deletion of the currently used fallback file
- Enhanced logging (download attempts, file operations)
