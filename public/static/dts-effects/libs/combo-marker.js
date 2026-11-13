/**
 * ComboMarker — Figma「房地产-深色-08045-460」点位标注（深色胶囊里左边名称、右边数值徽标，下方三角指针），
 * 红 / 橙 / 黄 / 绿四种配色，用 DTS 原生 marker 画。
 *
 * 做法：前端按设计稿把整张标注（底图 + 文字）画到 canvas 上，转成 PNG 的 data 地址交给 marker.imagePath。
 *   - 名称、数值是传进来的文字，长度不固定：用浏览器量出文字宽度，胶囊按「左右内边距 12 + 名称 + 间距 8 + 徽标」精确算宽，
 *     徽标按「左右内边距 8 + 数值」算宽，数值在徽标里水平居中；名称超过 maxNameWidth 时末尾截断成「…」。
 *     很短的时候有默认最小值：整条不窄于 minWidth（默认 200），徽标不窄于 minBadgeWidth（默认 80），
 *     多出的宽度留在名称和徽标之间（名称左对齐、徽标右对齐，同设计稿）。
 *   - 为什么不用 marker 自带的文字：实测 DTS 画的文字和图片不按同一比例缩放（随推流分辨率变），名称和徽标的间距对不齐；
 *     文字画进图片后和底图一起缩放，排版不会变。DTS 显示 SVG 时画不了文字，所以画成 PNG。
 *   - 尺寸：照 livex-front 的 marker 适配原则（min(宽 / 1920, 高 / 1080)），按推流画面的分辨率算：
 *     推流 1920×1080 是设计稿原尺寸，4K 是 2 倍；ComboMarker.fitScale() 算倍数，markers.observe() 在推流分辨率变了时自动重画。
 *   - 清晰度：画布按 max(2, scale) 倍分辨率画，图片像素不少于推流像素，4K 下也清楚。相同内容只画一次。
 *   - 图片数据走 SDK：每个点约十几 KB，一次 add 的批量不要太大（这里每批 25 个），上千个点会冲断连接。
 *
 * 抽稀（照业务代码的做法）：viewHeightRange 按档位分级显示，第 i 档最大可见相机高度 = baseRange / (i * 100) + fullHeight，
 *   共 100 档；点的档位按 id 固定（哈希取余 100，或点上传 level），更新数据后不会换档；0 档（约 1%）任何高度都显示。
 *
 *   const markers = ComboMarker.create(fdapi, { scale: ComboMarker.fitScale(), thin: { baseRange: 100000, fullHeight: 1000 } })
 *   await markers.set([{ id: 'p1', coordinate: [x, y, z], name: 'DISTRICT', value: '3,800 units', theme: 'red' }, ...])  全部重建
 *   await markers.update([{ id: 'p1', value: '4,000 units', theme: 'red' }])   只改变了的点：原地换图，不闪
 *   await markers.remove(['p1']) / markers.clear()
 *   const stop = markers.observe()   推流分辨率变了自动按新倍数换图
 *   theme：'red' | 'orange' | 'yellow' | 'green'
 */
