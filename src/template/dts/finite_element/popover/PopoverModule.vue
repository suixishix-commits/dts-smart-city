<template>
  <div class="popoverStyle">
    <div v-for="(item, index) in btnList" :key="index" class="btn">
      <el-popover ref="popover" placement="left" :width="scalePx(200)" :teleported="false" trigger="hover">
        <template #reference>
          <el-button class="m-2">{{ item.name }}</el-button>
        </template>
        <div class="popoverContent">
          <PopoverChild :text="item.name" :clickItem="clickItem" :timeAndMoXing="timeAndMoXing"></PopoverChild>
        </div>
      </el-popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { scalePx } from '@/utils/viewportScale'
import emitter from '@/utils/emitter'
import { ref, watch } from 'vue'
// 属性定义
const props = defineProps({
  childValue: {
    type: Object,
    default: {}
  }
})
// 传进去的编号和模型
const timeAndMoXing = ref({
  cycleId: '20241216',
  model: '二江泄水闸'
})
const clickItem: any = ref('')
const btnList = [
  { name: '温度场', value: 'temperature' },
  { name: '应力场', value: 'stress' },
  { name: '位移场', value: 'displacement' },
  { name: '渗流场', value: 'seepage' }
]
emitter.off('event-name')
emitter.on('event-name', (val: any) => {
  console.log('val', val)
  clickItem.value = val.name
})
onBeforeUnmount(() => {
  emitter.off('event-name')
})
</script>

<style scoped lang="scss">
.popoverStyle {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  // gap: 2rem;
  justify-content: space-between;

  :deep(.btn) {
    width: 100%;
    height: 3.4rem;
    background: url('@/assets/autoplay/popover-blue.png') no-repeat center center / 100% 100%;
    // background-color: red;

    .el-button {
      width: 100%;
      height: 3.4rem;
      border: 0;
      background-color: rgba(0, 0, 0, 0);
      background: none;
      color: aliceblue;
    }

    .el-popper {
      width: 19rem !important;
      // height: 19.7rem;
      padding: 0 !important;
      background-color: rgba(0, 0, 0, 0);
      border: 0;
      box-shadow: 0 0 0;
      margin-top: 0rem !important;

      .el-popper__arrow {
        display: none;
        // background-color:  rgba(0, 0, 0, 0);
      }

      .popoverContent {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 1.2rem;
        background: url('@/assets/autoplay/popover-reference.png') no-repeat center center / 100% 100%;
      }
    }
  }

  .btn:hover {
    background: url('@/assets/autoplay/popover-green.png') no-repeat center center / 100% 100% !important;
  }
}
</style>
