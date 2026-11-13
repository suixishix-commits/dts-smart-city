<template>
  <div class="ai-panel panel-block">
    <div class="panel-header">
      <span class="panel-header-arrow">>></span>
      <span class="panel-header-title">AI 智能预警事件</span>
      <span class="ai-badge">AI</span>
      <div class="ai-toggle" :class="{ on: aiEnabled }" @click="aiEnabled = !aiEnabled">
        <span class="toggle-dot"></span>
      </div>
    </div>

    <div class="panel-body">
      <!-- 子区域：智能发现(AI识别) -->
      <div class="section-title">
        <span class="section-bar"></span>
        <span class="section-label">智能发现（AI识别）</span>
      </div>
      <div class="ai-discover">
        <div class="discover-stat">
          <span class="discover-num">66</span>
          <span class="discover-unit">件</span>
          <span class="discover-label">告警总件数</span>
        </div>
        <div ref="aiBarChartRef" class="ai-bar-chart"></div>
      </div>

      <div class="section-divider"></div>

      <!-- 子区域：智能发现列表 -->
      <div class="section-title">
        <span class="section-bar"></span>
        <span class="section-label">智能发现列表</span>
      </div>
      <div class="ai-list">
        <div v-for="item in aiEvents" :key="item.id" class="ai-item" @click="onAiClick(item)">
          <div class="ai-img">
            <div class="ai-img-placeholder">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
                <circle cx="8.5" cy="10.5" r="1.5" stroke="currentColor" stroke-width="1.2"/>
                <path d="M3 17l5-4 4 3 3-3 6 4" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
          <div class="ai-info">
            <div class="ai-type">{{ item.type }}</div>
            <div class="ai-time">{{ item.time }}</div>
            <div class="ai-location">{{ item.location }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { scalePx, setScaledOption } from '@/utils/viewportScale'
import * as echarts from 'echarts'

const aiEnabled = ref(true)
const aiBarChartRef = ref<HTMLElement>()

const aiEvents = ref([
  { id: 1, type: '违章停车', time: '2025-11-23 16:52:32', location: '湖北省武汉市江岸区青岛路' },
  { id: 2, type: '占道摆摊', time: '2025-11-23 15:30:11', location: '湖北省武汉市武昌区中山路' },
  { id: 3, type: '共享单车乱摆放', time: '2025-11-23 14:18:05', location: '湖北省武汉市洪山区珞喻路' }
])

function onAiClick(item: any) {
  console.log('ai event click:', item)
}

function initAiBarChart() {
  if (!aiBarChartRef.value) return
  const chart = echarts.init(aiBarChartRef.value)
  setScaledOption(chart, {
    backgroundColor: 'transparent',
    grid: { top: 6, right: 8, bottom: 20, left: 72 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(13,50,70,0.92)', borderColor: 'rgba(96,228,255,0.3)', textStyle: { color: '#fff', fontSize: scalePx(11) } },
    xAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: scalePx(10) }, splitLine: { lineStyle: { color: 'rgba(96,228,255,0.08)', type: 'dashed' } } },
    yAxis: {
      type: 'category',
      data: ['其它', '交通拥堵', '共享单车乱摆放', '麻木车经营', '占道摆摊'],
      axisLabel: { color: 'rgba(255,255,255,0.6)', fontSize: scalePx(10) },
      axisLine: { show: false }, axisTick: { show: false }
    },
    series: [{
      type: 'bar', barWidth: scalePx(8),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
          { offset: 0, color: 'rgba(21,186,198,0.9)' },
          { offset: 1, color: 'rgba(21,186,198,0.2)' }
        ]),
        borderRadius: [0, 4, 4, 0]
      },
      label: { show: true, position: 'right', color: '#60E4FF', fontSize: scalePx(10) },
      data: [8, 18, 14, 10, 12]
    }]
  })
}

onMounted(() => nextTick(() => initAiBarChart()))
</script>

<style lang="scss" scoped>
$panel-bg: linear-gradient(180deg, rgba(14, 38, 58, 0.96) 0%, rgba(10, 28, 44, 0.98) 100%);
$border: rgba(21, 186, 198, 0.18);
$accent: #15BAC6;
$text-dim: rgba(255, 255, 255, 0.5);

