/* ZoneMarker3D adapter for the DTS SDK 7.1 (fdapi): zone status markers (V-shaped crystal, dot column, ground diamond,
 * zone name + status with an underline). Name, status, theme colour and text colour are editable at any time.
 *
 * Two ways to load the Blueprint BP_Marker3D_ZoneStatus:
 *   - Marker3D (production): put ZoneMarker3D-V1-WindowsNoEditor.pak in the renderer's AirCityExplorer\Content\Paks\ and
 *     connect with a new instance (reset: true); then ZoneMarker.create(fdapi).
 *   - customObject (no deployment, for testing): ZoneMarker.create(fdapi, { pakFilePath: '<render host path>\ZoneMarker3D-V1-WindowsNoEditor.pak' }).
 *     The renderer locks the file once loaded, and a loaded class does not refresh when the same path is rebuilt.
 *
 *   const zones = ZoneMarker.create(fdapi);
 *   await zones.add([{ id: 'a', coordinate: [x, y, 0], name: '滨海住宅 A区', status: '建设中' }]);   // text hidden by default
 *   await zones.update([{ id: 'a', status: '已交付' }]);            // status preset colour follows unless color is given
 *   await zones.update([{ id: 'a', color: '#ff3366', textColor: '#fff6d0' }]);
 *   await zones.update([{ id: 'a', textVisible: true }]);            // show name, status and underline; false hides them
 */
