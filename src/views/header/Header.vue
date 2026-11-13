<template>
  <div id="layout-header">
    <ModuleButton></ModuleButton>
    <DateUI class="date-time"></DateUI>
    <Weather class="weather"></Weather>
  </div>
</template>

<script lang="ts" setup>
import store from '@/stores/index'
import emitter from '@/utils/emitter'

/**属性定义 */
const props = defineProps({
  moduleName: {
    type: String,
    default: 'lyts',
    required: false
  },
  shadow: {
    type: String,
    default: 'shadow',
    required: false
  }
})

onMounted(() => {})
onBeforeUnmount(() => {})
</script>

<style lang="scss" scoped>
//标题栏最外层容器
#layout-header {
  position: absolute;
  top: 0;
  z-index: 999;
  width: 100%;
  height: $titleHeight;
  float: left;
  background: url('@/assets/framework/title.png') no-repeat center center / 100% 100%;

  .date-time {
    position: absolute;
    top: 50%;
    left: 3rem;
    transform: translateY(-50%);
  }
  .weather {
    position: absolute;
    right: 3rem;
    top: 50%;
    transform: translateY(-50%);
  }
}
</style>
