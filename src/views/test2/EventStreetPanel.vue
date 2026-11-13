<template>
  <div class="street-panel panel-block">
    <div class="panel-header">
      <span class="panel-header-arrow">>></span>
      <span class="panel-header-title">各街道处置效能</span>
    </div>
    <div class="panel-body">
      <div class="street-tabs">
        <span
          v-for="s in streets" :key="s"
          :class="['street-tab', activeStreet === s ? 'active' : '']"
          @click="activeStreet = s"
        >{{ s }}</span>
      </div>
      <div class="street-chart-wrap">
        <div ref="streetChartRef" class="street-chart"></div>
        <div class="street-legend">
          <div v-for="item in streetStats" :key="item.label" class="legend-item">
            <span class="legend-dot" :style="{ background: item.color }"></span>
            <span class="legend-label">{{ item.label }}</span>
            <span class="legend-num">{{ item.num }}件</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { scalePx, setScaledOption } from '@/utils/viewportScale'
import * as echarts from 'echarts'

const activeStreet = ref('东荆街道')
const streetChartRef = ref<HTMLElement>()

const streets = ['东荆街道', '邓南街道', '军山街道', '纱帽街']

const streetStats = ref([
  { label: '已派发', num: 102, color: '#15BAC6' },
  { label: '处置中', num: 56, color: '#FFB347' },
  { label: '已办结', num: 158, color: '#4AE8A0' }
])

function initStreetChart() {
  if (!streetChartRef.value) return
  const chart = echarts.init(streetChartRef.value)
  const total = streetStats.value.reduce((s, i) => s + i.num, 0)
  setScaledOption(chart, {
    backgroundColor: 'transparent',
    series: [{
      type: 'pie', radius: ['48%', '70%'], center: ['50%', '50%'],
      label: { show: false }, silent: false,
      data: streetStats.value.map(i => ({ value: i.num, name: i.label, itemStyle: { color: i.color } }))
    }],
    graphic: [{
      type: 'text', left: 'center', top: '40%',
      style: { text: String(total), fill: '#fff', fontSize: scalePx(16), fontWeight: 'bold' }
    }, {
      type: 'text', left: 'center', top: '55%',
      style: { text: '总件数', fill: 'rgba(255,255,255,0.45)', fontSize: scalePx(10) }
    }]
  })
}

watch(activeStreet, () => initStreetChart())
onMounted(() => nextTick(() => initStreetChart()))
</script>

<style lang="scss" scoped>
$panel-bg: linear-gradient(180deg, rgba(14, 38, 58, 0.96) 0%, rgba(10, 28, 44, 0.98) 100%);
$border: rgba(21, 186, 198, 0.18);
$accent: #15BAC6;
$text-dim: rgba(255, 255, 255, 0.5);

.street-panel {
  width: 38rem;
  display: flex;
  flex-direction: column;
  background: $panel-bg;
  border: 1px solid $border;
  border-radius: 0.4rem;
  overflow: hidden;
  min-height: 0;

  // ── 面板标题栏 ────────────────────────────────
  .panel-header {
    display: flex; align-items: center; gap: 0.5rem;
    height: 3.6rem; padding: 0 1.2rem;
    background: rgba(21, 186, 198, 0.07);
    border-bottom: 1px solid rgba(21, 186, 198, 0.12);
    flex-shrink: 0;

    .panel-header-arrow {
      font-size: 1.1rem; color: $accent;
      letter-spacing: -0.05em; font-weight: bold;
    }

    .panel-header-title {
      flex: 1;
      font-family: YouSheBiaoTiHei, sans-serif;
      font-size: 1.8rem; letter-spacing: 0.06em;
      background: linear-gradient(180deg, #e8f8ff 0%, #7dd8e8 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
  }

  // ── 面板内容区 ────────────────────────────────
  .panel-body {
    flex: 1; min-height: 0;
    display: flex; flex-direction: column;
    padding: 0.8rem 1.4rem;
    overflow: hidden;
  }

  .street-tabs {
    display: flex; gap: 0.4rem; margin-bottom: 0.8rem;
    flex-wrap: wrap; flex-shrink: 0;

    .street-tab {
      font-size: 1.1rem; color: $text-dim;
      padding: 0.25rem 0.7rem; border-radius: 0.25rem;
      cursor: pointer; border: 1px solid transparent; transition: all 0.2s;
      &.active { background: rgba(21,186,198,0.15); color: #60E4FF; border-color: rgba(21,186,198,0.3); }
    }
  }

  .street-chart-wrap {
    flex: 1; min-height: 0;
    display: flex; align-items: center; gap: 1.2rem;

    .street-chart { width: 12rem; height: 100%; flex-shrink: 0; min-height: 8rem; }

    .street-legend {
      display: flex; flex-direction: column; gap: 0.8rem;

      .legend-item {
        display: flex; align-items: center; gap: 0.6rem;
        .legend-dot { width: 0.8rem; height: 0.8rem; border-radius: 50%; flex-shrink: 0; }
        .legend-label { font-size: 1.15rem; color: $text-dim; }
        .legend-num { font-family: DIN, sans-serif; font-size: 1.3rem; color: rgba(255,255,255,0.8); margin-left: 0.3rem; }
      }
    }
  }
}
@media (min-width: 2560px) {
  .street-panel { width: 25rem; }
}
</style>
