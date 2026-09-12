/**
 * JAL PRAVAH — ML Flood Prediction Engine
 * 
 * A deterministic, client-side machine learning model that predicts
 * real-time flood probability for each Delhi district using:
 * 
 *  1. LIVE RAINFALL DATA      — from Open-Meteo API (7-day forecast)
 *  2. TERRAIN / SLOPE          — from Bhuvan Geoportal elevation data
 *  3. DRAINAGE CAPACITY        — from FCO 2025 drain network records
 *  4. LAND USE / IMPERVIOUS %  — from Bhuvan LULC Statistics
 *  5. HISTORICAL FLOOD RECORD  — from FCO 2025 / CWC data
 *
 *
 * Model: NDMA/CWC-Aligned Weighted Hydrological Feature Scoring (Multi-Factor)
 * Output: 7-day flood probability array [0–100] per district
 */

import { supabase } from './supabase';

// ============================================================
//  FCO 2025 DISTRICT DATA (Baseline Default Parameters)
// ============================================================
const DEFAULT_DISTRICT_DATA = {
  'Central': {
    drainCount: 8, drainLengthKm: 42.5, pumpingStations: 3,
    avgSlope: 0.15, imperviousPct: 92, elevation_m: 215,
    yamunaProximity: 0.95,
    historicalFloodFreq: 0.82,
    drainCapacityM3s: 185,
    underpasses: ['Minto Bridge', 'Azad Market', 'IP Flyover'],
    populationDensity: 28500,
  },
  'North': {
    drainCount: 7, drainLengthKm: 68.3, pumpingStations: 4,
    avgSlope: 0.22, imperviousPct: 65, elevation_m: 218,
    yamunaProximity: 0.75, historicalFloodFreq: 0.65,
    drainCapacityM3s: 260,
    underpasses: ['GTK Road Jahangirpuri'],
    populationDensity: 22000,
  },
  'North East': {
    drainCount: 5, drainLengthKm: 38.7, pumpingStations: 2,
    avgSlope: 0.12, imperviousPct: 78, elevation_m: 212,
    yamunaProximity: 0.90, historicalFloodFreq: 0.78,
    drainCapacityM3s: 140,
    underpasses: ['Wazirabad Road'],
    populationDensity: 36800,
  },
  'North West': {
    drainCount: 9, drainLengthKm: 95.2, pumpingStations: 5,
    avgSlope: 0.18, imperviousPct: 55, elevation_m: 220,
    yamunaProximity: 0.40, historicalFloodFreq: 0.55,
    drainCapacityM3s: 380,
    underpasses: ['Mangolpuri Underpass'],
    populationDensity: 18500,
  },
  'East': {
    drainCount: 6, drainLengthKm: 52.1, pumpingStations: 3,
    avgSlope: 0.14, imperviousPct: 80, elevation_m: 213,
    yamunaProximity: 0.85, historicalFloodFreq: 0.72,
    drainCapacityM3s: 195,
    underpasses: ['Laxmi Nagar Metro', 'Old Patparganj'],
    populationDensity: 27400,
  },
  'West': {
    drainCount: 7, drainLengthKm: 61.8, pumpingStations: 4,
    avgSlope: 0.20, imperviousPct: 62, elevation_m: 217,
    yamunaProximity: 0.30, historicalFloodFreq: 0.48,
    drainCapacityM3s: 290,
    underpasses: ['Zakhira Flyover', 'Raja Garden'],
    populationDensity: 20100,
  },
  'South': {
    drainCount: 10, drainLengthKm: 88.4, pumpingStations: 6,
    avgSlope: 0.25, imperviousPct: 58, elevation_m: 222,
    yamunaProximity: 0.20, historicalFloodFreq: 0.42,
    drainCapacityM3s: 410,
    underpasses: ['Pul Prahladpur', 'Chirag Delhi'],
    populationDensity: 15200,
  },
  'South East': {
    drainCount: 6, drainLengthKm: 45.6, pumpingStations: 3,
    avgSlope: 0.13, imperviousPct: 72, elevation_m: 214,
    yamunaProximity: 0.70, historicalFloodFreq: 0.68,
    drainCapacityM3s: 175,
    underpasses: ['Badarpur Flyover', 'Sarai Kale Khan'],
    populationDensity: 24300,
  },
  'South West': {
    drainCount: 8, drainLengthKm: 112.7, pumpingStations: 5,
    avgSlope: 0.28, imperviousPct: 42, elevation_m: 225,
    yamunaProximity: 0.15, historicalFloodFreq: 0.35,
    drainCapacityM3s: 450,
    underpasses: ['Dhaula Kuan', 'Mahipalpur Flyover'],
    populationDensity: 12500,
  },
  'New Delhi': {
    drainCount: 5, drainLengthKm: 32.9, pumpingStations: 2,
    avgSlope: 0.16, imperviousPct: 85, elevation_m: 216,
    yamunaProximity: 0.60, historicalFloodFreq: 0.58,
    drainCapacityM3s: 150,
    underpasses: ['Minto Bridge', 'Safdarjung'],
    populationDensity: 5600,
  },
  'Shahdara': {
    drainCount: 4, drainLengthKm: 28.4, pumpingStations: 2,
    avgSlope: 0.11, imperviousPct: 82, elevation_m: 211,
    yamunaProximity: 0.88, historicalFloodFreq: 0.75,
    drainCapacityM3s: 110,
    underpasses: ['Preet Vihar Metro'],
    populationDensity: 34200,
  },
};

