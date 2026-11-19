<template>
  <div class="heatdemo-main">
    <aside class="heatdemo-left">
      <PanelCard title="数据概况" :extra="data ? data.regions.length + ' 个片区' : '加载中'">
        <p v-if="error" class="error">{{ error }}</p>
        <div v-else-if="data" class="stats">
          <div class="stat">
            <span class="label">最高</span>
            <b :style="{ color: colorAt(1) }">{{ aed(range[1]) }}</b>
          </div>
          <div class="stat">
            <span class="label">最低（非零）</span>
            <b :style="{ color: colorAt(0) }">{{ aed(range[0]) }}</b>
          </div>
          <div class="stat">
            <span class="label">有数值 / 无数值片区</span>
            <b>{{ nonzero }} / {{ data.regions.length - nonzero }}</b>
          </div>
          <div class="stat">
            <span class="label">合计</span>
            <b>{{ aed(total) }}</b>
          </div>
        </div>
      </PanelCard>
      <PanelCard v-if="data" title="片区排行" grow>
        <template #extra>
          <button type="button" class="sort" @click="order = order === 'desc' ? 'asc' : 'desc'">{{ order === 'desc' ? '由高到低' : '由低到高' }} ⇅</button>
        </template>
        <div class="list scroll">
          <button v-for="(r, i) in ranked" :key="r.code" type="button" class="row" :class="{ active: r.code === active }" @click="select(r.code)">
            <span class="rank">{{ i + 1 }}</span>
            <span class="name">{{ title(r.name) }}</span>
            <span class="bar"><i :style="barStyle(r.value)"></i></span>
            <span class="value">{{ r.value ? aed(r.value) : '—' }}</span>
          </button>
        </div>
      </PanelCard>
    </aside>

    <SceneTools class="tools" :active="tools.active.value" @tool="tools.onTool" />
    <BaseLayerPanel v-if="tools.showLayers.value" class="base-layers" :state="tools.base" @change="tools.setBase" />

    <!-- 色板：三组客户图层色带 -->
    <div class="palettes" role="radiogroup" aria-label="色板">
      <button v-for="p in PALETTES" :key="p.key" type="button" class="palette" :class="{ on: p.key === palette.key }" role="radio" :aria-checked="p.key === palette.key ? 'true' : 'false'" @click="setPalette(p.key)">
        <i :style="{ background: rampOf(p) }"></i>{{ p.name }}
      </button>
    </div>

    <SceneLegend v-if="data" class="legend">
      <span class="legend-item">
        <b>片区数值</b>{{ aed(range[0]) }}<i class="ramp" :style="{ background: rampOf(palette) }"></i>{{ aed(range[1]) }}
      </span>
      <span class="legend-item"><i class="outline"></i>无数值（不着色）</span>
    </SceneLegend>
    <LayerToggle v-model="layers" class="layers" :layers="LAYERS" @change="onLayer" />
  </div>
</template>

<script setup lang="ts">
import { getRegionHeat } from '@/api/regionHeat'
import BaseLayerPanel from '@/components/panel/BaseLayerPanel.vue'
import LayerToggle from '@/components/panel/LayerToggle.vue'
import PanelCard from '@/components/panel/PanelCard.vue'
import SceneLegend from '@/components/panel/SceneLegend.vue'
import SceneTools from '@/components/panel/SceneTools.vue'
import { useSceneTools } from '@/composables/useSceneTools'
import { cityBase } from '@/scene/CityBase'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
import emitter from '@/utils/emitter'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { aed, HeatDemoScene, magnitudeRange, PALETTES, rampColorAt, rampPosition, title, type DemoData, type Palette } from './HeatDemoScene'

const LAYERS = [
  { key: 'fill', name: '片区填色' },
  { key: 'outline', name: '片区边界' },
  { key: 'label', name: '极值标注' }
]

const data = ref<DemoData | null>(null)
const error = ref('')
const active = ref<string | null>(null)
const order = ref<'desc' | 'asc'>('desc')
const layers = ref(LAYERS.map(l => l.key))
let scene: HeatDemoScene | null = null
const unmounting = new AbortController()

const range = computed(() => magnitudeRange(data.value?.regions ?? []))
const nonzero = computed(() => data.value?.regions.filter(r => r.value !== 0).length ?? 0)
const total = computed(() => data.value?.regions.reduce((n, r) => n + Math.abs(r.value), 0) ?? 0)
/** 排行按绝对值（和场景着色一致） */
const ranked = computed(() => [...(data.value?.regions ?? [])].sort((a, b) => (order.value === 'desc' ? Math.abs(b.value) - Math.abs(a.value) : Math.abs(a.value) - Math.abs(b.value))))
const colorAt = (t: number) => rampColorAt(palette.value.ramp, t)
const palette = ref<Palette>(PALETTES[0])
const rampOf = (p: Palette) => `linear-gradient(to right, ${p.ramp.join(', ')})`
function setPalette(key: string) {
  palette.value = PALETTES.find(p => p.key === key) ?? palette.value
  scene?.setPalette(key)
}

