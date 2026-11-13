/* HeatColumn Marker3D adapter for the DTS SDK 7.1 (fdapi).
 *
 * Requires BP_Marker3D_HeatColumn (3DUI) to be mounted in the render instance.
 * Labels are not part of the asset: add them with fdapi.marker (2D) or marker3d text.
 * By default every column shows the full colour scale along its own height; pass the same
 * scaleMaxM (> 0) to all columns of a chart for a shared scale where equal heights share colours.
 */
(function (global) {
  const POINT_NAME = 'BP_Marker3D_HeatColumn'; // 3DUI asset name used as marker3d pointName
  const FLOAT = 3; // BPFuncParamType.Float
  const BOOL = 0; // BPFuncParamType.Bool
  const COLOR = 6; // BPFuncParamType.Color (linear RGBA 0..1)

  /**
   * Call a marker3d SDK method and wait for its explicit success reply.
   * SDK 7.1.0930 drops the Promise value of callBPFunction, so the callback is authoritative
   * (same finding as the Sky Needle V2 controller); Promise-returning SDKs also work.
   * @param {object} api fdapi instance
   * @param {string} method marker3d method name
   * @param {Array<unknown>} args method arguments without the trailing callback
   * @param {number} [timeoutMs] reject after this many milliseconds without a reply
   * @returns {Promise<object>} SDK response whose result is 0
   */
  const invoke = (api, method, args, timeoutMs = 15000) => new Promise((resolve, reject) => {
    let settled = false; // true once resolved or rejected
    const timer = setTimeout(() => finish(new Error(`DTS marker3d.${method} timed out; outcome unknown`)), timeoutMs); // timeout guard
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
        finish(new Error(`DTS marker3d.${method} failed: ${(failed ?? response)?.resultMessage ?? 'no success reply'}`));
        return;
      }
      finish(null, response);
    };
    try {
      const pending = api.marker3d[method](...args, done); // undefined for callBPFunction in SDK 7.1.0930
      if (pending && typeof pending.then === 'function') pending.then(done, error => finish(error));
    } catch (error) {
      finish(error);
    }
  });

  /**
   * Build one callBPFunction entry.
   * @param {string} id Marker3D id
   * @param {string} functionName Blueprint function name
   * @param {Array<[number, unknown]>} params [paramType, paramValue] pairs in Blueprint order
   * @returns {object} callBPFunction request item
   */
  const request = (id, functionName, params) => ({
    id, functionName, parameters: params.map(([paramType, paramValue]) => ({ paramType, paramValue })),
  });

  /**
   * Convert a data value to a column height in metres (linear, clamped at 0).
   * @param {number} value data value, e.g. 76200
   * @param {number} maxValue value that maps to maxHeightM
   * @param {number} maxHeightM height in metres for maxValue
   * @returns {number} column height in metres
   */
  const heightFor = (value, maxValue, maxHeightM) => Math.max(0, (value / maxValue) * maxHeightM);

  /**
   * Turn style options into setter requests; only supplied fields are sent.
   * @param {string} id Marker3D id
   * @param {object} style optional fields: scaleMaxM (0 = full colour scale on every column, > 0 = shared
   *   scale in metres), colors [low, mid, high, top], worldWidthM (real side
   *   width in metres, scales with the scene; 0 = screen width), widthPx (screen width in pixels at a
   *   1080 px high view, used when worldWidthM is 0), brightness, opacity, flowIntensity,
   *   flowPeriodSeconds, riseDurationSeconds, ringVisible, ringPulseSeconds (ripple period, 0 = static)
   * @returns {object[]} callBPFunction request items
   */
  const styleRequests = (id, style = {}) => {
    const out = []; // requests in Blueprint order
    if (style.scaleMaxM !== undefined) out.push(request(id, 'SetScaleMaxM', [[FLOAT, style.scaleMaxM]]));
    if (style.colors !== undefined) out.push(request(id, 'SetGradientColors', style.colors.map(colour => [COLOR, colour])));
    if (style.worldWidthM !== undefined) out.push(request(id, 'SetWorldWidthM', [[FLOAT, style.worldWidthM]]));
    if (style.widthPx !== undefined) out.push(request(id, 'SetWidthPx', [[FLOAT, style.widthPx]]));
    if (style.brightness !== undefined) out.push(request(id, 'SetBrightness', [[FLOAT, style.brightness]]));
    if (style.opacity !== undefined) out.push(request(id, 'SetOpacity', [[FLOAT, style.opacity]]));
    if (style.flowIntensity !== undefined || style.flowPeriodSeconds !== undefined) {
      out.push(request(id, 'SetFlow', [[FLOAT, style.flowIntensity ?? 0.35], [FLOAT, style.flowPeriodSeconds ?? 4.5]]));
    }
    if (style.riseDurationSeconds !== undefined) out.push(request(id, 'SetRiseDuration', [[FLOAT, style.riseDurationSeconds]]));
    if (style.ringVisible !== undefined) out.push(request(id, 'SetRingVisible', [[BOOL, style.ringVisible]]));
    if (style.ringPulseSeconds !== undefined) out.push(request(id, 'SetRingPulse', [[FLOAT, style.ringPulseSeconds]]));
    return out;
  };

  /**
   * Build the marker3d.add entry for one column.
   * @param {object} column { id, coordinate:[x,y,z], coordinateType?, groupId?, marker? }
   *   `marker` is merged into marker3d.add (e.g. text for a ground label); pointScale stays 1.
   *   autoHeight defaults to true: pass z = 0 and DTS snaps the column base to the surface below
   *   (verified); pass marker: { autoHeight: false } when z is an exact ground elevation.
   * @returns {object} marker3d.add item
   */
  const markerData = ({ id, coordinate, coordinateType = 0, groupId = '', marker = {} }) => ({
    id, groupId, pointName: POINT_NAME, coordinate, coordinateType, range: [1, 1e7], textVisible: false, autoHeight: true,
    ...marker, pointScale: 1, fixedSize: false,
  });

  /**
   * Add (or replace) one heat column, apply its style, then rise to heightM.
   * @param {object} api fdapi / __g instance after onReady
   * @param {object} column { id, coordinate:[x,y,z], heightM, coordinateType?, groupId?, marker?, ...style }
   *   (fields as in markerData; the rest are style fields as in styleRequests)
   * @returns {Promise<object>} { add, calls } raw SDK responses
   */
  const add = async (api, { id, coordinate, heightM, coordinateType, groupId, marker, ...style }) => {
    await invoke(api, 'delete', [id]).catch(() => {});
    const added = await invoke(api, 'add', [markerData({ id, coordinate, coordinateType, groupId, marker })]); // add response; result 0 alone does not prove the asset resolved (see isResolved)
    const calls = await invoke(api, 'callBPFunction', [[...styleRequests(id, style), request(id, 'SetHeightM', [[FLOAT, heightM]])]]); // setter replies
    return { add: added, calls };
  };

  /**
   * Add (or replace) many columns with batched calls: per chunk one delete, one add and one
   * callBPFunction, instead of three round trips per column. All columns share one style.
   * @param {object} api fdapi instance after onReady
   * @param {object[]} columns [{ id, coordinate, heightM, coordinateType?, groupId?, marker? }]
   * @param {object} [options] { style: shared style fields (see styleRequests), chunkSize: columns per call }
   * @returns {Promise<{addMs: number, callMs: number}>} wall time spent in add and in the setters
   */
  const addMany = async (api, columns, { style = {}, chunkSize = 200 } = {}) => {
    const timing = { addMs: 0, callMs: 0 }; // accumulated per phase
    for (let i = 0; i < columns.length; i += chunkSize) {
      const chunk = columns.slice(i, i + chunkSize); // columns of this round trip
      await invoke(api, 'delete', [chunk.map(column => column.id)]).catch(() => {});
      let start = performance.now(); // phase start
      await invoke(api, 'add', [chunk.map(markerData)], 120000);
      timing.addMs += performance.now() - start;
      start = performance.now();
      const calls = chunk.flatMap(column => [...styleRequests(column.id, style), request(column.id, 'SetHeightM', [[FLOAT, column.heightM]])]); // setters of this chunk
      await invoke(api, 'callBPFunction', [calls], 120000);
      timing.callMs += performance.now() - start;
    }
    return timing;
  };

  /**
   * Animate an existing column to a new height (starts from its current displayed height).
   * @param {object} api fdapi instance
   * @param {string} id Marker3D id
   * @param {number} heightM new height in metres
   * @returns {Promise<object>} raw SDK response
   */
  const setHeight = (api, id, heightM) => invoke(api, 'callBPFunction', [request(id, 'SetHeightM', [[FLOAT, heightM]])]);

  /**
   * Restyle an existing column without changing its height.
   * @param {object} api fdapi instance
   * @param {string} id Marker3D id
   * @param {object} style same fields as add()
   * @returns {Promise<object>} raw SDK response
   */
  const setStyle = (api, id, style) => invoke(api, 'callBPFunction', [styleRequests(id, style)]);

  /**
   * Check that DTS really spawned the HeatColumn Blueprint (add returns 0 even for unknown names).
   * @param {object} api fdapi instance
   * @param {string} id Marker3D id
   * @returns {Promise<boolean>} true when the actor resolved and exposes SetHeightM
   */
  const isResolved = async (api, id) => {
    const info = await invoke(api, 'getBPFunction', [id]); // { data: [{ objectName, params }] }
    const entry = info?.data?.[0]; // this marker's Blueprint description
    return Boolean(entry && entry.objectName !== 'None' && entry.params?.some(p => p.functionName === 'SetHeightM'));
  };

  global.HeatColumn = { POINT_NAME, heightFor, invoke, add, addMany, setHeight, setStyle, isResolved };
})(window);