(function (global) {
  const POINT_NAME = 'BP_Marker3D_ZoneStatus'; // 3DUI asset name used as marker3d pointName
  const ASSET_PATH = '/JC_CustomAssets/EffectLibrary/Exhibition/3DUI/BP_Marker3D_ZoneStatus'; // customObject assetPath
  const FLOAT = 3; // BPFuncParamType.Float
  const STRING = 5; // BPFuncParamType.String (FText parameters crash the renderer, the Blueprint takes FString)
  /** Theme colour per status (sRGB hex), taken from the reference images; any other status keeps the current colour. */
  const STATUS_COLORS = Object.freeze({ 建设中: '#2f7bff', 未开工: '#ff9a2e', 已交付: '#4fd987', 计划建设: '#d8e6ff' });
  const DEFAULT_COLOR = STATUS_COLORS.建设中; // theme colour when neither color nor a known status is given

  /**
   * Call a marker3d / customObject SDK method and wait for its explicit success reply (SDK 7.1.0930 drops the Promise
   * value of callBPFunction, so the callback is authoritative).
   * @param {object} api fdapi instance
   * @param {string} method method name
   * @param {Array<unknown>} args method arguments without the trailing callback
   * @param {number} [timeoutMs] reject after this many milliseconds without a reply
   * @param {string} [target] 'marker3d' or 'customObject'
   * @returns {Promise<object>} SDK response whose result is 0
   */
  const invoke = (api, method, args, timeoutMs = 30000, target = 'marker3d') => new Promise((resolve, reject) => {
    let settled = false; // true once resolved or rejected
    const timer = setTimeout(() => finish(new Error(`DTS ${target}.${method} timed out; outcome unknown`)), timeoutMs); // timeout guard
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
        finish(new Error(`DTS ${target}.${method} failed: ${(failed ?? response)?.resultMessage ?? 'no success reply'}`));
        return;
      }
      finish(null, response);
    };
    try {
      const pending = api[target][method](...args, done); // undefined for callBPFunction in SDK 7.1.0930
      if (pending && typeof pending.then === 'function') pending.then(done, error => finish(error));
    } catch (error) {
      finish(error);
    }
  });

  /**
   * sRGB colour (hex '#rrggbb' / '#rgb' or [r, g, b] 0..1) to linear RGB, as the Blueprint expects.
   * @param {string|number[]} color colour
   * @returns {number[]} linear [r, g, b]
   */
  const toLinear = color => {
    let rgb = color; // sRGB 0..1
    if (typeof color === 'string') {
      let hex = color.replace('#', ''); // hex digits
      if (hex.length === 3) hex = [...hex].map(c => c + c).join('');
      rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    }
    return rgb.map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  };

  /**
   * One callBPFunction entry.
   * @param {string} id Marker3D id
   * @param {string} functionName Blueprint function name
   * @param {Array<[number, unknown]>} params [paramType, paramValue] pairs in Blueprint order
   * @returns {object} callBPFunction request item
   */
  const request = (id, functionName, params) => ({ id, functionName, parameters: params.map(([paramType, paramValue]) => ({ paramType, paramValue })) });

  /**
   * Setter requests for the supplied fields of one marker (only supplied fields are sent).
   * @param {object} item { id, name?, status?, textVisible?, color?, textColor?, layout?, glow?, maskOpacity?, minScreenScale?, animation?, referenceDistanceM?, brightness? }
   *   textVisible: text is hidden by default (only crystal, dots and diamond); true shows name, status and underline,
   *   false hides them again (the text is kept)
   *   layout: { crystalPx, beamPx, basePx, namePx, statusPx, underlinePx, textGapPx } (reference pixels, all required together)
   *   animation: { entrySeconds, delaySeconds, idleSpeed }
   * @param {object} current last known { name, status, textVisible, layout } of the marker (SetContent needs both lines)
   * @returns {object[]} callBPFunction request items
   */
  const setters = (item, current) => {
    const { id } = item; // marker id
    const out = []; // requests in order
    if (item.layout || item.textVisible !== undefined) {
      const l = { ...ZoneMarker.DEFAULT_LAYOUT, ...current.layout }; // complete layout
      if (!current.textVisible) l.underlinePx = 0;
      out.push(request(id, 'SetLayout', [l.crystalPx, l.beamPx, l.basePx, l.namePx, l.statusPx, l.underlinePx, l.textGapPx].map(v => [FLOAT, v])));
    }
    if (item.name !== undefined || item.status !== undefined || item.textVisible !== undefined) {
      const shown = current.textVisible === true; // hidden text is drawn as two empty lines
      out.push(request(id, 'SetContent', [[STRING, shown ? String(current.name ?? '') : ''], [STRING, shown ? String(current.status ?? '') : '']]));
    }
    const theme = item.color ?? (item.status !== undefined ? STATUS_COLORS[item.status] : undefined); // explicit colour wins over the preset
    if (theme !== undefined) out.push(request(id, 'SetThemeColor', toLinear(theme).map(v => [FLOAT, v])));
    if (item.textColor !== undefined) out.push(request(id, 'SetTextColor', toLinear(item.textColor).map(v => [FLOAT, v])));
    if (item.glow !== undefined) out.push(request(id, 'SetGlow', [[FLOAT, item.glow]]));
    if (item.maskOpacity !== undefined || item.minScreenScale !== undefined) {
      out.push(request(id, 'SetDisplay', [[FLOAT, item.maskOpacity ?? 0.45], [FLOAT, item.minScreenScale ?? 0.7]]));
    }
    if (item.animation) {
      const a = { entrySeconds: 2, delaySeconds: 0, idleSpeed: 1, ...item.animation }; // complete timing
      out.push(request(id, 'SetAnimation', [[FLOAT, a.entrySeconds], [FLOAT, a.delaySeconds], [FLOAT, a.idleSpeed]]));
    }
    if (item.referenceDistanceM !== undefined) out.push(request(id, 'SetReferenceDistance', [[FLOAT, item.referenceDistanceM]]));
    if (item.brightness !== undefined) out.push(request(id, 'SetBrightness', [[FLOAT, item.brightness]]));
    return out;
  };

  /**
   * Create a manager for one group of zone markers.
   * @param {object} api fdapi instance after onReady
   * @param {object} [options] { groupId, chunkSize: markers per round trip, pakFilePath: load through customObject
   *   from this render-host PAK instead of a mounted Marker3D (no deployment) }
   * @returns {object} { add, update, replay, showFinal, remove, clear, isResolved, items }
   */
  const create = (api, { groupId = 'zone_marker', chunkSize = 100, pakFilePath } = {}) => {
    const items = new Map(); // id -> { name, status }
    const target = pakFilePath ? 'customObject' : 'marker3d'; // SDK object the markers live in
    /**
     * invoke() on this manager's SDK object.
     * @param {string} method method name
     * @param {Array<unknown>} args arguments
     * @param {number} [timeoutMs] timeout
     * @returns {Promise<object>} SDK response
     */
    const run = (method, args, timeoutMs = 30000) => invoke(api, method, args, timeoutMs, target);
    /**
     * add() entry for one marker.
     * @param {object} m { id, coordinate, coordinateType?, marker? }
     * @returns {object} marker3d.add or customObject.add item
     */
    const addItem = ({ id, coordinate, coordinateType = 0, marker = {} }) => (pakFilePath
      ? { id, groupId, assetPath: ASSET_PATH, pakFilePath, location: coordinate, coordinateType, rotation: [0, 0, 0], scale: [1, 1, 1],
        range: [0, 1e7], autoHeight: true, collision: true, ...marker }
      // collision: true keeps the marker clickable. The Blueprint picks with thin slabs on the crystal, dot column and
      // diamond that follow the camera (Visibility channel only), so the camera is never inside a collider.
      : { id, groupId, pointName: POINT_NAME, coordinate, coordinateType, range: [1, 1e7], textVisible: false, autoHeight: true, collision: true,
        ...marker, pointScale: 1, fixedSize: false });

    /**
     * Run callBPFunction requests in chunks.
     * @param {object[]} calls request items
     * @returns {Promise<void>}
     */
    const call = async calls => {
      for (let i = 0; i < calls.length; i += chunkSize * 4) await run('callBPFunction', [calls.slice(i, i + chunkSize * 4)], 120000);
    };

    /**
     * Add (or replace) markers; each plays its entry animation. Text and colour are applied right after the add, so
     * set animation.delaySeconds a little above 0 if the first frames must already show the new text.
     * @param {object[]} list [{ id, coordinate: [x, y, z], name, status, color?, textColor?, coordinateType?, marker?, ...setters }]
     *   z = 0 with autoHeight (default) snaps to the surface; marker is merged into marker3d.add.
     * @returns {Promise<{ms: number}>} wall time
     */
    const add = async list => {
      const start = performance.now(); // timing
      for (let i = 0; i < list.length; i += chunkSize) {
        const chunk = list.slice(i, i + chunkSize); // markers of this round trip
        await run('delete', [chunk.map(m => m.id)]).catch(() => {});
        await run('add', [chunk.map(addItem)], 120000);
        const calls = chunk.flatMap(m => {
          const current = { name: m.name ?? '', status: m.status ?? '', textVisible: m.textVisible === true, layout: { ...m.layout } }; // state of this marker (text hidden unless asked for)
          items.set(m.id, current);
          const color = m.color ?? STATUS_COLORS[m.status] ?? DEFAULT_COLOR; // theme colour
          return [...setters({ ...m, name: current.name, status: current.status, textVisible: current.textVisible, color }, current), request(m.id, 'Replay', [])];
        });
        await call(calls);
      }
      return { ms: Math.round(performance.now() - start) };
    };

    /**
     * Change name, status, colours, layout or timing of existing markers (only supplied fields). Changing the status
     * also switches the theme colour to that status preset unless color is given.
     * @param {object[]} list [{ id, name?, status?, textVisible?, color?, textColor?, layout?, glow?, animation?, referenceDistanceM?, brightness?, replay? }]
     * @returns {Promise<{ms: number}>} wall time
     */
    const update = async list => {
      const start = performance.now(); // timing
      const calls = list.flatMap(m => {
        const current = items.get(m.id) ?? { name: '', status: '', textVisible: false, layout: {} }; // last known state
        if (m.name !== undefined) current.name = m.name;
        if (m.status !== undefined) current.status = m.status;
        if (m.textVisible !== undefined) current.textVisible = m.textVisible;
        if (m.layout) current.layout = { ...current.layout, ...m.layout };
        items.set(m.id, current);
        return [...setters(m, current), ...(m.replay ? [request(m.id, 'Replay', [])] : [])];
      });
      await call(calls);
      return { ms: Math.round(performance.now() - start) };
    };

    /**
     * Play the entry animation again.
     * @param {string[]} [ids] markers (default all)
     * @returns {Promise<void>}
     */
    const replay = ids => call((ids ?? [...items.keys()]).map(id => request(id, 'Replay', [])));

    /**
     * Jump to the final state (no entry).
     * @param {string[]} [ids] markers (default all)
     * @returns {Promise<void>}
     */
    const showFinal = ids => call((ids ?? [...items.keys()]).map(id => request(id, 'ShowFinal', [])));

    /**
     * Remove markers.
     * @param {string[]} ids markers
     * @returns {Promise<void>}
     */
    const remove = async ids => {
      await run('delete', [ids]).catch(() => {});
      ids.forEach(id => items.delete(id));
    };

    /**
     * Remove every marker of this group.
     * @returns {Promise<void>}
     */
    const clear = async () => {
      if (pakFilePath) await run('delete', [[...items.keys()]]).catch(() => {}); // customObject has no group delete
      else await run('deleteByGroupId', [groupId]).catch(() => {});
      items.clear();
    };

    /**
     * Check that DTS really spawned the Blueprint (add returns 0 even for an unknown pointName).
     * @param {string} id marker id
     * @returns {Promise<boolean>} true when the actor resolved and exposes SetContent
     */
    const isResolved = async id => {
      const info = await run('getBPFunction', [id]); // { data: [{ objectName, params }] }
      const entry = info?.data?.[0]; // this marker's Blueprint description
      return Boolean(entry && entry.objectName !== 'None' && entry.params?.some(p => p.functionName === 'SetContent'));
    };

    return { add, update, replay, showFinal, remove, clear, isResolved, items };
  };

  const ZoneMarker = {
    VERSION: '1.4.1', POINT_NAME, ASSET_PATH, STATUS_COLORS, toLinear, invoke, create,
    /** Layout defaults (reference pixels at ReferenceDistanceM 1500), same as the Blueprint. */
    DEFAULT_LAYOUT: Object.freeze({ crystalPx: 40, beamPx: 10, basePx: 14, namePx: 16, statusPx: 12, underlinePx: 64, textGapPx: 0 }),
  };
  global.ZoneMarker = ZoneMarker;
  if (typeof module !== 'undefined') module.exports = ZoneMarker;
})(typeof window !== 'undefined' ? window : globalThis);
