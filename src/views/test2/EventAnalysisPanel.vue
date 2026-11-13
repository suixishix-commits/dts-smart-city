<template>
  <div class="analysis-panel panel-block">
    <div class="panel-header">
      <span class="panel-header-arrow">>></span>
      <span class="panel-header-title">事件分析</span>
    </div>

    <div class="panel-body">
      <!-- 子区域：趋势分析 -->
      <div class="section block-trend">
        <div class="section-title">
          <span class="section-bar"></span>
          <span class="section-label">趋势分析</span>
          <div class="trend-tabs">
            <span :class="['tab', trendTab === '区级研判' ? 'active' : '']" @click="trendTab = '区级研判'">区级研判</span>
            <span :class="['tab', trendTab === '市级指令' ? 'active' : '']" @click="trendTab = '市级指令'">市级指令</span>
          </div>
        </div>
        <div ref="trendChartRef" class="chart-fill"></div>
      </div>

      <div class="section-divider"></div>

      <!-- 子区域：高发区域 -->
      <div class="section block-area">
        <div class="section-title">
          <span class="section-bar"></span>
          <span class="section-label">高发区域</span>
        </div>
        <div class="area-list">
          <div v-for="(item, i) in hotAreas" :key="item.name" class="area-item">
            <span class="area-rank" :class="i < 3 ? 'top3' : ''">NO{{ i + 1 }}</span>
            <div class="area-info">
              <div class="area-name-row">
                <span class="area-name">{{ item.name }}</span>
                <span class="area-num">{{ item.num.toLocaleString() }}条</span>
              </div>
              <div class="area-bar-wrap">
                <div class="area-bar-fill" :style="{ width: (item.num / hotAreas[0].num) * 100 + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="section-divider"></div>

      <!-- 子区域：高发类型 -->
      <div class="section block-type">
        <div class="section-title">
          <span class="section-bar"></span>
          <span class="section-label">高发类型</span>
        </div>
        <div ref="typeChartRef" class="chart-fill"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { scalePx, setScaledOption } from '@/utils/viewportScale'
import * as echarts from 'echarts'

const trendTab = ref('区级研判')
const trendChartRef = ref<HTMLElement>()
const typeChartRef = ref<HTMLElement>()

const hotAreas: any = ref([
  { name: '甘井子区', num: 3284 },
  { name: '金普新区', num: 3177 },
  { name: '沙河口区', num: 2986 },
  { name: '中山区', num: 2754 },
  { name: '西岗区', num: 2431 }
])

function initTrendChart() {
  if (!trendChartRef.value) return
  const chart = echarts.init(trendChartRef.value)
  setScaledOption(chart, {
    backgroundColor: 'transparent',
    grid: { top: 24, right: 12, bottom: 24, left: 36 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(13,50,70,0.92)', borderColor: 'rgba(96,228,255,0.3)', textStyle: { color: '#fff', fontSize: scalePx(11) } },
    xAxis: {
      type: 'category',
      data: ['10/01', '10/02', '10/03', '10/04', '10/05', '10/06'],
      axisLine: { lineStyle: { color: 'rgba(96,228,255,0.2)' } },
      axisTick: { show: false },
      axisLabel: { color: 'rgba(255,255,255,0.45)', fontSize: scalePx(10) }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(96,228,255,0.08)', type: 'dashed' } },
      axisLabel: { color: 'rgba(255,255,255,0.45)', fontSize: scalePx(10) }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: scalePx(5),
        lineStyle: { color: '#15BAC6', width: 2 },
        itemStyle: { color: '#15BAC6' },
        label: { show: true, color: '#60E4FF', fontSize: scalePx(10), position: 'top' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(21,186,198,0.25)' },
            { offset: 1, color: 'rgba(21,186,198,0.02)' }
          ])
        },
        data: [120, 150, 200, 180, 160, 210]
      }
    ]
  })
}

