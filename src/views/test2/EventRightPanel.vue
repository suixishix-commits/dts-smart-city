<template>
  <CollapsiblePanel side="right" group="event-panels" linkage="sync">
    <template #widget>
      <EventBtnGroup></EventBtnGroup>
    </template>
    <MultiColLayout :cols="rightCols" class="event-right" :auto-wrap="false">
      <template #col-0>
        <EventAiPanel />
      </template>
      <template #col-1>
        <div class="col-stats">
          <EventStreetPanel />
          <EventDeptPanel />
        </div>
      </template>
    </MultiColLayout>
  </CollapsiblePanel>
</template>

<script setup lang="ts">
import CollapsiblePanel from '@/components/CollapsiblePanel.vue'
import MultiColLayout from '@/components/MultiColLayout.vue'
import EventAiPanel from './EventAiPanel.vue'
import EventBtnGroup from './EventBtnGroup.vue'
import EventDeptPanel from './EventDeptPanel.vue'
import EventStreetPanel from './EventStreetPanel.vue'

const rightCols = [{ padding: '1rem 0.6rem' }, { padding: '1rem 0.8rem 1rem 0.2rem' }]
</script>

<style lang="scss" scoped>
.event-right {
  pointer-events: all;
}

// col-stats 内部两个子组件按比例分配高度（宽屏横排时生效）
.col-stats {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;

  > :nth-child(1) {
    flex: 55;
    min-height: 0;
  }
  > :nth-child(2) {
    flex: 45;
    min-height: 0;
  }
}
</style>