export let ACTIVE_DISTRICT_DATA = JSON.parse(JSON.stringify(DEFAULT_DISTRICT_DATA));

/**
 * Fetches ward-level overrides from Neon PostgreSQL Database.
 * Allows Admin panel updates to instantly affect all AI predictions site-wide.
 */
export async function refreshMLParams() {
  try {
    const { data, error } = await supabase.from('wards').select('*');
    if (!error && data) {
      data.forEach(override => {
        if (ACTIVE_DISTRICT_DATA[override.id]) {
          if (override.drain_capacity_m3s !== null) {
            ACTIVE_DISTRICT_DATA[override.id].drainCapacityM3s = override.drain_capacity_m3s;
          }
          if (override.impervious_pct !== null) {
            ACTIVE_DISTRICT_DATA[override.id].imperviousPct = override.impervious_pct;
          }
        }
      });
      console.log('JAL PRAVAH ML Engine: Live parameters synced from Neon PostgreSQL.');
    }
  } catch (err) {
    console.error('Failed to sync ML params from Neon DB:', err);
  }
}

// ============================================================
//  ML MODEL — RAINFALL-GATED ARCHITECTURE (CWC/NDMA Aligned)
// ============================================================
// Key Design: Rainfall is the PRIMARY DRIVER (gate function).
// Terrain/infrastructure features are AMPLIFIERS that only
// increase risk proportionally when rainfall is present,
// aligning with CWC Rational Runoff thresholds.
// WITHOUT RAIN → probability stays very low (3-8%).
// ============================================================

/**
 * Sigmoid activation — maps any value to (0, 1)
 */
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Rainfall → base flood risk score (0-1).
 * Based on Delhi IMD classification thresholds:
 *   0mm         → ~0 (no water, no flood)
 *   < 7mm/day   → 0.02-0.08 (very light)
 *   7-15mm/day  → 0.08-0.20 (light)
 *   15-35mm/day → 0.20-0.45 (moderate)
 *   35-65mm/day → 0.45-0.70 (heavy)
 *   65-115mm    → 0.70-0.90 (very heavy)
 *   > 115mm     → 0.90-0.98 (extreme)
 */
function rainfallToBaseRisk(mm) {
  if (mm <= 0) return 0;
  if (mm <= 7) return mm * 0.012;
  if (mm <= 15) return 0.084 + (mm - 7) * 0.015;
  if (mm <= 35) return 0.204 + (mm - 15) * 0.012;
  if (mm <= 65) return 0.444 + (mm - 35) * 0.0085;
  if (mm <= 115) return 0.699 + (mm - 65) * 0.004;
  return Math.min(0.98, 0.899 + (mm - 115) * 0.001);
}

/**
 * Terrain Vulnerability Index (TVI) / Runoff Coefficient (C) 
 * A composite score (0-1) that measures how VULNERABLE a district is IF rain occurs.
 * This directly adheres to CWC's urban runoff guidelines.
 *
 * Factors with weights (Government Calibration):
 *   Impervious surface (C-factor): 30%
 *   Drainage Deficit (D-factor):   25%
 *   Terrain Slope (S-factor):      25% 
 *   Historical Hazard Frequency:   10%
 *   Sub-surface infrastructure:     5%
 *   Population Load density:        5%
 */
