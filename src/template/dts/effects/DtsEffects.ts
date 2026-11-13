import { findEffect } from './effectCatalog'
import { destroyPanels, panelFor } from './effectRuntime'

/**
 * 特效执行器：按 id 运行 / 清除特效（effectCatalog 里登记的 line/、area/、dataviz/、view/ 下的文件）。
 * 特效代码按需加载，同一个特效重新运行前先清除；清除时关掉它的实时调节面板。
 */

/** 正在运行的特效 */
const running = new Set<string>()

async function load(id: string) {
  const effect = findEffect(id)
  if (!effect) throw new Error(`没有特效 ${id}`)
  return effect.load()
}

/** 运行特效 */
async function run(id: string): Promise<void> {
  const effect = await load(id)
  if (running.has(id)) await clear(id)
  destroyPanels(id)
  running.add(id)
  await effect.run(panelFor(id))
}

/** 清除特效 */
async function clear(id: string): Promise<void> {
  const effect = await load(id)
  destroyPanels(id)
  running.delete(id)
  await effect.clear()
}

/** 清除全部已运行的特效 */
async function clearAll(): Promise<void> {
  for (const id of [...running]) await clear(id)
}

export default { run, clear, clearAll, running }
