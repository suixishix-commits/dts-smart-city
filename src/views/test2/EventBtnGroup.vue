<template>
  <div class="event-btn-group">
    <div
      v-for="btn in btnList"
      :key="btn.key"
      class="icon-btn"
      :class="{ active: activeBtn === btn.key }"
      :title="btn.title"
      @click="onBtnClick(btn.key)"
    >
      <svg viewBox="0 0 24 24" fill="none" v-html="btn.svg"></svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import emitter from '@/utils/emitter'

const activeBtn = ref('')

function onBtnClick(key: string) {
  activeBtn.value = key
  emitter.emit('event-btn-click', key)
}

const btnList = [
  {
    key: 'refresh', title: '刷新',
    svg: '<path d="M20 11A9 9 0 1 1 11 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M20 2v5h-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    key: 'camera', title: '摄像头',
    svg: '<rect x="2" y="6" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M16 10l6-3v10l-6-3V10z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
  },
  {
    key: 'measure', title: '量算',
    svg: '<path d="M3 21L21 3M8 3H3v5M21 16v5h-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    key: 'search', title: '搜索',
    svg: '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
  },
  {
    key: 'weather', title: '天气',
    svg: '<path d="M18 10a6 6 0 1 0-11.94 1H6a4 4 0 0 0 0 8h12a3 3 0 0 0 0-6h-.06A6.01 6.01 0 0 0 18 10z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
  }
]
</script>

<style lang="scss" scoped>
$border: rgba(21, 186, 198, 0.18);
$accent: #15BAC6;

.event-btn-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 0.4rem;
  pointer-events: all;

  .icon-btn {
    width: 3.6rem;
    height: 3.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(14, 38, 58, 0.88);
    border: 1px solid $border;
    border-radius: 0.4rem;
    color: rgba(255, 255, 255, 0.45);
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;

    svg { width: 1.8rem; height: 1.8rem; }

    &:hover {
      border-color: $accent;
      color: #60E4FF;
      background: rgba(21, 186, 198, 0.1);
    }

    &.active {
      border-color: $accent;
      color: #60E4FF;
      background: rgba(21, 186, 198, 0.15);
      box-shadow: 0 0 8px rgba(21, 186, 198, 0.25);
    }
  }
}
</style>
