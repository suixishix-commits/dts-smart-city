<template>
  <div class="dept-panel">

    <!-- 面板：处置部门 TOP5/10 -->
    <div class="panel-block block-dept">
      <div class="panel-header">
        <span class="panel-header-arrow">>></span>
        <span class="panel-header-title">处置部门</span>
        <div class="top-tabs">
          <span :class="['tab', topN === 5 ? 'active' : '']" @click="topN = 5">TOP5</span>
          <span :class="['tab', topN === 10 ? 'active' : '']" @click="topN = 10">TOP10</span>
        </div>
      </div>
      <div class="dept-list">
        <div v-for="(item, i) in deptList.slice(0, topN)" :key="item.name" class="dept-item">
          <span class="dept-rank" :class="i < 3 ? 'top3' : ''">{{ i + 1 }}</span>
          <span class="dept-name">{{ item.name }}</span>
          <span class="dept-num">{{ item.num }}件</span>
          <div class="dept-bar-wrap">
            <div class="dept-bar-fill" :style="{ width: (item.num / deptList[0].num * 100) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 面板：12345 每周简报 -->
    <div class="panel-block block-report">
      <div class="panel-header">
        <span class="panel-header-arrow">>></span>
        <span class="panel-header-title">12345 每周简报</span>
      </div>
      <div class="report-list">
        <div v-for="item in reports" :key="item.id" class="report-item">
          <span class="report-id">第 {{ item.id }} 期</span>
          <span class="report-date">{{ item.date }}</span>
          <span class="report-arrow">›</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
const topN = ref(5)

const deptList = ref([
  { name: '市场监督管理局', num: 548 },
  { name: '社会保障', num: 451 },
  { name: '城市管理执法局', num: 386 },
  { name: '公安交管部门', num: 312 },
  { name: '环境保护局', num: 278 },
  { name: '住房建设局', num: 234 },
  { name: '卫生健康委', num: 198 },
  { name: '交通运输局', num: 176 },
  { name: '民政局', num: 154 },
  { name: '教育局', num: 132 }
])

const reports = ref([
  { id: 108, date: '2026/12/20' },
  { id: 107, date: '2026/12/18' },
  { id: 106, date: '2026/12/13' },
  { id: 105, date: '2026/12/11' },
  { id: 104, date: '2026/12/06' }
])
</script>

<style lang="scss" scoped>
$panel-bg: linear-gradient(180deg, rgba(14, 38, 58, 0.96) 0%, rgba(10, 28, 44, 0.98) 100%);
$border: rgba(21, 186, 198, 0.18);
$accent: #15BAC6;
$text-dim: rgba(255, 255, 255, 0.5);

.dept-panel {
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

  .block-dept   { flex: 3; }
  .block-report { flex: 2; }

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

    .top-tabs {
      display: flex; gap: 0.3rem;
      .tab {
        font-size: 1.1rem; color: $text-dim;
        padding: 0.15rem 0.6rem; border-radius: 0.25rem;
        cursor: pointer; border: 1px solid transparent; transition: all 0.2s;
        &.active { background: rgba(21,186,198,0.15); color: #60E4FF; border-color: rgba(21,186,198,0.3); }
      }
    }
  }

  // ── 处置部门列表 ──────────────────────────────
  .dept-list {
    flex: 1; min-height: 0; overflow-y: auto;
    display: flex; flex-direction: column; gap: 0.6rem;
    padding: 0.8rem 1.4rem;

    &::-webkit-scrollbar { width: 3px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; }
    &:hover::-webkit-scrollbar-thumb { background: rgba(21, 186, 198, 0.2); }

    .dept-item {
      display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0;

      .dept-rank {
        font-family: DIN, sans-serif; font-size: 1.2rem; color: $text-dim;
        width: 1.8rem; flex-shrink: 0; text-align: center;
        &.top3 { color: #FFB347; font-weight: bold; }
      }
      .dept-name {
        font-size: 1.15rem; color: rgba(255,255,255,0.8);
        flex: 1;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .dept-num {
        font-family: DIN, sans-serif; font-size: 1.15rem; color: #60E4FF;
        width: 4.5rem; flex-shrink: 0; text-align: right;
      }
      .dept-bar-wrap {
        width: 5rem; flex-shrink: 0; height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px;
        .dept-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, $accent, rgba(21,186,198,0.3));
          border-radius: 2px; transition: width 0.6s ease;
        }
      }
    }
  }

  // ── 每周简报列表 ──────────────────────────────
  .report-list {
    flex: 1; min-height: 0; overflow-y: auto;
    display: flex; flex-direction: column;
    padding: 0 1.4rem;

    .report-item {
      display: flex; align-items: center; height: 3.6rem; flex-shrink: 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      cursor: pointer; transition: background 0.2s;
      padding: 0 0.4rem; border-radius: 0.25rem;
      &:last-child { border-bottom: none; }
      &:hover { background: rgba(21,186,198,0.06); }

      .report-id { font-size: 1.25rem; color: rgba(255,255,255,0.8); flex: 1; }
      .report-date { font-family: DIN, sans-serif; font-size: 1.15rem; color: $text-dim; }
      .report-arrow { font-size: 1.4rem; color: rgba(21,186,198,0.5); margin-left: 0.6rem; }
    }
  }
}
@media (min-width: 2560px) {
  .dept-panel { width: 25rem; }
}
</style>
