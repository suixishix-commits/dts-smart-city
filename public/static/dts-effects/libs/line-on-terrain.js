/* OnTerrain switch for the dynamic lines (dash / arrow, V1.2 -> V1.3) and the FlowFX ribbons (particles / pulse,
 * V2.0 -> V2.1). Wraps the polyline data made by the unchanged adapters:
 *
 *   const line = DTSDynamicLines.preparePolyline({ id, coordinates, style: 'dash', width: 8 });   // or DTSFlowFX
 *   await fdapi.polyline.add(DTSLineOnTerrain.prepare(line, { onTerrain: true }));
 *
 * onTerrain false: the line floats at the given z (same look as V1.2 / V2.0 up close).
 * onTerrain true: the pattern is drawn on the visible surface under the line - terrain, roads and 3DT models such as
 * roofs and terraces; trees and buildings in front of it still hide it, leaves stay unpainted. z only needs to be
 * roughly at ground level.
 * Both modes: DTS draws a ribbon marginMeters wider than the line on each side; inside it the line is never thinner
 * than minPixelWidth pixels of a 1080-high view (its pattern grows with it), so it stays visible when the camera moves
 * away - no view range. With the defaults (30 m margin, 3 px) an 8 m line keeps 3 px to about 12 km; beyond that it is
 * as wide as the ribbon. Raise marginMeters for wider views. The margin also lets the draped line reach roofs above z
 * or ground below it.
 * Needs LineOnTerrain-V1.1-WindowsNoEditor.pak (or the effects bundle that contains it) in the render instance.
 */
(function (root) {
  'use strict';
  const NEW_MATERIALS = { // material of the unchanged adapters -> material with the OnTerrain parameter
    MI_FlowDash_V1_2: 'MI_FlowDash_V1_3',
    MI_ChaseArrow_V1_2: 'MI_ChaseArrow_V1_3',
    MI_ParticleFlow_V2_0: 'MI_ParticleFlow_V2_1',
    MI_PulseComposite_V2_0: 'MI_PulseComposite_V2_1',
  };
  const OWN_PARAMS = ['OnTerrain', 'LineWidthM', 'MinPixelWidth', 'DrapeMaxRise', 'DrapeEdgeReject', 'DrapeWiden']; // set here (DrapeWiden: V1.0)

  /**
   * Check that a value is a finite number inside a range.
   * @param {number} value value to check
   * @param {string} name option name for the error
   * @param {number} min lowest allowed value
   * @param {number} max highest allowed value
   * @returns {number} the value
   */
  const bounded = (value, name, min, max) => {
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`DTSLineOnTerrain: ${name} must be ${min}..${max}`);
    return value;
  };

  /**
   * Switch polyline data to the OnTerrain materials and set the drape fields.
   * @param {object} data polyline data from DTSDynamicLines.preparePolyline or DTSFlowFX.preparePolyline
   * @param {object} [options] { onTerrain: draw on the visible surface (default true), marginMeters: extra ribbon width
   *   on each side (default 30), minPixelWidth: thinnest on-screen width in 1080p pixels (default 3, 0 = off),
   *   maxRiseMeters: highest surface above the line's z that is painted (default no limit), leafFilter: leaf filter
   *   strength in pixel footprints (default 8, 0 = off), assetSuffix: test copies only, e.g. '_Dev6' }
   * @returns {object} new polyline data for fdapi.polyline.add / update (the input is not changed)
   */
  const prepare = (data, { onTerrain = true, marginMeters = 30, minPixelWidth = 3, maxRiseMeters = 100000, leafFilter = 8,
    assetSuffix = '' } = {}) => {
    const name = String(data?.material ?? '').split('/').pop(); // current material asset name
    const base = String(data?.material ?? '').slice(0, -name.length); // material folder
    const target = NEW_MATERIALS[name] ?? Object.values(NEW_MATERIALS).find(n => name === n + assetSuffix || name === n); // OnTerrain material
    if (!target) throw new Error(`DTSLineOnTerrain: unsupported material ${data?.material}`);
    if (typeof onTerrain !== 'boolean') throw new Error('DTSLineOnTerrain: onTerrain must be boolean');
    bounded(marginMeters, 'marginMeters', 0, 1000);
    bounded(minPixelWidth, 'minPixelWidth', 0, 50);
    bounded(maxRiseMeters, 'maxRiseMeters', 0, 100000);
    bounded(leafFilter, 'leafFilter', 0, 1000);
    const width = Number(data.lineWidthMeters ?? data.thickness); // true line width in metres (kept when prepared twice)
    if (!Number.isFinite(width) || width <= 0) throw new Error('DTSLineOnTerrain: data has no valid thickness');
    const depthTest = data.lineDepthTest ?? data.depthTest; // depth test wanted for the floating line
    const own = { OnTerrain: onTerrain ? 1 : 0, LineWidthM: width, MinPixelWidth: minPixelWidth, DrapeMaxRise: maxRiseMeters,
      DrapeEdgeReject: leafFilter }; // material parameters set here
    return {
      ...data,
      material: base + target + assetSuffix,
      thickness: width + 2 * marginMeters, // ribbon DTS draws; the line itself is drawn inside it
      lineWidthMeters: width,
      lineDepthTest: depthTest,
      depthTest: onTerrain ? false : depthTest, // DTS applies its own depth test from this field; a buried ribbon would be culled
      scalarParameters: [...(data.scalarParameters ?? []).filter(p => !OWN_PARAMS.includes(p.name)),
        ...Object.entries(own).map(([key, value]) => ({ name: key, value }))],
    };
  };

  const api = Object.freeze({ version: '1.1', materials: Object.freeze({ ...NEW_MATERIALS }), prepare }); // public API
  if (typeof module === 'object' && module.exports) module.exports = api; else root.DTSLineOnTerrain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
