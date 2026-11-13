/* dts-vue copy: pakFilePath '' is omitted from customObject.add (use it when the Cloud already mounts the effects bundle). */
/* 空间粒子光流 V5.0. Cooked three-plane spatial tracks are instanced in a single Blueprint.
 * Only route segments and style floats cross the SDK. No runtime C++ plugin or image service.
 * DTSStreamFlowInstanced.prepareLayer({id, routes, ...settings}) -> load(api, plan).
 */
(function (root) {
  'use strict';
  const assetPath = '/JC_CustomAssets/ObjectLibrary/Exhibition/StreamFlowInstancedV5/BP_StreamFlow_V5'; // cooked Blueprint
  const defaultPak = 'D:/worksace/UEProject/ue-mcp/projects/StreamFlowPerf_20261026/Delivery/StreamFlow-V5-WindowsNoEditor.pak'; // renderer-local PAK
  const ranges = Object.freeze({radius: [.1, 10000], density: [.05, 50], speedMps: [0, 100000], brightness: [0, 1000],
    filamentWidth: [.0001, 1000], haloRadius: [.001, 10000], sparkScale: [.01, 1000], trailMeters: [0, 10000],
    spacingMeters: [.01, 100000], minPixelWidth: [0, 64], maxSegmentMeters: [1, 128], simplifyMeters: [0, 10]}); // supported inputs, shared by GUI
  const defaults = Object.freeze({radius: 2.2, density: 2, speedMps: 2.4, brightness: 3.2, filamentWidth: .018,
    haloRadius: .48, sparkScale: 1, trailMeters: 2.15, spacingMeters: 8, minPixelWidth: 3,
    maxSegmentMeters: 48, simplifyMeters: .15, color: '#16acff', reverse: false, autoFit: true, manualTime: -1}); // reference appearance
  const packetWidth = 13, groupSize = 4, verticesPerInstance = 168; // cooked mesh contract

  /** Validate one finite scalar. @param {number} v input @param {string} name field @param {number[]} range bounds @returns {number} validated input */
  const bounded = (v, name, range) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < range[0] || v > range[1]) throw new RangeError(`${name} 必须为 ${range[0]}–${range[1]}`);
    return v;
  };

  /** Convert CSS RGB to linear shader color. @param {string} color #RRGGBB @returns {number[]} linear RGB */
  const linearColor = color => {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new TypeError('color 必须为 #RRGGBB');
    return [1, 3, 5].map(i => { const c = parseInt(color.slice(i, i + 2), 16) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  };

  /** Resolve style without clamping accepted settings. @param {object} o style inputs @returns {object} style array and instance count */
  const resolveSettings = (o = {}) => {
    const input = {...defaults}; // retain style fields without keeping entire route arrays alive
    for (const key of Object.keys(defaults)) if (o[key] !== undefined) input[key] = o[key];
    for (const [key, range] of Object.entries(ranges)) bounded(input[key], key, range);
    for (const key of ['autoFit', 'reverse']) if (typeof input[key] !== 'boolean') throw new TypeError(`${key} 必须为布尔值`);
    bounded(input.manualTime, 'manualTime', [-1, 1e9]);
    const ratio = input.autoFit ? Math.max(1, input.radius / 2.2) : 1; // reference-radius scaling
    const boost = Math.min(4, ratio ** .35), detail = ratio / Math.sqrt(boost), along = Math.min(8, Math.sqrt(ratio)); // V4 distribution
    const filaments = Math.round(9 * Math.sqrt(boost)), sparkTracks = Math.max(1, Math.round(input.density * 12 * boost)); // actual tracks, no density clamp
    const rgb = linearColor(input.color); // linear shader color
    const values = [input.radius, input.filamentWidth * detail, input.haloRadius * detail, input.sparkScale * detail,
      input.trailMeters * Math.min(detail, along * 2), input.spacingMeters * along, input.speedMps * along,
      input.reverse ? -1 : 1, input.brightness / boost, input.minPixelWidth, ...rgb, filaments, sparkTracks, input.manualTime]; // SetStyle order
    return {input, values, filaments, sparkTracks, groups: Math.ceil((filaments + sparkTracks) / groupSize)};
  };

  /** Simplify a spatial route within a measured error. @param {number[][]} points validated XYZ @param {number} tolerance metres @returns {number[][]} retained points */
  const simplify = (points, tolerance) => {
    if (tolerance === 0) return points;
    const keep = new Uint8Array(points.length), stack = [[0, points.length - 1]]; // retained points and spans
    keep[0] = keep[points.length - 1] = 1;
    while (stack.length) {
      const [a, b] = stack.pop(), delta = points[b].map((v, k) => v - points[a][k]); // current span
      const length2 = delta.reduce((n, v) => n + v * v, 0); // squared span length
      let farthest = -1, distance = tolerance; // point outside the tolerance
      for (let i = a + 1; i < b; i++) {
        const relative = points[i].map((v, k) => v - points[a][k]); // candidate offset
        const t = length2 ? Math.max(0, Math.min(1, relative.reduce((n, v, k) => n + v * delta[k], 0) / length2)) : 0; // closest projection
        const d = Math.hypot(...relative.map((v, k) => v - t * delta[k])); // perpendicular error
        if (d > distance) { distance = d; farthest = i; }
      }
      if (farthest >= 0) { keep[farthest] = 1; stack.push([a, farthest], [farthest, b]); }
    }
    return points.filter((_, i) => keep[i]);
  };

  /** Validate and copy a projected route. @param {number[][]} route XYZ metres @returns {number[][]} owned points */
  const validateRoute = route => {
    if (!Array.isArray(route) || route.length < 2 || route.length > 10000) throw new RangeError('每条路线需要 2–10000 个 XYZ 投影坐标');
    return route.map((p, i) => {
      if (!Array.isArray(p) || p.length !== 3 || !p.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e9)) throw new TypeError('路线坐标必须为有限 XYZ 米数');
      if (i && Math.hypot(...p.map((v, k) => v - route[i - 1][k])) < .001) throw new RangeError('相邻路线点不能重合');
      return p.slice();
    });
  };

  /** Convert route direction to the DTS actor-local lateral axis. @param {number[]} a start @param {number[]} b end @returns {number[]} unit local XY normal */
  const lateral = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy); // horizontal travel
    if (length < 1e-6) throw new RangeError('空间光流需要水平方向的行进，不能使用纯竖直段');
    return [dx / length, -dy / length];
  };

  /** Pack route metadata. @param {number[][]} input route @param {number[]} origin layer origin @param {object} settings style @param {number} maxSegments remaining budget @returns {number[][]} rows */
  const packRoute = (input, origin, settings, maxSegments) => {
    const route = simplify(validateRoute(input), settings.input.simplifyMeters); // simplified centreline
    const ds = [0], normals = []; // cumulative arc length and endpoint frame
    for (let i = 1; i < route.length; i++) ds.push(ds[i - 1] + Math.hypot(...route[i].map((v, k) => v - route[i - 1][k])));
    const needed = route.slice(1).reduce((n, p, i) => n + Math.ceil((ds[i + 1] - ds[i]) / settings.input.maxSegmentMeters), 0); // pre-allocation budget
    if (needed > maxSegments) throw new RangeError(`实例预算超出：此路线需要 ${needed * settings.groups} 个实例，剩余预算 ${maxSegments * settings.groups}`);
    for (let i = 0; i < route.length; i++) {
      const incoming = lateral(route[Math.max(0, i - 1)], route[Math.max(1, i)]); // previous segment normal
      const outgoing = lateral(route[Math.min(route.length - 2, i)], route[Math.min(route.length - 1, i + 1)]); // next segment normal
      const sum = incoming.map((v, k) => v + outgoing[k]), length = Math.hypot(...sum); // joined frame
      if (length < 1e-4) throw new RangeError('路线不能原地折返 180 度，请增加圆角过渡点');
      normals.push(sum.map(v => v / length));
    }
    const rows = []; // segment records, no particle vertices
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i], distance = ds[i] - ds[i - 1]; // source segment
      const count = Math.ceil(distance / settings.input.maxSegmentMeters), normal = lateral(a, b); // bounded WPO span
      for (let j = 0; j < count; j++) {
        const f = j / count, next = (j + 1) / count, p = a.map((v, k) => v + (b[k] - v) * f); // segment origin
        const local = [(p[1] - origin[1]) * 100, (p[0] - origin[0]) * 100, (p[2] - origin[2]) * 100]; // DTS local centimetres
        const delta = [(b[1] - a[1]) * (next - f) * 100, (b[0] - a[0]) * (next - f) * 100, (b[2] - a[2]) * (next - f) * 100]; // local displacement
        rows.push([...local, ...delta, ds[i - 1] + distance * f, distance / count, ds.at(-1),
          ...(j === 0 ? normals[i - 1] : normal), ...(j === count - 1 ? normals[i] : normal)].map(v => Math.round(v * 1e6) / 1e6));
      }
    }
    return rows;
  };

  /** Build layer incrementally. @param {object} o layer options @returns {Generator<number,object>} route progress followed by a complete plan */
  function* generateLayer(o = {}) {
    if (typeof o.id !== 'string' || !/^[\w-]{1,96}$/.test(o.id)) throw new TypeError('id 需要 1–96 个字母、数字、下划线或连字符');
    if (!Array.isArray(o.routes) || !o.routes.length || o.routes.length > 50000) throw new RangeError('routes 需要 1–50000 条路线');
    const settings = resolveSettings(o), origin = validateRoute(o.routes[0])[0]; // style and projected layer anchor
    const rows = []; // packed segment records
    const maxInstances = o.maxInstances ?? 1000000; // explicit caller-controlled resource budget
    bounded(maxInstances, 'maxInstances', [1, 10000000]);
    if (!Number.isInteger(maxInstances)) throw new RangeError('maxInstances 必须为整数');
    for (let i = 0; i < o.routes.length; i++) {
      const packed = packRoute(o.routes[i], origin, settings, Math.floor(maxInstances / settings.groups) - rows.length); // bounded before allocation
      for (const row of packed) rows.push(row);
      if (rows.length * settings.groups > maxInstances) throw new RangeError(`实例预算超出：需要 ${rows.length * settings.groups}，预算 ${maxInstances}。请调大实例预算或分批加载。`);
      yield i + 1;
    }
    const segmentsPerCall = o.segmentsPerCall ?? 64, packets = []; // cooperative Blueprint work and SDK batch size
    bounded(segmentsPerCall, 'segmentsPerCall', [1, 128]);
    if (!Number.isInteger(segmentsPerCall)) throw new RangeError('segmentsPerCall 必须为整数');
    for (let i = 0; i < rows.length; i += segmentsPerCall) packets.push(rows.slice(i, i + segmentsPerCall).flat());
    const instances = rows.length * settings.groups; // actual cooked mesh instance count
    return {version: '5.0', id: o.id, groupId: o.groupId ?? 'stream-flow-v5', origin, assetPath: o.assetPath ?? assetPath,
      pakFilePath: o.pakFilePath ?? defaultPak, settings, packets, routeCount: o.routes.length, segments: rows.length,
      instances, gpuVertices: instances * verticesPerInstance, payloadBytes: new TextEncoder().encode(JSON.stringify(packets)).length,
      coordinateAnchor: 'bottom', real3DGeometry: true, fpsPrediction: null};
  }

  /** Prepare a complete layer. @param {object} o options @returns {object} packed plan */
  const prepareLayer = o => {
    const iterator = generateLayer(o); // incremental planner
    let result = iterator.next(); // first route
    while (!result.done) result = iterator.next();
    return result.value;
  };

  /** Abort guard. @param {AbortSignal} signal cancellation token @returns {void} throws on cancellation */
  const checkAbort = signal => { if (signal?.aborted) throw new DOMException('加载已取消', 'AbortError'); };

  /** Yield to the browser event loop. @returns {Promise<void>} next task */
  const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));

  /** Prepare without freezing the control panel. @param {object} o options @param {object} control signal and onProgress @returns {Promise<object>} complete layer */
  const prepareLayerAsync = async (o, {signal, onProgress} = {}) => {
    const iterator = generateLayer(o); // shared planner
    let start = performance.now(), result; // current event-loop slice
    do {
      checkAbort(signal); result = iterator.next();
      if (!result.done) onProgress?.({completed: result.value, total: o.routes.length});
      if (performance.now() - start > 8) { await yieldTask(); start = performance.now(); }
    } while (!result.done);
    checkAbort(signal); return result.value;
  };

  /** Wait for an explicit SDK callback; undefined Promise returns are never success. @param {object} target SDK namespace @param {string} method method @param {unknown[]} args arguments @returns {Promise<object>} successful reply */
  const invoke = (target, method, args) => new Promise((resolve, reject) => {
    let done = false; // completion guard
    const timer = setTimeout(() => finish(new Error(`${method} 等待回执超时`)), 180000); // bounded callback wait
    /** Settle and release the timeout. @param {object|Error} reply response @returns {void} */
    const finish = reply => {
      if (done) return;
      done = true; clearTimeout(timer);
      if (reply instanceof Error) reject(reply);
      else if (reply && Number(reply.result) === 0) resolve(reply);
      else reject(new Error(`${method}: ${reply?.resultMessage ?? JSON.stringify(reply)}`));
    };
    try {
      const pending = target[method](...args, finish); // callback-first SDK 7.1 compatibility
      if (pending?.then) pending.then(value => { if (value !== undefined) finish(value); }, finish);
    } catch (error) { finish(error); }
  });

  /** Build a typed Blueprint call. @param {string} id object @param {string} functionName function @param {unknown} value parameter @param {number} type DTS type code @returns {object} call request */
  const request = (id, functionName, value, type = 15) => ({id, functionName, parameters: value === undefined ? [] : [{paramType: type, paramValue: value}]});

  /** Update material only. @param {object} api DTS API @param {string} id layer @param {object} options style @returns {Promise<object>} callback */
  const setStyle = (api, id, options) => invoke(api.customObject, 'callBPFunction', [[request(id, 'SetStyle', resolveSettings(options).values)]]);

  /** Remove one owned layer. @param {object} api DTS API @param {string} id object @returns {Promise<object>} callback */
  const remove = (api, id) => invoke(api.customObject, 'delete', [[id]]);

  /** Load one layer and roll it back on failure/cancellation. @param {object} api DTS API @param {object} plan prepared metadata @param {object} control signal and progress @returns {Promise<object>} load metrics */
  const load = async (api, plan, {signal, onProgress} = {}) => {
    checkAbort(signal);
    const started = performance.now(); // actual load start, includes PAK/actor creation
    let created = false, bytes = 0; // transaction ownership and confirmed payload
    try {
      await invoke(api.customObject, 'add', [[{id: plan.id, groupId: plan.groupId, ...(plan.pakFilePath ? {pakFilePath: plan.pakFilePath} : {}), assetPath: plan.assetPath,
        location: plan.origin, coordinateType: 0, rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, autoHeight: false,
        enableDecal: false, range: [0, 1000000]}]]);
      created = true; checkAbort(signal);
      await invoke(api.customObject, 'callBPFunction', [[request(plan.id, 'SetStyle', plan.settings.values)]]);
      let commands = 2; // actor creation and style initialization
      for (let i = 0; i < plan.packets.length;) {
        checkAbort(signal);
        const calls = []; // bounded Blueprint calls sharing one SDK command
        let chars = 2; // JSON array brackets
        while (i < plan.packets.length && calls.length < 8) {
          const item = request(plan.id, 'AppendSegments', plan.packets[i]), size = new TextEncoder().encode(JSON.stringify(item)).length; // next call size
          if (calls.length && chars + size + 1 > 120000) break;
          if (size > 120000) throw new RangeError('单条蓝图请求超过 120 KB，请减小 segmentsPerCall');
          calls.push(item); chars += size + 1; i++;
        }
        bytes += new TextEncoder().encode(JSON.stringify(calls)).length;
        await invoke(api.customObject, 'callBPFunction', [calls]);
        commands++; onProgress?.({completed: i, total: plan.packets.length, bytes});
        await yieldTask();
      }
      checkAbort(signal);
      return {addMs: performance.now() - started, requestBytes: bytes, calls: commands,
        routes: plan.routeCount, segments: plan.segments, instances: plan.instances, gpuVertices: plan.gpuVertices};
    } catch (error) {
      if (created) { try { await remove(api, plan.id); } catch (cleanup) { error.cleanupError = cleanup.message; } }
      throw error;
    }
  };

  const api = Object.freeze({version: '5.0', assetPath, defaultPak, ranges, defaults, packetWidth, groupSize,
    resolveSettings, prepareLayer, prepareLayerAsync, load, setStyle, remove, invoke, request, simplify}); // public contract
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DTSStreamFlowInstanced = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
