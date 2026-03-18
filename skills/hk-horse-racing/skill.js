const { HorseRacingAPI } = require('hkjc-api');

// Simple in-memory cache (TTL 15 minutes)
const cache = new Map();
// Rate limiting: timestamp of last API call (not cache read)
let lastApiCall = 0;
const RATE_LIMIT_MS = 60 * 1000; // 1 minute

function makeCacheKey({date, language, classFilter, excludeHorseNos, excludeBarriers}) {
  // Build deterministic key; sort arrays for consistency
  const cf = JSON.stringify((classFilter || []).sort());
  const ehn = JSON.stringify((excludeHorseNos || []).sort());
  const eb = JSON.stringify((excludeBarriers || []).sort());
  return `${date}|${language}|${cf}|${ehn}|${eb}`;
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

// Gear code translation map
const GEAR_MAP = {
  'B': '眼罩', 'B-': '眼罩(移除)', 'BO': '單眼罩', 'CC': '頸圈', 'CP': '羊毛頰墊',
  'CO': '單羊毛頰墊', 'E': '耳塞', 'H': '頭罩', 'P': '安眠带', 'PC': '安眠带+頭罩',
  'PS': '單安眠带', 'SB': '羊毛前額帶', 'SR': '陰影Roll', 'TT': '紮舌', 'V': '護眼罩',
  'VO': '單護眼罩', 'XB': '交叉鼻带', 'SR1': '陰影Roll(一)', 'CP2': '羊毛頰墊(二)'
};

function translateGear(gear, lang) {
  if (!gear || gear.length === 0) return lang === 'zh' ? '無' : 'none';
  if (lang === 'zh') {
    return gear.map(g => GEAR_MAP[g] || g).join('/');
  }
  return gear.join('/');
}

// Reason phrase dictionary
const REASON_PHRASES = {
  en: {
    winOdds: 'Win odds',
    recentForm: 'recent form avg',
    barrier: 'barrier',
    weight: 'weight',
    gear: 'gear'
  },
  zh: {
    winOdds: '獨贏賠率',
    recentForm: '近6場平均',
    barrier: '檔位',
    weight: '負磅',
    gear: '裝備'
  }
};

function computeRecommendations(horses, lang = 'en') {
  const phrases = REASON_PHRASES[lang] || REASON_PHRASES.en;
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

  // Compute form score: average of last 6 positions (lower is better). Normalize to 0-1.
  const formAvg = {};
  let minAvg = Infinity, maxAvg = -Infinity;
  for (const h of candidates) {
    const avg = h.pastRuns.reduce((a, b) => a + b, 0) / h.pastRuns.length;
    formAvg[h.horseName] = avg;
    if (avg < minAvg) minAvg = avg;
    if (avg > maxAvg) maxAvg = avg;
  }
  const formScore = {};
  for (const name of Object.keys(formAvg)) {
    // Avoid divide by zero if all same
    formScore[name] = (maxAvg === minAvg) ? 0.5 : 1 - (formAvg[name] - minAvg) / (maxAvg - minAvg);
  }

  // Combined score: 60% implied probability, 40% form score
  const scores = {};
  for (const h of candidates) {
    scores[h.horseName] = 0.6 * implied[h.horseName] + 0.4 * formScore[h.horseName];
  }

  // Normalize combined scores to sum to 1 to get estimated probabilities
  let sumScores = 0;
  for (const name of Object.keys(scores)) {
    sumScores += scores[name];
  }
  const estimatedProb = {};
  for (const name of Object.keys(scores)) {
    estimatedProb[name] = scores[name] / sumScores;
  }

  // Sort and take top 4 by estimated probability
  const ranked = candidates
    .map(h => ({ horse: h, prob: estimatedProb[h.horseName] }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 4);

  // Build recommendations with reason and estimated probability
  return ranked.map(r => {
    const h = r.horse;
    const probPercent = (r.prob * 100).toFixed(1);
    let reason = `${phrases.winOdds} ${h.winOdds}`;
    if (h.barrier) reason += `; ${phrases.barrier} ${h.barrier}`;
    if (h.weight) reason += `; ${phrases.weight} ${h.weight}`;
    const avgPos = formAvg[h.horseName].toFixed(1);
    reason += `; ${phrases.recentForm} ${avgPos}`;
    if (h.gear && h.gear.length > 0) {
      const gearStr = translateGear(h.gear, lang);
      reason += `; ${phrases.gear}: ${gearStr}`;
    }
    return {
      horseName: h.horseName,
      reason,
      winProbability: parseFloat(probPercent)
    };
  });
}

async function fetchRaceCard(params = {}) {
  const { date, classFilter = [], language = 'en', excludeHorseNos = [], excludeBarriers = [], raceNo } = params;
  const targetDate = date || getTodayHKT();

  const cacheKey = `racecard-${targetDate}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 15 * 60 * 1000)) {
    return cached.data;
  }

  const horseAPI = new HorseRacingAPI();

  try {
    const allMeetings = await horseAPI.getAllRaces();

    // Filter meetings by date
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
    // Determine venue: use venueCode or infer from races' raceCourse
    const venueCode = meeting.venueCode || (meeting.races && meeting.races[0]?.raceCourse) || 'Unknown';
    const venueName = venueCode; // Could map ST->Sha Tin, HV->Happy Valley
    result.meeting = {
      venue: venueName,
      date: targetDate,
      // weather and trackCondition might be from first race
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
        // oddsResult is an array of objects: each has oddsType and oddsNodes array
        for (const oddsNode of oddsResult) {
          const type = oddsNode.oddsType; // 'WIN' or 'PLA'
          for (const node of oddsNode.oddsNodes) {
            const key = node.combString; // e.g., '01'
            if (!oddsMap[key]) oddsMap[key] = {};
            oddsMap[key][type] = node.oddsValue;
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch odds for race ${race.no}:`, err.message);
      }

      // Build horses, selecting fields based on language
      let horses = (race.runners || []).map(runner => {
        const barrier = runner.barrierDrawNumber ? parseInt(runner.barrierDrawNumber, 10) : null;
        const horseNo = runner.no ? parseInt(runner.no, 10) : null;
        const horseName = language === 'zh' ? (runner.name_ch || '（無中文名）') : (runner.name_en || '(no English name)');
        const horseId = runner.horse?.id || runner.id || null;
        const handicapWeight = runner.handicapWeight ? parseInt(runner.handicapWeight, 10) : null;
        let jockeyName = null;
        if (runner.jockey) {
          jockeyName = language === 'zh' ? (runner.jockey.name_ch || '（無中文名）') : (runner.jockey.name_en || '(no English name)');
        }
        let trainerName = null;
        if (runner.trainer) {
          trainerName = language === 'zh' ? (runner.trainer.name_ch || '（無中文名）') : (runner.trainer.name_en || '(no English name)');
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
        // Gear: gearInfo string like 'B/TT' split by '/'
        let gear = [];
        if (runner.gearInfo) {
          gear = runner.gearInfo.split('/').map(s => s.trim()).filter(Boolean);
        }

        // Odds lookup: key is horseNo padded to 2 digits
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

      // Filter out excluded horse numbers
      if (excludeHorseNos.length > 0) {
        horses = horses.filter(h => !excludeHorseNos.includes(h.horseNo));
      }

      // Filter out excluded barrier numbers
      if (excludeBarriers.length > 0) {
        horses = horses.filter(h => !excludeBarriers.includes(h.barrier));
      }

      // Filter out SB horses (no horseNo or barrier)
      horses = horses.filter(h => h.horseNo != null && h.barrier != null);

      // Compute recommendations for this race (needs barrier for reason)
      const recommendations = computeRecommendations(horses, language);

      // Select class and going based on language
      const raceClass = language === 'zh' ? (race.raceClass_ch || race.raceClass_en) : (race.raceClass_en || race.raceClass_ch) || null;
      const going = language === 'zh' ? (race.go_ch || race.go_en) : (race.go_en || race.go_ch) || null;
      // Override meeting trackCondition if not set
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