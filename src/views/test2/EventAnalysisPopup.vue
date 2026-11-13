<template>
  <el-dialog
    v-model="visible"
    title="事件分析"
    :width="'50rem'"
    draggable
    append-to-body
    :close-on-click-modal="false"
    class="event-analysis-dialog"
    @closed="$emit('close')"
  >
    <div class="detail-body">
      <!-- 满意度分析 -->
      <div class="section">
        <div class="section-title">满意度分析</div>
        <div ref="heatChartRef" class="heat-chart"></div>
      </div>

      <div class="divider"></div>

      <!-- 智能热搜词 -->
      <div class="section">
        <div class="section-title">智能热搜词</div>
        <div class="keyword-tabs">
          <span
            v-for="cat in keywordCats" :key="cat"
            :class="['kw-tab', activeCat === cat ? 'active' : '']"
            @click="activeCat = cat"
          >{{ cat }}</span>
        </div>
        <div class="keyword-cloud">
          <span
            v-for="kw in filteredKeywords" :key="kw.word"
            class="kw-item"
            :style="{ fontSize: kw.size + 'rem', color: kw.color, opacity: 0.6 + kw.weight * 0.4 }"
            @click="onKeywordClick(kw)"
          >{{ kw.word }}</span>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { scalePx, setScaledOption } from '@/utils/viewportScale'
import * as echarts from 'echarts'