.ai-panel {
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

    .ai-badge {
      font-size: 1rem; font-weight: bold; color: #fff;
      background: linear-gradient(135deg, #15BAC6, #0d7a82);
      padding: 0.1rem 0.5rem; border-radius: 0.25rem;
    }

    .ai-toggle {
      width: 3rem; height: 1.6rem;
      background: rgba(255,255,255,0.1); border-radius: 1rem;
      position: relative; cursor: pointer; transition: background 0.2s;
      border: 1px solid rgba(255,255,255,0.15);

      .toggle-dot {
        position: absolute; top: 0.2rem; left: 0.2rem;
        width: 1.1rem; height: 1.1rem;
        background: rgba(255,255,255,0.4); border-radius: 50%; transition: all 0.2s;
      }

      &.on {
        background: rgba(21,186,198,0.3); border-color: $accent;
        .toggle-dot { left: calc(100% - 1.3rem); background: #60E4FF; }
      }
    }
  }

  // ── 面板内容区 ────────────────────────────────
  .panel-body {
    flex: 1; min-height: 0;
    display: flex; flex-direction: column;
    padding: 0 1.4rem;
    overflow: hidden;
  }

  // ── 子区域标题 ────────────────────────────────
  .section-title {
    display: flex; align-items: center; gap: 0.45rem;
    padding: 0.65rem 0 0.5rem; flex-shrink: 0;

    .section-bar {
      width: 0.22rem; height: 1rem;
      background: $accent; border-radius: 2px; flex-shrink: 0;
    }
    .section-label { font-size: 1.15rem; color: rgba(255,255,255,0.45); letter-spacing: 0.04em; }
  }

  .section-divider {
    height: 1px;
    background: rgba(21, 186, 198, 0.1);
    flex-shrink: 0; margin: 0.3rem 0;
  }

  // ── 智能发现区域 ──────────────────────────────
  .ai-discover {
    display: flex; align-items: center; gap: 1rem;
    flex-shrink: 0; padding-bottom: 0.4rem;

    .discover-stat {
      display: flex; align-items: baseline; gap: 0.3rem; flex-shrink: 0;
      .discover-num { font-family: DIN, sans-serif; font-size: 3.2rem; font-weight: bold; color: #fff; }
      .discover-unit { font-size: 1.2rem; color: $text-dim; }
      .discover-label { font-size: 1.05rem; color: $text-dim; margin-left: 0.2rem; }
    }

    .ai-bar-chart { flex: 1; height: 10rem; }
  }

  // ── 智能发现列表 ──────────────────────────────
  .ai-list {
    flex: 1; min-height: 0; overflow-y: auto;
    display: flex; flex-direction: column; gap: 0.6rem;
    padding-bottom: 1rem;

    &::-webkit-scrollbar { width: 3px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; }
    &:hover::-webkit-scrollbar-thumb { background: rgba(21, 186, 198, 0.2); }

    .ai-item {
      display: flex; gap: 0.8rem; padding: 0.7rem 0.8rem;
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
      border-radius: 0.3rem; cursor: pointer; transition: all 0.2s; flex-shrink: 0;
      &:hover { border-color: rgba(21,186,198,0.3); background: rgba(21,186,198,0.05); }

      .ai-img {
        width: 6rem; height: 4.5rem; flex-shrink: 0;
        border-radius: 0.3rem; overflow: hidden;
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);

        .ai-img-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.2);
          svg { width: 2.2rem; height: 2.2rem; }
        }
      }

      .ai-info {
        flex: 1; display: flex; flex-direction: column; justify-content: space-between;
        .ai-type { font-size: 1.25rem; color: rgba(255,255,255,0.85); font-weight: 500; }
        .ai-time { font-size: 1.05rem; color: $text-dim; }
        .ai-location { font-size: 1.05rem; color: $text-dim; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      }
    }
  }
}
@media (min-width: 2560px) {
  .ai-panel { width: 25rem; }
}
</style>
