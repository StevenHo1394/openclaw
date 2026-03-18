const { HorseRacingAPI } = require('hkjc-api');

// Simple in-memory cache (TTL 15 minutes)
const cache = new Map();
// Rate limiting: timestamp of last API call (not cache read)
let lastApiCall = 0;
const RATE_LIMIT_MS = 60 * 1000; // 1 minute

function makeCacheKey({date, classFilter, excludeHorseNos, excludeBarriers, advancedScoring, newsBoost}) {
  const cf = JSON.stringify((classFilter || []).sort());
  const ehn = JSON.stringify((excludeHorseNos || []).sort());
  const eb = JSON.stringify((excludeBarriers || []).sort());
  const adv = advancedScoring ? '1' : '0';
  const news = newsBoost ? '1' : '0';
  return `${date}|${cf}|${ehn}|${eb}|${adv}|${news}`;
}

function getTodayHKT() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const hktTime = new Date(utc + (8 * 3600000));
  return hktTime.toISOString().split('T')[0];
}

function padNumber(num, size = 2) {
  return String(num).padStart(size, '0');
}

// Reason phrases: fixed English
const PHRASES = {
  winOdds: 'Win odds',
  recentForm: 'recent form avg',
  barrier: 'barrier',
  weight: 'weight',
  gear: 'gear',
  tjBonus: 'trainer/jockey bonus',
  barrierBonus: 'barrier effectiveness'
};

// Top jockeys and trainers (names as they appear in HKJC API)
const TOP_JOCKEYS = new Set([
  'Z Purton', 'J Purton', 'Y L Chung', 'B Avdulla', 'A Badel', 'K Teetan', 'M L Yeung', 'C Y Ho'
]);
const TOP_TRAINERS = new Set([
  'K W Lui', 'D J Whyte', 'D A Hayes', 'W Y So', 'C Fownes', 'P F Yiu', 'K H Ting', 'C W Chang', 'Y S Tsui', 'A S Cruz'
]);

// Barrier effectiveness by distance class (empirical approximation)
// Effectiveness score added to candidate score (0-1 scale) multiplied by barrierBonusWeight
function barrierEffectiveness(barrier, distance) {
  if (!barrier) return 0;
  // Short: <1000m, Middle: 1000-1800m, Long: >1800m
  const distClass = distance < 1000 ? 'short' : distance <= 1800 ? 'middle' : 'long';
  // Simplified model: inner barriers (1-4) generally better for short, outer better for long; middle varies.
  const effectiveness = {
    short: [0.10, 0.08, 0.05, 0.02, 0, -0.02, -0.04, -0.06, -0.08, -0.10, -0.12, -0.14, -0.16],
    middle: [0.05, 0.04, 0.02, 0.01, 0, -0.01, -0.02, -0.03, -0.04, -0.05, -0.06, -0.07, -0.08],
    long: [-0.08, -0.06, -0.04, -0.02, 0, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.14, 0.16]
  };
  const idx = barrier - 1;
  if (idx >= 0 && idx < 13) {
    return effectiveness[distClass][idx];
  }
  return 0;
}

// Optional: fetch news sentiment for a horse name via Brave search
// Returns a small boost (0-0.05) if recent positive mentions found; otherwise 0.
// This is a stub; actual implementation would require a search API call and NLP. Since we have Brave search, we could do it, but for now it's a placeholder.
async function fetchNewsBoost(horseName) {
  // Placeholder: return 0. Could be extended to use web_search skill if available.
  return 0;
}