const props = defineProps<{ modelValue: boolean; data?: any }>()
const emit = defineEmits(['update:modelValue', 'close'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const heatChartRef = ref<HTMLElement>()
const activeCat = ref('全部')

const keywordCats = ['全部', '安全隐患', '城市管理', '民生服务']

const keywords = ref([
  { word: '交通安全', size: 1.6, weight: 1, color: '#FF6B6B', cat: '安全隐患' },
  { word: '交通事故', size: 1.4, weight: 0.9, color: '#FF6B6B', cat: '安全隐患' },
  { word: '交通拥堵', size: 1.3, weight: 0.8, color: '#FFB347', cat: '城市管理' },
  { word: '消防安全', size: 1.5, weight: 0.95, color: '#FF6B6B', cat: '安全隐患' },
  { word: '119警情', size: 1.2, weight: 0.75, color: '#FF6B6B', cat: '安全隐患' },
  { word: '消防通道占用', size: 1.3, weight: 0.8, color: '#FFB347', cat: '城市管理' },
  { word: '占道经营', size: 1.2, weight: 0.7, color: '#FFB347', cat: '城市管理' },
  { word: '噪音扰民', size: 1.1, weight: 0.6, color: '#A78BFA', cat: '民生服务' },
  { word: '垃圾清运', size: 1.1, weight: 0.6, color: '#4AE8A0', cat: '城市管理' },
  { word: '路灯故障', size: 1.0, weight: 0.55, color: '#60E4FF', cat: '民生服务' },
  { word: '供水异常', size: 1.0, weight: 0.5, color: '#60E4FF', cat: '民生服务' },
  { word: '违章停车', size: 1.2, weight: 0.7, color: '#FFB347', cat: '城市管理' }
])

const filteredKeywords = computed(() =>
  activeCat.value === '全部' ? keywords.value : keywords.value.filter(k => k.cat === activeCat.value)
)

function onKeywordClick(kw: any) {
  console.log('keyword click:', kw.word)
}

function initHeatChart() {
  if (!heatChartRef.value) return
  const chart = echarts.init(heatChartRef.value)
  const types = ['交通事故', '环境卫生', '城市管理', '劳资纠纷', '消防安全']
  const data: [number, number, number][] = []
  types.forEach((_, y) => {
    for (let x = 0; x <= 10; x++) {
      data.push([x, y, Math.round(Math.random() * 100)])
    }
  })
  setScaledOption(chart, {
    backgroundColor: 'transparent',
    grid: { top: 8, right: 12, bottom: 28, left: 80 },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(13,50,70,0.92)',
      borderColor: 'rgba(96,228,255,0.3)',
      textStyle: { color: '#fff', fontSize: scalePx(11) },
      formatter: (p: any) => `满意度: ${p.data[0] * 10}%<br/>数量: ${p.data[2]}`
    },
    xAxis: {
      type: 'category',
      data: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
      name: '满意度',
      nameTextStyle: { color: 'rgba(255,255,255,0.4)', fontSize: scalePx(10) },
      axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: scalePx(9) },
      axisLine: { lineStyle: { color: 'rgba(96,228,255,0.15)' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'category', data: types,
      axisLabel: { color: 'rgba(255,255,255,0.6)', fontSize: scalePx(10) },
      axisLine: { show: false }, axisTick: { show: false }
    },
    visualMap: {
      min: 0, max: 100, show: false,
      inRange: { color: ['rgba(21,186,198,0.05)', 'rgba(21,186,198,0.3)', 'rgba(21,186,198,0.8)'] }
    },
    series: [{ type: 'heatmap', data, itemStyle: { borderWidth: scalePx(1), borderColor: 'rgba(0,0,0,0.3)' } }]
  })
}

watch(visible, (val) => {
  if (val) nextTick(() => initHeatChart())
})
</script>

<style lang="scss">
.event-analysis-dialog {
  $accent: #15BAC6;
  $border: rgba(21, 186, 198, 0.3);
  $text-dim: rgba(255, 255, 255, 0.5);

  background: linear-gradient(160deg, rgba(14, 42, 62, 0.97) 0%, rgba(10, 30, 46, 0.98) 100%) !important;
  border: 1px solid $border !important;
  border-radius: 0.5rem !important;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(21, 186, 198, 0.1) !important;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, $accent 0%, rgba(21,186,198,0.05) 100%);
    border-radius: 0.5rem 0.5rem 0 0;
    z-index: 1;
  }

  .el-dialog__header {
    display: flex; align-items: center;
    height: 4.8rem; padding: 0 1.4rem;
    margin: 0;
    background: rgba(21, 186, 198, 0.08);
    border-bottom: 1px solid rgba(21, 186, 198, 0.15);

    &::before {
      content: '';
      width: 0.3rem; height: 1.5rem;
      background: linear-gradient(180deg, $accent 0%, rgba(21,186,198,0.15) 100%);
      border-radius: 2px; flex-shrink: 0;
      margin-right: 0.7rem;
    }

    .el-dialog__title {
      font-family: YouSheBiaoTiHei, sans-serif;
      font-size: 1.7rem; letter-spacing: 0.08em;
      background: linear-gradient(180deg, #e8f8ff 0%, #7dd8e8 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }

    .el-dialog__headerbtn {
      top: 50%; transform: translateY(-50%);
      width: 2.6rem; height: 2.6rem;
      border-radius: 0.3rem; transition: all 0.2s;
      .el-dialog__close { color: rgba(255,255,255,0.4); font-size: 1.4rem; }
      &:hover { background: rgba(255,107,107,0.1); .el-dialog__close { color: #FF6B6B; } }
    }
  }

  .el-dialog__body {
    padding: 0;
  }

  .detail-body {
    padding: 1.2rem 1.4rem;
    max-height: 70vh;
    overflow-y: auto;
    &::-webkit-scrollbar { width: 3px; }
    &::-webkit-scrollbar-thumb { background: rgba(21,186,198,0.25); border-radius: 2px; }
  }

  .section {
    margin-bottom: 0.4rem;
    .section-title {
      font-size: 1.2rem; color: rgba(255,255,255,0.45);
      margin-bottom: 0.7rem;
      display: flex; align-items: center; gap: 0.5rem;
      &::before {
        content: ''; display: inline-block;
        width: 0.25rem; height: 1.1rem;
        background: $accent; border-radius: 2px;
      }
    }
  }

  .divider {
    height: 1px;
    background: linear-gradient(90deg, rgba(21,186,198,0.3) 0%, rgba(21,186,198,0.03) 100%);
    margin: 1rem 0;
  }

  .heat-chart { width: 100%; height: 14rem; }

  .keyword-tabs {
    display: flex; gap: 0.4rem; margin-bottom: 0.8rem;
    .kw-tab {
      font-size: 1.1rem; color: $text-dim;
      padding: 0.2rem 0.7rem; border-radius: 0.25rem;
      cursor: pointer; border: 1px solid transparent; transition: all 0.2s;
      &.active { background: rgba(21,186,198,0.15); color: #60E4FF; border-color: rgba(21,186,198,0.3); }
    }
  }

  .keyword-cloud {
    display: flex; flex-wrap: wrap; gap: 0.6rem 0.8rem; padding: 0.4rem 0;
    .kw-item {
      cursor: pointer; font-family: OPPOSans, sans-serif;
      transition: opacity 0.2s, transform 0.2s;
      &:hover { opacity: 1 !important; transform: scale(1.08); }
    }
  }
}
</style>
