import { type EffectPanel, api, loadLib } from '../effectRuntime'

/**
 * Vue 三维卡片 — fdapi.customObject + 蓝图 BP_VueMarker3D
 * 普通的 Vue 组件当作三维卡片立在场景里：组件在页面外渲染，截成透明 PNG 交给蓝图当贴图，数据变了自动重新截图。
 * 卡片有固定的世界尺寸（近大远小），可以一直面向相机、保持竖直或固定朝向。不需要图片服务器。
 * 依赖：Cloud 已挂载效果总包 v17（含 BP_VueMarker3D）；接口 public/static/dts-effects/libs/vue-marker3d.js（全局 VueMarker3D），
 * 它要用全局 Vue 和截图库：public/static/dts-effects/libs/vendor/vue.global.prod.js、modern-screenshot.js，按顺序先加载。
 * 在自己的 Vue 3 项目里用法相同，create 时传 vue: Vue（import * as Vue from 'vue'），组件可以是 .vue 单文件组件。
 *
 * ── VueMarker3D 接口 ──
 *   const cards = VueMarker3D.create(fdapi, { pakFilePath? })     卡片管理器（已挂载总包时不传 pakFilePath）
 *   await cards.add({ id, location: [x, y, z], component, props, widthM, facing, yaw, anchor, opacity, brightness, tint })
 *   cards.update(id, { 要改的 props })    改数据，自动重新截图
 *   await cards.setOptions(id, { widthM, facing, yaw, opacity, brightness, tint, anchor })
 *   await cards.setVisible(id, 显示?, 淡入淡出秒数)
 *   await cards.remove(id) / cards.clear()
 *   facing：'camera' 一直面向相机 / 'upright' 保持竖直、只水平转向相机 / 'fixed' 固定朝向（yaw：0 北、90 东）
 */

/** 示例在 window 上存的状态（刷新页面后清除时要用） */
const win = window as any

// ── 参数 ──
const widthM = 24;           // 卡片宽度(m)，min=4 max=80 step=1
const facing = 'camera';     // 朝向，面向相机=camera, 保持竖直=upright, 固定朝向=fixed
const liftM = 24;            // 离地高度(m)，min=0 max=100 step=1
const distance = 140;        // 观察距离，min=50 max=2000 step=10，lookAt 的距离

