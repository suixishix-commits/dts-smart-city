<template>
  <div class="detail-card">
    <div class="head">
      <span v-if="detail.tag" class="tag" :style="{ background: detail.tag.color }">{{ detail.tag.text }}</span>
      <h3 class="name">{{ detail.title }}</h3>
      <button type="button" class="close" aria-label="关闭" @click="emit('close')">×</button>
    </div>
    <div v-if="detail.stats?.length" class="stats">
      <StatItem v-for="s in detail.stats" :key="s.label" :label="s.label" :value="s.value" :unit="s.unit" :color="s.color" />
    </div>
    <dl v-if="detail.rows.length" class="info" :class="{ plain: !detail.stats?.length }">
      <template v-for="row in detail.rows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </template>
    </dl>
  </div>
</template>

<script setup lang="ts">
import type { DetailModel } from '@/types/detail'
import StatItem from './StatItem.vue'

defineProps<{ detail: DetailModel }>()
const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<style lang="scss" scoped>
.detail-card {
  width: 300px;
  box-sizing: border-box;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  pointer-events: all;
  border-radius: $radius;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tag {
  flex-shrink: 0;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  color: $bg-page;
}
.name {
  flex-grow: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: $text-strong;
}
.close {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  margin: -10px -12px -10px 0;
  border: 0;
  font-size: 20px;
  color: $text-muted;
  background: none;
  cursor: pointer;
  &:hover {
    color: $text-strong;
  }
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.info {
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid $divider;
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  gap: 8px;
  font-size: $fs-aux;
  line-height: 20px;
  &.plain {
    padding-top: 0;
    border-top: 0;
  }
  dt {
    color: $text-muted;
  }
  dd {
    margin: 0;
    color: $text;
  }
}
</style>
