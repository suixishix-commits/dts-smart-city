/* DTS Demo Center copy: pakFilePath is optional here (leave it empty when the Cloud already mounts the effects bundle). */
/* PolygonMask adapter for the DTS SDK 7.1 (fdapi): a polygon-driven, semi-transparent black mask that
 * fills in from a large outer boundary and leaves a hole, plus a blue gradient wall around the hole.
 *
 * Requires BP_PolygonMask_V1 (customObject). pakFilePath must be readable by the DTS render host.
 * Coordinates are projected metres (coordinateType 0): rings are [[x, y], ...] or [[x, y, z], ...].
 * holes: every ring of the central polygon(s), even-odd: a ring inside another hole ring is masked again.
 */
(function (global) {
  const ASSET_PATH = '/JC_CustomAssets/ObjectLibrary/Exhibition/PolygonMaskV1/BP_PolygonMask_V1'; // Blueprint asset
  const TYPE = Object.freeze({ bool: 0, float: 3, string: 5, color: 6 }); // BPFuncParamType values
  const MAX_EDGES = 256; // shader limit: outer boundary + all hole rings
  const HEIGHT_RULE = Object.freeze({ heightScale: 0.05, minHeightM: 10, maxHeightM: 150 }); // Blueprint defaults
  const VOLUME = Object.freeze({ downM: 40, upM: 300 }); // Blueprint volume range when nothing was sampled
  const state = new Map(); // id -> { origin, baseZ, heightRule } of each created mask

  /**
   * Call a customObject SDK method and wait for its explicit success reply (callback first: SDK
   * 7.1.0930 drops the Promise value of callBPFunction; Promise-returning SDKs also work).
   * @param {object} api fdapi instance
   * @param {string} method customObject method name
   * @param {Array<unknown>} args method arguments without the trailing callback
   * @param {number} [timeoutMs] reject after this many milliseconds without a reply
   * @returns {Promise<object>} SDK response whose result is 0
   */
  const invoke = (api, method, args, timeoutMs = 30000) => new Promise((resolve, reject) => {
    let settled = false; // true once resolved or rejected
    const timer = setTimeout(() => finish(new Error(`DTS customObject.${method} timed out`)), timeoutMs); // timeout guard
    /**
     * Settle the promise once.
     * @param {Error|null} error failure, or null on success
     * @param {object} [response] SDK response on success
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
     * @param {object} [response] SDK reply from the callback or Promise
     * @returns {void}
     */
    const done = response => {
      if (response === undefined) return;
      const items = Array.isArray(response?.data) ? response.data : []; // batch items, when present
      const failed = items.find(item => item && item.result !== undefined && Number(item.result) !== 0); // first failed item
      if (Number(response?.result) !== 0 || failed) {
        finish(new Error(`DTS customObject.${method} failed: ${(failed ?? response)?.resultMessage ?? 'no success reply'}`));
        return;
      }
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
   * Build one callBPFunction entry.
   * @param {string} id customObject id
   * @param {string} functionName Blueprint function name
   * @param {Array<[number, unknown]>} params [paramType, paramValue] pairs in Blueprint order
   * @returns {object} callBPFunction request item
   */
  const request = (id, functionName, params = []) => ({
    id, functionName, parameters: params.map(([paramType, paramValue]) => ({ paramType, paramValue })),
  });

  /**
   * Validate one ring and drop the repeated closing point and consecutive duplicates.
   * @param {Array<number[]>} ring [[x, y(, z)], ...] in projected metres
   * @param {string} name ring name for error messages
   * @returns {number[][]} cleaned ring with at least 3 points
   */
  const cleanRing = (ring, name) => {
    if (!Array.isArray(ring)) throw new Error(`${name} must be an array of [x, y] points`);
    const out = []; // cleaned points
    for (const point of ring) {
      if (!Array.isArray(point) || point.length < 2 || !point.slice(0, 3).every(Number.isFinite)) throw new Error(`${name} has a point that is not [x, y] or [x, y, z]`);
      const last = out[out.length - 1]; // previous kept point
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.01) out.push(point.slice(0, 3));
    }
    if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 0.01) out.pop();
    if (out.length < 3) throw new Error(`${name} needs at least 3 distinct points`);
    if (Math.abs(signedArea(out)) < 1) throw new Error(`${name} encloses less than 1 square metre`);
    return out;
  };

  /**
   * Signed shoelace area in the projected XY plane (positive = counter-clockwise).
   * @param {number[][]} ring cleaned ring
   * @returns {number} signed area in square metres
   */
  const signedArea = ring => ring.reduce((sum, [x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length]; // next vertex
    return sum + (x * ny - nx * y) / 2;
  }, 0);

  /**
   * Even-odd point-in-ring test.
   * @param {number[][]} ring cleaned ring
   * @param {number[]} point [x, y]
   * @returns {boolean} true when the point is inside
   */
  const contains = (ring, [px, py]) => {
    let inside = false; // crossing parity
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]; // current vertex
      const [xj, yj] = ring[j]; // previous vertex
      if ((yi > py) !== (yj > py) && px < xj + ((py - yj) * (xi - xj)) / (yi - yj)) inside = !inside;
    }
    return inside;
  };

  /**
   * Douglas-Peucker simplification of a closed ring.
   * @param {number[][]} ring cleaned ring
   * @param {number} tolerance maximum deviation in metres
   * @returns {number[][]} simplified ring (at least 3 points)
   */
  const simplifyRing = (ring, tolerance) => {
    if (tolerance <= 0 || ring.length <= 3) return ring;
    /**
     * Distance from p to the segment a-b.
     * @param {number[]} p point
     * @param {number[]} a segment start
     * @param {number[]} b segment end
     * @returns {number} distance in metres
     */
    const segmentDistance = (p, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1]; // segment direction
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / Math.max(dx * dx + dy * dy, 1e-12))); // projection
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    };
    const far = ring.reduce((best, p, i) => (Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1]) > Math.hypot(ring[best][0] - ring[0][0], ring[best][1] - ring[0][1]) ? i : best), 0); // vertex farthest from the first
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
    const first = chainSimplify(ring.slice(0, far + 1)); // first to farthest
    const second = chainSimplify([...ring.slice(far), ring[0]]); // farthest back to first
    const out = [...first.slice(0, -1), ...second.slice(0, -1)]; // closed ring without repeat
    return out.length >= 3 ? out : ring;
  };

  /**
   * Simplify all rings until they fit MAX_EDGES (each ring of n points has n edges).
   * @param {number[][][]} rings outer ring first
   * @returns {{ rings: number[][][], toleranceM: number }} rings that fit and the tolerance used
   */
  const fitEdges = rings => {
    let toleranceM = 0; // current simplification tolerance
    let fitted = rings; // rings at that tolerance
    while (fitted.reduce((n, ring) => n + ring.length, 0) > MAX_EDGES) {
      toleranceM = toleranceM ? toleranceM * 1.5 : 0.1;
      if (toleranceM > 1e5) throw new Error(`Cannot simplify the polygon to ${MAX_EDGES} edges`);
      fitted = rings.map(ring => simplifyRing(ring, toleranceM));
    }
    return { rings: fitted, toleranceM };
  };

  /**
   * Orient hole rings so the Blueprint's signed area sum equals the even-odd hole area: rings at an
   * even nesting depth add, rings inside another hole ring (islands) subtract.
   * @param {number[][][]} holes cleaned hole rings
   * @returns {{ holes: number[][][], areaM2: number }} oriented rings and the hole area
   */
  const orientHoles = holes => {
    let areaM2 = 0; // even-odd hole area
    const oriented = holes.map((ring, index) => {
      const depth = holes.filter((other, j) => j !== index && contains(other, ring[0])).length; // nesting depth
      const area = signedArea(ring); // projected signed area
      areaM2 += Math.abs(area) * (depth % 2 ? -1 : 1);
      // Local axes swap X and Y (a mirror), so the local sign is the opposite of the projected one:
      // even depth wants a negative projected area, odd depth a positive one.
      return (depth % 2 ? area < 0 : area > 0) ? ring.slice().reverse() : ring;
    });
    return { holes: oriented, areaM2: Math.max(areaM2, 0) };
  };

  /**
   * Default outer boundary: a rectangle around the holes, larger by marginM on every side.
   * @param {number[][][]} holes cleaned hole rings
   * @param {number} [marginM] margin in metres (default: half the larger side, at least 200 m)
   * @returns {number[][]} outer ring
   */
  const outerAround = (holes, marginM) => {
    const xs = holes.flat().map(p => p[0]), ys = holes.flat().map(p => p[1]); // all hole coordinates
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; // hole bounds
    const margin = marginM ?? Math.max(200, 0.5 * Math.max(maxX - minX, maxY - minY)); // margin in metres
    return [[minX - margin, minY - margin], [maxX + margin, minY - margin], [maxX + margin, maxY + margin], [minX - margin, maxY + margin]];
  };

  /**
   * Turn polygon data into the Blueprint's PolygonData string.
   * @param {object} input { outer?, holes, origin?, baseZ, outerMarginM? }
   * @returns {object} { data, origin, baseZ, edgeCount, holeAreaM2, toleranceM, outer, holes }
   */
  const prepare = ({ outer, holes, origin, baseZ, outerMarginM }) => {
    if (!Array.isArray(holes) || !holes.length) throw new Error('holes needs at least one ring');
    const cleanHoles = holes.map((ring, i) => cleanRing(ring, `holes[${i}]`)); // validated hole rings
    const cleanOuter = cleanRing(outer ?? outerAround(cleanHoles, outerMarginM), 'outer'); // validated outer ring
    for (const [i, ring] of cleanHoles.entries()) {
      if (!ring.every(p => contains(cleanOuter, p))) throw new Error(`holes[${i}] must lie inside the outer boundary`);
    }
    const oriented = orientHoles(cleanHoles); // area-correct hole orientation
    const fitted = fitEdges([cleanOuter, ...oriented.holes]); // within the edge limit
    const actorOrigin = origin ?? [cleanOuter[0][0], cleanOuter[0][1], baseZ]; // actor location in projected metres
    const xs = fitted.rings.flat().map(p => p[0]), ys = fitted.rings.flat().map(p => p[1]); // bounds check
    if (Math.max(...xs) - Math.min(...xs) > 20000 || Math.max(...ys) - Math.min(...ys) > 20000) throw new Error('Polygon span exceeds 20 km; split it');
    /**
     * Format a number of centimetres compactly.
     * @param {number} value centimetres
     * @returns {string} value with at most one decimal
     */
    const cm = value => String(Math.round(value * 10) / 10);
    // Verified DTS actor convention (BoundaryFlow V1): local X = projected North, local Y = East, cm.
    const data = fitted.rings.map(ring => ring.map(([x, y, z]) => `X=${cm((y - actorOrigin[1]) * 100)} Y=${cm((x - actorOrigin[0]) * 100)} Z=${cm(((z ?? actorOrigin[2]) - actorOrigin[2]) * 100)}`).join('|')).join(';');
    return {
      data, origin: actorOrigin, baseZ: actorOrigin[2], edgeCount: fitted.rings.reduce((n, ring) => n + ring.length, 0),
      holeAreaM2: oriented.areaM2, toleranceM: fitted.toleranceM, outer: fitted.rings[0], holes: fitted.rings.slice(1),
    };
  };

  /**
   * Height the Blueprint will use: H = clamp(k * sqrt(A), Hmin, Hmax).
   * @param {number} areaM2 hole area in square metres
   * @param {object} [rule] { heightScale, minHeightM, maxHeightM }
   * @returns {number} wall height in metres
   */
  const heightFor = (areaM2, rule = HEIGHT_RULE) => Math.min(Math.max(rule.heightScale * Math.sqrt(areaM2), rule.minHeightM), Math.max(rule.minHeightM, rule.maxHeightM));

  /**
   * Surface heights (DTS tools.linesIntersect, top-down): a low percentile along the hole rings as the base
   * (roofs and tree tops on the outline do not lift it), plus the lowest and highest hit over the whole masked
   * area for the projection volume. The area must be in the camera view.
   * @param {object} api fdapi instance
   * @param {number[][][]} holes hole rings
   * @param {number[][]} [outer] outer ring; adds an 8 x 8 grid of probes inside it
   * @returns {Promise<{ base: number, low: number, high: number }|null>} metres, or null when nothing was hit
   */
  const sampleGround = async (api, holes, outer) => {
    const points = holes.flat(); // all hole vertices
    const step = Math.max(1, Math.floor(points.length / 64)); // at most about 64 samples
    const outline = points.filter((_, i) => i % step === 0); // outline samples (the base)
    const grid = []; // interior samples over the masked area (the volume range)
    if (outer) {
      const xs = outer.map(q => q[0]), ys = outer.map(q => q[1]); // outer bounds
      for (let i = 1; i <= 8; i++) for (let j = 1; j <= 8; j++) {
        const q = [Math.min(...xs) + (i / 9) * (Math.max(...xs) - Math.min(...xs)), Math.min(...ys) + (j / 9) * (Math.max(...ys) - Math.min(...ys))]; // grid point
        if (contains(outer, q)) grid.push(q);
      }
    }
    const probes = [...outline, ...grid].map(([x, y]) => ({ start: [x, y, 3000], end: [x, y, -500] })); // vertical probes
    const reply = await new Promise(resolve => { // SDK reply; the callback is authoritative in SDK 7.1.0930
      let done = false; // true once settled
      /**
       * Settle once.
       * @param {object|null} value SDK reply
       * @returns {void}
       */
      const finish = value => { if (!done) { done = true; resolve(value); } };
      setTimeout(() => finish(null), 15000);
      try {
        const pending = api.tools.linesIntersect(probes, false, false, finish); // Promise in some SDK builds
        if (pending && typeof pending.then === 'function') pending.then(finish, () => finish(null));
      } catch (error) {
        finish(null);
      }
    });
    const items = reply?.intersects ?? reply?.data ?? []; // one entry per probe
    const heights = (Array.isArray(items) ? items : []).map(item => item?.LineIntersectPoint?.[2]); // hit height per probe
    const rim = heights.slice(0, outline.length).filter(Number.isFinite).sort((a, b) => a - b); // outline hits
    const all = heights.filter(Number.isFinite); // every hit
    if (!rim.length) return null;
    return { base: rim[Math.floor(rim.length * 0.2)], low: Math.min(...all), high: Math.max(...all) };
  };

  /**
   * Turn style options into setter requests; only supplied fields are sent.
   * @param {string} id customObject id
   * @param {object} style fillDurationSeconds, revealDurationSeconds, maskOpacity, color [r,g,b,a] linear,
   *   glowIntensity, wallGradientPower, heightScale, minHeightM, maxHeightM, progress (0..1, holds the fill there)
   * @returns {object[]} callBPFunction request items
   */
  const styleRequests = (id, style = {}) => {
    const out = []; // requests
    const entry = state.get(id); // remembered height rule
    if (style.fillDurationSeconds !== undefined) out.push(request(id, 'SetFillDuration', [[TYPE.float, style.fillDurationSeconds]]));
    if (style.revealDurationSeconds !== undefined) out.push(request(id, 'SetRevealDuration', [[TYPE.float, style.revealDurationSeconds]]));
    if (style.maskOpacity !== undefined) out.push(request(id, 'SetMaskOpacity', [[TYPE.float, style.maskOpacity]]));
    if (style.color !== undefined) out.push(request(id, 'SetColor', [[TYPE.color, style.color]]));
    if (style.glowIntensity !== undefined) out.push(request(id, 'SetGlowIntensity', [[TYPE.float, style.glowIntensity]]));
    if (style.wallGradientPower !== undefined) out.push(request(id, 'SetWallGradient', [[TYPE.float, style.wallGradientPower]]));
    if (['heightScale', 'minHeightM', 'maxHeightM'].some(key => style[key] !== undefined)) {
      const rule = { ...(entry?.heightRule ?? HEIGHT_RULE), ...Object.fromEntries(['heightScale', 'minHeightM', 'maxHeightM'].filter(k => style[k] !== undefined).map(k => [k, style[k]])) }; // merged rule
      if (entry) entry.heightRule = rule;
      out.push(request(id, 'SetHeightRule', [[TYPE.float, rule.heightScale], [TYPE.float, rule.minHeightM], [TYPE.float, rule.maxHeightM]]));
    }
    if (style.progress !== undefined) out.push(request(id, 'SetFillProgress', [[TYPE.float, style.progress]]));
    return out;
  };

  /**
   * Create (or replace) a mask, set its polygon and style, then play the fill animation.
   * @param {object} api fdapi instance after onReady
   * @param {object} options { id, holes, outer?, outerMarginM?, groundZ? (metres; default: sampled),
   *   heightRangeM? ([down, up] metres around the base; default: fitted to the sampled heights),
   *   pakFilePath, autoPlay = true, ...style }
   * @returns {Promise<object>} prepared data summary (edgeCount, holeAreaM2, heightM, origin, volume, ...)
   */
  const create = async (api, { id, holes, outer, outerMarginM, groundZ, heightRangeM, pakFilePath, autoPlay = true, ...style }) => {
    if (typeof id !== 'string' || !id) throw new Error('id is required');
    if (pakFilePath !== undefined && pakFilePath !== '' && (typeof pakFilePath !== 'string' || !/\.pak$/i.test(pakFilePath.trim()))) throw new Error('pakFilePath must be empty or the .pak path on the DTS render host');
    const layout = prepare({ outer, holes, baseZ: 0, outerMarginM }); // outer ring for the height samples
    const sample = Number.isFinite(groundZ) ? null : await sampleGround(api, holes, layout.outer); // surface heights
    const baseZ = Number.isFinite(groundZ) ? groundZ : sample?.base ?? 0; // ground height in metres
    const prepared = prepare({ outer, holes, baseZ, outerMarginM }); // Blueprint data
    // Every covered pixel costs, so the volume spans only the sampled ground and roofs (plus room for what the
    // probes missed) instead of a fixed kilometre.
    const [downM, upM] = heightRangeM ?? (sample ? [Math.min(300, Math.max(40, baseZ - sample.low + 20)), Math.min(2000, Math.max(150, sample.high - baseZ + 60))] : [VOLUME.downM, VOLUME.upM]); // range around the base
    await invoke(api, 'delete', [id]).catch(() => {});
    await invoke(api, 'add', [{
      id, assetPath: ASSET_PATH, ...(pakFilePath ? { pakFilePath: pakFilePath.trim() } : {}), location: prepared.origin, rotation: [0, 0, 0], scale: [1, 1, 1],
      coordinateType: 0, collision: false, autoHeight: false, enableDecal: false,
    }]);
    state.set(id, { origin: prepared.origin, baseZ: prepared.baseZ, heightRule: { ...HEIGHT_RULE } });
    const calls = [...styleRequests(id, style), request(id, 'SetVolume', [[TYPE.float, downM], [TYPE.float, upM]]),
      request(id, 'SetPolygon', [[TYPE.string, prepared.data]])]; // setup calls (volume first, so the polygon is built once)
    if (autoPlay && style.progress === undefined) calls.push(request(id, 'Play'));
    await invoke(api, 'callBPFunction', [calls]);
    return { ...prepared, heightM: heightFor(prepared.holeAreaM2, state.get(id).heightRule), volume: { downM, upM } };
  };

  /**
   * Replace the polygon of an existing mask; the wall height eases to the new area's height.
   * @param {object} api fdapi instance
   * @param {string} id mask id from create()
   * @param {object} polygon { holes, outer?, outerMarginM? }
   * @returns {Promise<object>} prepared data summary
   */
  const update = async (api, id, { holes, outer, outerMarginM }) => {
    const entry = state.get(id); // origin of the existing actor
    if (!entry) throw new Error(`Unknown mask ${id}; call create() first`);
    const prepared = prepare({ outer, holes, origin: entry.origin, baseZ: entry.baseZ, outerMarginM }); // same actor origin
    await invoke(api, 'callBPFunction', [[request(id, 'SetPolygon', [[TYPE.string, prepared.data]])]]);
    return { ...prepared, heightM: heightFor(prepared.holeAreaM2, entry.heightRule) };
  };

  /**
   * Replay the fill animation from the outer boundary to the hole outline.
   * @param {object} api fdapi instance
   * @param {string} id mask id
   * @returns {Promise<object>} raw SDK response
   */
  const play = (api, id) => invoke(api, 'callBPFunction', [[request(id, 'Play')]]);

  /**
   * Restyle an existing mask (fields as in styleRequests).
   * @param {object} api fdapi instance
   * @param {string} id mask id
   * @param {object} style style fields
   * @returns {Promise<object>} raw SDK response
   */
  const setStyle = (api, id, style) => invoke(api, 'callBPFunction', [styleRequests(id, style)]);

  /**
   * Remove a mask.
   * @param {object} api fdapi instance
   * @param {string} id mask id
   * @returns {Promise<void>} resolves when DTS deleted it (or it did not exist)
   */
  const remove = async (api, id) => {
    await invoke(api, 'delete', [id]).catch(() => {});
    state.delete(id);
  };

  /**
   * Hole rings from a GeoJSON Polygon or MultiPolygon geometry (coordinates in projected metres).
   * @param {object} geometry GeoJSON geometry
   * @returns {number[][][]} rings for the holes option
   */
  const holesFromGeoJSON = geometry => {
    if (geometry?.type === 'Polygon') return geometry.coordinates;
    if (geometry?.type === 'MultiPolygon') return geometry.coordinates.flat();
    throw new Error('Expected a GeoJSON Polygon or MultiPolygon');
  };

  global.PolygonMask = { ASSET_PATH, MAX_EDGES, invoke, prepare, heightFor, sampleGround, create, update, play, setStyle, remove, holesFromGeoJSON };
})(typeof window !== 'undefined' ? window : globalThis);
