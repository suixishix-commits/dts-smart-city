<template>
  <div class="event-main">
    <EventLeftPanel class="panel-left" @event-click="onEventClick"></EventLeftPanel>
    <EventRightPanel class="panel-right"></EventRightPanel>
    <EventDetailPanel v-model="detailVisible" :data="detailData"></EventDetailPanel>
    <EventAnalysisPopup v-model="analysisVisible" :data="detailData"></EventAnalysisPopup>
  </div>
</template>

<script setup lang="ts">
import emitter from '@/utils/emitter'
import EventAnalysisPopup from './EventAnalysisPopup.vue'

const detailVisible = ref(false)
const analysisVisible = ref(false)
const detailData = ref<any>(null)

function onEventClick(data: any) {
  detailData.value = data
}

emitter.off('event-btn-click')
emitter.on('event-btn-click', (key: any) => {
  if (key === 'refresh') detailVisible.value = true
  if (key === 'camera') analysisVisible.value = true
})

onBeforeUnmount(() => {
  emitter.off('event-btn-click')
})
</script>

<style lang="scss" scoped>
.event-main {
  position: absolute;
  width: 100%;
  height: calc(100% - $titleHeight);
  margin-top: $titleHeight;
  pointer-events: none;
  overflow: visible;

  .panel-left {
    position: absolute;
    left: 0; top: 0;
    height: 100%;
  }

  .panel-right {
    position: absolute;
    right: 0; top: 0;
    height: 100%;
  }
}
</style>