function initTypeChart() {
  if (!typeChartRef.value) return
  const chart = echarts.init(typeChartRef.value)
  setScaledOption(chart, {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: 'rgba(13,50,70,0.92)', borderColor: 'rgba(96,228,255,0.3)', textStyle: { color: '#fff', fontSize: scalePx(11) } },
    legend: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['42%', '65%'],
        center: ['50%', '52%'],
        label: { fontSize: scalePx(10), color: 'rgba(255,255,255,0.65)' },
        labelLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
        data: [
          { value: 12, name: '类型一', itemStyle: { color: '#15BAC6' } },
          { value: 12, name: '类型二', itemStyle: { color: '#4AE8A0' } },
          { value: 18, name: '类型三', itemStyle: { color: '#FFB347' } },
          { value: 12, name: '类型四', itemStyle: { color: '#A78BFA' } },
          { value: 6, name: '类型五', itemStyle: { color: '#FF6B6B' } }
        ]
      }
    ],
    graphic: [{ type: 'text', left: 'center', top: '42%', style: { text: '34%', fill: '#60E4FF', fontSize: scalePx(14), fontWeight: 'bold' } }]
  })
}

onMounted(() => {
  nextTick(() => {
    initTrendChart()
    initTypeChart()
  })
})
</script>

<style lang="scss" scoped>
$panel-bg: linear-gradient(180deg, rgba(14, 38, 58, 0.96) 0%, rgba(10, 28, 44, 0.98) 100%);
$border: rgba(21, 186, 198, 0.18);
$accent: #15bac6;
$text-dim: rgba(255, 255, 255, 0.5);

.analysis-panel {
  width: 38rem;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: $panel-bg;
  border: 1px solid $border;
  border-radius: 0.4rem;
  overflow: hidden;
  min-height: 0;

  // ── 面板标题栏 ────────────────────────────────
  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 3.6rem;
    padding: 0 1.2rem;
    background: rgba(21, 186, 198, 0.07);
    border-bottom: 1px solid rgba(21, 186, 198, 0.12);
    flex-shrink: 0;

    .panel-header-arrow {
      font-size: 1.1rem;
      color: $accent;
      letter-spacing: -0.05em;
      font-weight: bold;
    }

    .panel-header-title {
      flex: 1;
      font-family: YouSheBiaoTiHei, sans-serif;
      font-size: 1.8rem;
      letter-spacing: 0.06em;
      background: linear-gradient(180deg, #e8f8ff 0%, #7dd8e8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  }

  // ── 面板内容区 ────────────────────────────────
  .panel-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0 1.4rem;
    overflow: hidden;
  }

  // ── 子区域 ────────────────────────────────────
  .section {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .block-trend {
    flex: 38;
  }
  .block-area {
    flex: 28;
  }
  .block-type {
    flex: 34;
  }

  .section-divider {
    height: 1px;
    background: rgba(21, 186, 198, 0.1);
    flex-shrink: 0;
    margin: 0.3rem 0;
  }

  // ── 子区域标题 ────────────────────────────────
  .section-title {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.6rem 0 0.5rem;
    flex-shrink: 0;

    .section-bar {
      width: 0.22rem;
      height: 1rem;
      background: $accent;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .section-label {
      font-size: 1.15rem;
      color: rgba(255, 255, 255, 0.45);
      letter-spacing: 0.04em;
    }

    .trend-tabs {
      margin-left: auto;
      display: flex;
      gap: 0.3rem;
      .tab {
        font-size: 1.05rem;
        color: $text-dim;
        padding: 0.1rem 0.55rem;
        border-radius: 0.25rem;
        cursor: pointer;
        transition: all 0.2s;
        &.active {
          background: rgba(21, 186, 198, 0.15);
          color: #60e4ff;
          border: 1px solid rgba(21, 186, 198, 0.3);
        }
      }
    }
  }

  .chart-fill {
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  .area-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    .area-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      .area-rank {
        font-family: DIN, sans-serif;
        font-size: 1.05rem;
        color: $text-dim;
        width: 3rem;
        flex-shrink: 0;
        &.top3 {
          color: #ffb347;
        }
      }
      .area-info {
        flex: 1;
        .area-name-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.25rem;
          .area-name {
            font-size: 1.15rem;
            color: rgba(255, 255, 255, 0.8);
          }
          .area-num {
            font-family: DIN, sans-serif;
            font-size: 1.05rem;
            color: #60e4ff;
          }
        }
        .area-bar-wrap {
          height: 3px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          .area-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, $accent, rgba(21, 186, 198, 0.3));
            border-radius: 2px;
            transition: width 0.6s ease;
          }
        }
      }
    }
  }
}
@media (min-width: 2560px) {
  .analysis-panel {
    width: 25rem;
  }
}
</style>