(function () {
  /** 配色（取自 Figma 各节点）：徽标渐变上 / 下，光晕，指针顶色 */
  var THEMES = {
    red: { top: '#FFAAA9', bottom: '#F56360', glow: '#F98D8B', pointerTop: '#FF9F9D' },     // 261488:50603
    orange: { top: '#FFDBAF', bottom: '#FBBF77', glow: '#F6D6A7', pointerTop: '#FFE6C8' },  // 261488:50593
    yellow: { top: '#F2F4B2', bottom: '#CDCF7F', glow: '#E3E5A0', pointerTop: '#F2F4B2' },  // 261488:50586
    green: { top: '#B4E0BE', bottom: '#79D18D', glow: '#9DE7AE', pointerTop: '#C4FFD1' }    // 261488:50591
  };
  // 设计稿尺寸（像素）
  var PAD = 12;            // 胶囊左右内边距
  var GAP = 8;             // 名称和徽标的间距
  var BADGE_PAD = 8;       // 徽标左右内边距
  var PILL_H = 44;         // 胶囊高（上下内边距 10 + 徽标 24）
  var BADGE_H = 24;
  var MARGIN = 10;         // 图片四周给投影、光晕留的空白
  var PILL_Y = 6;          // 胶囊上边在图片里的 y
  var IMG_H = 70;          // 图片高
  var TIP_Y = 55.8;        // 三角指针尖的 y
  var FONT_PX = 14;        // 字号
  var TRACKING = 0.28;     // 字间距
  var FONT = "Manrope, 'Segoe UI', 'Microsoft YaHei', Arial, sans-serif";

  /**
   * @param {object} api fdapi
   * @param {object} [opts] { prefix: id 前缀（也是 groupId）, far: 显示距离(m), maxNameWidth: 名称最宽(px),
   *                          scale: 显示倍数（默认 1 = 设计稿像素；按适配原则用 ComboMarker.fitScale()）,
   *                          dpr: 画布倍数（默认 max(2, scale)，不低于显示倍数，保证不糊）,
   *                          minWidth: 整条标注最小宽(px，默认 200，Figma 最窄的一款), minBadgeWidth: 徽标最小宽(px，默认 80),
   *                          batch: 每次 add 的个数, thin: { baseRange, fullHeight } 按相机高度抽稀，不传就不抽稀 }
   */
  function ComboMarker(api, opts) {
    opts = opts || {};
    this.api = api;                                  // fdapi
    this.prefix = opts.prefix || 'combo';            // id 前缀和 groupId
    this.far = opts.far || 100000;                   // 显示距离
    this.scale = opts.scale || 1;                    // 显示倍数：DTS 按 imageSize 在推流画面上 1:1 显示（实测 4K 推流 200 宽的图就是 200 像素）
    this.dpr = opts.dpr || 0;                        // 画布分辨率倍数，0 = max(2, scale)：不低于显示倍数，图片像素 ≥ 屏幕像素才清晰
    this.maxNameWidth = opts.maxNameWidth || 320;    // 名称最宽，超出截断
    this.batch = opts.batch || 25;                   // 每次 add 的点数
    this.minBadgeWidth = opts.minBadgeWidth || 80;   // 徽标最小宽（Figma 最窄的「300 units」徽标约 80）：数值很短时徽标不缩小，数值居中
    this.minWidth = opts.minWidth || 200;            // 整条标注最小宽（Figma 最窄的「300 units」款 200）：名称、数值很短时不缩成小块
    this.thin = opts.thin || null;                   // 抽稀参数
    this._cache = new Map();                         // 内容 → 画好的图片
  }

  ComboMarker.create = function (api, opts) { return new ComboMarker(api, opts); };

  /**
   * 显示倍数，照 livex-front 的 marker 适配原则（utils/videoMarkerScale.ts：min(宽 / 1920, 高 / 1080)），
   * 但按「推流画面」的分辨率来算，不按视频元素的大小：marker 的 imageSize 是推流像素，而推流分辨率不一定等于窗口
   * （实测本机 Cloud 推流在 3840×2062、2560×1348 之间变，页面上的视频窗口只有 826 宽，还 contain 留了黑边）。
   *   倍数 = min(推流宽 / 1920, 推流高 / 1080)：推流 1920×1080 是 1，4K 是 2；推流和窗口一样大时就是 livex 的倍数。
   *   在屏幕上看，标注 = 设计稿像素 × min(画面宽 / 1920, 画面高 / 1080)，和窗口同比例。
   *   imageSize、anchors 都乘它；range、viewHeightRange 这类按米算的距离不乘。
   * @param {HTMLVideoElement} [video] 推流视频元素，默认页面上第一个 video
   * @returns {number} 显示倍数（拿不到推流尺寸时为 1）
   */
  ComboMarker.fitScale = function (video) {
    video = video || document.querySelector('video');
    if (!video || !video.videoWidth || !video.videoHeight) return 1;
    return Math.min(video.videoWidth / 1920, video.videoHeight / 1080);
  };

  /**
   * 跟着推流分辨率自动重画：视频的 resize 事件（推流分辨率变了）和 ResizeObserver（窗口变了，推流随后会变），
   * 停顿 300 毫秒再重画。
   * @param {HTMLVideoElement} [video] 推流视频元素，默认页面上第一个 video
   * @returns {() => void} 停止监听
   */
  ComboMarker.prototype.observe = function (video) {
    var self = this, timer = 0;
    video = video || document.querySelector('video');
    if (!video) return function () {};
    var refit = function () {
      clearTimeout(timer);
      timer = setTimeout(function () { if (video.videoWidth) self.setScale(ComboMarker.fitScale(video)); }, 300);
    };
    video.addEventListener('resize', refit);
    var ob = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refit) : null;
    if (ob) ob.observe(video);
    return function () { clearTimeout(timer); video.removeEventListener('resize', refit); if (ob) ob.disconnect(); };
  };
  ComboMarker.THEMES = Object.keys(THEMES);

  /**
   * 圆角矩形路径。
   * @param {CanvasRenderingContext2D} g 画布
   * @param {number} x 左 @param {number} y 上 @param {number} w 宽 @param {number} h 高 @param {number} r 圆角
   * @returns {void}
   */
  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /**
   * 量文字宽度（含字间距）。
   * @param {CanvasRenderingContext2D} g 画布（已设好字体）
   * @param {string} s 文字
   * @returns {number} 像素宽
   */
  function textWidth(g, s) { return g.measureText(s).width + TRACKING * Math.max(0, s.length - 1); }

  /**
   * 文字放不进 maxW 时从末尾逐字去掉并加「…」。
   * @param {CanvasRenderingContext2D} g 画布 @param {string} s 文字 @param {number} maxW 最宽
   * @returns {string} 放得下的文字
   */
  function fit(g, s, maxW) {
    if (textWidth(g, s) <= maxW) return s;
    var t = s;
    while (t.length > 1 && textWidth(g, t + '…') > maxW) t = t.slice(0, -1);
    return t.replace(/\s+$/, '') + '…';
  }

  /** 等字体加载完（Manrope 在页面的 @font-face 里），canvas 才会用上 @returns {Promise<void>} */
  ComboMarker.prototype._fonts = function () {
    if (!this._fontReady) this._fontReady = document.fonts ? document.fonts.load('600 14px Manrope').catch(function () {}) : Promise.resolve();
    return this._fontReady;
  };

  /**
   * 画一张标注。
   * @param {string} name 名称 @param {string} value 数值 @param {string} theme 配色
   * @returns {{url: string, width: number}} PNG data 地址和图片宽（设计稿像素）
   */
  ComboMarker.prototype._draw = function (name, value, theme) {
    var key = [theme, name, value, this.dpr || Math.max(2, this.scale), this.minWidth, this.minBadgeWidth].join('|');
    if (this._cache.has(key)) return this._cache.get(key);
    var t = THEMES[theme] || THEMES.red, dpr = this.dpr || Math.max(2, this.scale);
    var probe = document.createElement('canvas').getContext('2d');
    probe.font = '600 ' + FONT_PX + 'px ' + FONT;
    name = fit(probe, name, this.maxNameWidth);
    var nw = textWidth(probe, name), vw = textWidth(probe, value);
    var bw = Math.max(this.minBadgeWidth, Math.ceil(vw + BADGE_PAD * 2)); // 徽标宽；一两位数时不窄于最小宽度，数值照样居中
    var pw = Math.max(this.minWidth, Math.ceil(PAD + nw + GAP + bw + PAD)); // 胶囊宽；不窄于最小宽，多出的宽度留在名称和徽标之间
    var W = pw + MARGIN * 2, cx = W / 2, bottom = PILL_Y + PILL_H;

    var canvas = document.createElement('canvas');
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(IMG_H * dpr);
    var g = canvas.getContext('2d');
    g.scale(dpr, dpr);

    // 投影：drop-shadow 0 4px 5px rgba(0,0,0,0.4)
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 5; g.shadowOffsetY = 4;
    roundRect(g, MARGIN, PILL_Y, pw, PILL_H, PILL_H / 2);
    g.fillStyle = 'rgba(55,57,60,0.8)';
    g.fill();
    g.restore();
    // 底边光晕：椭圆渐变从胶囊底边中间往上淡出
    g.save();
    roundRect(g, MARGIN, PILL_Y, pw, PILL_H, PILL_H / 2);
    g.clip();
    var rx = Math.max(60, pw * 0.42);
    g.translate(cx, bottom); g.scale(rx / 30, 1);
    var glow = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    glow.addColorStop(0, hexA(t.glow, 0.55)); glow.addColorStop(0.55, hexA(t.bottom, 0.22)); glow.addColorStop(1, hexA(t.bottom, 0));
    g.fillStyle = glow;
    g.fillRect(-30, -30, 60, 30);
    g.restore();
    // 底边亮线：两头淡出
    var edge = g.createLinearGradient(MARGIN + 7, 0, W - MARGIN - 7, 0);
    edge.addColorStop(0, hexA(t.bottom, 0)); edge.addColorStop(0.5, hexA(t.bottom, 1)); edge.addColorStop(1, hexA(t.bottom, 0));
    g.fillStyle = edge;
    g.fillRect(MARGIN + 7, bottom - 1.5, pw - 14, 1.5);
    // 描边：上淡下浓
    var stroke = g.createLinearGradient(0, PILL_Y, 0, bottom);
    stroke.addColorStop(0, hexA(t.bottom, 0.1)); stroke.addColorStop(1, hexA(t.bottom, 1));
    roundRect(g, MARGIN + 0.5, PILL_Y + 0.5, pw - 1, PILL_H - 1, (PILL_H - 1) / 2);
    g.strokeStyle = stroke; g.lineWidth = 1; g.stroke();
    // 三角指针
    var ptr = g.createLinearGradient(0, 52, 0, TIP_Y);
    ptr.addColorStop(0, t.pointerTop); ptr.addColorStop(1, t.bottom);
    g.beginPath(); g.moveTo(cx - 4.8, 52); g.lineTo(cx + 4.8, 52); g.lineTo(cx, TIP_Y); g.closePath();
    g.fillStyle = ptr; g.fill();
    // 徽标：上浅下深的渐变圆角条，右对齐、上下居中
    var bx = MARGIN + pw - PAD - bw, by = PILL_Y + (PILL_H - BADGE_H) / 2;
    var badge = g.createLinearGradient(0, by, 0, by + BADGE_H);
    badge.addColorStop(0, t.top); badge.addColorStop(1, t.bottom);
    roundRect(g, bx, by, bw, BADGE_H, BADGE_H / 2);
    g.fillStyle = badge; g.fill();
    // 文字：名称白色左对齐，数值深色在徽标里居中
    g.font = '600 ' + FONT_PX + 'px ' + FONT;
    g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = TRACKING + 'px';
    var midY = PILL_Y + PILL_H / 2 + 0.5;
    g.fillStyle = '#FAFAFA'; g.textAlign = 'left';
    g.fillText(name, MARGIN + PAD, midY);
    g.fillStyle = '#3F3F3F'; g.textAlign = 'left';
    g.fillText(value, bx + (bw - vw) / 2, midY);

    var out = { url: canvas.toDataURL('image/png'), width: W };
    this._cache.set(key, out);
    return out;
  };

  /** '#rrggbb' + 不透明度 → rgba() */
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /**
   * 一个点的抽稀档位：按 id 固定（字符串哈希取余 100），和数组顺序无关，更新数据后同一相机高度下显示的点不变；
   * 点上传了 level（0～99）就用它，0 档任何高度都显示，想在高处保留的点传 0。
   * @param {object} p 点 @returns {number} 档位
   */
  function levelOf(p) {
    if (p.level != null) return Math.max(0, Math.min(99, p.level | 0));
    var h = 0, s = String(p.id);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 100;
  }

  /** 档位的可见相机高度范围 @param {number} level 档位 @returns {number[]|null} [最低, 最高] */
  ComboMarker.prototype._heightRange = function (level) {
    if (!this.thin) return null;
    return [1, this.thin.baseRange / (level * 100) + this.thin.fullHeight]; // 0 档是 Infinity：任何高度都显示
  };

  /** 一个点的图片相关字段（imagePath、imageSize、anchors） @param {object} img 画好的图 @returns {object} 字段 */
  ComboMarker.prototype._imageFields = function (img) {
    return {
      imagePath: img.url,
      imageSize: [img.width * this.scale, IMG_H * this.scale],
      anchors: [-img.width / 2 * this.scale, TIP_Y * this.scale]   // 三角指针尖对准坐标
    };
  };

  /** 新加一个点的完整 marker 数据 @param {object} p 点 @param {object} img 画好的图 @returns {object} marker */
  ComboMarker.prototype._markerOf = function (p, img) {
    var hr = this._heightRange(levelOf(p));
    return Object.assign({
      id: p.id, groupId: this.prefix,
      coordinate: p.coordinate, coordinateType: 0, autoHeight: false,
      fixedSize: true,
      range: [1, this.far],
      text: '',
      displayMode: 2,                     // 相机移动时也显示，不参与避让聚合；疏密靠抽稀控制
      occlusionCull: false,
      autoHidePopupWindow: false
    }, this._imageFields(img), hr ? { viewHeightRange: hr, rangeRatio: 0.01 } : {});
  };

  /** 分批调 SDK（图片数据大，一批 batch 个） @param {Function} fn marker.add / marker.update @param {object[]} list 数据 @returns {Promise<void>} */
  ComboMarker.prototype._batched = async function (fn, list) {
    for (var k = 0; k < list.length; k += this.batch) await fn.call(this.api.marker, list.slice(k, k + this.batch));
  };

  /**
   * 换成这一批点（先删掉上一批，全部重新加）。只改部分点时用 update，不闪、只发变了的。
   * @param {{id: string, coordinate: number[], name: string, value: string, theme?: string, level?: number}[]} points 坐标是投影坐标（米）
   * @returns {Promise<{markers: number, images: number, kb: number, ms: number}>} 点数、不同图片数、图片数据量、添加耗时
   */
  ComboMarker.prototype.set = async function (points) {
    await this._fonts();
    var self = this, list = [], bytes = 0;
    points.forEach(function (p) {
      var img = self._draw(String(p.name), String(p.value), p.theme);
      bytes += img.url.length;
      list.push(self._markerOf(p, img));
    });
    await this.clear();
    this._items = new Map(points.map(function (p) { return [p.id, Object.assign({}, p)]; })); // id → 当前点（update 按它比较）
    var t0 = performance.now();
    await this._batched(this.api.marker.add, list); // 一次批量添加
    return { markers: list.length, images: this._cache.size, kb: Math.round(bytes / 1024), ms: Math.round(performance.now() - t0) };
  };

  /**
   * 增量更新：按 id 和当前的点比较，只发变了的。
   *   - 名称 / 数值 / 配色变了：重画这一张图，marker.update 原地换 imagePath、imageSize、anchors（实测 44 毫秒生效，不闪）；
   *   - 坐标变了：只改坐标；
   *   - 新 id：加进去；没传的点保持不动（删除用 remove）。
   * @param {{id: string, coordinate?: number[], name?: string, value?: string, theme?: string}[]} points 要改的点，可以只传变了的字段
   * @returns {Promise<{changed: number, added: number, kb: number, ms: number}>} 改了几个、新加几个、发出的图片数据量、耗时
   */
  ComboMarker.prototype.update = async function (points) {
    await this._fonts();
    if (!this._items) this._items = new Map();
    var self = this, changes = [], adds = [], bytes = 0;
    points.forEach(function (q) {
      var old = self._items.get(q.id);
      if (!old) {                            // 新点
        var img0 = self._draw(String(q.name), String(q.value), q.theme);
        bytes += img0.url.length;
        self._items.set(q.id, Object.assign({}, q));
        adds.push(self._markerOf(q, img0));
        return;
      }
      var p = Object.assign({}, old, q), change = { id: q.id };
      if (p.name !== old.name || p.value !== old.value || p.theme !== old.theme) {
        var img = self._draw(String(p.name), String(p.value), p.theme);
        bytes += img.url.length;
        Object.assign(change, self._imageFields(img));
      }
      if (q.coordinate && String(q.coordinate) !== String(old.coordinate)) change.coordinate = q.coordinate;
      if (self.thin && levelOf(p) !== levelOf(old)) change.viewHeightRange = self._heightRange(levelOf(p)); // 档位变了（比如按新类型的排名）
      self._items.set(q.id, p);
      if (Object.keys(change).length > 1) changes.push(change);
    });
    var t0 = performance.now();
    await this._batched(this.api.marker.update, changes);
    await this._batched(this.api.marker.add, adds);
    return { changed: changes.length, added: adds.length, kb: Math.round(bytes / 1024), ms: Math.round(performance.now() - t0) };
  };

  /**
   * 删掉指定的点。
   * @param {string[]} ids 点 id
   * @returns {Promise<object>} SDK 回复
   */
  ComboMarker.prototype.remove = function (ids) {
    var self = this;
    ids.forEach(function (id) { if (self._items) self._items.delete(id); });
    return this.api.marker.delete(ids);
  };

  /**
   * 改显示倍数：所有点重画一遍，原地换图（不删不加，不闪）。observe 在推流分辨率变了时自动调用。
   * @param {number} scale 显示倍数
   * @returns {Promise<object|null>} { changed, ms }；倍数没变或还没有点时为 null
   */
  ComboMarker.prototype.setScale = async function (scale) {
    if (Math.abs(scale - this.scale) < 0.01) return null;
    this.scale = scale;
    if (!this._items || !this._items.size) return null;
    var self = this, list = [];
    this._items.forEach(function (p) {
      list.push(Object.assign({ id: p.id }, self._imageFields(self._draw(String(p.name), String(p.value), p.theme))));
    });
    var t0 = performance.now();
    await this._batched(this.api.marker.update, list);
    return { changed: list.length, ms: Math.round(performance.now() - t0) };
  };

  /** 删掉本前缀的全部 marker（按 groupId，刷新页面后也能删干净） @returns {Promise<object>} SDK 回复 */
  ComboMarker.prototype.clear = function () { this._items = new Map(); return this.api.marker.deleteByGroupId(this.prefix); };

  window.ComboMarker = ComboMarker;
})();
