<template>
  <div class="today-panel">

    <!-- 面板：今日事件 -->
    <div class="panel-block block-event">
      <div class="panel-header">
        <span class="panel-header-arrow">>></span>
        <span class="panel-header-title">今日事件</span>
        <div class="panel-header-actions">
          <span class="action-btn" title="刷新">
            <svg viewBox="0 0 16 16" fill="none"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M13.5 2.5v3h-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span class="action-btn" title="筛选">
            <svg viewBox="0 0 16 16" fill="none"><path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          </span>
        </div>
      </div>

      <div class="total-row">
        <div class="total-gauge-wrap">
          <div class="total-gauge" ref="totalGaugeRef"></div>
          <div class="total-gauge-inner">
            <div class="total-num-row">
              <span class="total-num">2057</span>
              <span class="total-unit">件</span>
            </div>
            <span class="total-label">事件总数</span>
          </div>
        </div>
        <div class="total-tags">
          <div class="tag tag-auto">
            <span class="tag-dot"></span>
            <span class="tag-text">自动研判</span>
            <b>57</b>
          </div>
          <div class="tag tag-warn">
            <span class="tag-dot"></span>
            <span class="tag-text">预警事件</span>
            <b>21</b>
          </div>
          <div class="tag tag-urgent">
            <span class="tag-dot"></span>
            <span class="tag-text">紧急事件</span>
            <b>4</b>
          </div>
        </div>
      </div>

      <!-- 子区域：事件办理 -->
      <div class="section-title">
        <span class="section-bar"></span>
        <span class="section-label">事件办理</span>
      </div>

      <!-- 办结率横条 -->
      <div class="rate-bar">
        <span class="rate-bar-tag">&lt;&lt;</span>
        <span class="rate-bar-label">事件办结率</span>
        <div class="rate-bar-track">
          <div class="rate-bar-fill" style="width: 98%"></div>
        </div>
        <span class="rate-bar-value">98%</span>
      </div>

      <!-- 三个圆环卡片 -->
      <div class="handle-cards">
        <div v-for="item in handleStats" :key="item.label" class="stat-card">
          <div class="stat-ring-wrap">
            <div class="stat-ring" :ref="el => setRingRef(el, item.key)"></div>
            <div class="stat-ring-inner">
              <span class="stat-num">{{ item.num }}</span>
              <span class="stat-unit">件</span>
            </div>
          </div>
          <div class="stat-trend" :class="item.trend > 0 ? 'up' : 'down'">
            {{ item.trend > 0 ? '↑' : '↓' }}{{ Math.abs(item.trend) }}%
          </div>
          <div class="stat-label">{{ item.label }}</div>
        </div>
      </div>
    </div>

    <!-- 面板：今日事件来源 -->
    <div class="panel-block block-source">
      <div class="panel-header">
        <span class="panel-header-arrow">>></span>
        <span class="panel-header-title">今日事件来源</span>
      </div>
      <div class="source-grid">
        <div v-for="item in eventSources" :key="item.label" class="source-item"
          :style="{ background: `linear-gradient(180deg, ${item.bgFrom} 0%, ${item.bgTo} 100%)`, borderColor: item.color + '33' }">
          <div class="source-label">{{ item.label }}</div>
          <div class="source-bottom">
            <span class="source-num" :style="{ color: item.color }">{{ item.num }}</span>
            <span class="source-unit" :style="{ color: item.color }">件</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { setScaledOption } from '@/utils/viewportScale'
import * as echarts from 'echarts'

const totalGaugeRef = ref<HTMLElement>()
const ringRefs: Record<string, HTMLElement> = {}

function setRingRef(el: any, key: string) {
  if (el) ringRefs[key] = el
}

function initTotalGauge() {
  if (!totalGaugeRef.value) return
  const chart = echarts.init(totalGaugeRef.value)
  setScaledOption(chart, {
    backgroundColor: 'transparent',
    series: [
      {
        // 最外装饰虚线圈
        type: 'pie', radius: ['88%', '90%'], center: ['50%', '50%'],
        label: { show: false }, silent: true,
        data: [
          { value: 75, itemStyle: { color: 'rgba(21,186,198,0.35)' } },
          { value: 5,  itemStyle: { color: 'transparent' } },
          { value: 75, itemStyle: { color: 'rgba(21,186,198,0.35)' } },
          { value: 5,  itemStyle: { color: 'transparent' } },
          { value: 75, itemStyle: { color: 'rgba(21,186,198,0.35)' } },
          { value: 5,  itemStyle: { color: 'transparent' } },
          { value: 75, itemStyle: { color: 'rgba(21,186,198,0.35)' } },
          { value: 5,  itemStyle: { color: 'transparent' } }
        ]
      },
      {
        // 主光环
        type: 'pie', radius: ['74%', '82%'], center: ['50%', '50%'],
        label: { show: false }, silent: true,
        data: [
          { value: 100, itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
              { offset: 0, color: '#60E4FF' },
              { offset: 0.5, color: '#15BAC6' },
              { offset: 1, color: 'rgba(21,186,198,0.3)' }
            ])
          }}
        ]
      },
      {
        // 内侧细圈
        type: 'pie', radius: ['68%', '70%'], center: ['50%', '50%'],
        label: { show: false }, silent: true,
        data: [
          { value: 100, itemStyle: { color: 'rgba(21,186,198,0.15)' } }
        ]
      }
    ]
  })
}

