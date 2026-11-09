// Representative geometric heights above mean sea level for the procedural
// ocean weather scene. These are cloud envelopes, not fixed cloud bases from
// a live weather report. Cumulus may cross the low/middle/high level boundaries.
export const cloudLayers = {
  cumulus: { baseM: 900, topM: 3200 },
  toweringCumulus: { baseM: 2800, topM: 12000 },
  cirrus: { baseM: 6500, topM: 13000 },
} as const;