/** 运行 */
export async function run(panel: EffectPanel): Promise<void> {
  const fdapi = api()
  const CENTER: [number, number] = [492520, 2492200]; // demo.acp 北边公园（工程投影坐标，米）；换工程时改这里
  const GROUND_Z = -0.7; // 这一带的地面高度

  // 加载 Vue（含模板编译）、截图库和接口；加载过就跳过
  await loadLib('vendor/vue.global.prod.js', 'Vue')
  await loadLib('vendor/modern-screenshot.js', 'modernScreenshot')
  await loadLib('vue-marker3d.js', 'VueMarker3D')

  // ── 卡片组件（普通 Vue 组件，换成自己的 .vue 组件也一样）──
  const DeviceCard: any = {
    props: { name: String, code: String, online: Boolean, temp: Number, power: Number, load: Number },
    template: `
    <div style="width:280px;padding:14px 16px;border-radius:14px;background:linear-gradient(160deg,rgba(18,38,66,.92),rgba(9,18,32,.86));border:1px solid rgba(120,200,255,.55);color:#e8f3ff;font-family:'Microsoft YaHei',sans-serif">
      <div style="display:flex;align-items:center;gap:8px">
        <b style="font-size:16px;flex:1">{{ name }}</b>
        <span :style="{ whiteSpace: 'nowrap', fontSize: '12px', padding: '2px 8px', borderRadius: '10px', color: online ? '#58e3a6' : '#ff8a7d', border: '1px solid currentColor' }">{{ online ? '在线' : '离线' }}</span>
      </div>
      <div style="font-size:12px;color:#8fb2d6;margin:2px 0 8px">编号 {{ code }}</div>
      <div style="display:flex;gap:8px">
        <div style="flex:1;background:rgba(255,255,255,.06);border-radius:8px;padding:6px 8px"><div style="font-size:11px;color:#8fb2d6">温度</div><b style="font-size:18px">{{ temp.toFixed(1) }}</b><span style="font-size:11px"> ℃</span></div>
        <div style="flex:1;background:rgba(255,255,255,.06);border-radius:8px;padding:6px 8px"><div style="font-size:11px;color:#8fb2d6">功率</div><b style="font-size:18px">{{ power }}</b><span style="font-size:11px"> kW</span></div>
        <div style="flex:1;background:rgba(255,255,255,.06);border-radius:8px;padding:6px 8px"><div style="font-size:11px;color:#8fb2d6">负载</div><b style="font-size:18px">{{ load }}</b><span style="font-size:11px"> %</span></div>
      </div>
    </div>`,
  };
  const AlarmCard: any = {
    props: { level: Number, title: String, place: String, time: String },
    computed: { color(this: any) { return this.level >= 3 ? '#ff5a4f' : '#ffb020'; } },
    template: `
    <div :style="{ width: '250px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(40,10,10,.82)', border: '2px solid ' + color, color: '#fff4f2', fontFamily: 'Microsoft YaHei,sans-serif' }">
      <div style="display:flex;align-items:center;gap:8px">
        <b style="font-size:16px">{{ title }}</b>
        <span :style="{ marginLeft: 'auto', fontSize: '12px', color }">{{ level >= 3 ? '严重' : '警告' }}</span>
      </div>
      <div style="font-size:13px;margin-top:6px">位置：{{ place }}</div>
      <div style="font-size:12px;color:#d9a9a3">{{ time }}</div>
    </div>`,
  };
  const MonitorCard: any = {
    props: { title: String, unit: String, values: Array, labels: Array },
    computed: { max(this: any) { return Math.max(...this.values, 1); } },
    template: `
    <div style="width:300px;padding:12px 14px;border-radius:12px;background:rgba(8,22,40,.86);border:1px solid rgba(90,170,255,.5);color:#e3efff;font-family:'Microsoft YaHei',sans-serif">
      <div style="display:flex;justify-content:space-between"><b style="font-size:15px">{{ title }}</b><span style="font-size:12px;color:#8fb2d6">{{ unit }}</span></div>
      <svg width="272" height="110" style="display:block;margin-top:6px">
        <g v-for="(v, i) in values" :key="i">
          <rect :x="i * 34 + 6" :y="92 - v / max * 82" width="22" :height="v / max * 82" rx="3" :fill="v / max > .8 ? '#ff8a4c' : '#3ea6ff'"/>
          <text :x="i * 34 + 17" y="106" font-size="10" fill="#8fb2d6" text-anchor="middle">{{ labels[i] }}</text>
        </g>
      </svg>
    </div>`,
  };

  /** 随机演示数据 @returns {object} 每张卡片的 props */
  const sampleData = () => {
    const r = (a, b) => Math.round(a + Math.random() * (b - a)); // 随机整数
    return {
      device: { name: '1 号冷水机组', code: 'CH-0107', online: Math.random() > 0.15, temp: 6 + Math.random() * 4, power: r(120, 260), load: r(35, 95) },
      alarm: { level: Math.random() > 0.5 ? 3 : 2, title: '烟感告警', place: 'B 栋 3 层 东侧走廊', time: new Date().toLocaleString('zh-CN', { hour12: false }) },
      monitor: { title: '今日用电（分区）', unit: 'kWh', labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], values: Array.from({ length: 8 }, () => r(40, 320)) },
    };
  };
  // 三张卡片：组件和相对 CENTER 的偏移（米）
  const LAYOUT: Record<string, [any, [number, number]]> = { device: [DeviceCard, [-70, 10]], alarm: [AlarmCard, [35, 45]], monitor: [MonitorCard, [5, -65]] };

  // 上次运行留下的自动更新和卡片管理器：先停掉、清掉（卡片对象 id 是 <id>:card）
  clearInterval(win.__dtsVueCardTimer);
  await win.__dtsVueCards?.clear().catch(() => {});
  await fdapi.customObject.delete(Object.keys(LAYOUT).map(id => `demo_card_${id}:card`));

  const cards = VueMarker3D.create(fdapi); // 已挂载总包，不传 pakFilePath
  win.__dtsVueCards = cards;
  const data = sampleData(); // 初始数据
  const opts = { widthM, facing, yaw: 180, opacity: 1, brightness: 1, tint: '#ffffff' }; // 面板改的就是它
  for (const [key, [component, [dx, dy]]] of Object.entries(LAYOUT)) {
    await cards.add({ id: `demo_card_${key}`, location: [CENTER[0] + dx, CENTER[1] + dy, GROUND_Z + liftM], component, props: data[key], ...opts });
  }
  await fdapi.camera.lookAt(CENTER[0], CENTER[1], liftM, distance, -24, -110, 1);

  // ── 实时调节面板 ──
  const gui = panel({ title: 'Vue 卡片 · 实时调节' }); // 页面右侧的面板
  const ids = Object.keys(LAYOUT).map(key => `demo_card_${key}`); // 全部卡片
  /** 把一项外观发给全部卡片 @param {string} key 字段 @returns {(value: *) => void} 回调 */
  const send = key => value => ids.forEach(id => cards.setOptions(id, { [key]: value }));
  gui.add(opts, 'widthM', 4, 80, 1).name('宽度(m)').onFinishChange(send('widthM'));
  gui.add(opts, 'facing', { 面向相机: 'camera', 保持竖直: 'upright', 固定朝向: 'fixed' }).name('朝向').onChange(send('facing'));
  gui.add(opts, 'yaw', 0, 359, 1).name('固定朝向(°)').onFinishChange(send('yaw'));
  gui.add(opts, 'opacity', 0, 1, 0.05).name('透明度').onFinishChange(send('opacity'));
  gui.add(opts, 'brightness', 0.3, 2, 0.05).name('亮度').onFinishChange(send('brightness'));
  gui.addColor(opts, 'tint').name('整体调色').onFinishChange(send('tint'));
  /** 换一组数据，卡片自动重新截图 @returns {void} */
  const refresh = () => { const next = sampleData(); for (const key of Object.keys(LAYOUT)) cards.update(`demo_card_${key}`, next[key]); };
  const live = { auto: false }; // 自动更新开关
  gui.add({ refresh }, 'refresh').name('更新一次数据');
  gui.add(live, 'auto').name('每 2 秒自动更新').onChange(on => {
    clearInterval(win.__dtsVueCardTimer);
    if (on) win.__dtsVueCardTimer = setInterval(refresh, 2000);
  });
  gui.add({ hide: () => ids.forEach(id => cards.setVisible(id, false, 0.4)) }, 'hide').name('淡出隐藏');
  gui.add({ show: () => ids.forEach(id => cards.setVisible(id, true, 0.4)) }, 'show').name('淡入显示');
}

/** 清除 */
export async function clear(): Promise<void> {
  const fdapi = api()
  // 停掉自动更新、卸载页面外的 Vue 组件，再按对象 id 删除（刷新页面后管理器没有记录）
  clearInterval(win.__dtsVueCardTimer);
  await win.__dtsVueCards?.clear().catch(() => {});
  win.__dtsVueCards = undefined;
  await fdapi.customObject.delete(['demo_card_device:card', 'demo_card_alarm:card', 'demo_card_monitor:card']);
}