function computeTerrainVulnerability(districtData) {
  // Impervious (0-1): higher = more runoff
  const impervious = districtData.imperviousPct / 100;

  // Slope risk (0-1): flat terrain pools water
  const slope = districtData.avgSlope;
  let slopeRisk;
  if (slope <= 0.10) slopeRisk = 0.85;
  else if (slope <= 0.15) slopeRisk = 0.65;
  else if (slope <= 0.20) slopeRisk = 0.45;
  else if (slope <= 0.25) slopeRisk = 0.30;
  else if (slope <= 0.30) slopeRisk = 0.35;
  else slopeRisk = 0.40;

  // Drainage weakness: inverse of capacity per drain-km
  const capacityPerKm = districtData.drainCapacityM3s / districtData.drainLengthKm;
  const drainWeakness = Math.max(0, Math.min(1, 1 - (capacityPerKm / 10)));

  // Historical (already 0-1)
  const historical = districtData.historicalFloodFreq;

  // Underpass risk
  const underpassCount = Array.isArray(districtData.underpasses) ? districtData.underpasses.length : districtData.underpasses;
  const underpass = Math.min(1, underpassCount * 0.25);

  // Population density
  const popDensity = Math.min(1, districtData.populationDensity / 40000);

  // Weighted composite
  return (
    impervious  * 0.30 +
    slopeRisk   * 0.25 +
    drainWeakness * 0.25 +
    historical  * 0.10 +
    underpass   * 0.05 +
    popDensity  * 0.05
  );
}

/**
 * Drainage saturation modifier (0-1).
 * ONLY meaningful when rainfall > 0.
 */
function drainageSaturation(rainfallMm, districtData) {
  if (rainfallMm <= 0) return 0;
  const catchmentKm2 = districtData.drainLengthKm * 0.8;
  const runoffM3 = rainfallMm * 0.001 * catchmentKm2 * 1e6 * (districtData.imperviousPct / 100);
  const drainCapacity4hrs = districtData.drainCapacityM3s * 3600 * 4;
  const ratio = runoffM3 / drainCapacity4hrs;
  return sigmoid((ratio - 0.5) * 4);
}

// ============================================================
//  CORE ML PREDICTION FUNCTION
// ============================================================

/**
 * Predict flood probability for a single day.
 *
 * Architecture: RAINFALL-GATED MODEL
 *   probability = baseRisk(rainfall) × (1 + terrainAmplifier + drainageAmplifier)
 *
 * When rainfall = 0:
 *   baseRisk = 0 → probability ≈ 2-5% (tiny baseline for blocked drain flooding)
 *
 * When rainfall > 0:
 *   baseRisk scales with rainfall intensity
 *   terrainVulnerability amplifies it by up to 40%
 *   drainageSaturation amplifies it by up to 30%
 */
function predictDay(rainfallMm, districtData) {
  const tvi = computeTerrainVulnerability(districtData);
  const baseRisk = rainfallToBaseRisk(rainfallMm);
  const drainSat = drainageSaturation(rainfallMm, districtData);

  // Base probability from rainfall alone
  let probability;

  if (rainfallMm <= 0) {
    // DRY DAY: very low baseline (2-8%) based only on historical vulnerability
    // Even without rainfall, there can be minor waterlogging from blocked drains
    probability = 2 + tvi * 6; // max ~8% for most vulnerable districts
  } else {
    // WET DAY: rainfall drives risk, terrain & drainage amplify it
    const terrainAmplifier = tvi * 0.40;     // up to +40% amplification
    const drainageAmplifier = drainSat * 0.30; // up to +30% amplification
    probability = baseRisk * (1 + terrainAmplifier + drainageAmplifier) * 100;
  }

  return Math.round(Math.min(100, Math.max(1, probability)));
}

// ============================================================
//  CUMULATIVE RAINFALL MODIFIER
// ============================================================

/**
 * Multi-day cumulative effect: soil gets saturated over consecutive rain days.
 * Each subsequent rainy day adds a bonus because drainage is already stressed.
 */
function applyCumulativeEffect(baseProbabilities, dailyRainfall) {
  const adjusted = [...baseProbabilities];
  let cumulativeRain = 0;

  for (let i = 0; i < adjusted.length; i++) {
    cumulativeRain += dailyRainfall[i] || 0;
    
    // If cumulative rain over past 3 days exceeds 50mm, drainage is overwhelmed
    const lookback = dailyRainfall.slice(Math.max(0, i - 2), i + 1);
    const recentCumulative = lookback.reduce((a, b) => a + b, 0);
    
    if (recentCumulative > 80) {
      adjusted[i] = Math.min(100, adjusted[i] + 15); // Severe cumulative effect
    } else if (recentCumulative > 50) {
      adjusted[i] = Math.min(100, adjusted[i] + 8);  // Moderate cumulative
    } else if (recentCumulative > 30) {
      adjusted[i] = Math.min(100, adjusted[i] + 3);  // Slight cumulative
    }
  }

  return adjusted;
}

// ============================================================
//  PUBLIC API
// ============================================================

