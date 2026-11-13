/**
 * useCollapsibleGroup —— 可收缩面板联动组（模块级注册表）
 *
 * 用法：给 CollapsiblePanel 加 group 和 linkage prop 即可，父组件零感知。
 *
 *   <CollapsiblePanel side="left"  group="main" linkage="sync" />
 *   <CollapsiblePanel side="right" group="main" linkage="sync" />
 *
 * 联动模式（linkage）：
 *   sync      同步：一侧收起，另一侧也收起；一侧展开，另一侧也展开
 *   exclusive 互斥：展开一侧时，同组其他面板自动收起
 *   none      独立：不联动（默认）
 */

export type LinkageMode = 'sync' | 'exclusive' | 'none'

interface PanelEntry {
  id: symbol
  setCollapsed: (val: boolean) => void
}

// 模块级注册表：groupName → 该组所有面板
const registry = new Map<string, PanelEntry[]>()

function getGroup(name: string): PanelEntry[] {
  if (!registry.has(name)) registry.set(name, [])
  return registry.get(name)!
}

export function registerPanel(groupName: string, entry: PanelEntry) {
  getGroup(groupName).push(entry)
}

export function unregisterPanel(groupName: string, id: symbol) {
  const group = registry.get(groupName)
  if (!group) return
  const idx = group.findIndex(p => p.id === id)
  if (idx !== -1) group.splice(idx, 1)
  if (group.length === 0) registry.delete(groupName)
}

export function notifyGroup(groupName: string, sourceId: symbol, collapsed: boolean, mode: LinkageMode) {
  if (mode === 'none') return
  const others = getGroup(groupName).filter(p => p.id !== sourceId)
  if (mode === 'sync') {
    others.forEach(p => p.setCollapsed(collapsed))
  } else if (mode === 'exclusive') {
    if (!collapsed) others.forEach(p => p.setCollapsed(true))
  }
}
