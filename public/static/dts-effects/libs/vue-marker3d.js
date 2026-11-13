/* VueMarker3D V1 adapter for DTS (fdapi, SDK 7.1): Vue components as textured 3D cards.
   Each card is one customObject (BP_VueMarker3D) at a coordinate. The adapter keeps the Vue component mounted in an
   off-screen container, captures it as a transparent PNG whenever its DOM changes and passes the PNG bytes to the
   Blueprint through callBPFunction (SetContentData) with a rising version number - no image server. The Blueprint
   decodes the image at once, ignores older versions, keeps the last good image on bad
   data, and switches image and size in the same frame. With an upload() function (or items carrying a url) the
   Blueprint downloads the image instead (SetContentURL).
   The card has a fixed world size (near is big, far is small), a normalised anchor ([0.5, 1] = bottom centre at the
   coordinate) and faces the camera, stays upright, or keeps a fixed heading.
   Scale: addMany() creates cards in batches, static: true mounts a component only for its capture (a few thousand
   cards), createLayer() shows the nearest items of 10 000 - 1 000 000 through a pool of actors that follows the camera.
   DTS answers about one API command per rendered frame, so waiting Blueprint calls go out batched in one command.
   Needs: Vue 3 (window.Vue or options.vue) for components and modern-screenshot (window.modernScreenshot or
   options.capture) for the PNG. */
