# HKJC Race Card Skill

This skill provides two core functions:
- **Race card data** – Fetches Hong Kong Jockey Club race cards for a given date, including meeting details, race conditions, and complete horse data (jockey, trainer, barrier, weight, past runs, gear, win/place odds).
- **Recommended picks** – Analyzes the field and returns up to 4 recommended horses per race with reasoning (win odds, barrier, weight, recent form, gear), plus an estimated win probability.

Supports English (`language='en'`) and Chinese (`language='zh'`) modes with strict language adherence: when `zh`, uses only Chinese name fields; when `en`, uses only English. Additional features: exclude by horse number or barrier, single-race fetch (`raceNo`), 15‑minute caching, and 60‑second rate limiting between fresh API calls.

**Repository:** https://github.com/StevenHo1394/openclaw/tree/main/skills/hk-horse-racing

## Tools

### `fetchRaceCard(params)`

Fetch race card for a given date (default: today in HKT). Includes race details, per-horse win/place odds, and recommendations for each race.

**Parameters (object):**
- `date` (string, optional): Date in `YYYY-MM-DD` format. Default: today (HKT).
- `classFilter` (array of strings, optional): Filter races by class (e.g., `["Class 4"]`).
- `language` (string, optional): Output language for names and labels. `"en"` (default) or `"zh"`. When `"zh"`, returns Chinese horse/jockey/trainer names and Chinese labels in recommendations.
- `excludeHorseNos` (array of numbers, optional): List of horse numbers to exclude from the `horses` array and from recommendations (e.g., `[7]`). Useful if certain runners are scratched or you want to ignore them.
- `excludeBarriers` (array of numbers, optional): List of barrier numbers to exclude from the `horses` array and from recommendations (e.g., `[7]`). Useful if you want to avoid certain barrier positions.
- `raceNo` (number, optional): If provided, returns only this specific race. Omit to get all races for the date.

**Returns (object):**
```json
{
  "meeting": {
    "venue": "Happy Valley",
    "date": "2026-03-18",
    "weather": null,
    "trackCondition": "GOOD"
  },
  "races": [
    {
      "raceNo": 2,
      "distance": 1650,
      "class": "Class 4",
      "going": "GOOD",
      "horses": [
        {
          "horseNo": 1,
          "horseName": "MIGHTY STEED",
          "horseId": "HK_2023_J384",
          "weight": 135,
          "jockey": "Z Purton",
          "jockeyAllowance": null,
          "trainer": "K W Lui",
          "pastRuns": [7,7,3,3,7,1],
          "gear": ["CP"],
          "winOdds": 3.2,
          "placeOdds": 1.5
        }
        // ... other runners (SB horses excluded)
      ],
      "recommendations": [
        {
          "horseName": "MIGHTY STEED",
          "reason": "Win odds 3.2; barrier 7; weight 135; recent form avg 4.7; gear: CP",
          "winProbability": 17.2
        }
        // ... up to 4 best horses
      ]
    }
    // ...
  ],
  "source": "hkjc-api",
  "timestamp": "2026-03-17T17:58:31.793Z"
}
```

**Notes:**
- Stand‑by (SB) horses are excluded from the `horses` list.
- `recommendations` are derived from win odds and recent form; only horses with both are considered.
- Probabilities are normalized implied probabilities from market odds, adjusted by form.

## Prerequisites

- Node.js environment (Node 18+ recommended)
- Internet access to reach HKJC API (no authentication required)
- The skill depends on `hkjc-api` npm package, which will be installed automatically.

## Installation

1. Ensure the skill directory exists: `/home/node/.openclaw/workspace/skills/hkjc-race-card/`
2. Run `npm install` inside that directory to install dependencies. OpenClaw will typically run `npm install` automatically when the skill is loaded if you set `installCommand` in the plugin manifest.
3. Add the skill to the desired agent's allowed skills (e.g., Jonah) via `openclaw configure` or agent config.

## Usage with Jonah

The Jonah agent can call this skill directly during its hourly cron to fetch the day's race cards. The skill returns structured data that Jonah's analysis pipeline can consume.

Example agent call (pseudo):
```javascript
const card = await skill.fetchRaceCard({ date: '2026-03-18', classFilter: ['Class 4'] });
```

## Rate Limiting

To avoid overloading the HKJC source, the skill enforces a **1‑minute cooldown** between fresh API fetches. Cached data (within 15 minutes) is served without delay. If you attempt a fresh fetch sooner than 60 seconds after the previous one, the skill throws an error: `Rate limit: please wait Xs before fetching new data.`

## Notes

- **Strict language adherence**: When `language='zh'`, the skill uses *only* Chinese name fields (`name_ch`, `jockey.name_ch`, `trainer.name_ch`). If a Chinese name is missing, that field returns `null`. When `language='en'`, it uses only English (`name_en`, etc.). No cross‑language fallback.
- The HKJC API is unofficial and may have rate limits or downtime.
- Odds are fetched separately per race (WIN and PLA by default). Additional odds types can be added by modifying the skill.
- If the API does not return past performance data, that field will be empty.
- The skill caches results for 15 minutes to reduce load.

## Troubleshooting

If the skill fails to install or run:
- Check Node.js version (`node --version`).
- Ensure `npm install` completed without errors (look for `hkjc-api` in `node_modules`).
- Verify outbound network connectivity.
- Check agent logs for errors.

## Version History

### v1.0.0
- Initial stable release.
- Features: race card fetch, top 4 recommendations with reasoning, strict language adherence, exclude by horse/barrier, single-race fetch (`raceNo`), rate limiting (60s), 15‑minute cache.
- Barrier field retained internally and shown in recommendation reasons; summary line omit barrier per display requirements.

---

**Author:** Steven Ho  
**License:** ISC