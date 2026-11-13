/* DTS Demo Center copy: pakFilePath is optional here (leave it empty when the Cloud already mounts the effects bundle). */
/* RegionDotFlow V2 adapter for the DTS SDK 7.1 (fdapi): coloured dot lattice + glowing, flowing outline for
 * many adjacent map regions, drawn by ONE BP_RegionDotFlow_V2 customObject per layer.
 *
 * V1 used one customObject per region part and at most 256 edges per part. V2 bakes the whole layer into a
 * single field texture (RGBA16f: distance to the nearest border, arc position, region code, region attributes)
 * and draws it with one projection volume, so the per-frame cost does not depend on the number of regions or
 * points. The bake runs on the GPU in tiles; this adapter builds the tiles: shared borders (arcs), simplification
 * to the field resolution, region colouring, and compact packed point data (one float per point).
 *
 * Coordinates are projected metres (coordinateType 0): rings are [[x, y], ...]. Region rings use the even-odd
 * rule (outer parts, holes, islands). Neighbouring regions should share their border vertices (true for regions
 * exported from one dataset); T-junctions are fixed automatically.
 * Internal frame ("field frame", centimetres, relative to the layer origin): fx = north (projected y), fy = east
 * (projected x). DTS spawns custom objects rotated (yaw -90), so this is the actor's local frame.
 */