(function (root) {
  'use strict';

  const VERSION = '1.0.1'; // adapter version; pre-mounted PAKs need no disk path
  const ASSET_PATH = '/JC_CustomAssets/ObjectLibrary/Exhibition/VueMarker3D/BP_VueMarker3D'; // Blueprint asset
  const TYPE = Object.freeze({ bool: 0, int: 2, float: 3, string: 5, intArray: 10 }); // BPFuncParamType values
  const BATCH_BYTES = 128 * 1024; // image bytes per callBPFunction command: DTS runs one command per frame, so the Blueprint's byte conversion stays ~10 ms per frame
  const FACING = Object.freeze({ camera: 0, upright: 1, fixed: 2 }); // FacingMode values
  const LOAD_STATES = Object.freeze(['empty', 'loading', 'loaded', 'failed']); // ReportState LoadState values
  const VIEW_RANGE_M = 1000000; // customObject far clip (m); the SDK default 10 km would cut far views
  const MAX_TEXTURE_PX = 2048; // longest texture side; larger components are captured at a lower pixel ratio
  const DEFAULTS = Object.freeze({
    widthM: 16, heightM: null, anchor: [0.5, 1], facing: 'camera', yaw: 0, pitch: 0, opacity: 1, brightness: 1, tint: '#ffffff',
    fadeSeconds: 0.25, visible: true, pixelRatio: 2, exposureLock: true, stabilize: true, toneCompensation: 1, alphaGamma: 2.2,
  }); // per-card options (heightM null = from the component's aspect)
  const QUEUE_DEFAULTS = Object.freeze({ maxConcurrent: 2, minIntervalMs: 200, loadTimeoutMs: 10000, pollMs: 120 }); // update queue

  // ---------------------------------------------------------------------------------------------
  // Helpers

  /**
   * Use pre-mounted resources by default; include a disk path only for explicit dynamic PAK loading.
   * @param {string|null|undefined} pakFilePath optional render-host PAK path
   * @returns {object} optional customObject.add fields
   */
  const resolvePakOptions = pakFilePath => {
    if (pakFilePath == null) return {};
    if (typeof pakFilePath !== 'string') throw new Error('pakFilePath must be omitted or be a .pak path on the DTS render host');
    const path = pakFilePath.trim(); // explicit dynamic PAK path, or empty for pre-mounted resources
    if (!path) return {};
    if (!/\.pak$/i.test(path)) throw new Error('pakFilePath must be omitted or be a .pak path on the DTS render host');
    return { pakFilePath: path };
  };

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
   * 32-bit FNV-1a hash (crypto.subtle is missing on plain-http pages such as the DTS server origin).
   * @param {Uint8Array} bytes data
   * @returns {number} hash
   */
  const fnv1a = bytes => {
    let hash = 0x811c9dc5; // offset basis
    for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 0x01000193);
    return hash >>> 0;
  };

  /**
   * Wait for the next two animation frames (layout and paint of the latest change).
   * @returns {Promise<void>} resolves after two frames
   */
  const twoFrames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  /**
   * Wait until fonts and images inside an element are ready.
   * @param {HTMLElement} element captured element
   * @returns {Promise<void>} resolves when ready (errors are ignored: a broken image still captures)
   */
  const waitForContent = async element => {
    if (document.fonts?.ready) await document.fonts.ready;
    const images = [...element.querySelectorAll('img')]; // images to wait for
    await Promise.all(images.map(img => (img.complete ? img.decode?.().catch(() => {}) : new Promise(resolve => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); }))));
    await twoFrames();
  };

  /**
   * Default capture: modern-screenshot, transparent PNG.
   * @param {HTMLElement} element element to capture
   * @param {{ scale: number }} options pixel ratio
   * @returns {Promise<Blob>} PNG
   */
  const defaultCapture = (element, { scale }) => {
    const lib = root.modernScreenshot; // UMD global of modern-screenshot
    if (!lib?.domToBlob) throw new Error('modern-screenshot is not loaded; include vendor/modern-screenshot.js or pass options.capture');
    return lib.domToBlob(element, { scale, type: 'image/png', backgroundColor: null });
  };

  /**
   * Call a customObject SDK method and wait for its explicit success reply.
   * @param {object} api fdapi instance
   * @param {string} method customObject method name
   * @param {Array<unknown>} args arguments without the trailing callback
   * @param {number} [timeoutMs] reject after this many milliseconds
   * @returns {Promise<object>} SDK response whose result is 0
   */
  const invoke = (api, method, args, timeoutMs = 30000) => new Promise((resolve, reject) => {
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
   * @param {Array<[number, unknown]>} params [paramType, value] pairs in Blueprint order
   * @returns {object} request item
   */
  const call = (objectId, functionName, params = []) => ({ id: objectId, functionName, parameters: params.map(([paramType, paramValue]) => ({ paramType, paramValue })) });

  /**
   * Requests that apply a card's options to its Blueprint; groups equal to `base` are skipped.
   * @param {string} objectId customObject id
   * @param {object} o full options
   * @param {object|null} [base] options the Blueprint already has (DEFAULTS for a new object), null = send all
   * @returns {object[]} request items
   */
  const optionCalls = (objectId, o, base = null) => {
    const f = v => [TYPE.float, Number(v)]; // float parameter
    const same = keys => base !== null && keys.every(k => JSON.stringify(o[k]) === JSON.stringify(base[k])); // unchanged group
    const groups = [
      [['anchor'], () => call(objectId, 'SetAnchor', [f(o.anchor[0]), f(o.anchor[1])])],
      [['facing', 'yaw', 'pitch'], () => call(objectId, 'SetFacingMode', [[TYPE.int, FACING[o.facing]], f(o.yaw), f(o.pitch)])],
      [['opacity'], () => call(objectId, 'SetOpacity', [f(o.opacity)])],
      [['brightness'], () => call(objectId, 'SetBrightness', [f(o.brightness)])],
      [['tint'], () => call(objectId, 'SetTintColor', toLinear(o.tint).map(f))],
      [['exposureLock', 'stabilize', 'toneCompensation', 'alphaGamma'], () => call(objectId, 'SetRenderOptions', [f(o.exposureLock ? 1 : 0), f(o.stabilize ? 1 : 0), f(o.toneCompensation), f(o.alphaGamma)])],
      [['visible', 'fadeSeconds'], () => call(objectId, 'SetMarkerVisible', [[TYPE.bool, Boolean(o.visible)], f(o.fadeSeconds)])],
    ]; // option group -> request (the Blueprint defaults equal DEFAULTS)
    return groups.filter(([keys]) => !same(keys)).map(([, make]) => make());
  };

  /**
   * Validate card options (after merging with the defaults).
   * @param {object} o options
   * @returns {object} the same options
   */
  const checkOptions = o => {
    if (!(o.facing in FACING)) throw new Error("facing must be 'camera', 'upright' or 'fixed'");
    if (!Array.isArray(o.anchor) || o.anchor.length !== 2 || !o.anchor.every(Number.isFinite)) throw new Error('anchor must be [x, y], [0, 0] top-left .. [1, 1] bottom-right');
    if (!(Number(o.widthM) > 0)) throw new Error('widthM must be > 0');
    if (o.heightM != null && !(Number(o.heightM) > 0)) throw new Error('heightM must be > 0 or null');
    return o;
  };

  /**
   * Split a list into chunks.
   * @param {Array<unknown>} list items
   * @param {number} size chunk size
   * @returns {Array<Array<unknown>>} chunks
   */
  const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

  /**
   * Split requests into commands of at most `maxCount` items and about `maxBytes` image bytes.
   * @param {Array<{ bytes?: number }>} list requests (bytes = image payload size)
   * @param {number} maxCount items per command
   * @param {number} maxBytes image bytes per command
   * @returns {Array<Array<object>>} commands
   */
  const chunksBySize = (list, maxCount = 300, maxBytes = BATCH_BYTES) => {
    const out = []; // commands
    let part = [], size = 0; // current command
    for (const item of list) {
      if (part.length && (part.length >= maxCount || size + (item.bytes ?? 0) > maxBytes)) { out.push(part); part = []; size = 0; }
      part.push(item);
      size += item.bytes ?? 0;
    }
    if (part.length) out.push(part);
    return out;
  };

  /**
   * Request that hands an image to a card: its bytes (default) or a URL the render host downloads.
   * @param {string} objectId customObject id
   * @param {{ bytes?: Uint8Array, url?: string }} image PNG bytes or URL
   * @param {number} version rising version
   * @param {number[]} sizeM [width, height] metres, applied with the image
   * @returns {object} request item (with its payload size in `bytes`)
   */
  const imageCall = (objectId, image, version, sizeM) => (image.bytes
    ? { ...call(objectId, 'SetContentData', [[TYPE.intArray, Array.from(image.bytes)], [TYPE.int, version], [TYPE.float, sizeM[0]], [TYPE.float, sizeM[1]]]), bytes: image.bytes.length }
    : call(objectId, 'SetContentURL', [[TYPE.string, image.url], [TYPE.int, version], [TYPE.float, sizeM[0]], [TYPE.float, sizeM[1]]]));

  /**
   * Strip the bookkeeping field before a request goes to DTS.
   * @param {object} item request
   * @returns {object} request for callBPFunction
   */
  const plain = ({ bytes, ...item }) => item;

  /**
   * Run an async worker over queued arguments a few at a time (thousands of parallel requests get dropped).
   * @param {Function} fn async worker taking one argument
   * @param {number} limit parallel calls
   * @returns {(args: unknown[]) => void} enqueue function
   */
  const throttle = (fn, limit) => {
    const waiting = []; // queued arguments
    let active = 0; // calls in flight
    /**
     * Queue arguments and start what the limit allows.
     * @param {unknown[]} list arguments
     * @returns {void}
     */
    const push = list => {
      waiting.push(...list);
      while (active < limit && waiting.length) {
        const arg = waiting.shift(); // next argument
        active++;
        Promise.resolve().then(() => fn(arg)).catch(() => {}).finally(() => { active--; push([]); });
      }
    };
    return push;
  };

  // ---------------------------------------------------------------------------------------------
  // Manager

  /**
   * Create a card manager bound to one DTS connection.
   * @param {object} api fdapi instance after onReady
   * @param {object} [options] { pakFilePath? (dynamic loading only; omit for pre-mounted resources), upload? (optional: (blob, { id, version, name }) ->
   *   URL the render host can download; without it the PNG bytes go through callBPFunction), discard?(url),
   *   capture?(element, { scale }) -> PNG Blob, vue? (Vue module; default
   *   window.Vue), assetPath?, maxConcurrent? (2), minIntervalMs? (200 per card), loadTimeoutMs? (10000),
   *   confirmLoads? (true: each job waits until DTS reports the image shown; false: it ends once DTS accepted the URL),
   *   onStatus?({ id, state, version, url, ms, error }) }
   * @returns {object} manager { add, addMany, update, refresh, startLive, stopLive, setOptions, setLocation, setVisible,
   *   getState, focus, remove, clear, list, stats }
   */
  const create = (api, options = {}) => {
    const { pakFilePath, upload, discard = async () => {}, capture = defaultCapture, assetPath = ASSET_PATH, onStatus = () => {}, confirmLoads = true } = options ?? {}; // settings
    const loadOptions = resolvePakOptions(pakFilePath); // pre-mounted assets need no pakFilePath field
    const queue = { ...QUEUE_DEFAULTS, ...Object.fromEntries(Object.entries(options).filter(([k, v]) => k in QUEUE_DEFAULTS && Number.isFinite(v))) }; // queue limits
    const cards = new Map(); // id -> card record
    const pending = new Set(); // cards waiting for a capture, in request order
    let running = 0; // jobs in flight
    let pumpTimer = 0; // retry timer for cards still inside their minimum interval
    let host = null; // off-screen container for the mounted components
    const discardLater = throttle(discard, 4); // deletes superseded images a few at a time

    /**
     * Off-screen container (laid out and painted, but outside the viewport).
     * @returns {HTMLElement} container
     */
    const hostElement = () => {
      if (host?.isConnected) return host;
      host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;contain:layout style;';
      document.body.appendChild(host);
      return host;
    };

    /**
     * Parse one getBPFunction entry (ReportState parameters mirror the state variables).
     * @param {object} entry reply item { idOrPath, params: [{ functionName, functionParams }] }
     * @returns {object|null} { state, requestedVersion, loadedVersion, failedVersion, loadedURL } or null
     */
    const parseState = entry => {
      const report = entry?.params?.find(p => p.functionName === 'ReportState'); // the no-op reporter
      if (!report) return null;
      const value = name => report.functionParams.find(p => p.name === name)?.defaultValue; // current variable value
      return { state: LOAD_STATES[Number(value('LoadState'))] ?? 'unknown', requestedVersion: Number(value('RequestedVersion')), loadedVersion: Number(value('LoadedVersion')),
        failedVersion: Number(value('FailedVersion')), loadedURL: String(value('LoadedURL') ?? '') };
    };

    /**
     * Read one card's Blueprint load state.
     * @param {string} objectId customObject id
     * @returns {Promise<object>} state, see parseState
     */
    const readState = async objectId => {
      const reply = await invoke(api, 'getBPFunction', [[objectId]]); // { data: [{ idOrPath, params }] }
      const state = parseState(reply?.data?.[0]); // parsed state
      if (!state) throw new Error(`BP_VueMarker3D not found on ${objectId}: check the mounted PAK and assetPath (or pakFilePath for dynamic loading)`);
      return state;
    };

    // DTS answers about one API command per rendered frame (25 fps cap), so per-card commands cap the update rate at
    // ~25 per second. Calls and state polls are therefore batched: one command in flight, carrying everything waiting.
    const outbox = []; // { item, resolve, reject } waiting for the next callBPFunction command
    let sending = false; // a batch is in flight
    const waiters = new Map(); // objectId -> [{ version, deadline, resolve }]
    let polling = false; // the poll loop runs

    /**
     * Send queued Blueprint calls as one command.
     * @returns {Promise<void>} resolves when this batch is answered
     */
    const flush = async () => {
      if (sending || !outbox.length) return;
      sending = true;
      const batch = chunksBySize(outbox.map(b => b.item))[0].map(() => outbox.shift()); // calls of this command
      try {
        await invoke(api, 'callBPFunction', [batch.map(b => plain(b.item))]);
        batch.forEach(b => b.resolve());
      } catch (error) {
        batch.forEach(b => b.reject(error));
      } finally {
        sending = false;
        flush();
      }
    };

    /**
     * Queue one Blueprint call.
     * @param {object} item callBPFunction item
     * @returns {Promise<void>} resolves when DTS accepted the batch it went in
     */
    const send = item => new Promise((resolve, reject) => { outbox.push({ item, resolve, reject }); flush(); });

    /**
     * Poll the state of every waiting card with one getBPFunction command per round.
     * @returns {Promise<void>} resolves when nobody waits any more
     */
    const pollStates = async () => {
      if (polling) return;
      polling = true;
      try {
        while (waiters.size) {
          await new Promise(resolve => setTimeout(resolve, queue.pollMs));
          const ids = [...waiters.keys()].slice(0, 200); // cards of this round
          const reply = await invoke(api, 'getBPFunction', [ids]).catch(() => null); // states
          const now = performance.now(); // for timeouts
          const byId = new Map((reply?.data ?? []).map(entry => [entry?.idOrPath, parseState(entry)])); // parsed states
          for (const id of ids) {
            const s = byId.get(id); // this card's state
            const left = (waiters.get(id) ?? []).filter(w => {
              if (s && s.loadedVersion >= w.version) { w.resolve(s.loadedVersion === w.version ? 'loaded' : 'superseded'); return false; }
              if (s && s.failedVersion >= w.version) { w.resolve('failed'); return false; }
              if (now > w.deadline) { w.resolve('timeout'); return false; }
              return true;
            }); // still waiting
            if (left.length) waiters.set(id, left); else waiters.delete(id);
          }
        }
      } finally {
        polling = false;
      }
    };

    /**
     * Wait until the Blueprint has shown or rejected a version.
     * @param {object} card card record
     * @param {number} version version sent
     * @returns {Promise<string>} 'loaded', 'failed', 'superseded' or 'timeout'
     */
    const waitLoaded = (card, version) => new Promise(resolve => {
      const list = waiters.get(card.objectId) ?? []; // waiters of this card
      list.push({ version, deadline: performance.now() + queue.loadTimeoutMs, resolve });
      waiters.set(card.objectId, list);
      pollStates();
    });

    /**
     * Mount a card's component (or element) into the off-screen container.
     * @param {object} card card record
     * @returns {void}
     */
    const mount = card => {
      const el = document.createElement('div'); // this card's mount point
      el.style.cssText = 'display:inline-block;position:absolute;left:0;top:0;width:max-content;';
      hostElement().appendChild(el);
      card.el = el;
      if (card.component) {
        const Vue = options.vue ?? root.Vue; // Vue module
        if (!Vue?.createApp) throw new Error('Vue 3 is not available: load it (window.Vue) or pass options.vue');
        card.props ??= Vue.reactive({ ...card.initialProps });
        card.app = Vue.createApp({ render: () => Vue.h(card.component, card.props) });
        if (card.setupApp) card.setupApp(card.app);
        card.app.mount(el);
      } else {
        el.appendChild(card.element);
      }
      if (card.static) return;
      // Any DOM change of the component (new props, its own state) schedules a capture; unchanged images are skipped.
      card.observer = new MutationObserver(() => schedule(card));
      card.observer.observe(el, { subtree: true, childList: true, characterData: true, attributes: true });
    };

    /**
     * Unmount a card's component and drop its DOM.
     * @param {object} card card record
     * @returns {void}
     */
    const unmount = card => {
      card.observer?.disconnect();
      card.observer = null;
      card.app?.unmount();
      card.app = null;
      card.el?.remove();
      card.el = null;
    };

    /**
     * Capture, upload and show the current component image of one card.
     * @param {object} card card record
     * @returns {Promise<void>} resolves when the job ends
     */
    const job = async card => {
      const started = performance.now(); // for the status timing
      card.lastStart = started;
      let url = null; // uploaded image of this job
      let version = 0; // version of this job
      try {
        if (!card.el) mount(card); // static cards are mounted only for their capture
        await waitForContent(card.el);
        if (card.waitFor) await card.waitFor(card.el);
        if (card.removed) return;
        const target = card.el.firstElementChild ?? card.el; // the component's root element
        const rect = target.getBoundingClientRect(); // CSS size of the card
        if (!(rect.width > 0 && rect.height > 0)) throw new Error('the component has no size (is it display:none?)');
        const scale = Math.min(card.o.pixelRatio, MAX_TEXTURE_PX / Math.max(rect.width, rect.height)); // pixel ratio of the texture
        const blob = await capture(target, { scale }); // transparent PNG
        if (card.static) unmount(card); // a static card needs no DOM once captured
        const bytes = new Uint8Array(await blob.arrayBuffer()); // PNG bytes
        const hash = fnv1a(bytes); // detects "nothing changed"
        const widthM = Number(card.o.widthM); // world width
        const heightM = card.o.heightM != null ? Number(card.o.heightM) : widthM * rect.height / rect.width; // world height keeps the aspect
        if (card.removed || (hash === card.hash && widthM === card.sizeM[0] && Math.abs(heightM - card.sizeM[1]) < 1e-6)) return;
        version = ++card.version;
        if (typeof upload === 'function') {
          const name = `${card.fileKey}-v${version}.png`; // versioned name: no cache can serve an older image
          url = await upload(blob, { id: card.id, version, name });
          card.uploads.push({ version, url });
          if (card.removed) return;
        }
        await send(imageCall(card.objectId, url ? { url } : { bytes }, version, [widthM, heightM]));
        const state = confirmLoads ? await waitLoaded(card, version) : 'sent'; // result in DTS
        if (state === 'loaded' || state === 'sent') {
          card.hash = hash;
          card.sizeM = [widthM, heightM];
          card.url = url;
        }
        if (state === 'loaded') {
          const old = card.uploads.filter(u => u.version < version); // superseded images
          card.uploads = card.uploads.filter(u => u.version >= version);
          discardLater(old.map(u => u.url));
        }
        card.failures = 0;
        onStatus({ id: card.id, state, version, url, ms: Math.round(performance.now() - started) });
      } catch (error) {
        if (card.static) unmount(card);
        onStatus({ id: card.id, state: 'error', version, url, ms: Math.round(performance.now() - started), error });
        // Transient failures (upload hiccup, busy SDK) are retried twice, 1 s and 2 s later.
        card.failures = (card.failures ?? 0) + 1;
        if (!card.removed && card.failures <= 2) setTimeout(() => schedule(card), 1000 * card.failures);
      }
    };

    /**
     * Start queued jobs while the concurrency and per-card interval limits allow.
     * @returns {void}
     */
    const pump = () => {
      const now = performance.now(); // current time
      let wait = Infinity; // earliest time a waiting card may start
      for (const card of pending) {
        if (running >= queue.maxConcurrent) break;
        if (card.removed) { pending.delete(card); continue; }
        if (card.busy || !card.o.visible) continue;
        const ready = card.lastStart + queue.minIntervalMs; // the card's next allowed start
        if (ready > now) { wait = Math.min(wait, ready - now); continue; }
        pending.delete(card);
        running++;
        card.busy = true;
        job(card).finally(() => { card.busy = false; running--; pump(); });
      }
      if (wait < Infinity) { clearTimeout(pumpTimer); pumpTimer = setTimeout(pump, wait); }
    };

    /**
     * Mark a card for a new capture.
     * @param {object} card card record
     * @returns {void}
     */
    const schedule = card => {
      if (card.removed) return;
      pending.add(card);
      pump();
    };

    /**
     * Card record by id.
     * @param {string} id card id
     * @returns {object} record
     */
    const record = id => {
      const card = cards.get(id); // record
      if (!card) throw new Error(`Unknown VueMarker3D card ${id}; call add() first`);
      return card;
    };

    /**
     * Forget a card locally (unmount, timers, uploaded images); the DTS object is deleted by the caller.
     * @param {object} card card record
     * @returns {void}
     */
    const detach = card => {
      cards.delete(card.id);
      pending.delete(card);
      card.removed = true;
      clearInterval(card.liveTimer);
      unmount(card);
      discardLater(card.uploads.map(u => u.url));
      (waiters.get(card.objectId) ?? []).forEach(w => w.resolve('superseded'));
      waiters.delete(card.objectId);
    };

    /**
     * Remove a card: unmount the component, delete the DTS object and its uploaded images.
     * @param {string} id card id
     * @returns {Promise<void>} resolves when deleted (or nothing to delete)
     */
    const remove = async id => {
      const card = cards.get(id); // record
      if (!card) return;
      detach(card);
      await invoke(api, 'delete', [[card.objectId]]).catch(() => {});
    };

    /**
     * Add (or replace) many cards with batched DTS requests.
     * @param {object[]} specs card descriptions, see add()
     * @param {{ batchSize?: number }} [opts] customObject.add batch size (default 200)
     * @returns {Promise<object[]>} [{ id, objectId, props }]
     */
    const addMany = async (specs, { batchSize = 200 } = {}) => {
      const stamp = Date.now().toString(36); // keeps file names unique across page reloads
      const made = specs.map(spec => {
        const { id, location, coordinateType = 0, autoHeight = false, component, props = {}, element, setupApp, waitFor, groupId, static: isStatic = false } = spec ?? {}; // card description
        if (typeof id !== 'string' || !id || id.includes(':')) throw new Error('id is required and must not contain ":"');
        if (!Array.isArray(location) || location.length < 2 || !location.every(Number.isFinite)) throw new Error(`location of ${id} must be [x, y] or [x, y, z]`);
        if (!component && !(element instanceof HTMLElement)) throw new Error(`${id}: pass a Vue component (component) or a DOM element (element)`);
        const o = checkOptions({ ...DEFAULTS, ...Object.fromEntries(Object.entries(spec).filter(([k]) => k in DEFAULTS)) }); // full options
        const objectId = `${id}:card`; // customObject id
        const object = {
          id: objectId, groupId: groupId ?? id, assetPath, ...loadOptions, location: [...location.slice(0, 3), ...(location.length < 3 ? [0] : [])],
          coordinateType, rotation: [0, 0, 0], scale: [1, 1, 1], range: [0, VIEW_RANGE_M], autoHeight, collision: false, enableDecal: false,
        }; // customObject.add item
        const card = {
          id, objectId, o, component, initialProps: props, props: null, element, setupApp, waitFor, static: Boolean(isStatic), el: null, app: null, observer: null,
          version: 0, hash: null, sizeM: [0, 0], url: null, uploads: [], busy: false, lastStart: -Infinity, removed: false, liveTimer: 0,
          fileKey: `${id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)}-${stamp}`,
        }; // record
        return { card, object };
      }); // validated before anything is sent
      made.forEach(({ card }) => { const old = cards.get(card.id); if (old) detach(old); });
      for (const part of chunks(made.map(m => m.object.id), 500)) await invoke(api, 'delete', [part]).catch(() => {}); // replaced cards and page-reload leftovers
      for (const part of chunks(made, batchSize)) await invoke(api, 'add', [part.map(m => m.object)]);
      const requests = made.flatMap(({ card }) => optionCalls(card.objectId, card.o, DEFAULTS)); // non-default options only
      for (const part of chunks(requests, 300)) await invoke(api, 'callBPFunction', [part]);
      for (const { card } of made) {
        cards.set(card.id, card);
        if (!card.static) mount(card);
        else if (card.component) card.props = (options.vue ?? root.Vue).reactive({ ...card.initialProps });
        pending.add(card);
      }
      pump();
      return made.map(({ card }) => ({ id: card.id, objectId: card.objectId, props: card.props }));
    };

    /**
     * Add (or replace) a card.
     * @param {object} spec { id, location [x, y, z], coordinateType? (0 projected m), autoHeight? (false), component +
     *   props? (Vue) or element (any DOM element you keep updated), setupApp?(app) (install Pinia / UI libraries /
     *   provide), waitFor?(element) (extra async readiness, e.g. charts), static? (true: captured once, mounted only
     *   for its capture; change it with update()), groupId?, plus DEFAULTS fields }
     * @returns {Promise<object>} { id, objectId, props } (props is reactive: change it to update the card)
     */
    const add = async spec => (await addMany([spec], { batchSize: 1 }))[0];

    /**
     * Change some props of a Vue card (the same as writing to the reactive props returned by add(); a static card is
     * captured again because nothing observes its DOM).
     * @param {string} id card id
     * @param {object} patch props to merge
     * @returns {void}
     */
    const update = (id, patch) => {
      const card = record(id); // record
      Object.assign(card.props ?? {}, patch);
      if (card.static) schedule(card);
    };

    /**
     * Capture again although the DOM did not change (e.g. after a canvas chart redrew).
     * @param {string} id card id
     * @returns {void}
     */
    const refresh = id => { const card = record(id); card.hash = null; schedule(card); };

    /**
     * Keep capturing at a fixed rate (CSS animations, canvas charts); the queue limits still apply.
     * @param {string} id card id
     * @param {number} fps captures per second (each one is a full capture + upload + download)
     * @returns {void}
     */
    const startLive = (id, fps = 2) => {
      const card = record(id); // record
      clearInterval(card.liveTimer);
      card.liveTimer = setInterval(() => schedule(card), 1000 / Math.max(0.1, Math.min(fps, 30)));
    };

    /**
     * Stop startLive.
     * @param {string} id card id
     * @returns {void}
     */
    const stopLive = id => { clearInterval(record(id).liveTimer); };

    /**
     * Change display options (DEFAULTS fields); only the given ones change. A new widthM/heightM applies at once.
     * @param {string} id card id
     * @param {object} patch options
     * @returns {Promise<object>} the full options
     */
    const setOptions = async (id, patch) => {
      const card = record(id); // record
      const next = checkOptions({ ...card.o, ...Object.fromEntries(Object.entries(patch).filter(([k]) => k in DEFAULTS)) }); // merged options
      const resize = next.widthM !== card.o.widthM || next.heightM !== card.o.heightM; // size changed
      const wasVisible = card.o.visible; // to resume captures on show
      const requests = optionCalls(card.objectId, next, card.o); // changed option groups only
      card.o = next;
      if (resize && card.sizeM[0] > 0) {
        const heightM = next.heightM != null ? Number(next.heightM) : Number(next.widthM) * card.sizeM[1] / card.sizeM[0]; // keep the image aspect
        card.sizeM = [Number(next.widthM), heightM];
        requests.unshift(call(card.objectId, 'SetWorldSize', [[TYPE.float, card.sizeM[0]], [TYPE.float, heightM]]));
      }
      if (requests.length) await invoke(api, 'callBPFunction', [requests]);
      if (next.visible && !wasVisible) pump(); // captures pause while hidden
      return { ...next };
    };

    /**
     * Show or hide with a fade (captures pause while hidden and resume with the latest content).
     * @param {string} id card id
     * @param {boolean} visible true to show
     * @param {number} [fadeSeconds] fade time
     * @returns {Promise<object>} the full options
     */
    const setVisible = (id, visible, fadeSeconds = record(id).o.fadeSeconds) => setOptions(id, { visible, fadeSeconds });

    /**
     * Move a card.
     * @param {string} id card id
     * @param {number[]} location [x, y, z] in the card's coordinateType
     * @returns {Promise<void>} resolves when DTS answered
     */
    const setLocation = async (id, location) => { await invoke(api, 'setLocation', [record(id).objectId, location]); };

    /**
     * Current Blueprint load state of a card.
     * @param {string} id card id
     * @returns {Promise<object>} { state, requestedVersion, loadedVersion, failedVersion, loadedURL }
     */
    const getState = id => readState(record(id).objectId);

    /**
     * Fly the camera to a card.
     * @param {string} id card id
     * @param {number} [distance] metres (0 = automatic)
     * @param {number} [flyTime] seconds
     * @returns {Promise<void>} resolves when DTS answered
     */
    const focus = async (id, distance = 0, flyTime = 1) => { await invoke(api, 'focus', [record(id).objectId, distance, flyTime]); };

    /**
     * Remove every card of this manager.
     * @returns {Promise<void>} resolves when all are deleted
     */
    const clear = async () => {
      const all = [...cards.values()]; // every card
      all.forEach(detach);
      for (const part of chunks(all.map(c => c.objectId), 500)) await invoke(api, 'delete', [part]).catch(() => {});
      host?.remove();
      host = null;
    };

    return Object.freeze({
      add, addMany, update, refresh, startLive, stopLive, setOptions, setVisible, setLocation, getState, focus, remove, clear,
      stats: () => ({ cards: cards.size, pending: pending.size, running, mounted: [...cards.values()].filter(c => c.el).length }),
      list: () => [...cards.values()].map(c => ({ id: c.id, objectId: c.objectId, version: c.version, url: c.url, sizeM: [...c.sizeM], options: { ...c.o } })),
    });
  };

  // ---------------------------------------------------------------------------------------------
  // Layer: many static cards (10 000 - 1 000 000 items) through a pool of actors that follows the camera

  /**
   * Create a virtualised layer for many static cards. Only the `poolSize` items nearest to the camera (inside
   * `maxDistanceM`, items in front of the camera first) get a card; their images are captured on demand, cached by
   * item, and a pooled BP_VueMarker3D actor is cleared, moved and given the cached image. Renderer cost therefore
   * depends on the pool size, not on the item count.
   * @param {object} api fdapi instance after onReady
   * @param {object} [options] { pakFilePath? (dynamic loading only), upload? (optional, see create), discard?, capture?, vue?, assetPath?, component
   *   (one Vue component for every item; items may instead carry url + aspect of a pre-rendered image), setupApp?,
   *   cacheLimit? (3000 captured images kept in browser memory), poolSize? (400), maxDistanceM? (1500), cellM? (200, grid index cell), tickMs? (500,
   *   camera check), captureConcurrency? (6), behindPenalty? (2.5, distance factor for items behind the camera),
   *   onTick?(stats), plus DEFAULTS fields for every card (widthM, anchor, facing, ...) }
   * @returns {object} layer { setItems, addItems, removeItems, updateItem, setOptions, start, stop, tick, stats, clear }
   */
  const createLayer = (api, options = {}) => {
    const {
      pakFilePath, upload, discard = async () => {}, capture = defaultCapture, assetPath = ASSET_PATH, component, setupApp,
      poolSize = 400, maxDistanceM = 1500, cellM = 200, tickMs = 500, captureConcurrency = 6, behindPenalty = 2.5, cacheLimit = 3000, onTick = () => {},
    } = options ?? {}; // settings
    const loadOptions = resolvePakOptions(pakFilePath); // pre-mounted assets need no pakFilePath field
    let o = checkOptions({ ...DEFAULTS, ...Object.fromEntries(Object.entries(options).filter(([k]) => k in DEFAULTS)) }); // card options
    const stamp = Date.now().toString(36); // keeps file names unique across page reloads
    const items = new Map(); // id -> { id, location, props, url, sizeM, state, actor, version, cell, failures }
    const cells = new Map(); // grid cell key -> Set of items
    const pool = []; // actors { objectId, item, version, created }
    const queue = []; // items waiting for a capture, nearest first
    const refreshed = new Set(); // assigned items whose image changed
    const cached = []; // items holding PNG bytes, oldest first
    let capturing = 0; // captures in flight
    let timer = 0; // camera check interval
    let soon = 0; // early tick after new images
    let ticking = false; // one tick at a time
    let host = null; // off-screen container
    let last = { ms: 0, candidates: 0, camera: null }; // last tick summary
    const discardLater = throttle(discard, 4); // deletes images a few at a time

    const key = (x, y) => `${Math.floor(x / cellM)}:${Math.floor(y / cellM)}`; // grid cell of a point

    /**
     * Index one item.
     * @param {{ id: string, location: number[], props?: object }} spec item
     * @returns {void}
     */
    const index = spec => {
      if (typeof spec?.id !== 'string' || !Array.isArray(spec.location) || spec.location.length < 2 || !spec.location.slice(0, 3).every(Number.isFinite)) throw new Error(`layer item needs an id and a location [x, y(, z)]: ${spec?.id}`);
      const item = { id: spec.id, location: [spec.location[0], spec.location[1], spec.location[2] ?? 0], props: spec.props ?? {}, url: null, sizeM: null, state: 'none', actor: null, version: 0, cell: '', failures: 0 }; // record
      if (typeof spec.url === 'string' && Number(spec.aspect) > 0) {
        // Pre-rendered image (e.g. an offline batch for static data): no capture in the browser.
        item.url = spec.url;
        item.sizeM = [Number(o.widthM), o.heightM != null ? Number(o.heightM) : Number(o.widthM) * Number(spec.aspect)];
        item.state = 'ready';
        item.external = true;
      }
      item.cell = key(item.location[0], item.location[1]);
      if (!cells.has(item.cell)) cells.set(item.cell, new Set());
      cells.get(item.cell).add(item);
      items.set(item.id, item);
    };

    /**
     * Drop one item (its actor is released on the next tick, its image deleted).
     * @param {object} item record
     * @returns {void}
     */
    const unindex = item => {
      items.delete(item.id);
      cells.get(item.cell)?.delete(item);
      item.removed = true;
      if (item.url && !item.external) discardLater([item.url]);
      item.bytes = null;
    };

    /**
     * Capture and upload one item's image.
     * @param {object} item record
     * @returns {Promise<void>} resolves when the image is uploaded
     */
    const captureItem = async item => {
      if (!component) throw new Error(`item ${item.id} has no image: pass a component, or url + aspect`);
      if (!host?.isConnected) {
        host = document.createElement('div');
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;contain:layout style;';
        document.body.appendChild(host);
      }
      const Vue = options.vue ?? root.Vue; // Vue module
      const el = document.createElement('div'); // mount point
      el.style.cssText = 'display:inline-block;position:absolute;left:0;top:0;width:max-content;';
      host.appendChild(el);
      const app = Vue.createApp({ render: () => Vue.h(component, item.props) }); // one-off app
      if (setupApp) setupApp(app);
      try {
        app.mount(el);
        await waitForContent(el);
        const target = el.firstElementChild ?? el; // component root
        const rect = target.getBoundingClientRect(); // CSS size
        if (!(rect.width > 0 && rect.height > 0)) throw new Error('the component has no size');
        const blob = await capture(target, { scale: Math.min(o.pixelRatio, MAX_TEXTURE_PX / Math.max(rect.width, rect.height)) }); // PNG
        app.unmount();
        el.remove();
        item.version++;
        const hadImage = Boolean(item.url || item.bytes); // replacing an image
        if (typeof upload === 'function') {
          const url = await upload(blob, { id: item.id, version: item.version, name: `${item.id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)}-${stamp}-v${item.version}.png` }); // render host URL
          if (item.removed) { discardLater([url]); return; }
          if (item.url) discardLater([item.url]);
          item.url = url;
        } else {
          item.bytes = new Uint8Array(await blob.arrayBuffer());
          cached.push(item);
          // Keep at most cacheLimit images in memory: forget the oldest that no card shows (captured again when needed).
          for (let k = 0; cached.length > cacheLimit && k < cached.length; k++) {
            const old = cached[k]; // candidate
            if (old.actor || old === item) continue;
            old.bytes = null;
            if (!old.url) old.state = 'none';
            cached.splice(k--, 1);
          }
        }
        const widthM = Number(o.widthM); // world width
        item.sizeM = [widthM, o.heightM != null ? Number(o.heightM) : widthM * rect.height / rect.width];
        if (hadImage && item.actor) refreshed.add(item);
      } finally {
        if (el.isConnected) { app.unmount(); el.remove(); }
      }
    };

    /**
     * Start captures, nearest first.
     * @returns {void}
     */
    const pumpCaptures = () => {
      while (capturing < captureConcurrency && queue.length) {
        const item = queue.shift(); // next item
        if (item.state !== 'none' || item.removed) continue;
        item.state = 'capturing';
        capturing++;
        captureItem(item)
          .then(() => { item.state = 'ready'; item.failures = 0; })
          .catch(() => { item.failures++; item.state = item.failures < 3 ? 'none' : 'error'; })
          .finally(() => { capturing--; pumpCaptures(); clearTimeout(soon); soon = setTimeout(tick, 150); });
      }
    };

    /**
     * Camera position and heading.
     * @returns {Promise<object|null>} { x, y, z, yaw } or null
     */
    const camera = () => new Promise(resolve => {
      let done = false; // settled flag
      /**
       * Settle once.
       * @param {object|null} value reply
       * @returns {void}
       */
      const finish = value => { if (!done) { done = true; resolve(value && Number.isFinite(value.x) ? value : null); } };
      setTimeout(() => finish(null), 5000);
      try { const p = api.camera.get(finish); if (p?.then) p.then(finish, () => finish(null)); } catch (error) { finish(null); }
    });

    /**
     * Choose the wanted items for the current camera and update the pool.
     * @returns {Promise<void>} resolves when DTS answered
     */
    const tick = async () => {
      if (ticking) return;
      ticking = true;
      const started = performance.now(); // timing
      try {
        const cam = await camera(); // camera state
        if (!cam) return;
        const yaw = Number(cam.yaw) * Math.PI / 180; // DTS yaw: 0 east, -90 north
        const fwd = [Math.cos(yaw), -Math.sin(yaw)]; // horizontal view direction
        const reach = Math.ceil(maxDistanceM / cellM); // cells to scan per side
        const cx = Math.floor(cam.x / cellM), cy = Math.floor(cam.y / cellM); // camera cell
        const candidates = []; // [score, item]
        for (let i = -reach; i <= reach; i++) {
          for (let j = -reach; j <= reach; j++) {
            const set = cells.get(`${cx + i}:${cy + j}`); // items of this cell
            if (!set) continue;
            for (const item of set) {
              const dx = item.location[0] - cam.x, dy = item.location[1] - cam.y; // horizontal offset
              const dist = Math.hypot(dx, dy, item.location[2] - cam.z); // metres
              if (dist <= maxDistanceM) candidates.push([dx * fwd[0] + dy * fwd[1] >= 0 ? dist : dist * behindPenalty, item]);
            }
          }
        }
        candidates.sort((a, b) => a[0] - b[0]);
        const wanted = candidates.slice(0, poolSize).map(c => c[1]); // nearest items
        const wantedSet = new Set(wanted); // lookup
        queue.length = 0;
        for (const item of wanted) if (item.state === 'none') queue.push(item);
        pumpCaptures();
        const clears = []; // actors to clear first
        const moves = []; // actors to move
        const shows = []; // images to show
        for (const a of pool) {
          if (a.item && (!wantedSet.has(a.item) || a.item.removed)) {
            a.item.actor = null;
            a.item = null;
            clears.push(call(a.objectId, 'ClearContent'));
          }
        }
        const free = pool.filter(a => !a.item && a.created); // reusable actors
        const fresh = []; // new actors (created at their item's location)
        for (const item of wanted) {
          if (item.actor || item.state !== 'ready') continue;
          let a = free.pop(); // actor for this item
          if (a) {
            if (!clears.some(c => c.id === a.objectId)) clears.push(call(a.objectId, 'ClearContent'));
            moves.push({ id: a.objectId, location: item.location });
          } else if (pool.length < poolSize) {
            a = { objectId: `${stamp}-pool${pool.length}:card`, item: null, version: 0, created: false };
            pool.push(a);
            fresh.push({ a, location: item.location });
          } else {
            break;
          }
          a.item = item;
          item.actor = a;
          a.version++;
          shows.push(imageCall(a.objectId, item, a.version, item.sizeM));
        }
        for (const item of refreshed) {
          const a = item.actor; // actor still showing the old image
          refreshed.delete(item);
          if (!a || item.removed) continue;
          a.version++;
          shows.push(imageCall(a.objectId, item, a.version, item.sizeM));
        }
        // Order matters: clear (hide) before moving, so an old image never shows at a new place.
        for (const part of chunks(clears, 300)) await invoke(api, 'callBPFunction', [part]);
        if (moves.length) for (const part of chunks(moves, 300)) await invoke(api, 'update', [part]);
        if (fresh.length) {
          for (const part of chunks(fresh, 200)) {
            await invoke(api, 'add', [part.map(({ a, location }) => ({
              id: a.objectId, groupId: `${stamp}-layer`, assetPath, ...loadOptions, location, coordinateType: 0, rotation: [0, 0, 0], scale: [1, 1, 1],
              range: [0, VIEW_RANGE_M], autoHeight: false, collision: false, enableDecal: false, smoothMotion: 0,
            }))]);
            part.forEach(({ a }) => { a.created = true; });
          }
          const setup = fresh.flatMap(({ a }) => optionCalls(a.objectId, o, DEFAULTS)); // non-default options of new actors
          for (const part of chunks(setup, 300)) await invoke(api, 'callBPFunction', [part]);
        }
        for (const part of chunksBySize(shows)) await invoke(api, 'callBPFunction', [part.map(plain)]);
        last = { ms: Math.round(performance.now() - started), candidates: candidates.length, camera: [cam.x, cam.y, cam.z].map(Math.round), changed: shows.length };
      } catch (error) {
        last = { ...last, error: String(error?.message ?? error) };
      } finally {
        ticking = false;
        onTick(stats());
      }
    };

    /**
     * Layer counters.
     * @returns {object} stats
     */
    const stats = () => ({
      items: items.size, cells: cells.size, pool: pool.length, assigned: pool.filter(a => a.item).length,
      captured: [...items.values()].filter(i => i.url || i.bytes).length, cachedBytesMB: +(cached.reduce((s, i) => s + (i.bytes?.length ?? 0), 0) / 1048576).toFixed(1),
      capturing, queued: queue.length, lastTick: last,
    });

    return Object.freeze({
      /**
       * Replace all items.
       * @param {Array<{ id: string, location: number[], props?: object }>} list items (projected metres)
       * @returns {void}
       */
      setItems: list => { [...items.values()].forEach(unindex); list.forEach(index); },
      /**
       * Add items.
       * @param {Array<{ id: string, location: number[], props?: object }>} list items
       * @returns {void}
       */
      addItems: list => list.forEach(index),
      /**
       * Remove items by id.
       * @param {string[]} ids item ids
       * @returns {void}
       */
      removeItems: ids => ids.forEach(id => { const item = items.get(id); if (item) unindex(item); }),
      /**
       * Change one item's props: its image is captured again when it is wanted; a shown card swaps in place.
       * @param {string} id item id
       * @param {object} props new props (merged)
       * @returns {void}
       */
      updateItem: (id, props) => {
        const item = items.get(id); // record
        if (!item) return;
        item.props = { ...item.props, ...props };
        if (item.state !== 'capturing') item.state = 'none';
      },
      /**
       * Change display options (DEFAULTS fields) of every card; a new widthM/heightM applies to new captures.
       * @param {object} patch options
       * @returns {Promise<void>} resolves when DTS answered
       */
      setOptions: async patch => {
        const next = checkOptions({ ...o, ...Object.fromEntries(Object.entries(patch).filter(([k]) => k in DEFAULTS)) }); // merged options
        const requests = pool.filter(a => a.created).flatMap(a => optionCalls(a.objectId, next, o)); // changed groups only
        o = next;
        for (const part of chunks(requests, 300)) await invoke(api, 'callBPFunction', [part]);
      },
      start: () => { clearInterval(timer); timer = setInterval(tick, tickMs); tick(); },
      stop: () => { clearInterval(timer); timer = 0; },
      tick,
      stats,
      /**
       * Stop and delete the pool actors and every uploaded image.
       * @returns {Promise<void>} resolves when deleted
       */
      clear: async () => {
        clearInterval(timer);
        clearTimeout(soon);
        [...items.values()].forEach(unindex);
        for (const part of chunks(pool.filter(a => a.created).map(a => a.objectId), 500)) await invoke(api, 'delete', [part]).catch(() => {});
        pool.length = 0;
        host?.remove();
        host = null;
      },
    });
  };

  const VueMarker3D = Object.freeze({ VERSION, ASSET_PATH, FACING, DEFAULTS, QUEUE_DEFAULTS, MAX_TEXTURE_PX, create, createLayer, invoke, toLinear, fnv1a }); // public API
  root.VueMarker3D = VueMarker3D;
  if (typeof module !== 'undefined') module.exports = VueMarker3D;
})(typeof window !== 'undefined' ? window : globalThis);
