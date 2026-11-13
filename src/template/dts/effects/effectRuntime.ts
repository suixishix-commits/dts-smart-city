import GUI from 'lil-gui'

/**
 * 特效公用工具：取 fdapi、加载接口文件、单独 PAK 的路径、实时调节面板。
 * 接口文件在 public/static/dts-effects/libs 下（来自 dts-vue 的 public/libs）。
 */

/** 特效的实时调节面板工厂：用法同 `new GUI(options)`，面板放在页面右侧，清除特效时自动关闭 */
export type EffectPanel = (options?: { title?: string }) => GUI

/** 每个特效文件的导出 */
export interface EffectModule {
  run(panel: EffectPanel): Promise<void>
  clear(): Promise<void>
}

/** 场景接口（__xapi），没连上时报错 */
export function api(): any {
  if (!__xapi?.isReady) throw new Error('三维场景还没连上')
  return __xapi
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const assetUrl = (path: string): string => new URL(`static/dts-effects/${path}`, document.baseURI).href

/**
 * 加载 public/static/dts-effects/libs 下的接口文件（会挂一个全局对象，如 ElectronicFence）。
 * 全局对象已经有了就跳过；`version` 不同时重新加载。
 */
export async function loadLib(file: string, globalName: string, version?: string): Promise<void> {
  const current = (window as any)[globalName]
  if (current && (!version || current.VERSION === version)) return
  await new Promise((resolve, reject) => {
    const src = assetUrl(`libs/${file}${version ? `?v=${version}` : ''}`)
    const script = Object.assign(document.createElement('script'), { src, onload: resolve })
    script.onerror = () => reject(new Error(`加载 ${file} 失败`))
    document.head.appendChild(script)
  })
}

/** 单独 PAK 在渲染机上的目录（.env 里的 VITE_DTS_EFFECT_PAK_DIR，即 docs/dts-effects/paks） */
const PAK_DIR = (import.meta.env.VITE_DTS_EFFECT_PAK_DIR ?? '').replace(/[\\/]+$/, '')

/** 单独 PAK 在渲染机上的路径；没配目录时用 fallback */
export const pakPath = (file: string, fallback = ''): string => (PAK_DIR ? `${PAK_DIR}\\${file}` : fallback)

// ---- 实时调节面板 ----

/**
 * lil-gui 的尺寸是运行时注入的 px，不经过 pxtorem；每层 .lil-gui 都会重新定义这些变量，
 * 所以用比它高一级的选择器整体改成 rem（1rem = 10px，1920 设计稿），随分辨率缩放
 */
const GUI_CSS = `.dts-effect-gui-host .lil-gui {
  --font-size: 1.2rem; --input-font-size: 1.2rem; --padding: 0.4rem; --spacing: 0.4rem;
  --widget-height: 2.2rem; --slider-knob-width: 0.2rem; --slider-input-min-width: 4.5rem; --color-input-min-width: 4.5rem;
  --folder-indent: 0.7rem; --widget-padding: 0 0 0 0.3rem; --widget-border-radius: 0.2rem; --scrollbar-width: 0.5rem;
}
.dts-effect-gui-host .lil-gui.lil-root { --width: 28rem; }`

let guiHost: HTMLElement | null = null

/** 面板的容器：页面右上角，多个面板往下排 */
function host(): HTMLElement {
  if (!guiHost?.isConnected) {
    guiHost = Object.assign(document.createElement('div'), { className: 'dts-effect-gui-host' })
    Object.assign(guiHost.style, {
      position: 'fixed',
      top: '9rem',
      right: '46rem',
      zIndex: '3000',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.8rem',
      maxHeight: 'calc(100vh - 12rem)',
      overflowY: 'auto'
    })
    document.body.appendChild(guiHost)
    if (!document.getElementById('dts-effect-gui-css')) {
      document.head.appendChild(Object.assign(document.createElement('style'), { id: 'dts-effect-gui-css', textContent: GUI_CSS }))
    }
  }
  return guiHost
}

/** 按特效记录建过的面板 */
const guis = new Map<string, GUI[]>()

/** 给某个特效用的面板工厂 */
export function panelFor(owner: string): EffectPanel {
  return (options = {}) => {
    const gui = new GUI({ title: '实时调节', ...options, container: host() })
    guis.set(owner, [...(guis.get(owner) ?? []), gui])
    return gui
  }
}

/** 关掉某个特效的面板 */
export function destroyPanels(owner: string): void {
  for (const gui of guis.get(owner) ?? []) gui.destroy()
  guis.delete(owner)
}
