import { describe, expect, it } from 'vitest';
import { cloudLayers } from '../src/cloudModel';
import { compositeFragment } from '../src/renderShaders';

describe('procedural cloud heights', () => {
  it('places low cloud bases below 2 km and lets cumulus extend across levels', () => {
    expect(cloudLayers.cumulus.baseM).toBeLessThan(2000);
    expect(cloudLayers.cumulus.topM).toBeGreaterThan(3048);
    expect(cloudLayers.toweringCumulus.baseM).toBeLessThan(cloudLayers.cumulus.topM);
    expect(cloudLayers.toweringCumulus.topM).toBeGreaterThan(10668);
  });

  it('keeps temperate cirrus in the WMO high-cloud band and passes heights to the renderer', () => {
    expect(cloudLayers.cirrus.baseM).toBeGreaterThanOrEqual(5000);
    expect(cloudLayers.cirrus.topM).toBeLessThanOrEqual(13000);
    for (const layer of Object.values(cloudLayers)) {
      expect(layer.baseM).toBeLessThan(layer.topM);
      expect(compositeFragment).toContain(`${layer.baseM}.0,${layer.topM}.0`);
    }
  });
});