function computeRecommendations(horses, options = {}) {
  const {
    advancedScoring = false,
    tjBonusWeight = 0.1,
    barrierBonusWeight = 0.05,
    raceDistance = null,
    newsBoost = false
  } = options;

  // Only consider horses with valid winOdds and at least some form data
  const candidates = horses.filter(h => h.winOdds != null && h.pastRuns && h.pastRuns.length > 0);
  if (candidates.length < 2) return [];

  // Compute implied probability from win odds (1/odds) and normalize to sum=1
  const implied = {};
  let sumImplied = 0;
  for (const h of candidates) {
    implied[h.horseName] = 1 / h.winOdds;
    sumImplied += implied[h.horseName];
  }
  for (const h of candidates) {
    implied[h.horseName] /= sumImplied;
  }

  // Compute form average (lower is better)
  const formAvg = {};
  let minAvg = Infinity, maxAvg = -Infinity;
  for (const h of candidates) {
    const avg = h.pastRuns.reduce((a, b) => a + b, 0) / h.pastRuns.length;
    formAvg[h.horseName] = avg;
    if (avg < minAvg) minAvg = avg;
    if (avg > maxAvg) maxAvg = avg;
  }
  // Normalize form to 0-1 (better form = higher score)
  const formScore = {};
  for (const name of Object.keys(formAvg)) {
    formScore[name] = (maxAvg === minAvg) ? 0.5 : 1 - (formAvg[name] - minAvg) / (maxAvg - minAvg);
  }

  // Base combined score: 0.6 implied, 0.4 form
  const baseWeight = 0.6 + 0.4; // =1.0 but we’ll adjust if extra bonuses enabled
  const scores = {};
  for (const h of candidates) {
    let score = 0.6 * implied[h.horseName] + 0.4 * formScore[h.horseName];
    scores[h.horseName] = { score, reasons: [] };
  }

  // Advanced bonuses
  if (advancedScoring) {
    // Trainer/Jockey bonus: if both jockey and trainer are top-tier, add tjBonusWeight
    for (const h of candidates) {
      const isTopJockey = h.jockey && TOP_JOCKEYS.has(h.jockey);
      const isTopTrainer = h.trainer && TOP_TRAINERS.has(h.trainer);
      if (isTopJockey && isTopTrainer) {
        scores[h.horseName].score += tjBonusWeight;
        scores[h.horseName].reasons.push(`TJ bonus +${(tjBonusWeight*100).toFixed(1)}%`);
      }
    }
    // Barrier effectiveness bonus
    if (raceDistance != null) {
      for (const h of candidates) {
        const bEff = barrierEffectiveness(h.barrier, raceDistance);
        const bonus = bEff * barrierBonusWeight;
        if (Math.abs(bonus) > 0.001) {
          scores[h.horseName].score += bonus;
          scores[h.horseName].reasons.push(`Barrier ${bonus >= 0 ? '+' : ''}${(bonus*100).toFixed(1)}%`);
        }
      }
    }
    // News boost (placeholder for now)
    if (newsBoost) {
      // Could be implemented async but would slow down; not enabled by default
    }
  }

  // Normalize final scores to sum to 1
  let sumScores = 0;
  for (const name of Object.keys(scores)) {
    sumScores += scores[name].score;
  }
  const estimatedProb = {};
  for (const name of Object.keys(scores)) {
    estimatedProb[name] = scores[name].score / sumScores;
  }

  // Rank and take top 4
  const ranked = candidates
    .map(h => ({ horse: h, prob: estimatedProb[h.horseName], reasons: scores[h.horseName].reasons }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 4);

  // Build recommendations
  return ranked.map(r => {
    const h = r.horse;
    const probPercent = (r.prob * 100).toFixed(1);
    let reason = `${PHRASES.winOdds} ${h.winOdds}`;
    if (h.barrier) reason += `; ${PHRASES.barrier} ${h.barrier}`;
    if (h.weight) reason += `; ${PHRASES.weight} ${h.weight}`;
    const avgPos = formAvg[h.horseName].toFixed(1);
    reason += `; ${PHRASES.recentForm} ${avgPos}`;
    if (h.gear && h.gear.length > 0) {
      reason += `; ${PHRASES.gear}: ${h.gear.join('/')}`;
    }
    if (r.reasons && r.reasons.length > 0) {
      reason += '; ' + r.reasons.join('; ');
    }
    return {
      horseName: h.horseName,
      reason,
      winProbability: parseFloat(probPercent)
    };
  });
}

async function fetchRaceCard(params = {}) {
  const { date, classFilter = [], excludeHorseNos = [], excludeBarriers = [], raceNo, advancedScoring = false, tjBonusWeight = 0.1, barrierBonusWeight = 0.05, newsBoost = false } = params;
  const targetDate = date || getTodayHKT();

  const cacheKey = makeCacheKey({ date: targetDate, classFilter, excludeHorseNos, excludeBarriers, advancedScoring, newsBoost });
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 15 * 60 * 1000)) {
    return cached.data;
  }

  // Enforce rate limit on fresh fetches
  const now = Date.now();
  if (now - lastApiCall < RATE_LIMIT_MS) {
    const waitMs = RATE_LIMIT_MS - (now - lastApiCall);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  lastApiCall = Date.now();

  const horseAPI = new HorseRacingAPI();

  try {
    const allMeetings = await horseAPI.getAllRaces();

    // Filter meetings by date (API returns string date)
    const filteredMeetings = allMeetings.filter(m => m.date === targetDate);

    const result = {
      meeting: null,
      races: [],
      source: 'hkjc-api',
      timestamp: new Date().toISOString()
    };

    if (filteredMeetings.length === 0) {
      cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    const meeting = filteredMeetings[0];
    const venueCode = meeting.venueCode || (meeting.races?.[0]?.raceCourse) || 'Unknown';
    result.meeting = {
      venue: venueCode,
      date: targetDate,
      weather: null,
      trackCondition: null
    };

    const races = meeting.races || [];
    for (const race of races) {
      // Apply class filter if any
      if (classFilter.length > 0) {
        const raceClass = (race.raceClass_en || '').toLowerCase();
        const matches = classFilter.some(cls => raceClass.includes(cls.toLowerCase()));
        if (!matches) continue;
      }

      // Fetch odds for this race
      let oddsMap = {}; // { '01': {WIN: '14', PLA: '5.8'}, ... }
      try {
        const raceNumber = race.no ? parseInt(race.no, 10) : 1;
        const oddsResult = await horseAPI.getRaceOdds(raceNumber, ['WIN', 'PLA']);
        for (const oddsNode of oddsResult) {
          const type = oddsNode.oddsType; // 'WIN' or 'PLA'
          for (const node of oddsNode.oddsNodes) {
            const key = node.combString; // padded horse number string
            if (!oddsMap[key]) oddsMap[key] = {};
            oddsMap[key][type] = node.oddsValue;
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch odds for race ${race.no}:`, err.message);
      }

      // Map runners to horse objects (English only)
      let horses = (race.runners || []).map(runner => {
        const barrier = runner.barrierDrawNumber ? parseInt(runner.barrierDrawNumber, 10) : null;
        const horseNo = runner.no ? parseInt(runner.no, 10) : null;
        const horseName = runner.name_en || '(no English name)';
        const horseId = runner.horse?.id || runner.id || null;
        const handicapWeight = runner.handicapWeight ? parseInt(runner.handicapWeight, 10) : null;

        let jockeyName = null;
        if (runner.jockey) {
          jockeyName = runner.jockey.name_en || '(no English name)';
        }

        let trainerName = null;
        if (runner.trainer) {
          trainerName = runner.trainer.name_en || '(no English name)';
        }

        const allowanceRaw = runner.allowance;
        let jockeyAllowance = null;
        if (allowanceRaw && allowanceRaw.trim() !== '') {
          jockeyAllowance = parseInt(allowanceRaw.trim(), 10);
          if (isNaN(jockeyAllowance)) jockeyAllowance = null;
        }

        // Past runs: last6run string like '8/12/12/12/3/8'
        let pastRuns = [];
        if (runner.last6run) {
          pastRuns = runner.last6run.split('/').map(p => parseInt(p, 10)).filter(n => !isNaN(n));
        }

        // Gear: gearInfo string like 'B/TT'
        let gear = [];
        if (runner.gearInfo) {
          gear = runner.gearInfo.split('/').map(s => s.trim()).filter(Boolean);
        }

        // Odds lookup
        const oddsKey = horseNo ? padNumber(horseNo) : null;
        const oddsEntry = oddsKey && oddsMap[oddsKey] ? oddsMap[oddsKey] : {};
        const winOdds = oddsEntry.WIN ? parseFloat(oddsEntry.WIN) : null;
        const placeOdds = oddsEntry.PLA ? parseFloat(oddsEntry.PLA) : null;

        return {
          barrier,
          horseNo,
          horseName,
          horseId,
          weight: handicapWeight,
          jockey: jockeyName,
          jockeyAllowance,
          trainer: trainerName,
          pastRuns,
          gear,
          winOdds,
          placeOdds
        };
      });

      // Apply exclusions
      if (excludeHorseNos.length > 0) {
        horses = horses.filter(h => !excludeHorseNos.includes(h.horseNo));
      }
      if (excludeBarriers.length > 0) {
        horses = horses.filter(h => !excludeBarriers.includes(h.barrier));
      }

      // Filter out SB horses (missing critical data)
      horses = horses.filter(h => h.horseNo != null && h.barrier != null);

      // Compute recommendations with advanced options if enabled
      const recommendations = computeRecommendations(horses, {
        advancedScoring,
        tjBonusWeight,
        barrierBonusWeight,
        raceDistance: race.distance || null,
        newsBoost
      });

      // Class and going (English only)
      const raceClass = race.raceClass_en || null;
      const going = race.go_en || null;
      if (!result.meeting.trackCondition && going) {
        result.meeting.trackCondition = going;
      }

      result.races.push({
        raceNo: race.no ? parseInt(race.no, 10) : null,
        distance: race.distance || null,
        class: raceClass,
        going: going,
        horses,
        recommendations
      });
    }

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('HKJC fetchRaceCard error:', error);
    throw error;
  }
}

module.exports = {
  tools: {
    fetchRaceCard
  }
};