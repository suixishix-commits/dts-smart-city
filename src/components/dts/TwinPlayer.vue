<template>
  <div class="twin-player">
    <RtcPlayer class="rtc_player" player-variable="__xapi"></RtcPlayer>
    <RtcPlayer class="twin_rtc_player" player-variable="__xapi2" v-if="twinPlayerVisible"></RtcPlayer>
  </div>
</template>

<script setup lang="ts">
import store from '@/stores'
import MultiSceneLinkageHandler from './handler/MultiSceneLinkageHandler'

// 镜像场景是否可见
const twinPlayerVisible = ref(false)

//监听双屏
watch(
  () => store.dtsStore.twinPlayerVisible,
  (newValue, oldValue) => {
    if (newValue) {
      twinPlayerVisible.value = true
      // 启动多屏联动
      MultiSceneLinkageHandler.register(['__xapi', '__xapi2'])
    } else {
      twinPlayerVisible.value = false
      // 取消多屏联动
      MultiSceneLinkageHandler.unRegister()
    }
  }
)

onMounted(() => {
  twinPlayerVisible.value = store.dtsStore.twinPlayerVisible ? true : false
  if (twinPlayerVisible.value) {
    // 启动多屏联动
    MultiSceneLinkageHandler.register(['__xapi', '__xapi2'])
  }
  //console.log('镜像场景是否可见:', store.dtsStore.twinPlayerVisible, twinPlayerVisible.value)
})
</script>

<style lang="scss" scoped>
.twin-player {
  position: absolute;
  display: flex;
  pointer-events: all;
  width: 100%;
  height: 100%;
  z-index: 0;
  .rtc_player {
    position: relative;
  }
  .twin_rtc_player {
    position: relative;
  }
}
</style>