export function predictFlood(target, weather = {}) {
  const districtData = (typeof target === 'object') ? target : (ACTIVE_DISTRICT_DATA[target] || ACTIVE_DISTRICT_DATA['Central']);
  const forecast = weather.forecast7day || [];
  const currentRain = weather.precipitation || 0;

  // Build 7-day rainfall array (today + 6 forecast days)
  const dailyRainfall = [currentRain];
  for (let i = 0; i < 6; i++) {
    dailyRainfall.push(forecast[i] ?? 0);
  }

  // Step 1: Calculate base probability for each day
  const baseProbabilities = dailyRainfall.map(rain => predictDay(rain, districtData));

  // Step 2: Apply cumulative rainfall effect
  const finalProbabilities = applyCumulativeEffect(baseProbabilities, dailyRainfall);

  return finalProbabilities;
}

export function getFeatureBreakdown(target, rainfallMm = 0) {
  const d = (typeof target === 'object') ? target : (ACTIVE_DISTRICT_DATA[target] || ACTIVE_DISTRICT_DATA['Central']);
  const baseRisk = rainfallToBaseRisk(rainfallMm);
  const tvi = computeTerrainVulnerability(d);
  const drainSat = drainageSaturation(rainfallMm, d);

  return {
    rainfall: {
      value: `${rainfallMm.toFixed(1)}mm`,
      score: baseRisk,
      weight: 'Primary Driver',
      contribution: rainfallMm > 0 ? (baseRisk * 100).toFixed(1) + '%' : '0% (no rain)',
    },
    terrainVulnerability: {
      value: `TVI: ${(tvi * 100).toFixed(0)}/100`,
      score: tvi,
      weight: 'Amplifier (×0.40)',
      contribution: rainfallMm > 0 ? '+' + (tvi * 40).toFixed(1) + '% boost' : 'Inactive (no rain)',
    },
    drainageSaturation: {
      value: `${d.drainCapacityM3s}m³/s capacity`,
      score: drainSat,
      weight: 'Amplifier (×0.30)',
      contribution: rainfallMm > 0 ? '+' + (drainSat * 30).toFixed(1) + '% boost' : 'Inactive (no rain)',
    },
    imperviousSurface: {
      value: `${d.imperviousPct}% concrete`,
      score: d.imperviousPct / 100,
      weight: 'TVI component',
      contribution: 'Part of terrain vulnerability',
    },
    slopeRisk: {
      value: `${d.avgSlope}% avg slope`,
      score: d.avgSlope <= 0.15 ? 0.65 : (d.avgSlope <= 0.25 ? 0.35 : 0.40),
      weight: 'TVI component',
      contribution: 'Part of terrain vulnerability',
    }
  };
}

/**
 * Generate safety precautions based on risk level (deterministic, no API needed).
 */
export function getPrecautions(target, riskLevel) {
  const d = (typeof target === 'object') ? target : (ACTIVE_DISTRICT_DATA[target] || ACTIVE_DISTRICT_DATA['Central']);
  const underpasses = d.underpasses && d.underpasses.length > 0 ? d.underpasses : ['local underpasses or low-lying areas'];
  const districtName = d.name || target;

  const precautionsByRisk = {
    critical: [
      `🚨 EVACUATE low-lying areas near main water bodies in ${districtName} immediately`,
      `🏠 Move to higher floors — water levels may reach dangerous heights soon`,
      `📞 Call Disaster Helpline (1077) or Flood Control Room for rescue`,
      `⚡ Turn OFF all electrical mains before water enters your residence`,
      `🚗 DO NOT attempt to drive through ${underpasses.join(', ')} — life-threatening`,
    ],
    high: [
      `⚠️ Avoid all road travel near ${underpasses.join(', ')} in ${districtName}`,
      `🌊 Stay clear of ${districtName}'s heavy drainage outfalls and flood plain`,
      `📻 Monitor Jal Pravah alerts for ${districtName} continuously`,
      `🔦 Keep torch, power bank, medicines, and 3-day food supply ready`,
      `📱 Save Emergency Helplines on speed dial`,
    ],
    moderate: [
      `📡 Monitor live rainfall alerts for ${districtName} via Jal Pravah`,
      `🏗️ Check and clear drain covers near your home/office in ${districtName}`,
      `🌂 Carry rain gear and avoid low-lying roads during heavy spells`,
      `🔧 Report blocked drains via the Citizen Report tab to help clear them`,
      `💧 Store clean drinking water — supply may be disrupted during waterlogging`,
    ],
    low: [
      `✅ Conditions in ${districtName} are currently stable — stay informed`,
      `📱 Keep Jal Pravah bookmarked for immediate updates`,
      `🗺️ Know your nearest relief camp and evacuation routes`,
      `🔋 Keep emergency torch and first-aid kit available`,
      `🧹 Pre-monsoon check: ensure roof drains and local nalas are clear`,
    ],
  };

  return precautionsByRisk[riskLevel] || precautionsByRisk.low;
}

// Export district data for UI display
export { ACTIVE_DISTRICT_DATA as DISTRICT_DATA };
