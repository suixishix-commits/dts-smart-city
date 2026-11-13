<template>
  <CollapsiblePanel side="left" group="event-panels" linkage="sync">
    <MultiColLayout :cols="leftCols" class="event-left" :auto-wrap="false">
      <template #col-0><EventTodayPanel /></template>
      <template #col-1><EventAnalysisPanel /></template>
    </MultiColLayout>
  </CollapsiblePanel>
</template>

<script setup lang="ts">
import CollapsiblePanel from '@/components/CollapsiblePanel.vue'
import MultiColLayout from '@/components/MultiColLayout.vue'
import EventAnalysisPanel from './EventAnalysisPanel.vue'
import EventTodayPanel from './EventTodayPanel.vue'

defineEmits(['event-click'])

const leftCols = [{ padding: '1rem 0.6rem' }, { padding: '1rem 0.6rem' }]
</script>

<style lang="scss" scoped>
.event-left {
  pointer-events: all;
}
</style>
