import type { EffectModule } from './effectRuntime'

/**
 * 特效目录：取自 dts-vue 示例中心（DTS 团队特效资源库 dts-resource 的效果），按功能分组。
 * 每个特效一个文件（line/、area/、dataviz/、view/ 下），导出 run（运行）和 clear（清除）。
 * id 与 dts-vue 的示例 id 相同。使用说明和用到的 PAK 见 docs/dts-effects/。
 */

/** 特效需要的资源 */
export type EffectPak =
  /** 效果总包 DTS-Effects-Bundle（放渲染端 Content\Paks） */
  | 'bundle'
  /** DTS 原生接口，不需要 PAK */
  | 'none'
  /** 单独的 PAK，见 EffectItem.pakFile */
  | 'single'

export interface EffectItem {
  id: string
  /** 特效代码（按需加载）：每个特效一个文件，导出 run / clear */
  load: () => Promise<EffectModule>
  name: string
  desc: string
  pak: EffectPak
  /** 单独 PAK 的文件名（docs/dts-effects/paks/ 下） */
  pakFile?: string
}

export interface EffectGroup {
  name: string
  items: EffectItem[]
}

export const EFFECT_GROUPS: EffectGroup[] = [
  {
    name: '线与路径',
    items: [
      { id: 'mt-flow-line', load: () => import('./line/FlowLine'), name: '流动线', desc: '流动虚线、追逐箭头、粒子流光、脉冲流光', pak: 'bundle' },
      { id: 'ln-terrain', load: () => import('./line/TerrainLine'), name: '贴地流动线', desc: '同四种流动线，图案画在地形、道路和模型表面上', pak: 'bundle' },
      {
        id: 'ln-ground-layer', load: () => import('./line/GroundLayerLine'),
        name: '图层贴花线',
        desc: '原生贴花只投到指定的地面图层，不爬上建筑（预览版）',
        pak: 'single',
        pakFile: 'GroundLayerLines-V1-20261028-WindowsNoEditor.pak'
      },
      { id: 'mt-dash-mesh', load: () => import('./line/DashMesh'), name: '海量流动虚线', desc: '上百条线合成几个网格，流动虚线或追逐箭头', pak: 'bundle' },
      { id: 'mt-stream-flow', load: () => import('./line/StreamFlow'), name: '空间光流', desc: '沿路线流动的立体粒子光流', pak: 'bundle' },
      { id: 'ln-stream-v5', load: () => import('./line/StreamFlowInstanced'), name: '实例化光流', desc: 'V5：大量路线在一个蓝图里实例化绘制', pak: 'bundle' },
      { id: 'ln-guide-line', load: () => import('./line/NativeGuideLine'), name: '原生牵引线', desc: '沿出行路线画带材质的引导线，每条一种颜色', pak: 'none' }
    ]
  },
  {
    name: '区域与边界',
    items: [
      { id: 'mt-boundary-flow', load: () => import('./area/BoundaryFlow'), name: '边界流光', desc: '光点沿闭合边界跑一圈，留下发光边线', pak: 'bundle' },
      { id: 'mt-e-fence', load: () => import('./area/ElectronicFenceFx'), name: '电子围栏', desc: '贴地轮廓先提亮，再整圈升起能量幕墙', pak: 'bundle' },
      { id: 'mt-polygon-mask', load: () => import('./area/PolygonMaskFx'), name: '多边形遮罩', desc: '外围压暗向中心收拢，留出区域并立起光墙', pak: 'bundle' },
      {
        id: 'ln-polygon-spread', load: () => import('./area/PolygonSpreadFx'),
        name: '多边形漫开',
        desc: '水面从起点沿区域内部漫开，前沿发光，终态描边（预览版）',
        pak: 'single',
        pakFile: 'PolygonSpread-V1-WindowsNoEditor.pak'
      },
      { id: 'mt-dot-flow-layer', load: () => import('./area/RegionDotFlowFx'), name: '区域点阵流光', desc: '整个图层一个对象，六种内部图案，贴地或平面', pak: 'bundle' }
    ]
  },
  {
    name: '数据可视化',
    items: [
      { id: 'mt-heat-column', load: () => import('./dataviz/HeatColumn'), name: '热力柱', desc: '方柱按数值升起，四段色带，柱脚扩散光圈', pak: 'bundle' },
      { id: 'dv-vue-card', load: () => import('./dataviz/VueCard'), name: 'Vue 三维卡片', desc: 'Vue 组件渲染成贴图，立在场景里随数据刷新', pak: 'bundle' },
      { id: 'dv-combo-marker', load: () => import('./dataviz/ComboMarkerFx'), name: '区域数值标注', desc: '名称胶囊 + 数值徽标，红橙黄绿四色', pak: 'none' },
      {
        id: 'dv-zone-marker', load: () => import('./dataviz/ZoneMarkerFx'),
        name: '区域状态标注',
        desc: '玻璃晶体 3D 标注，按状态上色，带出场动画',
        pak: 'single',
        pakFile: 'ZoneMarker3D-V1-WindowsNoEditor.pak'
      }
    ]
  },
  {
    name: '视域分析',
    items: [{ id: 'mt-view-frustum', load: () => import('./view/ViewFrustumFx'), name: '摄像头视域', desc: '视锥从镜头长出，碰到地面和墙就停', pak: 'bundle' }]
  }
]

export function findGroup(name: string): EffectGroup | undefined {
  return EFFECT_GROUPS.find((g) => g.name === name)
}

/** 面板选项的值：`特效-<id>` 运行、`特效清除-<id>` 清除、`特效-全部清除` 清除全部 */
export const EFFECT_PREFIX = '特效-'
export const EFFECT_CLEAR_PREFIX = '特效清除-'
export const EFFECT_CLEAR_ALL = '特效-全部清除'

export function findEffect(id: string): EffectItem | undefined {
  for (const group of EFFECT_GROUPS) {
    const item = group.items.find((i) => i.id === id)
    if (item) return item
  }
  return undefined
}
