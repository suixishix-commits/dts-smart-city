/* DTS Demo Center copy: pakFilePath is optional here (leave it empty when the Cloud already mounts the effects bundle). */
/* ViewFrustum V2 adapter for DTS (fdapi, SDK 7.1).
   One customObject (BP_ViewFrustum_V2) draws one camera's view pyramid: apex fixed on the lens, four flat
   translucent side faces, thin glowing side edges, no far cap. play() grows it from the lens: the material scales
   the pyramid about the apex, so length, far width and far height grow together and the opening angles never change.
   With collision on (default), a depth capture from the lens stops every ray at the first surface it meets (ground,
   wall, object) and the surfaces inside the pyramid light up with glowing outlines (footprint); only rays that meet
   nothing end in a free far outline. */
(function (root) {
  'use strict';

  const VERSION = '2.0'; // adapter version
  const ASSET_PATH = '/JC_CustomAssets/ObjectLibrary/Exhibition/ViewFrustumV2/BP_ViewFrustum_V2'; // Blueprint asset
  const TYPE = Object.freeze({ float: 3 }); // BPFuncParamType values
  const VIEW_RANGE_M = 1000000; // customObject far clip (m); the SDK default 10 km would cut far views
  const DEFAULT_SHAPE = Object.freeze({ hfovDeg: 60, vfovDeg: 34, rangeM: 120 }); // Blueprint defaults (Build/spec.py)
  const TARGET_REACH = 2; // with collision, rays that point up or level run this many times the target distance
  const DEFAULT_STYLE = Object.freeze({ color: '#58ceff', faceOpacity: 0.05, edgeBand: 0.18, lineWidthPx: 1.6, glowPx: 2.5, brightness: 1, frontBoost: 0.8, footprintOpacity: 0.22 });
  const DEFAULT_DURATION = 1.2; // growth seconds
  const frustums = new Map(); // id -> { objectId, position, shape, aim, style, collision }

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
   * Aim in the customObject's own frame (DTS spawns it turned: X north, Y east, Z up) for a world direction.
   * @param {number[]} d direction [east, north, up]
   * @returns {{ pitchDeg: number, yawDeg: number }} Blueprint SetAim values
   */
  const actorAim = ([e, n, u]) => ({
    pitchDeg: Math.atan2(u, Math.hypot(e, n)) * 180 / Math.PI,
    yawDeg: Math.atan2(e, n) * 180 / Math.PI,
  });

  /**
   * World direction of a DTS camera pose (yaw 0 = east, clockwise; pitch below 0 looks down).
   * @param {number} yawDeg DTS camera yaw
   * @param {number} pitchDeg DTS camera pitch
   * @returns {number[]} unit direction [east, north, up]
   */
  const cameraDirection = (yawDeg, pitchDeg) => {
    const y = yawDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180; // radians
    return [Math.cos(p) * Math.cos(y), -Math.cos(p) * Math.sin(y), Math.sin(p)];
  };

  /**
   * Aim, and the range a target implies, from the options of create() / aim().
   * @param {number[]} position lens [x, y, z]
   * @param {{ target?: number[], yawDeg?: number, pitchDeg?: number }} o target point, or a DTS camera yaw / pitch
   * @returns {{ pitchDeg: number, yawDeg: number, distance?: number }|null} aim, null when nothing was given
   */
  const resolveAim = (position, o) => {
    if (Array.isArray(o.target)) {
      const d = [o.target[0] - position[0], o.target[1] - position[1], (o.target[2] ?? position[2]) - position[2]]; // lens -> target
      const distance = Math.hypot(...d); // metres
      if (!(distance > 0)) throw new Error('target must differ from the lens position');
      return { ...actorAim(d), distance };
    }
    if (Number.isFinite(o.yawDeg) || Number.isFinite(o.pitchDeg)) return actorAim(cameraDirection(o.yawDeg ?? 0, o.pitchDeg ?? 0));
    return null;
  };

  /**
   * World positions of the far rectangle corners (for markers, camera framing and checks).
   * @param {{ position: number[], shape: object, aim: object }} f frustum record
   * @returns {number[][]} 4 corners [x, y, z]: right-bottom, right-top, left-top, left-bottom as the camera sees them
   */
  const farCorners = f => {
    const r = Math.PI / 180; // degrees -> radians
    const yaw = f.aim.yawDeg * r, pitch = f.aim.pitchDeg * r; // actor-frame aim
    // Actor axes in world (east, north, up): X north, Y east, Z up; UE rotator (pitch, yaw, 0) applied to the unit pyramid.
    const fwd = [Math.cos(pitch) * Math.sin(yaw), Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch)]; // local X
    const right = [Math.cos(yaw), -Math.sin(yaw), 0]; // local Y (UE yaw turns X toward Y)
    const up = [-Math.sin(pitch) * Math.sin(yaw), -Math.sin(pitch) * Math.cos(yaw), Math.cos(pitch)]; // local Z
    const L = f.shape.rangeM, w = L * Math.tan(f.shape.hfovDeg * r / 2), h = L * Math.tan(f.shape.vfovDeg * r / 2); // range, half width, half height
    return [[1, -1], [1, 1], [-1, 1], [-1, -1]].map(([sy, sz]) => [0, 1, 2].map(k => f.position[k] + L * fwd[k] + sy * w * right[k] + sz * h * up[k]));
  };

  /**
   * Longest ray with collision on and a target: far enough that every downward corner ray meets the ground plane
   * through the target (walls and objects stop rays earlier anyway); rays pointing up or level end at TARGET_REACH
   * times the target distance.
   * @param {number[]} position lens
   * @param {{ pitchDeg: number, yawDeg: number }} aim actor-frame aim
   * @param {{ hfovDeg: number, vfovDeg: number }} shape fields of view
   * @param {number[]} target aim point
   * @param {number} distance lens -> target (m)
   * @returns {number} range (m, along the axis)
   */
  const reachRange = (position, aim, shape, target, distance) => {
    const unit = farCorners({ position, aim, shape: { ...shape, rangeM: 1 } }); // corners at axis depth 1
    const drop = (target[2] ?? position[2]) - position[2]; // target plane relative to the lens (m)
    const depths = unit.map(c => { const dz = c[2] - position[2]; return dz < -1e-3 && drop < 0 ? drop / dz : Infinity; }); // axis depth where each corner ray meets the plane
    const down = depths.filter(Number.isFinite); // corners that reach the plane
    const needed = Math.max(0, ...down) * 1.1; // margin for uneven ground
    const floor = distance * (down.length < 4 ? TARGET_REACH : 1.1); // nothing shorter than the target
    return Math.min(Math.max(needed, floor), Math.max(distance * 8, 50), 3000);
  };

  // ---------------------------------------------------------------------------------------------
  // SDK helpers (as the RegionDotFlow / TunnelBIM adapters: SDK 7.1.0930 answers callBPFunction only in the callback)

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
   * One callBPFunction request item with float parameters.
   * @param {string} objectId customObject id
   * @param {string} functionName Blueprint function
   * @param {number[]} values float parameters in Blueprint order
   * @returns {object} request item
   */
  const call = (objectId, functionName, values = []) => ({ id: objectId, functionName, parameters: values.map(v => ({ paramType: TYPE.float, paramValue: Number(v) })) });

  /**
   * Requests that apply a shape, aim and style.
   * @param {object} f frustum record
   * @returns {object[]} request items
   */
  const stateRequests = f => {
    const c = toLinear(f.style.color); // linear colour
    const s = f.style; // style
    return [
      call(f.objectId, 'SetShape', [f.shape.hfovDeg, f.shape.vfovDeg, f.shape.rangeM]),
      call(f.objectId, 'SetAim', [f.aim.pitchDeg, f.aim.yawDeg]),
      call(f.objectId, 'SetStyle', [c[0], c[1], c[2], s.faceOpacity, s.edgeBand, s.lineWidthPx, s.glowPx, s.brightness, s.frontBoost, s.footprintOpacity]),
      call(f.objectId, 'SetCollision', [f.collision ? 1 : 0]),
    ];
  };

  /**
   * Remembered frustum.
   * @param {string} id frustum id
   * @returns {object} record
   */
  const record = id => {
    const f = frustums.get(id); // record
    if (!f) throw new Error(`Unknown view frustum ${id}; call create() first`);
    return f;
  };

  // ---------------------------------------------------------------------------------------------
  // Public API

  /**
   * Create (or replace) a camera view pyramid.
   * @param {object} api fdapi instance after onReady
   * @param {object} options { id, pakFilePath, position [x, y, z] (lens, projected m), target [x, y, z] | yawDeg + pitchDeg
   *   (DTS camera convention), rangeM? (longest ray; default: with collision TARGET_REACH x the target distance, else
   *   the target distance, else 120), hfovDeg?, vfovDeg?, style?, collision? (default true), play? (default true: grow
   *   now; false: full pyramid at once), duration? (s), assetPath? }
   * @returns {Promise<object>} summary { id, rangeM, aim, corners }
   */
  const create = async (api, { id, pakFilePath, position, play = true, duration = DEFAULT_DURATION, style = {}, collision = true, assetPath = ASSET_PATH, ...options }) => {
    if (typeof id !== 'string' || !id || id.includes(':')) throw new Error('id is required and must not contain ":"');
    if (pakFilePath !== undefined && pakFilePath !== '' && (typeof pakFilePath !== 'string' || !/\.pak$/i.test(pakFilePath.trim()))) throw new Error('pakFilePath must be empty or the .pak path on the DTS render host');
    if (!Array.isArray(position) || position.length < 3 || !position.every(Number.isFinite)) throw new Error('position must be the lens [x, y, z]');
    const aim = resolveAim(position, options) ?? { pitchDeg: 0, yawDeg: 0 }; // aim in the actor frame
    const fov = { hfovDeg: options.hfovDeg ?? DEFAULT_SHAPE.hfovDeg, vfovDeg: options.vfovDeg ?? DEFAULT_SHAPE.vfovDeg }; // fields of view
    const reach = Number.isFinite(aim.distance) ? (collision ? reachRange(position, aim, fov, options.target, aim.distance) : aim.distance) : undefined; // range a target implies
    const shape = { ...DEFAULT_SHAPE, rangeM: options.rangeM ?? reach ?? DEFAULT_SHAPE.rangeM }; // fields of view and range
    if (Number.isFinite(options.hfovDeg)) shape.hfovDeg = options.hfovDeg;
    if (Number.isFinite(options.vfovDeg)) shape.vfovDeg = options.vfovDeg;
    await remove(api, id);
    const objectId = `${id}:frustum`; // customObject id
    await invoke(api, 'delete', [[objectId]]).catch(() => {}); // leftovers after a page reload
    await invoke(api, 'add', [[{
      id: objectId, groupId: id, assetPath, ...(pakFilePath ? { pakFilePath: pakFilePath.trim() } : {}), location: position.slice(0, 3), rotation: [0, 0, 0], scale: [1, 1, 1],
      coordinateType: 0, collision: false, autoHeight: false, enableDecal: false, range: [0, VIEW_RANGE_M],
    }]]);
    const f = { objectId, position: position.slice(0, 3), shape, aim: { pitchDeg: aim.pitchDeg, yawDeg: aim.yawDeg }, style: { ...DEFAULT_STYLE, ...style }, collision: Boolean(collision) }; // record
    frustums.set(id, f);
    // A new object waits collapsed at the lens, so shape and aim arrive before anything big is drawn.
    await invoke(api, 'callBPFunction', [[...stateRequests(f), play ? call(objectId, 'Play', [duration]) : call(objectId, 'ShowFull')]]);
    return { id, rangeM: shape.rangeM, aim: f.aim, corners: farCorners(f) };
  };

  /**
   * Grow the pyramid out of the lens again (starts from the small starting shape).
   * @param {object} api fdapi instance
   * @param {string} id frustum id
   * @param {number} [duration] seconds (about 1-1.5 looks best)
   * @returns {Promise<void>} resolves when DTS answered
   */
  const play = async (api, id, duration = DEFAULT_DURATION) => { await invoke(api, 'callBPFunction', [[call(record(id).objectId, 'Play', [duration])]]); };

  /**
   * Show the full pyramid at once (no growth).
   * @param {object} api fdapi instance
   * @param {string} id frustum id
   * @returns {Promise<void>} resolves when DTS answered
   */
  const showFull = async (api, id) => { await invoke(api, 'callBPFunction', [[call(record(id).objectId, 'ShowFull')]]); };

  /**
   * Re-aim: at a target point (the range follows the distance unless rangeM is given) or a DTS camera yaw / pitch.
   * @param {object} api fdapi instance
   * @param {string} id frustum id
   * @param {{ target?: number[], yawDeg?: number, pitchDeg?: number, rangeM?: number, play?: boolean, duration?: number }} options aim
   * @returns {Promise<object>} { aim, rangeM, corners }
   */
  const aim = async (api, id, options) => {
    const f = record(id); // record
    const a = resolveAim(f.position, options); // new aim
    if (!a) throw new Error('aim needs target or yawDeg / pitchDeg');
    f.aim = { pitchDeg: a.pitchDeg, yawDeg: a.yawDeg };
    if (Number.isFinite(options.rangeM) || Number.isFinite(a.distance)) f.shape.rangeM = options.rangeM ?? (f.collision ? reachRange(f.position, f.aim, f.shape, options.target, a.distance) : a.distance);
    const items = [call(f.objectId, 'SetShape', [f.shape.hfovDeg, f.shape.vfovDeg, f.shape.rangeM]), call(f.objectId, 'SetAim', [f.aim.pitchDeg, f.aim.yawDeg])]; // requests
    if (options.play) items.push(call(f.objectId, 'Play', [options.duration ?? DEFAULT_DURATION]));
    await invoke(api, 'callBPFunction', [items]);
    return { aim: f.aim, rangeM: f.shape.rangeM, corners: farCorners(f) };
  };

  /**
   * Change fields of view and / or range (only the supplied fields).
   * @param {object} api fdapi instance
   * @param {string} id frustum id
   * @param {{ hfovDeg?: number, vfovDeg?: number, rangeM?: number }} shape new values
   * @returns {Promise<object>} the full shape
   */
  const setShape = async (api, id, shape) => {
    const f = record(id); // record
    for (const k of ['hfovDeg', 'vfovDeg', 'rangeM']) if (Number.isFinite(shape[k])) f.shape[k] = shape[k];
    await invoke(api, 'callBPFunction', [[call(f.objectId, 'SetShape', [f.shape.hfovDeg, f.shape.vfovDeg, f.shape.rangeM])]]);
    return { ...f.shape };
  };

  /**
   * Restyle (DEFAULT_STYLE fields; only the supplied ones change).
   * @param {object} api fdapi instance
   * @param {string} id frustum id
   * @param {object} style style fields
   * @returns {Promise<object>} the full style
   */
  const setStyle = async (api, id, style) => {
    const f = record(id); // record
    Object.assign(f.style, style);
    await invoke(api, 'callBPFunction', [[stateRequests(f)[2]]]);
    return { ...f.style };
  };

  /**
   * Turn collision on (rays stop at surfaces, footprint shows) or off (the plain pyramid).
   * @param {object} api fdapi instance
   * @param {string} id frustum id
   * @param {boolean} on collision on
   * @returns {Promise<void>} resolves when DTS answered
   */
  const setCollision = async (api, id, on) => {
    const f = record(id); // record
    f.collision = Boolean(on);
    await invoke(api, 'callBPFunction', [[call(f.objectId, 'SetCollision', [f.collision ? 1 : 0])]]);
  };

  /**
   * Capture the lens depth again (the scene changed: a vehicle moved, a layer was loaded). Play() also does it.
   * @param {object} api fdapi instance
   * @param {string} id frustum id
   * @returns {Promise<void>} resolves when DTS answered
   */
  const recapture = async (api, id) => { await invoke(api, 'callBPFunction', [[call(record(id).objectId, 'Recapture')]]); };

  /**
   * Show or hide.
   * @param {object} api fdapi instance
   * @param {string} id frustum id
   * @param {boolean} visible true to show
   * @returns {Promise<void>} resolves when DTS answered
   */
  const setVisible = async (api, id, visible) => { await invoke(api, visible ? 'show' : 'hide', [[record(id).objectId]]); };

  /**
   * Delete.
   * @param {object} api fdapi instance
   * @param {string} id frustum id
   * @returns {Promise<void>} resolves when deleted (or nothing to delete)
   */
  const remove = async (api, id) => {
    const f = frustums.get(id); // record
    if (!f) return;
    frustums.delete(id);
    await invoke(api, 'delete', [[f.objectId]]).catch(() => {});
  };

  const ViewFrustum = Object.freeze({
    VERSION, ASSET_PATH, DEFAULT_SHAPE, DEFAULT_STYLE, DEFAULT_DURATION, TARGET_REACH,
    create, play, showFull, aim, setShape, setStyle, setCollision, recapture, setVisible, remove,
    corners: id => farCorners(record(id)), get: id => frustums.get(id),
    actorAim, cameraDirection, resolveAim, farCorners, reachRange, toLinear, invoke,
  }); // public API
  root.ViewFrustum = ViewFrustum;
  if (typeof module !== 'undefined') module.exports = ViewFrustum;
})(typeof window !== 'undefined' ? window : globalThis);