const handleStats = ref([
  { key: 'done', label: '已办结总量', num: 84, trend: 23, color: '#15BAC6', pct: 65 },
  { key: 'undone', label: '未办结总量', num: 45, trend: 7, color: '#FFB347', pct: 35 },
  { key: 'overdue', label: '超期未办结', num: 12, trend: -2, color: '#FF6B6B', pct: 9 }
])

const eventSources = ref([
  { label: '市民热线',   num: 12, color: '#15BAC6', bgFrom: 'rgba(21,186,198,0.25)',  bgTo: 'rgba(21,186,198,0.05)' },
  { label: '市公安交管局', num: 45, color: '#15BAC6', bgFrom: 'rgba(21,186,198,0.25)',  bgTo: 'rgba(21,186,198,0.05)' },
  { label: '120急救',   num: 17, color: '#FF6B6B', bgFrom: 'rgba(255,107,107,0.3)',  bgTo: 'rgba(255,107,107,0.05)' },
  { label: '城管执法',   num: 23, color: '#15BAC6', bgFrom: 'rgba(21,186,198,0.25)',  bgTo: 'rgba(21,186,198,0.05)' },
  { label: '网络舆情',   num: 54, color: '#15BAC6', bgFrom: 'rgba(21,186,198,0.25)',  bgTo: 'rgba(21,186,198,0.05)' },
  { label: '其它',     num: 12, color: '#FFB347', bgFrom: 'rgba(255,179,71,0.3)',   bgTo: 'rgba(255,179,71,0.05)' }
])

function initRingCharts() {
  handleStats.value.forEach(item => {
    const el = ringRefs[item.key]
    if (!el) return
    const chart = echarts.init(el)
    setScaledOption(chart, {
      backgroundColor: 'transparent',
      series: [{
        type: 'pie', radius: ['62%', '78%'], center: ['50%', '50%'],
        label: { show: false }, silent: true,
        data: [
          { value: item.pct, itemStyle: { color: item.color } },
          { value: 100 - item.pct, itemStyle: { color: 'rgba(255,255,255,0.06)' } }
        ]
      }]
    })
  })
}

onMounted(() => {
  nextTick(() => {
    initTotalGauge()
    initRingCharts()
  })
})
</script>

<style lang="scss" scoped>
$panel-bg: linear-gradient(180deg, rgba(14, 38, 58, 0.96) 0%, rgba(10, 28, 44, 0.98) 100%);
$border: rgba(21, 186, 198, 0.18);
$accent: #15BAC6;
$text-dim: rgba(255, 255, 255, 0.5);