(function (global) {
  const VERSION = '2.2'; // adapter version
  const ASSET_PATH = '/JC_CustomAssets/ObjectLibrary/Exhibition/RegionDotFlowV2/BP_RegionDotFlow_V2'; // Blueprint asset
  const TYPE = Object.freeze({ bool: 0, float: 3, string: 5, color: 6, floatArray: 15 }); // BPFuncParamType values
  const LIMITS = Object.freeze({ // shared with Build/spec.py and the bake shader
    maxFieldTexels: 4096, // field side limit (RGBA16f: 128 MB at 4096 x 4096)
    minTexelCm: 150, // finest field texel
    clampTexels: 48, // distances are exact up to this many texels, then clamped
    maxClampTexels: 128, // longest exact distance a layer can ask for (contour rings, clampTexels option)
    rootTile: 256, // largest bake tile (texels)
    minTile: 8, // smallest bake tile
    tileFloats: 2048, // floats per bake tile (copy material P0..P511 -> DataRT)
    gridCell: 32, // edge index cell (texels)
    palette: 64, // colours per layer
    batchFloats: 48000, // most floats per AddTiles call (the Blueprint sets them in one frame: keep it short)
    bakeBudget: 3e9, // most bake work (texels x floats) per AddTiles call, so no frame bakes too much
    bakeGapMs: 8, // pause between bake calls (lets the renderer finish a frame)
  });
  const HEADER = 9; // floats per piece header: n + 512 * flags, codes L/R, ring positions and steps L/R, bounding box
  const MAX_PIECE_POINTS = 64; // points per piece (short pieces keep their bounding boxes tight)
  const JUNCTION_PENALTY = 0.05; // texels added to junction-end distances seen from behind (bake shader too)
  const BATCH_CHARS = 3000000; // most request characters per callBPFunction
  const PROBES = 4000; // ground probes per layer (tools.linesIntersect)
  const VOLUME = Object.freeze({ downM: 30, upM: 300 }); // projection volume when nothing was sampled
  const VIEW_RANGE_M = 1000000; // customObject far clip (m); the SDK default 10 km hid layers seen from farther away
  const DEFAULT_STYLE = Object.freeze({ // Blueprint defaults (Build/spec.py)
    baseOpacity: 0.05,
    dotSpacingM: 40, dotSizeM: 8, dotIntensity: 1.1, dotOpacity: 0.7, dotEdgeBoost: 0.5, dotGapPx: 3, dotFadePx: 5,
    breathPeriodSeconds: 5.5, breathAmount: 0.08,
    lineWidthPx: 2, lineIntensity: 1.6, lineOpacity: 0.95, lineWhiten: 0.06,
    glowWidthPx: 12, glowIntensity: 1, glowOpacity: 0.15, glowCapRatio: 0.22,
    spillWidthPx: 4, spillIntensity: 0.25,
    flowPeriodSeconds: 13, flowLength: 0.07, flowCount: 2, flowIntensity: 2.5,
    pattern: 'dots', patternLinePx: 1, patternAnim: 0.4, patternRings: 4,
    surface: 'drape', flatHeightM: 0, flatDepthTest: true,
    paused: false,
  });
  // Where the layer is drawn: 'drape' on the visible surface (terrain, photogrammetry, roofs), or 'flat' on a
  // horizontal sheet flatHeightM above the layer base; with flatDepthTest, buildings in front of the sheet hide it.
  const SURFACES = Object.freeze({ drape: 0, flat: 1 });
  // Interior patterns (the effect sheet's 01-06); the dot* fields set their spacing, size, brightness and opacity.
  const PATTERNS = Object.freeze({ dots: 0, glimmer: 1, hatch: 2, honeycomb: 3, contour: 4, grid: 5 });
  const PATTERN_FIELDS = ['pattern', 'dotSpacingM', 'dotSizeM', 'dotIntensity', 'dotOpacity', 'patternLinePx', 'patternAnim', 'patternRings']; // fields every preset sets
  const PRESETS = Object.freeze({ // starting points per variant (reference view: 1 px is about 4 m)
    dots: Object.freeze({ pattern: 'dots', dotSpacingM: 40, dotSizeM: 8, dotIntensity: 1.1, dotOpacity: 0.7, patternLinePx: 1, patternAnim: 0.4, patternRings: 4 }), // 06 点阵流光
    glimmer: Object.freeze({ pattern: 'glimmer', dotSpacingM: 64, dotSizeM: 7, dotIntensity: 1.5, dotOpacity: 0.75, patternLinePx: 1, patternAnim: 0.4, patternRings: 4 }), // 01 微光点阵
    hatch: Object.freeze({ pattern: 'hatch', dotSpacingM: 28, dotSizeM: 8, dotIntensity: 0.9, dotOpacity: 0.5, patternLinePx: 1, patternAnim: 0, patternRings: 4 }), // 02 精密斜纹
    honeycomb: Object.freeze({ pattern: 'honeycomb', dotSpacingM: 48, dotSizeM: 8, dotIntensity: 0.9, dotOpacity: 0.55, patternLinePx: 1, patternAnim: 0, patternRings: 4 }), // 03 蜂巢微网
    contour: Object.freeze({ pattern: 'contour', dotSpacingM: 24, dotSizeM: 8, dotIntensity: 1.4, dotOpacity: 0.75, patternLinePx: 1.2, patternAnim: 1.2, patternRings: 4 }), // 04 轮廓流线
    grid: Object.freeze({ pattern: 'grid', dotSpacingM: 32, dotSizeM: 8, dotIntensity: 0.75, dotOpacity: 0.38, patternLinePx: 0.8, patternAnim: 0.6, patternRings: 4 }), // 05 数字微栅格
  });
  const GROUPS = Object.freeze([ // Blueprint setter -> style fields in parameter order
    ['SetBaseTint', ['baseOpacity']],
    ['SetDots', ['dotSpacingM', 'dotSizeM', 'dotIntensity', 'dotOpacity']],
    ['SetDotDetail', ['dotEdgeBoost', 'dotGapPx', 'dotFadePx']],
    ['SetBreath', ['breathPeriodSeconds', 'breathAmount']],
    ['SetLine', ['lineWidthPx', 'lineIntensity', 'lineOpacity', 'lineWhiten']],
    ['SetGlow', ['glowWidthPx', 'glowIntensity', 'glowOpacity', 'glowCapRatio']],
    ['SetSpill', ['spillWidthPx', 'spillIntensity']],
    ['SetFlow', ['flowPeriodSeconds', 'flowLength', 'flowCount', 'flowIntensity']],
    ['SetPattern', ['pattern', 'patternLinePx', 'patternAnim', 'patternRings']],
    ['SetSurface', ['surface', 'flatHeightM', 'flatDepthTest']],
  ]);
  const OFFSET = 2 ** 25; // vertex key offset (field coordinates within +-335 km of the origin)
  const layers = new Map(); // layer id -> { objectId, style, prepared }
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()); // millisecond timer

  /**
   * Hash map from non-negative integer-valued numbers (< 2^53) to int32 values, open addressing in typed arrays
   * (several times faster than Map for millions of numeric keys).
   */
  class NumMap {
    /**
     * @param {number} expected expected number of keys
     */
    constructor(expected) {
      let cap = 16; // power-of-two capacity
      while (cap < expected * 2) cap *= 2;
      this.mask = cap - 1; // index mask
      this.keys = new Float64Array(cap).fill(-1); // -1 = empty slot
      this.values = new Int32Array(cap); // values
      this.size = 0; // keys stored
    }

    /**
     * Slot of a key (where it is or would go).
     * @param {number} key key
     * @returns {number} slot index
     */
    slot(key) {
      const hi = Math.floor(key / 4294967296), lo = key - hi * 4294967296; // 32-bit halves
      let i = (Math.imul(lo | 0, 0x9e3779b1) ^ Math.imul(hi | 0, 0x85ebca77)) & this.mask; // probe start
      while (this.keys[i] !== -1 && this.keys[i] !== key) i = (i + 1) & this.mask;
      return i;
    }

    /**
     * Value of a key, inserting `value` when the key is new (one probe).
     * @param {number} key key
     * @param {number} value value stored for a new key
     * @returns {number} existing value, or -1 when the key was inserted
     */
    getOrSet(key, value) {
      if ((this.size + 1) * 2 > this.mask + 1) this.grow();
      const i = this.slot(key); // slot
      if (this.keys[i] === key) return this.values[i];
      this.keys[i] = key; this.values[i] = value; this.size++;
      return -1;
    }

    /**
     * Value of a key.
     * @param {number} key key
     * @returns {number} value, or -1 when absent
     */
    get(key) {
      const i = this.slot(key); // slot
      return this.keys[i] === key ? this.values[i] : -1;
    }

    /**
     * Store a value (grows when half full).
     * @param {number} key key
     * @param {number} value int32 value
     * @returns {void}
     */
    set(key, value) {
      let i = this.slot(key); // slot
      if (this.keys[i] !== key) {
        if ((this.size + 1) * 2 > this.mask + 1) { this.grow(); i = this.slot(key); }
        this.keys[i] = key; this.size++;
      }
      this.values[i] = value;
    }

    /**
     * Double the capacity.
     * @returns {void}
     */
    grow() {
      const keys = this.keys, values = this.values; // old storage
      this.mask = keys.length * 2 - 1;
      this.keys = new Float64Array(keys.length * 2).fill(-1);
      this.values = new Int32Array(keys.length * 2);
      this.size = 0;
      for (let i = 0; i < keys.length; i++) if (keys[i] !== -1) this.set(keys[i], values[i]);
    }
  }

  /**
   * Blueprint id of a pattern given by name ('hatch') or id (2).
   * @param {string|number} pattern pattern name or id
   * @returns {number} id 0-5
   */
  const patternId = pattern => {
    const id = typeof pattern === 'string' ? PATTERNS[pattern] : Number(pattern); // resolved id
    if (!Number.isInteger(id) || id < 0 || id > 5) throw new Error(`pattern must be one of ${Object.keys(PATTERNS).join(', ')} (or 0-5): ${pattern}`);
    return id;
  };

  /**
   * Blueprint id of a surface mode given by name ('flat') or id (1).
   * @param {string|number} surface surface mode name or id
   * @returns {number} id 0-1
   */
  const surfaceId = surface => {
    const id = typeof surface === 'string' ? SURFACES[surface] : Number(surface); // resolved id
    if (id !== 0 && id !== 1) throw new Error(`surface must be 'drape' or 'flat' (or 0-1): ${surface}`);
    return id;
  };

  /**
   * Blueprint value of a style field (names of patterns and surface modes become ids).
   * @param {string} key style field
   * @param {unknown} value field value
   * @returns {number} value sent to the Blueprint
   */
  const fieldValue = (key, value) => (key === 'pattern' ? patternId(value) : key === 'surface' ? surfaceId(value) : Number(value));

  /**
   * Projection volume (m below / above the layer base) for a style: draping fits the sampled ground and roofs
   * (or heightRangeM), a flat sheet only has to be enclosed.
   * @param {object} vol layer volume { base, sample, heightRangeM }
   * @param {object} style full style
   * @returns {number[]} [down, up] metres
   */
  const volumeRange = (vol, style) => {
    if (surfaceId(style.surface) === SURFACES.flat) {
      const h = Number(style.flatHeightM) || 0; // sheet height above the base (m)
      return [Math.max(5, 5 - h), Math.max(10, h + 5)];
    }
    if (vol.heightRangeM) return vol.heightRangeM;
    const s = vol.sample; // sampled surface heights
    return s ? [Math.min(300, Math.max(20, vol.base - s.low + 20)), Math.min(2000, Math.max(150, s.high - vol.base + 60))] : [VOLUME.downM, VOLUME.upM];
  };

  /**
   * SetVolume request for a layer volume and style.
   * @param {string} oid customObject id
   * @param {object} vol layer volume { centerCm, sizeCm, base, sample, heightRangeM }
   * @param {object} style full style
   * @returns {object} callBPFunction item
   */
  const volumeRequest = (oid, vol, style) => {
    const [down, up] = volumeRange(vol, style); // metres below / above the base
    return request(oid, 'SetVolume', [[TYPE.float, vol.centerCm[0]], [TYPE.float, vol.centerCm[1]], [TYPE.float, vol.sizeCm[0]], [TYPE.float, vol.sizeCm[1]], [TYPE.float, down], [TYPE.float, up]]);
  };

  /**
   * Exact field distance a style needs (m): contour rings reach (rings + 1) spacings into a region.
   * @param {object} style full style
   * @returns {number} metres, 0 when the default reach is enough
   */
  const styleReachM = style => (patternId(style.pattern) === PATTERNS.contour ? (Math.max(1, Math.round(style.patternRings)) + 1) * Number(style.dotSpacingM) : 0);

  // ---------------------------------------------------------------------------------------------
  // SDK helpers

  /**
   * Call a customObject SDK method and wait for its explicit success reply (callback first: SDK 7.1.0930 drops
   * the Promise value of callBPFunction; Promise-returning SDKs also work).
   * @param {object} api fdapi instance
   * @param {string} method customObject method name
   * @param {Array<unknown>} args method arguments without the trailing callback
   * @param {number} [timeoutMs] reject after this many milliseconds without a reply
   * @returns {Promise<object>} SDK response whose result is 0
   */
  const invoke = (api, method, args, timeoutMs = 120000) => new Promise((resolve, reject) => {
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
   * Send callBPFunction items in batches limited by request size.
   * @param {object} api fdapi instance
   * @param {object[]} items request items
   * @param {(sent: number) => void} [progress] called after every batch with the number of items sent
   * @returns {Promise<void>} resolves when every batch succeeded
   */
  const callAll = async (api, items, progress) => {
    let batch = [], chars = 0, sent = 0; // current request, its size, items sent
    for (const item of items) {
      const size = item.size ?? JSON.stringify(item).length; // request characters of this item
      if (batch.length && chars + size > BATCH_CHARS) {
        await invoke(api, 'callBPFunction', [batch.map(strip)]);
        sent += batch.length; progress?.(sent);
        batch = []; chars = 0;
      }
      batch.push(item); chars += size;
    }
    if (batch.length) { await invoke(api, 'callBPFunction', [batch.map(strip)]); sent += batch.length; progress?.(sent); }
  };

  /**
   * Remove the size hint from a request item.
   * @param {object} item request item, possibly with a size field
   * @returns {object} item without size
   */
  const strip = ({ size, ...item }) => item;

  // ---------------------------------------------------------------------------------------------
  // Colours and small geometry helpers

  /**
   * Region colour as linear RGBA: '#rrggbb' (sRGB, as in a legend) or [r, g, b(, a)] already linear.
   * @param {string|number[]} color input colour
   * @returns {number[]} [r, g, b, a] linear
   */
  const toLinear = color => {
    if (Array.isArray(color)) return [color[0], color[1], color[2], color[3] ?? 1].map(Number);
    const hex = /^#?([0-9a-f]{6})$/i.exec(String(color ?? '').trim()); // parsed hex digits
    if (!hex) throw new Error(`Colour must be #rrggbb or [r, g, b]: ${color}`);
    return [0, 2, 4].map(i => {
      const c = parseInt(hex[1].slice(i, i + 2), 16) / 255; // sRGB channel 0..1
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }).concat(1);
  };

  /**
   * Signed shoelace area of a ring given by vertex ids (positive = counter-clockwise in the field frame).
   * @param {ArrayLike<number>} ring vertex ids without closing vertex
   * @param {Float64Array} vx vertex fx (cm)
   * @param {Float64Array} vy vertex fy (cm)
   * @returns {number} signed area in cm2
   */
  const ringArea = (ring, vx, vy) => {
    let sum = 0; // twice the signed area
    for (let i = 0, n = ring.length; i < n; i++) {
      const a = ring[i], b = ring[i + 1 < n ? i + 1 : 0]; // edge ends
      sum += vx[a] * vy[b] - vx[b] * vy[a];
    }
    return sum / 2;
  };

  /**
   * Even-odd point-in-ring test.
   * @param {ArrayLike<number>} ring vertex ids
   * @param {Float64Array} vx vertex fx
   * @param {Float64Array} vy vertex fy
   * @param {number} px point fx
   * @param {number} py point fy
   * @returns {boolean} true when inside
   */
  const ringContains = (ring, vx, vy, px, py) => {
    let inside = false; // crossing parity
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = vx[ring[i]], yi = vy[ring[i]], xj = vx[ring[j]], yj = vy[ring[j]]; // edge ends
      if ((yi > py) !== (yj > py) && px < xj + ((py - yj) * (xi - xj)) / (yi - yj)) inside = !inside;
    }
    return inside;
  };

  /**
   * Douglas-Peucker on an index range of a polyline (iterative); marks kept points.
   * @param {Float64Array} xs point x
   * @param {Float64Array} ys point y
   * @param {number} first first index
   * @param {number} last last index (kept)
   * @param {number} tolerance maximum deviation
   * @param {Uint8Array} keep output marks (1 = kept)
   * @returns {void}
   */
  const douglasPeucker = (xs, ys, first, last, tolerance, keep) => {
    keep[first] = 1; keep[last] = 1;
    const stack = [first, last]; // pending index ranges
    const tol2 = tolerance * tolerance; // squared tolerance
    while (stack.length) {
      const b = stack.pop(), a = stack.pop(); // range ends
      const ax = xs[a], ay = ys[a], dx = xs[b] - ax, dy = ys[b] - ay; // chord
      const len2 = dx * dx + dy * dy; // squared chord length
      let worst = -1, index = -1; // farthest point
      for (let i = a + 1; i < b; i++) {
        let ex = xs[i] - ax, ey = ys[i] - ay; // offset from the chord start
        if (len2 > 0) {
          const t = Math.max(0, Math.min(1, (ex * dx + ey * dy) / len2)); // projection
          ex -= t * dx; ey -= t * dy;
        }
        const d2 = ex * ex + ey * ey; // squared deviation
        if (d2 > worst) { worst = d2; index = i; }
      }
      if (index >= 0 && worst > tol2) { keep[index] = 1; stack.push(a, index, index, b); }
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Preparation: rings -> arcs -> simplified arcs -> codes -> field layout -> packed tiles

  /**
   * Rings from a GeoJSON Polygon or MultiPolygon geometry (coordinates in projected metres).
   * @param {object} geometry GeoJSON geometry
   * @returns {number[][][]} rings (even-odd)
   */
  function ringsFromGeometry(geometry) {
    if (geometry?.type === 'Polygon') return geometry.coordinates;
    if (geometry?.type === 'MultiPolygon') return geometry.coordinates.flat();
    throw new Error('Expected a GeoJSON Polygon or MultiPolygon');
  }

  /**
   * Regions from a GeoJSON FeatureCollection.
   * @param {object} collection FeatureCollection with Polygon / MultiPolygon features
   * @param {object} [options] { idField = 'id', color: (feature) => colour }
   * @returns {object[]} regions for create()
   */
  const regionsFromGeoJSON = (collection, { idField = 'id', color = () => '#2f6bff' } = {}) => (collection?.features ?? []).map((feature, i) => ({
    id: String(feature.properties?.[idField] ?? feature.id ?? i), color: color(feature), rings: ringsFromGeometry(feature.geometry),
  }));

  /**
   * Turn regions into the packed field bake (pure, no SDK call).
   * @param {Array<{ id: string, color: string|number[], rings?: number[][][], geometry?: object }>} regions input regions
   * @param {object} [options] { simplifyM (extra tolerance, m), maxFieldTexels, minTexelCm, clampTexels, reachM (exact
   *   distance the style needs, m; contour rings) }
   * @returns {object} layer data: origin, field, tiles, palette, regions, stats
   */
  const prepare = (regions, options = {}) => {
    const started = clock(); // timing
    const stats = { ms: {} }; // timings and counts
    let lap = started; // last timing mark
    /**
     * Record the time since the previous mark.
     * @param {string} name step name
     * @returns {void}
     */
    const mark = name => { const now = clock(); stats.ms[name] = Math.round(now - lap); lap = now; };
    const maxField = Math.max(64, Math.min(LIMITS.maxFieldTexels, Math.round(options.maxFieldTexels ?? LIMITS.maxFieldTexels))); // field side limit
    const minTexel = Math.max(25, Number(options.minTexelCm ?? LIMITS.minTexelCm)); // finest texel (cm)
    const fixedM = options.clampTexels !== undefined ? Math.max(8, Math.min(LIMITS.maxClampTexels, Math.round(options.clampTexels))) : null; // caller's clamp (texels)
    const reachCm = Math.max(0, Number(options.reachM ?? 0) * 100); // exact distance the style needs (cm)
    let layoutM = fixedM ?? LIMITS.clampTexels; // field margin (texels)
    if (!Array.isArray(regions) || !regions.length) throw new Error('regions needs at least one region');

    // 1. Collect rings, find the origin (bbox centre) and snap to centimetres in the field frame.
    const meta = []; // per region { id, color }
    const rawRings = []; // { region, points }
    const ids = new Set(); // region ids seen
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; // projected bounds
    regions.forEach((region, index) => {
      const id = String(region.id ?? index); // region id
      if (ids.has(id)) throw new Error(`Duplicate region id ${id}`);
      ids.add(id);
      const source = region.rings ?? ringsFromGeometry(region.geometry); // raw rings
      if (!Array.isArray(source)) throw new Error(`regions[${index}] needs rings or a geometry`);
      source.forEach((ring, k) => {
        if (!Array.isArray(ring)) throw new Error(`regions[${index}].rings[${k}] must be an array of [x, y] points`);
        for (const p of ring) {
          const x = p?.[0], y = p?.[1]; // coordinates
          if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`regions[${index}].rings[${k}] has a point that is not [x, y]`);
          if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        rawRings.push({ region: index, points: ring, name: `regions[${index}].rings[${k}]` });
      });
      meta.push({ id, color: toLinear(region.color ?? '#2f6bff') });
    });
    if (!rawRings.length) throw new Error('regions contain no rings');
    const origin = [Math.round((minX + maxX) * 50) / 100, Math.round((minY + maxY) * 50) / 100]; // projected metres
    if ((maxX - minX) * 100 > 2 * OFFSET * 0.9 || (maxY - minY) * 100 > 2 * OFFSET * 0.9) throw new Error('Regions span more than about 600 km');
    let total = 0; // input points
    for (const r of rawRings) total += r.points.length;
    let vx = new Float64Array(total + 1024), vy = new Float64Array(total + 1024); // vertex coordinates (field cm)
    let vertexCount = 0; // vertices so far
    const vertexOf = new NumMap(total); // snapped key -> vertex id
    /**
     * Vertex id of a snapped field point (creates it on first use).
     * @param {number} fx north cm (integer)
     * @param {number} fy east cm (integer)
     * @returns {number} vertex id
     */
    const vertex = (fx, fy) => {
      const key = (fx + OFFSET) * 67108864 + (fy + OFFSET); // 2^26 * x + y
      const v = vertexOf.getOrSet(key, vertexCount); // existing vertex, or -1 when just added
      if (v >= 0) return v;
      if (vertexCount >= vx.length) { const grow = vx.length * 2; const nx = new Float64Array(grow), ny = new Float64Array(grow); nx.set(vx); ny.set(vy); vx = nx; vy = ny; }
      vx[vertexCount] = fx; vy[vertexCount] = fy;
      return vertexCount++;
    };
    let rings = []; // { region, verts: number[] }
    for (const raw of rawRings) {
      const verts = []; // vertex ids without repeats
      for (const p of raw.points) {
        const v = vertex(Math.round((p[1] - origin[1]) * 100), Math.round((p[0] - origin[0]) * 100)); // field frame: north, east
        if (!verts.length || verts[verts.length - 1] !== v) verts.push(v);
      }
      if (verts.length > 1 && verts[0] === verts[verts.length - 1]) verts.pop();
      if (verts.length < 3 || Math.abs(ringArea(verts, vx, vy)) < 10000) continue; // < 3 points or < 1 m2
      rings.push({ region: raw.region, verts });
    }
    if (!rings.length) throw new Error('No ring has 3 distinct points and 1 square metre');
    stats.inputPoints = total;
    mark('snap');

    // 2. Even-odd nesting inside each region: even depth = outer ring (counter-clockwise), odd = hole (clockwise).
    const byRegion = meta.map(() => []); // ring indices per region
    rings.forEach((r, i) => byRegion[r.region].push(i));
    for (const own of byRegion) {
      if (own.length === 1) {
        const r = rings[own[0]]; // single ring
        if (ringArea(r.verts, vx, vy) < 0) r.verts.reverse();
        continue;
      }
      const boxes = own.map(i => { // bounding boxes for a quick reject
        const v = rings[i].verts; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; // bounds
        for (const id of v) { if (vx[id] < x0) x0 = vx[id]; if (vx[id] > x1) x1 = vx[id]; if (vy[id] < y0) y0 = vy[id]; if (vy[id] > y1) y1 = vy[id]; }
        return [x0, y0, x1, y1];
      });
      own.forEach((i, a) => {
        const p = rings[i].verts[0]; // test point of this ring
        let depth = 0; // rings of the same region containing it
        own.forEach((j, b) => {
          if (a === b) return;
          const box = boxes[b]; // candidate bounds
          if (vx[p] < box[0] || vx[p] > box[2] || vy[p] < box[1] || vy[p] > box[3]) return;
          if (ringContains(rings[j].verts, vx, vy, vx[p], vy[p])) depth++;
        });
        const ccw = ringArea(rings[i].verts, vx, vy) > 0; // current orientation
        if ((depth % 2 === 0) !== ccw) rings[i].verts.reverse();
      });
    }
    mark('nest');

    // 3. Undirected edges: owners and region-degree of vertices. T-junctions get noded first (only edges that
    //    are not matched by a neighbour can need it).
    /**
     * Edge table of the current rings.
     * @returns {{ slot: Map<number, number>, count: Uint8Array, regA: Int32Array, regB: Int32Array }} owners per edge
     */
    const edgeTable = () => {
      let edges = 0; // ring edges
      for (const r of rings) edges += r.verts.length;
      const slot = new NumMap(edges); // undirected key -> slot
      const count = new Uint8Array(edges), regA = new Int32Array(edges), regB = new Int32Array(edges).fill(-1); // owners
      const N = vertexCount + 1; // key base
      let next = 0; // next free slot
      for (const r of rings) {
        const v = r.verts, n = v.length; // ring vertices
        for (let i = 0; i < n; i++) {
          const a = v[i], b = v[i + 1 < n ? i + 1 : 0]; // edge ends
          const key = a < b ? a * N + b : b * N + a; // undirected key
          let s = slot.get(key); // slot of this edge
          if (s < 0) { s = next++; slot.set(key, s); regA[s] = r.region; }
          else if (regA[s] !== r.region && regB[s] < 0) regB[s] = r.region;
          if (count[s] < 255) count[s]++;
        }
      }
      return { slot, count, regA, regB, N };
    };
    let table = edgeTable(); // edge owners
    {
      // T-junctions: a vertex lying on an unmatched edge of another region (within 2 cm) is inserted into that
      // edge. Only unmatched edges can need it, and a vertex used by that edge's region alone never does.
      const firstRegion = new Int32Array(vertexCount).fill(-1); // region using a vertex (-2: several)
      for (const r of rings) for (const v of r.verts) firstRegion[v] = firstRegion[v] === -1 || firstRegion[v] === r.region ? r.region : -2;
      const looseRing = [], looseAt = []; // unmatched edges: ring and position
      let looseLen = 0; // their total length
      rings.forEach((r, ri) => {
        const v = r.verts, n = v.length; // ring vertices
        for (let i = 0; i < n; i++) {
          const a = v[i], b = v[i + 1 < n ? i + 1 : 0]; // edge ends
          if (table.count[table.slot.get(a < b ? a * table.N + b : b * table.N + a)] !== 1) continue;
          looseRing.push(ri); looseAt.push(i); looseLen += Math.hypot(vx[b] - vx[a], vy[b] - vy[a]);
        }
      });
      if (looseRing.length) {
        const cell = Math.max(500, (2 * looseLen) / looseRing.length); // grid cell (cm)
        const heads = new NumMap(looseRing.length * 2 + 16); // cell key -> first vertex of its list
        const cellRegion = new NumMap(looseRing.length * 2 + 16); // cell key -> its only region (-2: several)
        const nextIn = new Int32Array(vertexCount).fill(-1); // vertex list links
        const listed = new Uint8Array(vertexCount); // vertex already in the grid
        /**
         * Grid key of a cell.
         * @param {number} cx cell x
         * @param {number} cy cell y
         * @returns {number} key
         */
        const cellKey = (cx, cy) => (cx + OFFSET) * 67108864 + (cy + OFFSET);
        // A T-junction vertex of region B on region A's edge ends unmatched edges of B, so it is listed here.
        for (let k = 0; k < looseRing.length; k++) {
          const v = rings[looseRing[k]].verts; // ring
          for (const u of [v[looseAt[k]], v[(looseAt[k] + 1) % v.length]]) {
            if (listed[u]) continue;
            listed[u] = 1;
            const key = cellKey(Math.floor(vx[u] / cell), Math.floor(vy[u] / cell)); // cell of the vertex
            nextIn[u] = heads.get(key); heads.set(key, u);
            const was = cellRegion.getOrSet(key, firstRegion[u] + 3) - 3; // cell's region so far (-4: new cell)
            if (was !== -4 && was !== firstRegion[u]) cellRegion.set(key, 1); // several regions: -2 (stored + 3)
          }
        }
        const inserts = new Map(); // "ring,position" -> [{ v, t }]
        for (let k = 0; k < looseRing.length; k++) {
          const ri = looseRing[k], i = looseAt[k], r = rings[ri].verts, region = rings[ri].region; // unmatched edge
          const a = r[i], b = r[(i + 1) % r.length]; // ends
          const ax = vx[a], ay = vy[a], dx = vx[b] - ax, dy = vy[b] - ay, len2 = dx * dx + dy * dy; // segment
          if (len2 < 1) continue;
          const c0 = Math.floor((Math.min(ax, vx[b]) - 2) / cell), c1 = Math.floor((Math.max(ax, vx[b]) + 2) / cell); // cell range x
          const d0 = Math.floor((Math.min(ay, vy[b]) - 2) / cell), d1 = Math.floor((Math.max(ay, vy[b]) + 2) / cell); // cell range y
          for (let cx = c0; cx <= c1; cx++) for (let cy = d0; cy <= d1; cy++) {
            const key = cellKey(cx, cy); // cell
            if (cellRegion.get(key) - 3 === region) continue; // only this region's own vertices here
            for (let u = heads.get(key); u >= 0; u = nextIn[u]) {
              if (u === a || u === b || firstRegion[u] === region) continue;
              const t = ((vx[u] - ax) * dx + (vy[u] - ay) * dy) / len2; // projection
              if (t <= 0 || t >= 1) continue;
              const ex = vx[u] - ax - t * dx, ey = vy[u] - ay - t * dy; // deviation
              if (ex * ex + ey * ey > 4) continue; // farther than 2 cm
              const key = `${ri},${i}`; // edge identity
              let list = inserts.get(key); if (!list) inserts.set(key, (list = [])); list.push({ v: u, t });
            }
          }
        }
        if (inserts.size) {
          const perRing = new Map(); // ring -> Map(position -> sorted inserted vertices)
          for (const [key, list] of inserts) {
            const [ri, i] = key.split(',').map(Number); // edge identity
            let m = perRing.get(ri); if (!m) perRing.set(ri, (m = new Map()));
            m.set(i, [...new Map(list.map(h => [h.v, h])).values()].sort((a, b) => a.t - b.t).map(h => h.v));
          }
          for (const [ri, m] of perRing) {
            const v = rings[ri].verts, out = []; // ring with inserted vertices
            for (let i = 0; i < v.length; i++) { out.push(v[i]); const add = m.get(i); if (add) out.push(...add); }
            rings[ri].verts = out;
          }
          table = edgeTable();
          stats.nodedVertices = [...inserts.values()].reduce((n, l) => n + l.length, 0);
        }
      }
    }
    mark('node');

    // 4. Arcs: maximal runs of edges with the same neighbours, each shared by both sides; the arc's direction is
    //    the first ring's direction, so its left side is that ring's region (rings keep their interior on the left).
    const junction = new Uint8Array(vertexCount); // 1 = three or more regions meet
    {
      const first = new Int32Array(vertexCount).fill(-1), second = new Int32Array(vertexCount).fill(-1); // first two regions at a vertex
      for (const r of rings) for (const v of r.verts) {
        const g = r.region; // region of this ring
        if (first[v] < 0 || first[v] === g) first[v] = g;
        else if (second[v] < 0 || second[v] === g) second[v] = g;
        else junction[v] = 1;
      }
    }
    const arcs = []; // { verts: Int32Array, closed, left, right, leftRing, rightRing, ... }
    const edgeArc = new Int32Array(table.count.length).fill(-1); // slot -> arc
    const ringArcs = rings.map(() => []); // per ring: [{ arc, reversed, at }]
    rings.forEach((r, ri) => {
      const v = r.verts, n = v.length; // ring vertices
      const sig = new Float64Array(n); // neighbour signature per edge
      const slots = new Int32Array(n); // slot per edge
      for (let i = 0; i < n; i++) {
        const a = v[i], b = v[i + 1 < n ? i + 1 : 0]; // edge ends
        const s = table.slot.get(a < b ? a * table.N + b : b * table.N + a); // slot
        slots[i] = s;
        const other = table.regA[s] === r.region ? table.regB[s] : table.regA[s]; // neighbour region or -1
        sig[i] = other; // -1 = exterior
      }
      const breaks = []; // positions where an arc starts
      for (let i = 0; i < n; i++) if (sig[(i + n - 1) % n] !== sig[i] || junction[v[i]]) breaks.push(i);
      const closed = !breaks.length; // the whole ring is one arc
      const starts = closed ? [0] : breaks; // arc starts
      for (let k = 0; k < starts.length; k++) {
        const s0 = starts[k], s1 = closed ? s0 + n : (k + 1 < starts.length ? starts[k + 1] : starts[0] + n); // range [s0, s1]
        const s = slots[s0 % n]; // first edge slot
        if (edgeArc[s] >= 0) { // second side of a known arc
          const arc = arcs[edgeArc[s]]; // shared arc
          arc.rightRing = ri; arc.right = r.region;
          ringArcs[ri].push({ arc: edgeArc[s], reversed: true, at: s0 % n });
          continue;
        }
        const verts = new Int32Array(s1 - s0 + 1); // arc vertices, both ends
        for (let i = s0; i <= s1; i++) verts[i - s0] = v[i % n];
        const id = arcs.length; // new arc id
        const other = sig[s0 % n]; // neighbour across the arc
        arcs.push({ verts, closed, left: r.region, right: other, leftRing: ri, rightRing: -1, shared: other >= 0 });
        for (let i = s0; i < s1; i++) edgeArc[slots[i % n]] = id;
        ringArcs[ri].push({ arc: id, reversed: false, at: s0 % n });
      }
    });
    stats.arcs = arcs.length;
    stats.sharedArcs = arcs.reduce((c, a) => c + (a.shared ? 1 : 0), 0);
    mark('arcs');

    // 5. Field layout from the bounds (texel size first: it sets the simplification tolerance).
    let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity; // field-frame bounds (cm)
    for (let i = 0; i < vertexCount; i++) { if (vx[i] < fx0) fx0 = vx[i]; if (vx[i] > fx1) fx1 = vx[i]; if (vy[i] < fy0) fy0 = vy[i]; if (vy[i] > fy1) fy1 = vy[i]; }
    const span = Math.max(fx1 - fx0, fy1 - fy0, 100); // largest extent (cm)
    /**
     * Texel size for a field margin.
     * @param {number} margin margin (texels)
     * @returns {number} texel (cm)
     */
    const texelFor = margin => Math.max(minTexel, Math.ceil((span / (maxField - 2 * margin - 2)) * 100) / 100);
    let texel = texelFor(layoutM); // texel size (cm)
    if (fixedM === null && reachCm > 0) {
      const need = Math.min(LIMITS.maxClampTexels, Math.ceil(reachCm / texel) + 2); // margin the reach needs (texels)
      if (need > layoutM) { layoutM = need; texel = texelFor(layoutM); }
    }
    const W = Math.min(maxField, Math.ceil((fx1 - fx0) / texel) + 2 * layoutM + 2), H = Math.min(maxField, Math.ceil((fy1 - fy0) / texel) + 2 * layoutM + 2); // field size
    const fieldMin = [fx0 - (layoutM + 1) * texel, fy0 - (layoutM + 1) * texel]; // field corner (cm)
    const tolerance = Math.max(texel * 0.25, Number(options.simplifyM ?? 0) * 100); // simplification tolerance (cm)

    // 6. Simplify every arc once (both sides use the same result); closed arcs split at the farthest point.
    let simplifiedPoints = 0; // points after simplification
    for (const arc of arcs) {
      const n = arc.verts.length; // vertices incl. both ends
      const xs = new Float64Array(n), ys = new Float64Array(n); // coordinates
      for (let i = 0; i < n; i++) { xs[i] = vx[arc.verts[i]]; ys[i] = vy[arc.verts[i]]; }
      const keep = new Uint8Array(n); // kept marks
      if (arc.closed) {
        let far = 0, best = -1; // farthest vertex from the start
        for (let i = 1; i < n - 1; i++) { const d = (xs[i] - xs[0]) ** 2 + (ys[i] - ys[0]) ** 2; if (d > best) { best = d; far = i; } }
        douglasPeucker(xs, ys, 0, far, tolerance, keep);
        douglasPeucker(xs, ys, far, n - 1, tolerance, keep);
        let kept = 0; for (let i = 0; i < n; i++) kept += keep[i]; // closed rings keep at least 4 (3 distinct)
        if (kept < 4) { keep[Math.floor(far / 2)] = 1; keep[Math.floor((far + n - 1) / 2)] = 1; }
      } else {
        douglasPeucker(xs, ys, 0, n - 1, tolerance, keep);
      }
      let m = 0; for (let i = 0; i < n; i++) m += keep[i]; // kept count
      const px = new Float64Array(m), py = new Float64Array(m), cum = new Float64Array(m); // simplified points and arc length
      for (let i = 0, k = 0; i < n; i++) {
        if (!keep[i]) continue;
        px[k] = xs[i]; py[k] = ys[i];
        if (k) cum[k] = cum[k - 1] + Math.hypot(px[k] - px[k - 1], py[k] - py[k - 1]);
        k++;
      }
      arc.px = px; arc.py = py; arc.cum = cum; arc.length = cum[m - 1];
      simplifiedPoints += m - 1;
    }
    stats.simplifiedPoints = simplifiedPoints;
    stats.toleranceCm = tolerance;
    mark('simplify');

    // 7. Ring lengths and arc positions; region areas and perimeters (from the simplified rings).
    const ringLen = new Float64Array(rings.length); // ring length (cm)
    const area = new Float64Array(meta.length), perimeter = new Float64Array(meta.length); // per region
    rings.forEach((r, ri) => {
      const list = ringArcs[ri].slice().sort((p, q) => p.at - q.at); // arcs in ring order
      let s = 0; // running length
      for (const item of list) {
        const arc = arcs[item.arc]; // arc
        if (item.reversed) { arc.offR = s; } else { arc.offL = s; }
        s += arc.length;
        // area via the arc's points in ring direction
        const m = arc.px.length; // simplified points
        let twice = 0; // twice the signed area contribution
        for (let k = 0; k < m - 1; k++) twice += arc.px[k] * arc.py[k + 1] - arc.px[k + 1] * arc.py[k];
        area[r.region] += (item.reversed ? -twice : twice) / 2;
      }
      ringLen[ri] = s;
      perimeter[r.region] += s;
    });
    // For a closed arc shared with a ring that starts elsewhere, the right ring's offset is where it meets the arc start.
    for (const arc of arcs) {
      if (arc.offL === undefined) arc.offL = 0;
      if (arc.rightRing >= 0 && arc.offR === undefined) arc.offR = 0;
    }
    mark('rings');

    // 8. Region codes: palette slot, thickness level (glow cap) and a local id that differs between neighbours.
    const neighbours = meta.map(() => new Set()); // adjacency
    for (const arc of arcs) if (arc.shared && arc.right >= 0 && arc.right !== arc.left) { neighbours[arc.left].add(arc.right); neighbours[arc.right].add(arc.left); }
    const order = meta.map((_, i) => i).sort((a, b) => neighbours[b].size - neighbours[a].size); // most neighbours first
    const localId = new Int32Array(meta.length); // 1..255
    for (const r of order) {
      const used = new Set(); // colours of coloured neighbours
      for (const n of neighbours[r]) if (localId[n]) used.add(localId[n]);
      let c = 1; // smallest free colour
      while (used.has(c)) c++;
      if (c > 255) throw new Error('Region adjacency needs more than 255 local ids');
      localId[r] = c;
    }
    const palette = []; // unique linear colours
    const paletteKey = new Map(); // colour key -> slot
    const slotOf = new Int32Array(meta.length); // region -> palette slot
    meta.forEach((m, r) => {
      const key = m.color.map(c => Math.round(c * 4095)).join(','); // colour identity
      let slot = paletteKey.get(key); // existing slot
      if (slot === undefined) { slot = palette.length; paletteKey.set(key, slot); palette.push(m.color); }
      slotOf[r] = slot;
    });
    if (palette.length > LIMITS.palette) {
      // More colours than slots: keep the most used ones, map the rest to the nearest kept colour.
      const uses = new Int32Array(palette.length); // regions per colour
      for (const s of slotOf) uses[s]++;
      const kept = palette.map((_, i) => i).sort((a, b) => uses[b] - uses[a]).slice(0, LIMITS.palette); // kept slots
      const remap = new Int32Array(palette.length); // old -> new slot
      palette.forEach((c, i) => {
        let best = 0, bestD = Infinity; // nearest kept colour
        kept.forEach((k, j) => { const d = (palette[k][0] - c[0]) ** 2 + (palette[k][1] - c[1]) ** 2 + (palette[k][2] - c[2]) ** 2; if (d < bestD) { bestD = d; best = j; } });
        remap[i] = best;
      });
      const reduced = kept.map(k => palette[k]); // new palette
      for (let r = 0; r < slotOf.length; r++) slotOf[r] = remap[slotOf[r]];
      palette.length = 0; palette.push(...reduced);
      stats.paletteReduced = true;
    }
    const level = new Int32Array(meta.length); // thickness level: thickness ~ 2^(level / 2) m
    for (let r = 0; r < meta.length; r++) {
      const thicknessM = perimeter[r] > 0 ? (2 * Math.abs(area[r]) / perimeter[r]) / 100 : 1; // 2A / P
      level[r] = Math.max(0, Math.min(31, Math.round(2 * Math.log2(Math.max(1, thicknessM)))));
    }
    const code = new Float64Array(meta.length); // attr * 256 + local id
    for (let r = 0; r < meta.length; r++) code[r] = (slotOf[r] * 32 + level[r]) * 256 + localId[r];
    stats.localIds = localId.reduce((m, v) => (v > m ? v : m), 0);
    // Clamp distance: everything the region look reads stays inside it (flow reach = 4 x the glow, the glow is at
    // most GlowCapRatio x thickness; 1.5 x the default ratio as headroom), so small regions need far fewer texels.
    const thick = Array.from(level, l => 2 ** (l / 2)).sort((a, b) => a - b); // thickness per region (m)
    const reachM = 4 * DEFAULT_STYLE.glowCapRatio * 1.5 * thick[Math.min(thick.length - 1, Math.floor(thick.length * 0.95))]; // flow reach (m)
    const M = fixedM ?? Math.max(12, Math.min(layoutM, Math.max(Math.ceil((reachM * 100) / texel), Math.ceil(reachCm / texel) + 1))); // clamp (texels)
    mark('codes');

    // 9. Edge index: every simplified edge in texel units, binned into grid cells.
    let edgeCount = 0; // simplified edges
    for (const arc of arcs) edgeCount += arc.px.length - 1;
    const ex0 = new Float32Array(edgeCount), ey0 = new Float32Array(edgeCount), ex1 = new Float32Array(edgeCount), ey1 = new Float32Array(edgeCount); // ends (texels)
    const edgeArcId = new Int32Array(edgeCount), edgeIndex = new Int32Array(edgeCount); // arc and position
    {
      let e = 0; // edge cursor
      arcs.forEach((arc, ai) => {
        arc.firstEdge = e;
        for (let k = 0; k < arc.px.length - 1; k++, e++) {
          ex0[e] = (arc.px[k] - fieldMin[0]) / texel; ey0[e] = (arc.py[k] - fieldMin[1]) / texel;
          ex1[e] = (arc.px[k + 1] - fieldMin[0]) / texel; ey1[e] = (arc.py[k + 1] - fieldMin[1]) / texel;
          edgeArcId[e] = ai; edgeIndex[e] = k;
        }
      });
    }
    const G = LIMITS.gridCell; // cell size (texels)
    const GW = Math.ceil(W / G) + 1, GH = Math.ceil(H / G) + 1; // grid size
    const cellCount = new Int32Array(GW * GH + 1); // edges per cell, then offsets
    /**
     * Visit the grid cells covered by an edge's bounding box.
     * @param {number} e edge index
     * @param {(cell: number) => void} fn callback per cell
     * @returns {void}
     */
    const cellsOf = (e, fn) => {
      const c0 = Math.max(0, Math.floor(Math.min(ex0[e], ex1[e]) / G)), c1 = Math.min(GW - 1, Math.floor(Math.max(ex0[e], ex1[e]) / G)); // x range
      const r0 = Math.max(0, Math.floor(Math.min(ey0[e], ey1[e]) / G)), r1 = Math.min(GH - 1, Math.floor(Math.max(ey0[e], ey1[e]) / G)); // y range
      for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) fn(r * GW + c);
    };
    for (let e = 0; e < edgeCount; e++) cellsOf(e, cell => { cellCount[cell + 1]++; });
    for (let i = 1; i <= GW * GH; i++) cellCount[i] += cellCount[i - 1];
    const cellEdges = new Int32Array(cellCount[GW * GH]); // edges by cell (CSR)
    {
      const fill = cellCount.slice(0, GW * GH); // write cursors
      for (let e = 0; e < edgeCount; e++) cellsOf(e, cell => { cellEdges[fill[cell]++] = e; });
    }
    mark('index');

    // 10. Tiles: quadtree from rootTile down to minTile until the candidate pieces fit one bake material.
    const stamp = new Int32Array(edgeCount); // last tile that saw an edge
    let tileSerial = 0; // stamp counter
    const tiles = []; // { i0, j0, w, h, fillB, fillA, S, floats: Float32Array }
    let truncated = 0; // pieces dropped because a minimum tile overflowed
    /**
     * Candidate edges of a rectangle (texels), as a sorted list.
     * @param {number} x0 min x
     * @param {number} y0 min y
     * @param {number} x1 max x
     * @param {number} y1 max y
     * @returns {number[]} edge indices intersecting the rectangle, by arc then position
     */
    const candidates = (x0, y0, x1, y1) => {
      tileSerial++;
      const out = []; // edges
      const c0 = Math.max(0, Math.floor(x0 / G)), c1 = Math.min(GW - 1, Math.floor(x1 / G)); // cell range x
      const r0 = Math.max(0, Math.floor(y0 / G)), r1 = Math.min(GH - 1, Math.floor(y1 / G)); // cell range y
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const cell = r * GW + c; // cell id
        for (let k = cellCount[cell]; k < cellCount[cell + 1]; k++) {
          const e = cellEdges[k]; // edge
          if (stamp[e] === tileSerial) continue;
          stamp[e] = tileSerial;
          if (clipSegment(ex0[e], ey0[e], ex1[e], ey1[e], x0, y0, x1, y1)) out.push(e);
        }
      }
      return out.sort((a, b) => a - b); // edges are numbered by arc, then position
    };
    /**
     * Pack the candidate edges of a tile into bake floats (pieces clipped to the expanded rectangle).
     * @param {number[]} list sorted candidate edges
     * @param {number} i0 tile x (texels)
     * @param {number} j0 tile y
     * @param {number} w tile width
     * @param {number} h tile height
     * @param {boolean} force pack even if it overflows (drops the remaining pieces)
     * @returns {{ floats: Float32Array, S: number }|null} packed data, or null when it does not fit
     */
    const pack = (list, i0, j0, w, h, force) => {
      const x0 = i0 - M, y0 = j0 - M, x1 = i0 + w + M, y1 = j0 + h + M; // expanded rectangle
      const S = Math.floor(4095 / (Math.max(w, h) + 2 * M)); // quantisation steps per texel
      const pieces = []; // { arc, pts: number[] (packed), s0: arc length at the first point (cm) }
      let current = null; // piece being built
      let lastEdge = -2; // previous edge of the current piece
      /**
       * Packed value of a point given in texels (field frame).
       * @param {number} x field texel x
       * @param {number} y field texel y
       * @returns {number} qx + 4096 * qy
       */
      const q = (x, y) => Math.min(4095, Math.max(0, Math.round((x - i0 + M) * S))) + 4096 * Math.min(4095, Math.max(0, Math.round((y - j0 + M) * S)));
      for (const e of list) {
        const arc = arcs[edgeArcId[e]], k = edgeIndex[e]; // arc and position
        const t = clipT; clipSegment(ex0[e], ey0[e], ex1[e], ey1[e], x0, y0, x1, y1); // clipped parameter range
        const len = arc.cum[k + 1] - arc.cum[k]; // edge length (cm)
        const startsInside = t[0] <= 0, endsInside = t[1] >= 1; // clipped ends
        const continues = current && e === lastEdge + 1 && edgeArcId[e] === current.arc && startsInside; // same run
        if (!continues) {
          // A piece that starts at the first vertex of an open arc starts at a junction (see the bake shader).
          current = { arc: edgeArcId[e], pts: [], s0: arc.cum[k] + t[0] * len, startJ: !arc.closed && k === 0 && startsInside, endJ: false };
          pieces.push(current);
          current.pts.push(q(ex0[e] + (ex1[e] - ex0[e]) * t[0], ey0[e] + (ey1[e] - ey0[e]) * t[0]));
        }
        current.pts.push(q(ex0[e] + (ex1[e] - ex0[e]) * t[1], ey0[e] + (ey1[e] - ey0[e]) * t[1]));
        current.endJ = !arc.closed && k === arc.px.length - 2 && endsInside;
        lastEdge = e;
        if (!endsInside) { current = null; lastEdge = -2; }
      }
      // Split long pieces (MAX_PIECE_POINTS per block) with the split point repeated; s0 follows the arc length.
      const parts = []; // { arc, pts, s0, flags }
      for (const p of pieces) {
        if (p.pts.length < 2) continue;
        let first = 0; // start of the next part
        while (first < p.pts.length - 1) {
          const last = Math.min(p.pts.length - 1, first + MAX_PIECE_POINTS - 1); // end (inclusive)
          const flags = (first === 0 && p.startJ ? 1 : 0) + (last === p.pts.length - 1 && p.endJ ? 2 : 0); // junction ends
          parts.push({ arc: p.arc, pts: p.pts.slice(first, last + 1), s0: p.s0, offset: first, parent: p, flags });
          first = last;
        }
      }
      // Arc length at each part's first point: walk the unpacked points (texel units) from the piece start.
      for (const part of parts) {
        if (!part.offset) { part.sStart = part.s0; continue; }
        let s = part.parent.s0, prev = part.parent.pts[0]; // running length (cm) and previous packed point
        for (let i = 1; i <= part.offset; i++) {
          const cur = part.parent.pts[i]; // packed point
          s += Math.hypot((cur % 4096 - prev % 4096) / S, (Math.floor(cur / 4096) - Math.floor(prev / 4096)) / S) * texel;
          prev = cur;
        }
        part.sStart = s;
      }
      // Stream: [n + 512 * flags, codeL, codeR, uL0, uR0, duL, duR, box min, box max, points...] per piece; the box
      // (packed like a point) lets the shader skip pieces farther than its best so far.
      const floats = []; // output
      let dropped = 0; // parts that did not fit
      for (const part of parts) {
        const need = HEADER + part.pts.length; // floats of this piece
        if (floats.length + need > LIMITS.tileFloats) { if (!force) return null; dropped++; continue; }
        const arc = arcs[part.arc]; // arc of this part
        const left = code[arc.left], right = arc.right >= 0 ? code[arc.right] : 0; // region codes on both sides
        const lenL = ringLen[arc.leftRing], lenR = arc.rightRing >= 0 ? ringLen[arc.rightRing] : 1; // ring lengths (cm)
        const uL0 = ((arc.offL + part.sStart) / lenL) % 1; // left ring position at the part start
        const uR0 = arc.rightRing >= 0 ? (((arc.offR + arc.length - part.sStart) / lenR) % 1 + 1) % 1 : 0; // right ring runs the other way
        let bx0 = 4095, by0 = 4095, bx1 = 0, by1 = 0; // bounding box (quantised)
        for (const v of part.pts) { const qy = Math.floor(v / 4096), qx = v - qy * 4096; if (qx < bx0) bx0 = qx; if (qx > bx1) bx1 = qx; if (qy < by0) by0 = qy; if (qy > by1) by1 = qy; }
        floats.push(part.pts.length + 512 * part.flags, left, right, round6(uL0), round6(uR0), roundSig(texel / lenL), roundSig(arc.rightRing >= 0 ? -texel / lenR : 0),
          bx0 + 4096 * by0, bx1 + 4096 * by1, ...part.pts);
      }
      truncated += dropped;
      while (floats.length % 4) floats.push(0); // whole vector parameters
      return { floats: Float32Array.from(floats), S };
    };
    /**
     * Fill code of an empty tile: the region the tile centre lies in (ray towards +x to the first border).
     * @param {number} cx centre x (texels)
     * @param {number} cy centre y (texels)
     * @returns {number} region code (0 = outside every region)
     */
    const fillCode = (cx, cy) => {
      const r = Math.max(0, Math.min(GH - 1, Math.floor(cy / G))); // grid row
      let best = Infinity, side = 0, arcId = -1; // nearest crossing to the right
      for (let c = Math.max(0, Math.floor(cx / G)); c < GW; c++) {
        if (c * G > best) break;
        const cell = r * GW + c; // cell id
        for (let k = cellCount[cell]; k < cellCount[cell + 1]; k++) {
          const e = cellEdges[k]; // edge
          const ay = ey0[e], by = ey1[e]; // y ends
          if ((ay <= cy) === (by <= cy)) continue;
          const x = ex0[e] + ((cy - ay) * (ex1[e] - ex0[e])) / (by - ay); // crossing x
          if (x <= cx || x >= best) continue;
          best = x; arcId = edgeArcId[e];
          side = (ex1[e] - ex0[e]) * (cy - ay) - (by - ay) * (cx - ex0[e]); // > 0: centre on the left
        }
      }
      if (arcId < 0) return 0;
      const arc = arcs[arcId]; // crossed arc
      return side > 0 ? code[arc.left] : (arc.right >= 0 ? code[arc.right] : 0);
    };
    /**
     * Process one tile: pack it, split it, or fill it.
     * @param {number} i0 x (texels)
     * @param {number} j0 y
     * @param {number} w width
     * @param {number} h height
     * @returns {void}
     */
    const tile = (i0, j0, w, h) => {
      const list = candidates(i0 - M, j0 - M, i0 + w + M, j0 + h + M); // edges near the tile
      if (!list.length) {
        const c = fillCode(i0 + w / 2, j0 + h / 2); // region of the whole tile
        tiles.push({ i0, j0, w, h, fillB: c % 256, fillA: Math.floor(c / 256), S: 1, floats: new Float32Array(0) });
        return;
      }
      const small = w <= LIMITS.minTile && h <= LIMITS.minTile; // cannot split further
      const packed = pack(list, i0, j0, w, h, small); // packed data
      if (packed) { tiles.push({ i0, j0, w, h, fillB: 0, fillA: 0, S: packed.S, floats: packed.floats }); return; }
      const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2); // child size
      tile(i0, j0, hw, hh);
      if (w - hw > 0) tile(i0 + hw, j0, w - hw, hh);
      if (h - hh > 0) tile(i0, j0 + hh, hw, h - hh);
      if (w - hw > 0 && h - hh > 0) tile(i0 + hw, j0 + hh, w - hw, h - hh);
    };
    for (let j = 0; j < H; j += LIMITS.rootTile) for (let i = 0; i < W; i += LIMITS.rootTile) tile(i, j, Math.min(LIMITS.rootTile, W - i), Math.min(LIMITS.rootTile, H - j));
    stats.tiles = tiles.length;
    stats.emptyTiles = tiles.reduce((n, t) => n + (t.floats.length ? 0 : 1), 0);
    stats.floats = tiles.reduce((n, t) => n + t.floats.length, 0);
    stats.truncatedPieces = truncated;
    mark('tiles');
    stats.ms.total = Math.round(clock() - started);

    // Region summary for the caller (colours can change later without a rebake when the palette slots stay).
    const regionInfo = meta.map((m, r) => ({ id: m.id, localId: localId[r], slot: slotOf[r], level: level[r], areaM2: Math.abs(area[r]) / 1e4 }));
    return {
      origin, texelCm: texel, field: { W, H, minCm: fieldMin, clampTexels: M, clampM: (M * texel) / 100 },
      bounds: { fx0, fy0, fx1, fy1 }, tiles, palette, regions: regionInfo, stats,
      _debug: { arcs, rings, ringArcs, ringLen, vx, vy, code, localId },
    };
  };

  /**
   * Liang-Barsky clip of a segment against a rectangle; the parameter range lands in clipT.
   * @param {number} ax start x
   * @param {number} ay start y
   * @param {number} bx end x
   * @param {number} by end y
   * @param {number} x0 rectangle min x
   * @param {number} y0 rectangle min y
   * @param {number} x1 rectangle max x
   * @param {number} y1 rectangle max y
   * @returns {boolean} true when part of the segment lies inside
   */
  function clipSegment(ax, ay, bx, by, x0, y0, x1, y1) {
    let t0 = 0, t1 = 1; // parameter range
    const dx = bx - ax, dy = by - ay; // direction
    const p = [-dx, dx, -dy, dy], qv = [ax - x0, x1 - ax, ay - y0, y1 - ay]; // Liang-Barsky terms
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (qv[i] < 0) return false; continue; }
      const r = qv[i] / p[i]; // boundary parameter
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    clipT[0] = t0; clipT[1] = t1;
    return true;
  }
  const clipT = [0, 1]; // last clip result (shared scratch)

  /**
   * Round to 6 decimals.
   * @param {number} v value
   * @returns {number} rounded value
   */
  const round6 = v => Math.round(v * 1e6) / 1e6;

  /**
   * Round to 5 significant digits.
   * @param {number} v value
   * @returns {number} rounded value
   */
  const roundSig = v => (v === 0 ? 0 : Number(v.toPrecision(5)));

  // ---------------------------------------------------------------------------------------------
  // Shader emulation (the bake material and the render decode do exactly this; used by the self-check)

  /**
   * Bake one texel of a tile like M_RegionDotFlowBake_V2.
   * @param {object} t tile { w, h, fillB, fillA, S, floats }
   * @param {number} qx texel centre x inside the tile (texels)
   * @param {number} qy texel centre y
   * @param {object} f field { clampTexels, texelCm }
   * @returns {number[]} [distance (m, clamped), u, B (signed local id), attr]
   */
  const bakeTexel = (t, qx, qy, f) => {
    const M = f.clampTexels; // clamp (texels)
    let best = 1e30, U = 0, B = t.fillB, A = t.fillA; // state
    const F = t.floats; // packed data
    const unpack = v => { const yq = Math.floor(v / 4096); return [(v - yq * 4096) / t.S - M, yq / t.S - M]; }; // texels
    {
      let p = 0; // read cursor
      while (p + HEADER <= F.length) {
        const n = F[p] % 512, flags = Math.floor(F[p] / 512); // points in this piece, junction flags
        if (n < 2) break;
        const cL = F[p + 1], cR = F[p + 2], uL0 = F[p + 3], uR0 = F[p + 4], duL = F[p + 5], duR = F[p + 6]; // header
        const pts = p + HEADER; // first point
        const [bx0, by0] = unpack(F[p + 7]), [bx1, by1] = unpack(F[p + 8]); // bounding box
        const ox = Math.max(0, bx0 - qx, qx - bx1), oy = Math.max(0, by0 - qy, qy - by1); // texel outside the box
        if (ox * ox + oy * oy >= best) { p = pts + n; continue; }
        /**
         * Squared distance to a junction end, raised when the texel lies behind the edge (the one-sided side test is
         * only trustworthy across the edge), so the arc running across the texel wins a tie at the junction.
         * @param {number} d2 squared distance (texels^2)
         * @param {number} vx texel - vertex x
         * @param {number} vy texel - vertex y
         * @param {number} ux edge unit direction x
         * @param {number} uy edge unit direction y
         * @returns {number} raised squared distance
         */
        const raise = (d2, vx, vy, ux, uy) => {
          const d = Math.sqrt(d2), sin = d > 1e-9 ? Math.abs(ux * vy - uy * vx) / d : 1; // |sin| between texel ray and edge
          return (d + JUNCTION_PENALTY * (1 - sin)) ** 2;
        };
        /**
         * Record a new nearest point.
         * @param {number} d2 squared distance (texels^2)
         * @param {number} side > 0 left of the piece direction
         * @param {number} s arc length from the piece start (texels)
         * @returns {void}
         */
        const take = (d2, side, s) => {
          best = d2;
          const leftSide = side >= 0; // which side the texel is on
          const c = leftSide ? cL : cR, o = leftSide ? cR : cL; // own and opposite codes
          const u = leftSide ? uL0 + s * duL : uR0 + s * duR, uo = leftSide ? uR0 + s * duR : uL0 + s * duL; // ring positions
          const id = c % 256; // local id on this side
          if (id > 0) { B = id; A = Math.floor(c / 256); U = u - Math.floor(u); }
          else { B = -(o % 256); A = Math.floor(o / 256); U = uo - Math.floor(uo); }
        };
        let [ax, ay] = unpack(F[pts]); // first point
        let pdx = 0, pdy = 0, hasPrev = false, acc = 0; // previous unit direction, running length
        for (let k = 1; k < n; k++) {
          const [bx, by] = unpack(F[pts + k]); // next point
          const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; // segment
          if (L2 > 1e-12) {
            const L = Math.sqrt(L2), ux = dx / L, uy = dy / L; // unit direction
            const vx0 = qx - ax, vy0 = qy - ay; // to the start vertex
            const d2a = !hasPrev && flags % 2 >= 1 ? raise(vx0 * vx0 + vy0 * vy0, vx0, vy0, ux, uy) : vx0 * vx0 + vy0 * vy0; // squared distance
            if (d2a < best) {
              const nx = -uy + (hasPrev ? -pdy : 0), ny = ux + (hasPrev ? pdx : 0); // pseudo-normal (left)
              take(d2a, vx0 * nx + vy0 * ny, acc);
            }
            const tt = (vx0 * dx + vy0 * dy) / L2; // projection
            if (tt > 0 && tt < 1) {
              const cx = vx0 - tt * dx, cy = vy0 - tt * dy, d2 = cx * cx + cy * cy; // to the segment
              if (d2 < best) take(d2, dx * vy0 - dy * vx0, acc + tt * L);
            }
            pdx = ux; pdy = uy; hasPrev = true; acc += L;
          }
          ax = bx; ay = by;
        }
        const vxl = qx - ax, vyl = qy - ay; // to the last vertex
        const d2l = flags >= 2 ? raise(vxl * vxl + vyl * vyl, vxl, vyl, pdx, pdy) : vxl * vxl + vyl * vyl; // squared distance
        if (d2l < best && hasPrev) take(d2l, vxl * -pdy + vyl * pdx, acc);
        p = pts + n;
      }
    }
    return [Math.min(Math.sqrt(best) * f.texelCm / 100, M * f.texelCm / 100), U, B, A];
  };

  /**
   * Bake a whole prepared layer on the CPU (small layers only; for the self-check).
   * @param {object} prepared prepare() output
   * @returns {Float32Array} W * H * 4 texels (d, u, B, attr), row-major by fy then fx
   */
  const bakeField = prepared => {
    const { W, H } = prepared.field; // size
    const out = new Float32Array(W * H * 4); // texels
    const f = { clampTexels: prepared.field.clampTexels, texelCm: prepared.texelCm }; // globals
    for (const t of prepared.tiles) {
      for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
        const v = bakeTexel(t, x + 0.5, y + 0.5, f); // texel value
        out.set(v, ((t.j0 + y) * W + (t.i0 + x)) * 4);
      }
    }
    return out;
  };

  /**
   * Decode the region at a field point like the render material (4 taps, candidate signed distances).
   * @param {Float32Array} field bakeField() output
   * @param {number} W field width
   * @param {number} H field height
   * @param {number} px point x (texels, continuous)
   * @param {number} py point y
   * @returns {{ B: number, sd: number, attr: number }} code (> 0 inside region with that local id), signed distance (m)
   */
  const decodePoint = (field, W, H, px, py) => {
    const tx = px - 0.5, ty = py - 0.5; // texel-centre space
    const i0 = Math.floor(tx), j0 = Math.floor(ty), fx = tx - i0, fy = ty - j0; // base tap and weights
    const taps = []; // [d, B, attr, weight]
    for (const [di, dj, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
      const i = Math.max(0, Math.min(W - 1, i0 + di)), j = Math.max(0, Math.min(H - 1, j0 + dj)); // clamped tap
      const o = (j * W + i) * 4; // offset
      taps.push([field[o], field[o + 2], field[o + 3], w]);
    }
    let bestB = 0, bestSd = -Infinity, attr = 0; // winner
    for (const [, X] of taps) {
      let sd = 0; // candidate signed distance
      for (const [d, B, , w] of taps) sd += w * (B === X ? d : -d);
      if (sd > bestSd) { bestSd = sd; bestB = X; attr = taps.find(tp => tp[1] === X)[2]; }
    }
    return { B: bestB, sd: bestSd, attr };
  };

  // ---------------------------------------------------------------------------------------------
  // DTS side

  /**
   * Surface heights under the layer (DTS tools.linesIntersect, top-down probes inside the regions): a low
   * percentile as the base, the lowest and highest hit for the volume. The area must be in the camera view.
   * @param {object} api fdapi instance
   * @param {object} prepared prepare() output
   * @returns {Promise<{ base: number, low: number, high: number }|null>} metres, null when nothing was hit
   */
  const sampleGround = async (api, prepared) => {
    const { W, H, minCm } = prepared.field; // field
    const side = Math.max(4, Math.round(Math.sqrt(PROBES))); // probe grid
    const probes = []; // vertical probes
    for (let i = 0; i < side; i++) for (let j = 0; j < side; j++) {
      const fx = minCm[0] + ((i + 0.5) / side) * W * prepared.texelCm, fy = minCm[1] + ((j + 0.5) / side) * H * prepared.texelCm; // field cm
      const x = prepared.origin[0] + fy / 100, y = prepared.origin[1] + fx / 100; // projected metres
      probes.push({ start: [x, y, 3000], end: [x, y, -500] });
    }
    const reply = await new Promise(resolve => { // SDK reply; the callback is authoritative in SDK 7.1.0930
      let done = false; // true once settled
      /**
       * Settle once.
       * @param {object|null} value SDK reply
       * @returns {void}
       */
      const finish = value => { if (!done) { done = true; resolve(value); } };
      setTimeout(() => finish(null), 30000);
      try {
        const pending = api.tools.linesIntersect(probes, false, false, finish); // Promise in some SDK builds
        if (pending && typeof pending.then === 'function') pending.then(finish, () => finish(null));
      } catch (error) {
        finish(null);
      }
    });
    const items = reply?.intersects ?? reply?.data ?? []; // one entry per probe
    const hits = []; // hit heights
    (Array.isArray(items) ? items : []).forEach(item => { const z = item?.LineIntersectPoint?.[2]; if (Number.isFinite(z)) hits.push(z); });
    if (!hits.length) return null;
    hits.sort((a, b) => a - b);
    return { base: hits[Math.floor(hits.length * 0.1)], low: hits[0], high: hits[hits.length - 1] };
  };

  /**
   * Setter requests for the style fields that are present (whole groups, completed from the current style).
   * @param {string} id customObject id
   * @param {object} style fields to send
   * @param {object} current current full style of the layer
   * @returns {object[]} callBPFunction request items
   */
  const styleRequests = (id, style, current) => {
    const out = []; // requests
    for (const [fn, keys] of GROUPS) {
      if (keys.some(k => style[k] !== undefined)) out.push(request(id, fn, keys.map(k => [TYPE.float, fieldValue(k, style[k] ?? current[k])])));
    }
    if (style.paused !== undefined) out.push(request(id, 'SetPaused', [[TYPE.bool, Boolean(style.paused)]]));
    return out;
  };

  /**
   * Palette request: 64 linear colours as one float array.
   * @param {string} id customObject id
   * @param {number[][]} palette linear colours
   * @returns {object} callBPFunction item
   */
  const paletteRequest = (id, palette) => {
    const floats = []; // r, g, b, a per slot
    for (let i = 0; i < LIMITS.palette; i++) { const c = palette[i] ?? [0, 0, 0, 1]; floats.push(round6(c[0]), round6(c[1]), round6(c[2]), 1); }
    return request(id, 'SetPalette', [[TYPE.floatArray, floats]]);
  };

  /**
   * AddTiles requests: tiles packed as [count, (i0, j0, w, h, fillB, fillA, S, params, floats...) per tile].
   * @param {string} id customObject id
   * @param {object[]} tiles prepared tiles
   * @returns {object[]} callBPFunction items
   */
  const tileRequests = (id, tiles) => {
    const items = []; // requests
    let floats = [0], count = 0; // current batch
    /**
     * Close the current batch.
     * @returns {void}
     */
    const flush = () => {
      if (!count) return;
      floats[0] = count;
      const item = request(id, 'AddTiles', [[TYPE.floatArray, floats]]); // request
      item.size = floats.length * 9 + 200;
      items.push(item);
      floats = [0]; count = 0;
    };
    let work = 0; // bake work in the current batch
    for (const t of tiles) {
      const cost = t.w * t.h * Math.max(16, t.floats.length); // texels x floats
      if (count && (floats.length + 8 + t.floats.length > LIMITS.batchFloats || work + cost > LIMITS.bakeBudget)) { flush(); work = 0; }
      work += cost;
      floats.push(t.i0, t.j0, t.w, t.h, t.fillB, t.fillA, t.S, t.floats.length / 4);
      for (let k = 0; k < t.floats.length; k++) floats.push(t.floats[k]);
      count++;
    }
    flush();
    return items;
  };

  /**
   * Customobject id of a layer.
   * @param {string} layer layer id
   * @returns {string} id
   */
  const objectId = layer => `${layer}:field`;

  /**
   * Create (or replace) a layer of regions.
   * @param {object} api fdapi instance after onReady
   * @param {object} options { id, pakFilePath, regions, style?, groundZ? (m; default: sampled, else 0),
   *   heightRangeM? ([down, up] m around the base), simplifyM?, maxFieldTexels?, minTexelCm?, clampTexels?,
   *   assetPath? (Blueprint path of a renamed or test copy; default ASSET_PATH) }
   * @returns {Promise<object>} summary { regions, inputPoints, simplifiedPoints, tiles, field, ms, seconds }
   */
  const create = async (api, { id, pakFilePath, regions, style = {}, groundZ, heightRangeM, assetPath = ASSET_PATH, ...options }) => {
    if (typeof id !== 'string' || !id || id.includes(':')) throw new Error('id is required and must not contain ":"');
    if (pakFilePath !== undefined && pakFilePath !== '' && (typeof pakFilePath !== 'string' || !/\.pak$/i.test(pakFilePath.trim()))) throw new Error('pakFilePath must be empty or the .pak path on the DTS render host');
    const started = clock(); // timing
    const full = { ...DEFAULT_STYLE, ...style }; // layer style
    surfaceId(full.surface);
    const prepared = prepare(regions, { reachM: styleReachM(full), ...options }); // packed bake
    await remove(api, id);
    const oid = objectId(id); // customObject id
    await invoke(api, 'delete', [[oid]]).catch(() => {}); // leftovers after a page reload
    const sample = Number.isFinite(groundZ) ? null : await sampleGround(api, prepared); // surface heights
    const base = Number.isFinite(groundZ) ? groundZ : sample?.base ?? 0; // actor height
    await invoke(api, 'add', [[{
      id: oid, groupId: id, assetPath, ...(pakFilePath ? { pakFilePath: pakFilePath.trim() } : {}), location: [...prepared.origin, base],
      rotation: [0, 0, 0], scale: [1, 1, 1], coordinateType: 0, collision: false, autoHeight: false, enableDecal: false, range: [0, VIEW_RANGE_M],
    }]]);
    const { W, H, minCm, clampM } = prepared.field; // field
    const sizeCm = [W * prepared.texelCm, H * prepared.texelCm]; // field size (cm)
    const volume = { centerCm: [minCm[0] + sizeCm[0] / 2, minCm[1] + sizeCm[1] / 2], sizeCm, base, sample, heightRangeM }; // layer volume
    layers.set(id, { objectId: oid, style: full, prepared, colors: regions.map(r => r.color), volume });
    const sent = clock(); // transfer start
    await callAll(api, [
      volumeRequest(oid, volume, full),
      request(oid, 'BeginField', [[TYPE.float, minCm[0]], [TYPE.float, minCm[1]], [TYPE.float, prepared.texelCm], [TYPE.float, W], [TYPE.float, H], [TYPE.float, clampM], [TYPE.float, prepared.field.clampTexels]]),
    ]);
    // One bake call per request, a frame apart: every call bakes at most LIMITS.bakeBudget, so frames stay smooth.
    for (const item of tileRequests(oid, prepared.tiles)) {
      await invoke(api, 'callBPFunction', [[strip(item)]]);
      await new Promise(resolve => setTimeout(resolve, LIMITS.bakeGapMs));
    }
    await callAll(api, [paletteRequest(oid, prepared.palette), ...styleRequests(oid, style, full), request(oid, 'FinishField')]);
    const now = clock(); // finished
    return {
      regions: prepared.regions.length, inputPoints: prepared.stats.inputPoints, simplifiedPoints: prepared.stats.simplifiedPoints,
      tiles: prepared.stats.tiles, floats: prepared.stats.floats, field: { W, H, texelM: prepared.texelCm / 100, clampM },
      ground: base, volume: volumeRange(volume, full), prepareMs: prepared.stats.ms, sendSeconds: (now - sent) / 1000, seconds: (now - started) / 1000,
    };
  };

  /**
   * Restyle a layer (fields as in DEFAULT_STYLE, or a PRESETS entry; only supplied fields change).
   * @param {object} api fdapi instance
   * @param {string} id layer id
   * @param {object} style style fields
   * @returns {Promise<boolean>} true; false when the style was applied but contour rings reach past the baked
   *   field (create the layer again with this style to see every ring)
   */
  const setStyle = async (api, id, style) => {
    const layer = layers.get(id); // remembered layer
    if (!layer) throw new Error(`Unknown layer ${id}; call create() first`);
    if (style.pattern !== undefined) patternId(style.pattern);
    if (style.surface !== undefined) surfaceId(style.surface);
    Object.assign(layer.style, style);
    const moved = style.surface !== undefined || style.flatHeightM !== undefined; // the volume follows the surface
    await callAll(api, [...(moved ? [volumeRequest(layer.objectId, layer.volume, layer.style)] : []), ...styleRequests(layer.objectId, style, layer.style)]);
    return styleReachM(layer.style) <= layer.prepared.field.clampM + 1e-6;
  };

  /**
   * Change region colours. Recolouring whole colour classes only updates the palette; a region that gets a
   * colour of its own needs a new create().
   * @param {object} api fdapi instance
   * @param {string} id layer id
   * @param {Object<string, string|number[]>} colors region id -> colour
   * @returns {Promise<boolean>} true when the palette was enough, false when the layer must be created again
   */
  const setColors = async (api, id, colors) => {
    const layer = layers.get(id); // remembered layer
    if (!layer) throw new Error(`Unknown layer ${id}; call create() first`);
    const palette = layer.prepared.palette.map(c => c.slice()); // new palette
    const assigned = new Map(); // slot -> colour key set by this call
    for (const region of layer.prepared.regions) {
      if (colors[region.id] === undefined) continue;
      const c = toLinear(colors[region.id]), key = c.map(v => v.toFixed(4)).join(','); // new colour
      if (assigned.has(region.slot) && assigned.get(region.slot) !== key) return false;
      assigned.set(region.slot, key);
      palette[region.slot] = c;
    }
    // Every region of a recoloured slot must have been recoloured the same way.
    for (const region of layer.prepared.regions) if (assigned.has(region.slot) && colors[region.id] === undefined) return false;
    layer.prepared.palette = palette;
    await callAll(api, [paletteRequest(layer.objectId, palette)]);
    return true;
  };

  /**
   * Remove a layer.
   * @param {object} api fdapi instance
   * @param {string} id layer id
   * @returns {Promise<void>} resolves when DTS deleted the object (or none existed)
   */
  const remove = async (api, id) => {
    const layer = layers.get(id); // remembered layer
    if (layer) await invoke(api, 'delete', [[layer.objectId]]).catch(() => {});
    layers.delete(id);
  };

  const exported = Object.freeze({ // public surface
    version: VERSION, ASSET_PATH, LIMITS, DEFAULT_STYLE, PATTERNS, PATTERN_FIELDS, PRESETS, SURFACES, invoke, toLinear, prepare, sampleGround, create, setStyle, setColors, remove,
    regionsFromGeoJSON, rings: ringsFromGeometry, _emulate: Object.freeze({ bakeTexel, bakeField, decodePoint }),
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  global.RegionDotFlow = exported;
})(typeof window !== 'undefined' ? window : globalThis);