/** 排行条：长度按绝对值占最大值的比例，颜色和场景里该片区的颜色一致；值为 0 不画 */
function barStyle(v: number) {
  const t = rampPosition(v, range.value)
  if (t === null) return { width: '0' }
  return { left: '0', width: Math.max(2, (Math.abs(v) / (range.value[1] || 1)) * 100) + '%', background: colorAt(t) }
}

function select(code: string) {
  active.value = active.value === code ? null : code
  if (active.value) scene?.focusRegion(code)
}

function onLayer(key: string, visible: boolean) {
  scene?.setLayerVisible(key, visible)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 场景事件载荷由 EventDispatcher 原样转发
function onRegionClick(e: any) {
  select(JSON.parse(e.data.userData).id)
}

const tools = useSceneTools({
  reset: async () => {
    active.value = null
    const c = scene?.camera
    if (c?.length) await __xapi.camera.set(c[0], c[1], c[2], c[3], c[4], 1.5)
  },
  tour: () => []
})

onMounted(async () => {
  try {
    data.value = await getRegionHeat()
  } catch (e) {
    error.value = (e as Error).message ?? String(e)
    return
  }
  emitter.on('sc_heatdemo_region', onRegionClick)
  if (!(await cityBase.start()) || unmounting.signal.aborted) return
  scene = new HeatDemoScene(new DtsSceneApi(), data.value)
  // 渲染端断开时场景调用会抛错：只记日志，面板照常可用
  await scene.enter().catch(e => console.warn('[片区热力] 场景图层创建失败', e))
})

onBeforeUnmount(async () => {
  unmounting.abort()
  emitter.off('sc_heatdemo_region', onRegionClick)
  const leaving = scene?.leave()
  scene = null
  await leaving?.catch(e => console.warn('[片区热力] 场景图层清理失败', e))
})
</script>

<style lang="scss" scoped>
$scene-left: var(--scene-left);

.heatdemo-main {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.heatdemo-left {
  position: absolute;
  left: $page-margin;
  top: $panel-top;
  width: $panel-width;
  height: calc(100% - #{$panel-top} - #{$page-margin});
  display: flex;
  flex-direction: column;
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 12px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  .label {
    font-size: 12px;
    color: $text-muted;
  }
  b {
    font-family: $font-num;
    font-size: 22px;
    font-weight: 600;
    color: $text-strong;
  }
}
.error {
  margin: 0;
  color: $level-1;
}
.sort {
  padding: 2px 8px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  font-size: 12px;
  color: $text;
  background: transparent;
  cursor: pointer;
}
.list {
  flex: 1;
  min-height: 0;
  overflow: hidden auto;
  display: flex;
  flex-direction: column;
}
.row {
  display: grid;
  grid-template-columns: 24px 1fr 96px 72px;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 0;
  border-radius: $radius-sm;
  text-align: left;
  color: $text;
  background: transparent;
  cursor: pointer;
  .rank {
    font-family: $font-num;
    font-size: 12px;
    color: $text-muted;
  }
  .name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 13px;
  }
  .bar {
    position: relative;
    height: 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.06);
    i {
      position: absolute;
      top: 0;
      bottom: 0;
      border-radius: 3px;
    }
  }
  .value {
    font-family: $font-num;
    font-size: 13px;
    text-align: right;
  }
}
.tools {
  position: absolute;
  left: $scene-left;
  top: $panel-top;
}
.base-layers {
  position: absolute;
  left: calc(#{$scene-left} + 64px);
  top: $panel-top;
}
.palettes {
  position: absolute;
  right: $page-margin;
  top: $panel-top;
  display: flex;
  gap: 4px;
  padding: 4px;
  pointer-events: all;
  background: $bg-float;
  border: 1px solid $border;
  border-radius: $radius;
}
.palette {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: $radius-sm;
  font-size: 13px;
  color: $text-muted;
  background: transparent;
  cursor: pointer;
  i {
    width: 40px;
    height: 8px;
    border-radius: 4px;
  }
  &:hover {
    color: $text;
  }
  &.on {
    color: $text-strong;
    background: $accent-soft;
  }
}
.legend {
  position: absolute;
  left: $scene-left;
  bottom: $page-margin;
  b {
    font-weight: 400;
    color: $text;
    margin-right: 2px;
  }
  i {
    display: inline-block;
    font-style: normal;
  }
  .ramp {
    position: relative;
    width: 160px;
    height: 8px;
    margin: 0 6px;
    border-radius: 4px;
  }
  .outline {
    width: 14px;
    height: 10px;
    box-sizing: border-box;
    border: 1px solid rgba(223, 233, 242, 0.7);
    border-radius: 2px;
  }
}
.layers {
  position: absolute;
  right: $page-margin;
  bottom: $page-margin;
}
</style>
