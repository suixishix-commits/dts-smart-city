/* DashLine V2 adapter for the DTS SDK 7.1 (fdapi): flowing dashes / chasing arrows for many routes at once.
 *
 * V1.2 (dynamic-lines.js) drew every route as a DTS polyline, whose per-segment geometry made the cost grow
 * with each line and point. V2 merges all routes of one style into a few customMesh ribbons (one draw call
 * each, about 2 vertices per route point) with MI_FlowDash_V2_0 / MI_ChaseArrow_V2_0. The dash position is
 * stored in the vertex alpha, inside blocks of BLOCK_PERIODS dash periods, so 8-bit vertex colours are enough.
 * Coordinates are projected metres (coordinateType 0): [[x, y, z], ...]. The ribbon lies flat (horizontal),
 * like the V1.2 polyline.
 */
(function (global) {
  const BASE = '/JC_CustomAssets/PolylineLibrary/Exhibition/AIStudio/'; // material instance folder
  const MATERIALS = Object.freeze({ dash: BASE + 'MI_FlowDash_V2_0', arrow: BASE + 'MI_ChaseArrow_V2_0' }); // one instance per pattern
  const BLOCK_PERIODS = 5; // dash periods per alpha block (material parameter BlockPeriods)
  const MAX_VERTICES = 60000; // vertices per customMesh
  const MAX_CALL_CHARS = 3000000; // request size per customMesh.add
  const DEFAULTS = Object.freeze({ // V1.2 look
    style: 'dash', color: '#24c9ff', width: 8, spacingMeters: 12, speed: 0.22, brightness: 3.8, opacity: 1,
    reverse: false, liftM: 0, groupId: '', simplifyM: 0.1,
  });
  const layers = new Map(); // layer id -> { meshIds, options }

  /**
   * Call an SDK module method and wait for an explicit success reply (callback first, Promise also accepted).
   * @param {object} api fdapi instance
   * @param {string} module SDK module name, e.g. 'customMesh'
   * @param {string} method method name
   * @param {Array<unknown>} args arguments without the trailing callback
   * @param {number} [timeoutMs] reject after this many milliseconds
   * @returns {Promise<object>} SDK reply whose result is 0
   */
  const invoke = (api, module, method, args, timeoutMs = 120000) => new Promise((resolve, reject) => {
    let settled = false; // true once settled
    const timer = setTimeout(() => finish(new Error(`DTS ${module}.${method} timed out`)), timeoutMs); // timeout guard
    /**
     * Settle once.
     * @param {Error|null} error failure or null
     * @param {object} [reply] SDK reply
     * @returns {void}
     */
    function finish(error, reply) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(reply);
    }
    /**
     * Accept only result 0.
     * @param {object} [reply] SDK reply
     * @returns {void}
     */
    const done = reply => {
      if (reply === undefined) return;
      if (Number(reply?.result) !== 0) finish(new Error(`DTS ${module}.${method} failed: ${reply?.resultMessage ?? 'no success reply'}`));
      else finish(null, reply);
    };
    try {
      const pending = api[module][method](...args, done); // Promise in some SDK builds
      if (pending && typeof pending.then === 'function') pending.then(done, error => finish(error));
    } catch (error) {
      finish(error);
    }
  });

  /**
   * Mount PAK files on the render host at runtime. SDK 7.1's settingsPanel.setPakFile references an undefined
   * ac_utils global, so the SetPakAsset command is sent directly in that case.
   * @param {object} api fdapi instance
   * @param {string|string[]} paths PAK paths readable by the DTS render host
   * @returns {Promise<object>} SDK reply
   */
  const mountPak = (api, paths) => new Promise((resolve, reject) => {
    const list = (Array.isArray(paths) ? paths : [paths]).map(p => String(p).trim()).filter(Boolean); // PAK paths
    /**
     * Accept only result 0.
     * @param {object} [reply] SDK reply
     * @returns {void}
     */
    const done = reply => {
      if (reply === undefined) return;
      if (Number(reply?.result) !== 0) reject(new Error(`DTS SetPakAsset failed: ${reply?.resultMessage ?? 'no success reply'}`)); else resolve(reply);
    };
    try {
      let pending; // Promise in some SDK builds
      try {
        pending = api.settingsPanel.setPakFile(list, done);
      } catch (error) {
        if (!String(error?.message).includes('ac_utils')) throw error;
        pending = api.settingsPanel.int.call({ command: 'SetPakAsset', bFolder: false, pakFile: list }, done);
      }
      if (pending && typeof pending.then === 'function') pending.then(done, reject);
    } catch (error) {
      reject(error);
    }
  });

  /**
   * '#rrggbb' (sRGB) to linear RGB.
   * @param {string} hex colour
   * @returns {number[]} [r, g, b] linear
   */
  const rgb = hex => {
    if (!/^#[0-9a-f]{6}$/i.test(String(hex))) throw new Error('color must be #RRGGBB');
    return [1, 3, 5].map(i => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255; // sRGB channel
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  };

  /**
   * Material parameters of a style (no geometry).
   * @param {object} o full options
   * @returns {{ scalarParameters: object[], vectorParameters: object[] }} customMesh parameter fields
   */
  const materialParameters = o => {
    const c = rgb(o.color); // linear flow colour
    return {
      scalarParameters: Object.entries({
        Speed: o.speed, Direction: o.reverse ? -1 : 1, Brightness: o.brightness, Opacity: o.opacity,
        PeriodAspect: o.spacingMeters / o.width, BlockPeriods: BLOCK_PERIODS,
      }).map(([name, value]) => ({ name, value })),
      vectorParameters: [{ name: 'FlowColor', value: [...c, 1] }, { name: 'CoreColor', value: [...c.map(v => v * 0.3 + 0.7), 1] }],
    };
  };

  /**
   * Validate and merge options.
   * @param {object} options user options
   * @returns {object} full options
   */
  const resolve = options => {
    const o = { ...DEFAULTS, ...options }; // merged options
    if (!Object.hasOwn(MATERIALS, o.style)) throw new Error('style must be dash or arrow');
    for (const [key, min, max] of [['width', 0.05, 10000], ['spacingMeters', 0.1, 100000], ['speed', -100, 100], ['brightness', 0, 50], ['opacity', 0, 1], ['liftM', -10000, 10000], ['simplifyM', 0, 1000]]) {
      if (typeof o[key] !== 'number' || !Number.isFinite(o[key]) || o[key] < min || o[key] > max) throw new Error(`${key} is out of range`);
    }
    return o;
  };

  /**
   * Chunked mesh sink: vertex pairs (left, right) with their alpha; a strip continues across chunks.
   * @param {number} maxVertices vertices per mesh
   * @returns {object} sink with pair(), break() and chunks
   */
  const sink = maxVertices => {
    const chunks = []; // finished and current chunks
    let chunk = null; // current { coordinates, colors, indices }
    let last = null; // last pair { l, r, a } for continuing a strip in a new chunk
    let linked = false; // whether the next pair connects to the previous one
    /**
     * Round to centimetres for a smaller request.
     * @param {number[]} p point
     * @returns {number[]} rounded point
     */
    const cm = p => p.map(v => Math.round(v * 100) / 100);
    /**
     * Start a new chunk.
     * @returns {void}
     */
    const open = () => { chunk = { coordinates: [], colors: [], indices: [] }; chunks.push(chunk); };
    /**
     * Append one vertex pair and, when linked, the quad to the previous pair.
     * @param {number[]} l left vertex
     * @param {number[]} r right vertex
     * @param {number} a alpha (block position)
     * @returns {void}
     */
    const put = (l, r, a) => {
      const base = chunk.coordinates.length; // index of the left vertex
      const alpha = Math.round(a * 1000) / 1000; // block position (DTS stores 8 bits)
      chunk.coordinates.push(cm(l), cm(r));
      chunk.colors.push([0, 0, 0, alpha], [1, 0, 0, alpha]);
      return base;
    };
    let prevBase = -1; // left-vertex index of the previous pair in the current chunk
    return {
      chunks,
      /**
       * Add a vertex pair; connect it to the previous pair unless break() was called.
       * @param {number[]} l left vertex
       * @param {number[]} r right vertex
       * @param {number} a alpha
       * @returns {void}
       */
      pair(l, r, a) {
        if (!chunk || chunk.coordinates.length + 2 > maxVertices) {
          open();
          prevBase = -1;
          if (linked && last) prevBase = put(last.l, last.r, last.a); // continue the strip in the new chunk
        }
        const base = put(l, r, a); // this pair
        if (linked && prevBase >= 0) chunk.indices.push(prevBase, prevBase + 1, base, prevBase + 1, base + 1, base);
        prevBase = base;
        last = { l, r, a };
        linked = true;
      },
      /**
       * The next pair starts a new strip (a new line or the second pair at a block boundary).
       * @returns {void}
       */
      break() { linked = false; },
    };
  };

  /**
   * Append one route as a flat ribbon. Vertex pairs sit at every route point and at every block boundary
   * (alpha 1 closes a block, alpha 0 opens the next one at the same position).
   * @param {number[][]} points route points [x, y, z] (metres)
   * @param {object} o full options
   * @param {object} out sink
   * @returns {number} route length in metres
   */
  const ribbon = (points, o, out) => {
    const pts = []; // route without repeated points
    for (const p of points) {
      if (!Array.isArray(p) || p.length < 3 || !p.slice(0, 3).every(Number.isFinite)) throw new Error('Each point needs finite X, Y, Z in metres');
      const q = [p[0], p[1], p[2] + o.liftM]; // lifted point
      const prev = pts[pts.length - 1]; // last kept point
      if (!prev || Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]) > 0.001) pts.push(q);
    }
    if (pts.length < 2) throw new Error('A route needs at least two distinct points');
    if (o.lineReverse) pts.reverse();
    if (o.simplifyM > 0 && pts.length > 2) {
      // Douglas-Peucker: drop points within simplifyM of the line through their neighbours (dense tracks).
      const keep = new Uint8Array(pts.length); // 1 = kept
      keep[0] = keep[pts.length - 1] = 1;
      const stack = [[0, pts.length - 1]]; // index ranges to check
      while (stack.length) {
        const [first, last] = stack.pop(); // range ends
        const a = pts[first], b = pts[last]; // chord
        const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ab2 = Math.max(ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2], 1e-12); // chord vector
        let worst = -1, index = -1; // farthest point
        for (let i = first + 1; i < last; i++) {
          const p = pts[i], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / ab2)); // projection
          const d = Math.hypot(p[0] - a[0] - t * ab[0], p[1] - a[1] - t * ab[1], p[2] - a[2] - t * ab[2]); // deviation
          if (d > worst) { worst = d; index = i; }
        }
        if (worst > o.simplifyM) { keep[index] = 1; stack.push([first, index], [index, last]); }
      }
      const kept = pts.filter((_, i) => keep[i]); // simplified route
      pts.length = 0;
      pts.push(...kept);
    }
    const half = o.width / 2; // ribbon half width
    const block = o.spacingMeters * BLOCK_PERIODS; // metres per alpha block
    /**
     * Unit direction of segment i in the XY plane (falls back to +X for vertical segments).
     * @param {number} i segment index
     * @returns {number[]} [dx, dy]
     */
    const dir = i => {
      const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], n = Math.hypot(dx, dy); // XY step
      return n > 1e-6 ? [dx / n, dy / n] : [1, 0];
    };
    /**
     * Left and right vertices at p with the given unit normal and miter scale.
     * @param {number[]} p centre point
     * @param {number[]} n unit normal (XY)
     * @param {number} m miter scale
     * @returns {number[][]} [left, right]
     */
    const side = (p, n, m) => [[p[0] + n[0] * half * m, p[1] + n[1] * half * m, p[2]], [p[0] - n[0] * half * m, p[1] - n[1] * half * m, p[2]]];
    let s = 0; // arc length at the current point
    out.break();
    const d0 = dir(0); // first direction
    let [l, r] = side(pts[0], [-d0[1], d0[0]], 1); // first pair
    out.pair(l, r, 0);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]; // segment ends
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); // segment length (3D)
      const d = dir(i), n = [-d[1], d[0]]; // segment direction and normal
      // Block boundaries strictly inside the segment: two pairs at the same place, alpha 1 then 0.
      for (let k = Math.floor(s / block) + 1; k * block < s + len - 1e-6; k++) {
        const t = (k * block - s) / len; // position on the segment
        const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; // boundary point
        [l, r] = side(p, n, 1);
        out.pair(l, r, 1);
        out.break();
        out.pair(l, r, 0);
      }
      s += len;
      // End of the segment: a mitred corner, or the route's end.
      let normal = n, miter = 1; // offset at point b
      if (i + 1 < pts.length - 1) {
        const e = dir(i + 1), sum = [d[0] + e[0], d[1] + e[1]], k = Math.hypot(sum[0], sum[1]); // next direction
        if (k > 1e-6) {
          normal = [-sum[1] / k, sum[0] / k];
          miter = 1 / Math.max(normal[0] * n[0] + normal[1] * n[1], 0.25);
        }
      }
      [l, r] = side(b, normal, miter);
      const phase = s / block - Math.floor(s / block); // position inside the current block
      const onBoundary = phase < 1e-6 && s > 0; // the point itself ends a block
      out.pair(l, r, onBoundary ? 1 : phase);
      if (onBoundary && i + 1 < pts.length - 1) { out.break(); out.pair(l, r, 0); }
    }
    return s;
  };

  /**
   * Build the customMesh objects for a set of routes (pure, no SDK call).
   * @param {object} options { id, lines: Array<number[][] | { coordinates, reverse? }>, style?, color?, width?,
   *   spacingMeters?, speed?, brightness?, opacity?, reverse? (all lines), liftM?, groupId?, maxVertices? }
   * @returns {{ meshes: object[], vertices: number, triangles: number, lengthM: number, lines: number }} summary
   */
  const prepareMeshes = options => {
    const o = resolve(options); // full options
    if (typeof o.id !== 'string' || !o.id.trim()) throw new Error('id is required');
    if (!Array.isArray(o.lines) || !o.lines.length) throw new Error('lines needs at least one route');
    const out = sink(Math.max(8, Math.min(MAX_VERTICES, o.maxVertices ?? MAX_VERTICES))); // mesh sink
    let lengthM = 0; // total route length
    o.lines.forEach((line, i) => {
      const coordinates = Array.isArray(line) ? line : line?.coordinates; // route points
      if (!Array.isArray(coordinates)) throw new Error(`lines[${i}] needs coordinates`);
      lengthM += ribbon(coordinates, { ...o, lineReverse: !Array.isArray(line) && line.reverse === true }, out); // arrays have a reverse() method
    });
    const params = materialParameters(o); // shared material parameters
    const meshes = out.chunks.map((chunk, k) => ({
      id: `${o.id}_${k}`, groupId: o.groupId, coordinateType: 0, coordinates: chunk.coordinates, colors: chunk.colors,
      indices: chunk.indices, color: [1, 1, 1, 1], createCollision: false, material: MATERIALS[o.style], ...params,
    })); // one customMesh per chunk
    return {
      meshes, vertices: meshes.reduce((n, m) => n + m.coordinates.length, 0), triangles: meshes.reduce((n, m) => n + m.indices.length / 3, 0),
      lengthM, lines: o.lines.length,
    };
  };

  /**
   * Draw (or replace) a layer of routes.
   * @param {object} api fdapi instance after onReady (the PAK with the V2 materials must be mounted)
   * @param {object} options as prepareMeshes
   * @returns {Promise<object>} summary { meshes (count), meshIds (for customMesh.show/hide), vertices, triangles, lengthM, lines, seconds }
   */
  const create = async (api, options) => {
    const started = Date.now(); // timing
    const built = prepareMeshes(options); // geometry
    await remove(api, options.id);
    const ids = built.meshes.map(m => m.id); // mesh ids
    await invoke(api, 'customMesh', 'delete', [ids]).catch(() => {}); // leftovers after a page reload
    let batch = [], chars = 0; // current request
    for (const mesh of built.meshes) {
      const size = mesh.coordinates.length * 48 + mesh.indices.length * 7; // rough request characters
      if (batch.length && chars + size > MAX_CALL_CHARS) { await invoke(api, 'customMesh', 'add', [batch]); batch = []; chars = 0; }
      batch.push(structuredClone(mesh)); chars += size; // the SDK may rewrite fields: send copies
    }
    if (batch.length) await invoke(api, 'customMesh', 'add', [batch]);
    layers.set(options.id, { meshIds: ids, options: { ...DEFAULTS, ...options } });
    return { meshes: ids.length, meshIds: ids, vertices: built.vertices, triangles: built.triangles, lengthM: built.lengthM, lines: built.lines, seconds: (Date.now() - started) / 1000 };
  };

  /**
   * Restyle a layer. Colour, speed, brightness, opacity and direction only update material parameters;
   * width, spacing, style, lift or routes rebuild the geometry.
   * @param {object} api fdapi instance
   * @param {string} id layer id
   * @param {object} style changed fields
   * @returns {Promise<object|void>} create() summary when the geometry was rebuilt
   */
  const setStyle = async (api, id, style) => {
    const layer = layers.get(id); // remembered layer
    if (!layer) throw new Error(`Unknown layer ${id}; call create() first`);
    const next = { ...layer.options, ...style }; // merged options
    if (['width', 'spacingMeters', 'style', 'liftM', 'lines', 'maxVertices'].some(k => style[k] !== undefined && style[k] !== layer.options[k])) return create(api, next);
    const params = materialParameters(resolve(next)); // new parameters
    await invoke(api, 'customMesh', 'update', [layer.meshIds.map(meshId => ({ id: meshId, ...params }))]);
    layer.options = next;
    return undefined;
  };

  /**
   * Remove a layer.
   * @param {object} api fdapi instance
   * @param {string} id layer id
   * @returns {Promise<void>} resolves when DTS deleted its meshes (or none existed)
   */
  const remove = async (api, id) => {
    const layer = layers.get(id); // remembered layer
    if (layer?.meshIds.length) await invoke(api, 'customMesh', 'delete', [layer.meshIds]).catch(() => {});
    layers.delete(id);
  };

  global.DTSDashLines = Object.freeze({ version: '2.0', MATERIALS, BLOCK_PERIODS, DEFAULTS, prepareMeshes, create, setStyle, remove, invoke, mountPak });
})(typeof window !== 'undefined' ? window : globalThis);
