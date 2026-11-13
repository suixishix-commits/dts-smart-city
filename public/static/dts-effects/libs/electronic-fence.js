/* DTS Demo Center copy: pakFilePath is optional here (leave it empty when the Cloud already mounts the effects bundle). */
/* ElectronicFence V1 adapter for DTS (fdapi, SDK 7.1).
   One customObject (BP_ElectronicFence_V1) draws one fence along a closed ground polygon: a glowing ground outline with
   a narrow soft glow, and a translucent blue energy curtain that rises from zero height. play() first brightens the
   outline, then lifts the whole curtain at once (about 2 s, slow start, fast middle, soft stop) behind a thin bright
   cyan top edge. Once standing, only the wall texture moves (slowly rising particles, faint flow lines, a low scan band,
   gentle breathing); the curtain rises again only when play() is called.
   Coordinates are projected metres (coordinateType 0). Ground heights come from the points' z, a fixed groundZ, or DTS
   tools.linesIntersect probes (the fence area must then be in the camera view). */
(function (root) {
  'use strict';

  const VERSION = '1.0'; // adapter version
  const ASSET_PATH = '/JC_CustomAssets/ObjectLibrary/Exhibition/ElectronicFenceV1/BP_ElectronicFence_V1'; // Blueprint asset
  const TYPE = Object.freeze({ float: 3, floatArray: 15 }); // BPFuncParamType values
  const VIEW_RANGE_M = 1000000; // customObject far clip (m); the SDK default 10 km would cut far views
  const MAX_POINTS = 4096; // Blueprint limit: path points including the closing repeat (Build/spec.py)
  const MAX_CORNERS = 256; // Blueprint limit: outline corners for the ground line (Build/spec.py)
  const CELL_M = 1.2; // the wall pattern repeats every 1.2 m along the fence; the perimeter is rounded to a multiple
  const DEFAULT_HEIGHT_M = 15; // curtain height
  const DEFAULT_TIMING = Object.freeze({ riseSeconds: 2, preRollSeconds: 0.35 }); // rise and outline lead-in
  const DEFAULT_STYLE = Object.freeze({
    color: '#278cff', edgeColor: '#61e2ff', brightness: 1, wallOpacity: 0.28, gradientPower: 1.6, particleDensity: 0.55,
    flowIntensity: 0.35, scanIntensity: 0.3, breathAmount: 0.08, frontBoost: 1.2, groundGlowM: 1.2, groundLineM: 0.3,
  }); // electric blue curtain, cyan-blue top edge
  const SAMPLE_STEP_M = 4; // ground sample spacing along the outline
  const fences = new Map(); // id -> { objectId, origin, heightM, style, timing, summary }

  // ---------------------------------------------------------------------------------------------
  // Geometry

  /**
   * Linear RGB of a #rrggbb colour (or [r, g, b] already linear).
   * @param {string|number[]} color colour
   * @returns {number[]} [r, g, b] linear
   */
  const toLinear = color => {
    if (Array.isArray(color)) return color.slice(0, 3).map(Number);
    const hex = /^#?([0-9a-f]{6})$/i.exec(String(color ?? '').trim()); // parsed digits
    if (!hex) throw new Error(`Colour must be #rrggbb or [r, g, b]: ${color}`);
    return [0, 2, 4].map(i => { const c = parseInt(hex[1].slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  };

  /**
   * Signed shoelace area (positive = counter-clockwise).
   * @param {number[][]} ring points [x, y, ...]
   * @returns {number} square metres
   */
  const signedArea = ring => ring.reduce((sum, [x, y], i) => { const [nx, ny] = ring[(i + 1) % ring.length]; return sum + (x * ny - nx * y) / 2; }, 0);

  /**
   * Validate a ring, drop the repeated closing point and consecutive duplicates.
   * @param {Array<number[]>} ring [[x, y(, z)], ...] projected metres
   * @returns {number[][]} cleaned ring (at least 3 points)
   */
  const cleanRing = ring => {
    if (!Array.isArray(ring)) throw new Error('coordinates must be an array of [x, y] points');
    const out = []; // kept points
    for (const point of ring) {
      if (!Array.isArray(point) || point.length < 2 || !point.slice(0, 3).every(Number.isFinite)) throw new Error('coordinates has a point that is not [x, y] or [x, y, z]');
      const last = out[out.length - 1]; // previous kept point
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.01) out.push(point.slice(0, 3));
    }
    if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 0.01) out.pop();
    if (out.length < 3) throw new Error('coordinates needs at least 3 distinct points');
    if (Math.abs(signedArea(out)) < 1) throw new Error('the fence encloses less than 1 square metre');
    return out;
  };

  /**
   * Douglas-Peucker simplification of a closed ring.
   * @param {number[][]} ring cleaned ring
   * @param {number} tolerance maximum deviation (m)
   * @returns {number[][]} simplified ring (at least 3 points)
   */
  const simplifyRing = (ring, tolerance) => {
    if (tolerance <= 0 || ring.length <= 3) return ring;
    /**
     * Distance from p to segment a-b.
     * @param {number[]} p point
     * @param {number[]} a segment start
     * @param {number[]} b segment end
     * @returns {number} metres
     */
    const segmentDistance = (p, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1]; // segment direction
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / Math.max(dx * dx + dy * dy, 1e-12))); // projection
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    };
    /**
     * Simplify an open chain recursively.
     * @param {number[][]} chain points from start to end inclusive
     * @returns {number[][]} kept points including both ends
     */
    const chainSimplify = chain => {
      let index = -1, distance = 0; // farthest interior point
      for (let i = 1; i < chain.length - 1; i++) {
        const d = segmentDistance(chain[i], chain[0], chain[chain.length - 1]); // deviation
        if (d > distance) { distance = d; index = i; }
      }
      if (distance <= tolerance) return [chain[0], chain[chain.length - 1]];
      return [...chainSimplify(chain.slice(0, index + 1)).slice(0, -1), ...chainSimplify(chain.slice(index))];
    };
    const far = ring.reduce((best, p, i) => (Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1]) > Math.hypot(ring[best][0] - ring[0][0], ring[best][1] - ring[0][1]) ? i : best), 0); // vertex farthest from the first
    const out = [...chainSimplify(ring.slice(0, far + 1)).slice(0, -1), ...chainSimplify([...ring.slice(far), ring[0]]).slice(0, -1)]; // closed ring without repeat
    return out.length >= 3 ? out : ring;
  };

  /**
   * Simplify until the ring fits the corner limit.
   * @param {number[][]} ring cleaned ring
   * @returns {{ ring: number[][], toleranceM: number }} corners and the tolerance used
   */
  const fitCorners = ring => {
    let toleranceM = 0; // current tolerance
    let fitted = ring; // ring at that tolerance
    while (fitted.length > MAX_CORNERS) {
      toleranceM = toleranceM ? toleranceM * 1.5 : 0.05;
      fitted = simplifyRing(ring, toleranceM);
    }
    return { ring: fitted, toleranceM };
  };

  /**
   * Points along the closed outline: every corner plus samples at most stepM apart (fewer when the point limit needs it).
   * @param {number[][]} corners outline corners (z optional)
   * @param {number} stepM sample spacing (m)
   * @returns {Array<{ x: number, y: number, z: number|undefined, corner: boolean }>} open ring of path points
   */
  const densify = (corners, stepM) => {
    const lengths = corners.map((a, i) => { const b = corners[(i + 1) % corners.length]; return Math.hypot(b[0] - a[0], b[1] - a[1]); }); // edge lengths
    const perimeter = lengths.reduce((s, l) => s + l, 0); // metres
    const step = Math.max(stepM, perimeter / (MAX_POINTS - corners.length - 2)); // keeps the total under the limit
    const out = []; // path points
    corners.forEach((a, i) => {
      const b = corners[(i + 1) % corners.length]; // edge end
      const k = Math.max(1, Math.ceil(lengths[i] / step)); // samples on this edge
      for (let j = 0; j < k; j++) {
        const t = j / k; // position on the edge
        const z = Number.isFinite(a[2]) && Number.isFinite(b[2]) ? a[2] + (b[2] - a[2]) * t : undefined; // given heights interpolate
        out.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z, corner: j === 0 });
      }
    });
    return out;
  };

  /**
   * Robust ground heights along the path: gaps take the nearest hit, then each point takes the second lowest of its
   * seven neighbours (a single tree top, vehicle or roof edge on the line does not lift the fence).
   * @param {number[]} raw heights per point (NaN where nothing was hit)
   * @returns {number[]|null} heights, or null when nothing was hit at all
   */
  const robustHeights = raw => {
    const n = raw.length; // points (circular)
    if (!raw.some(Number.isFinite)) return null;
    const filled = raw.map((z, i) => {
      if (Number.isFinite(z)) return z;
      for (let d = 1; d < n; d++) {
        const a = raw[(i + d) % n], b = raw[(i - d + n) % n]; // neighbours d steps away
        if (Number.isFinite(a)) return a;
        if (Number.isFinite(b)) return b;
      }
      return 0;
    }); // every point has a height
    return filled.map((_, i) => [-3, -2, -1, 0, 1, 2, 3].map(d => filled[(i + d + n) % n]).sort((a, b) => a - b)[1]);
  };

  /**
   * Blueprint path data: [count, then per point x, y, z (actor-local cm: X north, Y east, Z up), s (metres along the
   * fence, perimeter rounded to the pattern repeat), corner flag]; the first point is repeated at the end.
   * @param {Array<{ x: number, y: number, corner: boolean }>} points open ring
   * @param {number[]} heights ground height per point (m)
   * @returns {{ data: number[], origin: number[], perimeterM: number, lowM: number, highM: number }} payload and frame
   */
  const pathData = (points, heights) => {
    const xs = points.map(p => p.x), ys = points.map(p => p.y); // planar coordinates
    const lowM = Math.min(...heights), highM = Math.max(...heights); // ground range
    const origin = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, lowM]; // actor location
    const ring = [...points, points[0]]; // closed
    const hs = [...heights, heights[0]]; // heights of the closed ring
    const steps = ring.slice(1).map((p, i) => Math.hypot(p.x - ring[i].x, p.y - ring[i].y)); // segment lengths
    const perimeterM = steps.reduce((s, l) => s + l, 0); // metres
    const scale = Math.max(CELL_M, Math.round(perimeterM / CELL_M) * CELL_M) / perimeterM; // seamless pattern at the start point
    const data = [ring.length]; // payload
    let s = 0; // metres along the fence
    ring.forEach((p, i) => {
      // Verified DTS customObject frame (spawned turned): local X = projected north, local Y = east, centimetres.
      data.push(Math.round((p.y - origin[1]) * 1000) / 10, Math.round((p.x - origin[0]) * 1000) / 10, Math.round((hs[i] - origin[2]) * 1000) / 10,
        Math.round(s * scale * 1000) / 1000, i < points.length && p.corner ? 1 : 0);
      if (i < steps.length) s += steps[i];
    });
    return { data, origin, perimeterM, lowM, highM };
  };

  // ---------------------------------------------------------------------------------------------
  // SDK helpers (SDK 7.1.0930 answers callBPFunction only in the callback)

  /**
   * Call a customObject SDK method and wait for its explicit success reply.
   * @param {object} api fdapi instance
   * @param {string} method customObject method name
   * @param {Array<unknown>} args arguments without the trailing callback
   * @param {number} [timeoutMs] reject after this many milliseconds
   * @returns {Promise<object>} SDK response whose result is 0
   */
  const invoke = (api, method, args, timeoutMs = 60000) => new Promise((resolve, reject) => {
    let settled = false; // true once settled
    const timer = setTimeout(() => finish(new Error(`DTS customObject.${method} timed out`)), timeoutMs); // timeout guard
    /**
     * Settle the promise once.
     * @param {Error|null} error failure, or null on success
     * @param {object} [response] SDK response
     * @returns {void}
     */
    function finish(error, response) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(response);
    }
    /**
     * Accept only an explicit result 0, including every item of a batch reply.
     * @param {object} [response] SDK reply
     * @returns {void}
     */
    const done = response => {
      if (response === undefined) return;
      const items = Array.isArray(response?.data) ? response.data : []; // batch items
      const failed = items.find(item => item && item.result !== undefined && Number(item.result) !== 0); // first failed item
      if (Number(response?.result) !== 0 || failed) { finish(new Error(`DTS customObject.${method} failed: ${(failed ?? response)?.resultMessage ?? 'no success reply'}`)); return; }
      finish(null, response);
    };
    try {
      const pending = api.customObject[method](...args, done); // undefined for callBPFunction in SDK 7.1.0930
      if (pending && typeof pending.then === 'function') pending.then(done, error => finish(error));
    } catch (error) {
      finish(error);
    }
  });

  /**
   * One callBPFunction request item.
   * @param {string} objectId customObject id
   * @param {string} functionName Blueprint function
   * @param {Array<number|number[]>} values parameters in Blueprint order (arrays go as float arrays)
   * @returns {object} request item
   */
  const call = (objectId, functionName, values = []) => ({
    id: objectId, functionName,
    parameters: values.map(v => (Array.isArray(v) ? { paramType: TYPE.floatArray, paramValue: v } : { paramType: TYPE.float, paramValue: Number(v) })),
  });

  /**
   * SetStyle request from a style object (DEFAULT_STYLE fields).
   * @param {string} objectId customObject id
   * @param {object} s full style
   * @returns {object} request item
   */
  const styleCall = (objectId, s) => {
    const c = toLinear(s.color), e = toLinear(s.edgeColor); // linear colours
    return call(objectId, 'SetStyle', [...c, ...e, s.brightness, s.wallOpacity, s.gradientPower, s.particleDensity, s.flowIntensity,
      s.scanIntensity, s.breathAmount, s.frontBoost, s.groundGlowM, s.groundLineM]);
  };

  /**
   * Surface heights under points (DTS tools.linesIntersect, vertical probes, batches of 500). The area must be in view.
   * @param {object} api fdapi instance
   * @param {Array<{ x: number, y: number }>} points probe positions
   * @returns {Promise<number[]>} height per point (NaN where nothing was hit)
   */
  const sampleGround = async (api, points) => {
    const heights = []; // results in order
    for (let start = 0; start < points.length; start += 500) {
      const batch = points.slice(start, start + 500); // probes of this request
      const reply = await new Promise(resolve => { // SDK reply; the callback is authoritative in SDK 7.1.0930
        let done = false; // true once settled
        /**
         * Settle once.
         * @param {object|null} value SDK reply
         * @returns {void}
         */
        const finish = value => { if (!done) { done = true; resolve(value); } };
        setTimeout(() => finish(null), 20000);
        try {
          const pending = api.tools.linesIntersect(batch.map(p => ({ start: [p.x, p.y, 3000], end: [p.x, p.y, -500] })), false, false, finish); // Promise in some SDK builds
          if (pending && typeof pending.then === 'function') pending.then(finish, () => finish(null));
        } catch (error) {
          finish(null);
        }
      });
      const items = reply?.intersects ?? reply?.data ?? []; // one entry per probe
      batch.forEach((_, i) => { const z = Number((Array.isArray(items) ? items[i] : null)?.LineIntersectPoint?.[2]); heights.push(Number.isFinite(z) ? z : NaN); });
    }
    return heights;
  };

  /**
   * Remembered fence.
   * @param {string} id fence id
   * @returns {object} record
   */
  const record = id => {
    const f = fences.get(id); // record
    if (!f) throw new Error(`Unknown electronic fence ${id}; call create() first`);
    return f;
  };

  // ---------------------------------------------------------------------------------------------
  // Public API

  /**
   * Create (or replace) a fence along a closed polygon.
   * @param {object} api fdapi instance after onReady
   * @param {object} options { id, pakFilePath, coordinates [[x, y(, z)], ...] (projected m; z = ground height),
   *   heightM? (15), groundZ? (fixed ground height, m), sampleStepM? (4), mode? ('rise' default: brighten then rise;
   *   'outline': ground outline only until play(); 'full': standing at once), timing? { riseSeconds, preRollSeconds },
   *   style? (DEFAULT_STYLE fields), assetPath? }
   * @returns {Promise<object>} summary { id, origin, perimeterM, points, corners, toleranceM, heightM, ground, volume }
   */
  const create = async (api, { id, pakFilePath, coordinates, heightM = DEFAULT_HEIGHT_M, groundZ, sampleStepM = SAMPLE_STEP_M, mode = 'rise', timing = {}, style = {}, assetPath = ASSET_PATH }) => {
    if (typeof id !== 'string' || !id || id.includes(':')) throw new Error('id is required and must not contain ":"');
    if (pakFilePath !== undefined && pakFilePath !== '' && (typeof pakFilePath !== 'string' || !/\.pak$/i.test(pakFilePath.trim()))) throw new Error('pakFilePath must be empty or the .pak path on the DTS render host');
    if (!['rise', 'outline', 'full'].includes(mode)) throw new Error("mode must be 'rise', 'outline' or 'full'");
    const { ring: corners, toleranceM } = fitCorners(cleanRing(coordinates)); // outline within the corner limit
    const points = densify(corners, Math.max(0.5, Number(sampleStepM) || SAMPLE_STEP_M)); // path points
    let ground = 'coordinates'; // where the heights came from
    let heights = points.map(p => p.z); // given heights
    if (Number.isFinite(groundZ)) { heights = points.map(() => groundZ); ground = 'groundZ'; }
    else if (!heights.every(Number.isFinite)) {
      heights = robustHeights(await sampleGround(api, points));
      ground = heights ? 'sampled' : 'none (0 m: put the fence area in view or pass groundZ)';
      heights = heights ?? points.map(() => 0);
    }
    const prepared = pathData(points, heights); // Blueprint payload
    const volume = { downM: 3, upM: Math.min(2000, prepared.highM - prepared.lowM + 5) }; // projection range around the base
    await remove(api, id);
    const objectId = `${id}:fence`; // customObject id
    await invoke(api, 'delete', [[objectId]]).catch(() => {}); // leftovers after a page reload
    await invoke(api, 'add', [[{
      id: objectId, groupId: id, assetPath, ...(pakFilePath ? { pakFilePath: pakFilePath.trim() } : {}), location: prepared.origin, rotation: [0, 0, 0], scale: [1, 1, 1],
      coordinateType: 0, collision: false, autoHeight: false, enableDecal: false, range: [0, VIEW_RANGE_M],
    }]]);
    const f = { objectId, origin: prepared.origin, heightM, style: { ...DEFAULT_STYLE, ...style }, timing: { ...DEFAULT_TIMING, ...timing } }; // record
    fences.set(id, f);
    const start = mode === 'rise' ? call(objectId, 'Play', [f.timing.riseSeconds, f.timing.preRollSeconds]) : call(objectId, mode === 'full' ? 'ShowFull' : 'ShowOutline'); // first state
    // The height is set while the fence still waits as an outline, so it applies at once.
    await invoke(api, 'callBPFunction', [[styleCall(objectId, f.style), call(objectId, 'SetHeight', [heightM]), call(objectId, 'SetVolume', [volume.downM, volume.upM]),
      call(objectId, 'SetPath', [prepared.data]), start]]);
    f.summary = { id, origin: prepared.origin, perimeterM: prepared.perimeterM, points: points.length, corners: corners.length, toleranceM, heightM, ground, volume };
    return { ...f.summary };
  };

  /**
   * Raise the curtain again from zero: the outline brightens, then the wall rises.
   * @param {object} api fdapi instance
   * @param {string} id fence id
   * @param {{ riseSeconds?: number, preRollSeconds?: number }} [timing] seconds (rise about 2 looks best)
   * @returns {Promise<void>} resolves when DTS answered
   */
  const play = async (api, id, timing = {}) => {
    const f = record(id); // record
    Object.assign(f.timing, Object.fromEntries(Object.entries(timing).filter(([, v]) => Number.isFinite(v))));
    await invoke(api, 'callBPFunction', [[call(f.objectId, 'Play', [f.timing.riseSeconds, f.timing.preRollSeconds])]]);
  };

  /**
   * Show the standing fence at once (no rise).
   * @param {object} api fdapi instance
   * @param {string} id fence id
   * @returns {Promise<void>} resolves when DTS answered
   */
  const showFull = async (api, id) => { await invoke(api, 'callBPFunction', [[call(record(id).objectId, 'ShowFull')]]); };

  /**
   * Back to the ground outline only (the curtain is down until the next play()).
   * @param {object} api fdapi instance
   * @param {string} id fence id
   * @returns {Promise<void>} resolves when DTS answered
   */
  const showOutline = async (api, id) => { await invoke(api, 'callBPFunction', [[call(record(id).objectId, 'ShowOutline')]]); };

  /**
   * Change the curtain height (a standing fence eases to it in 0.8 s).
   * @param {object} api fdapi instance
   * @param {string} id fence id
   * @param {number} heightM metres (0.5 - 500)
   * @returns {Promise<void>} resolves when DTS answered
   */
  const setHeight = async (api, id, heightM) => {
    const f = record(id); // record
    f.heightM = heightM;
    await invoke(api, 'callBPFunction', [[call(f.objectId, 'SetHeight', [heightM])]]);
  };

  /**
   * Restyle (DEFAULT_STYLE fields; only the supplied ones change).
   * @param {object} api fdapi instance
   * @param {string} id fence id
   * @param {object} style style fields
   * @returns {Promise<object>} the full style
   */
  const setStyle = async (api, id, style) => {
    const f = record(id); // record
    Object.assign(f.style, style);
    await invoke(api, 'callBPFunction', [[styleCall(f.objectId, f.style)]]);
    return { ...f.style };
  };

  /**
   * Show or hide.
   * @param {object} api fdapi instance
   * @param {string} id fence id
   * @param {boolean} visible true to show
   * @returns {Promise<void>} resolves when DTS answered
   */
  const setVisible = async (api, id, visible) => { await invoke(api, visible ? 'show' : 'hide', [[record(id).objectId]]); };

  /**
   * Delete.
   * @param {object} api fdapi instance
   * @param {string} id fence id
   * @returns {Promise<void>} resolves when deleted (or nothing to delete)
   */
  const remove = async (api, id) => {
    const f = fences.get(id); // record
    if (!f) return;
    fences.delete(id);
    await invoke(api, 'delete', [[f.objectId]]).catch(() => {});
  };

  /**
   * Outer ring of a GeoJSON Polygon / MultiPolygon geometry (largest part), coordinates in projected metres.
   * @param {object} geometry GeoJSON geometry
   * @returns {number[][]} ring for the coordinates option
   */
  const ringFromGeoJSON = geometry => {
    if (geometry?.type === 'Polygon') return geometry.coordinates[0];
    if (geometry?.type === 'MultiPolygon') return geometry.coordinates.map(p => p[0]).sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)))[0];
    throw new Error('Expected a GeoJSON Polygon or MultiPolygon');
  };

  const ElectronicFence = Object.freeze({
    VERSION, ASSET_PATH, DEFAULT_STYLE, DEFAULT_TIMING, DEFAULT_HEIGHT_M, MAX_POINTS, MAX_CORNERS, CELL_M,
    create, play, showFull, showOutline, setHeight, setStyle, setVisible, remove, ringFromGeoJSON,
    get: id => (fences.get(id) ? { ...fences.get(id).summary, style: { ...fences.get(id).style }, timing: { ...fences.get(id).timing } } : undefined),
    toLinear, cleanRing, simplifyRing, fitCorners, densify, robustHeights, pathData, sampleGround, invoke,
  }); // public API
  root.ElectronicFence = ElectronicFence;
  if (typeof module !== 'undefined') module.exports = ElectronicFence;
})(typeof window !== 'undefined' ? window : globalThis);