.today-panel {
  width: 38rem;
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0.6rem;

  // ── 面板容器 ──────────────────────────────────
  .panel-block {
    background: $panel-bg;
    border: 1px solid $border;
    border-radius: 0.4rem;
    overflow: hidden;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .block-event  { flex: 58; }
  .block-source { flex: 42; }

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

    .panel-header-actions {
      display: flex; gap: 0.4rem;
      .action-btn {
        width: 2.2rem; height: 2.2rem;
        display: flex; align-items: center; justify-content: center;
        border: 1px solid $border; border-radius: 0.3rem;
        color: rgba(255,255,255,0.45); cursor: pointer; transition: all 0.2s;
        svg { width: 1.2rem; height: 1.2rem; }
        &:hover { border-color: $accent; color: #60E4FF; }
      }
    }
  }

  // ── 面板内容区 ────────────────────────────────
  .block-event > :not(.panel-header) { padding: 0 1.4rem; }
  .block-source > :not(.panel-header) { padding: 0 1.4rem; }

  .total-row {
    display: flex; align-items: center; gap: 1.2rem;
    padding-top: 0.8rem; padding-bottom: 0.6rem; flex-shrink: 0;

    .total-gauge-wrap {
      position: relative;
      width: 11rem; height: 11rem; flex-shrink: 0;

      .total-gauge { width: 100%; height: 100%; }

      .total-gauge-inner {
        position: absolute; inset: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 1; pointer-events: none;

        .total-num-row {
          display: flex; align-items: baseline; gap: 0.2rem;
          .total-num { font-family: DIN, sans-serif; font-size: 2.8rem; font-weight: bold; color: #fff; line-height: 1; }
          .total-unit { font-size: 1.1rem; color: $text-dim; }
        }
        .total-label { font-size: 1rem; color: $text-dim; margin-top: 0.3rem; }
      }
    }

    .total-tags {
      flex: 1;
      display: flex; flex-direction: column; gap: 0.4rem;

      .tag {
        display: flex; align-items: center; gap: 0.55rem;
        padding: 0.35rem 0.7rem; border-radius: 0.25rem;

        .tag-dot {
          width: 0.7rem; height: 0.7rem; border-radius: 50%; flex-shrink: 0;
        }
        .tag-text { font-size: 1.1rem; color: rgba(255,255,255,0.65); flex: 1; }
        b { font-family: DIN, sans-serif; font-size: 1.3rem; font-weight: bold; }

        &.tag-auto {
          background: rgba(21,186,198,0.1); border: 1px solid rgba(21,186,198,0.2);
          .tag-dot { background: #15BAC6; } b { color: #60E4FF; }
        }
        &.tag-warn {
          background: rgba(255,179,71,0.1); border: 1px solid rgba(255,179,71,0.2);
          .tag-dot { background: #FFB347; } b { color: #FFB347; }
        }
        &.tag-urgent {
          background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.2);
          .tag-dot { background: #FF6B6B; } b { color: #FF6B6B; }
        }
      }
    }
  }

  // ── 子区域标题 ────────────────────────────────
  .section-title {
    display: flex; align-items: center; gap: 0.45rem;
    padding-top: 0.5rem; padding-bottom: 0.5rem; flex-shrink: 0;
    .section-bar {
      width: 0.22rem; height: 1rem;
      background: $accent; border-radius: 2px; flex-shrink: 0;
    }
    .section-label {
      font-size: 1.1rem; color: rgba(255,255,255,0.45); letter-spacing: 0.04em;
    }
  }

  // ── 办结率横条 ────────────────────────────────
  .rate-bar {
    display: flex; align-items: center; gap: 0.6rem;
    background: rgba(21, 186, 198, 0.06);
    border: 1px solid rgba(21, 186, 198, 0.12);
    border-radius: 0.3rem;
    padding: 0.7rem 0.8rem;
    flex-shrink: 0;

    .rate-bar-tag {
      font-size: 1rem; color: $accent;
      font-weight: bold; letter-spacing: -0.05em; flex-shrink: 0;
    }

    .rate-bar-label {
      font-size: 1.1rem; color: rgba(255,255,255,0.55); flex-shrink: 0;
    }

    .rate-bar-track {
      flex: 1; height: 4px;
      background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;

      .rate-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, $accent, #60E4FF);
        border-radius: 2px;
      }
    }

    .rate-bar-value {
      font-family: DIN, sans-serif; font-size: 1.8rem; font-weight: bold;
      color: #60E4FF; flex-shrink: 0; line-height: 1;
    }
  }

  // ── 三圆环卡片 ────────────────────────────────
  .handle-cards {
    flex: 1; min-height: 0;
    display: flex; gap: 0.6rem;
    padding: 0.5rem 0 0.8rem;

    .stat-card {
      flex: 1;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 0.4rem;
      padding: 0.8rem 0.4rem;
      gap: 0.4rem;

      .stat-ring-wrap {
        position: relative;
        width: 6.5rem; height: 6.5rem; flex-shrink: 0;

        .stat-ring { width: 100%; height: 100%; }

        .stat-ring-inner {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          flex-direction: row; gap: 0.1rem;
          z-index: 1; pointer-events: none;

          .stat-num {
            font-family: DIN, sans-serif; font-size: 1.7rem;
            font-weight: bold; color: #fff; line-height: 1;
          }
          .stat-unit {
            font-size: 0.95rem; color: $text-dim; align-self: flex-end; margin-bottom: 0.15rem;
          }
        }
      }

      .stat-trend {
        font-size: 1.05rem;
        &.up { color: #4AE8A0; }
        &.down { color: #FF6B6B; }
      }

      .stat-label {
        font-size: 1rem; color: $text-dim; text-align: center;
      }
    }
  }

  .source-grid {
    flex: 1; min-height: 0;
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;
    align-content: start; padding-top: 0.8rem; padding-bottom: 0.8rem;

    .source-item {
      display: flex; flex-direction: column; justify-content: space-between;
      border: 1px solid; border-radius: 0.3rem;
      padding: 0.6rem 0.8rem 0.5rem;
      min-height: 5rem;

      .source-label {
        font-size: 1.1rem; font-weight: 600;
        color: rgba(255,255,255,0.9); line-height: 1.3;
      }

      .source-bottom {
        display: flex; align-items: baseline; gap: 0.2rem; margin-top: 0.4rem;

        .source-num {
          font-family: DIN, sans-serif; font-size: 2.2rem;
          font-weight: bold; line-height: 1;
        }
        .source-unit {
          font-size: 1rem; opacity: 0.8;
        }
      }
    }
  }
}
@media (min-width: 2560px) {
  .today-panel { width: 25rem; }
}
</style>
