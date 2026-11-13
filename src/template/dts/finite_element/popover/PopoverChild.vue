<template>
  <div class="childStyle">
    <div class="son temperature" v-if="text == '温度场'">
      <div class="item" :class="clickItem == item.name ? 'selectedNode' : ''" v-for="(item, index) in temperatureList" :key="index" @click="itemClick(item)">
        {{ item.name }}
      </div>
    </div>
    <div class="son stress" v-if="text == '应力场'">
      <div class="item" :class="clickItem == item.name ? 'selectedNode' : ''" v-for="(item, index) in stressList" :key="index" @click="itemClick(item)">
        {{ item.name }}
      </div>
    </div>
    <div class="son displacement" v-if="text == '位移场'">
      <div class="item" :class="clickItem == item.name ? 'selectedNode' : ''" v-for="(item, index) in displacementList" :key="index" @click="itemClick(item)">
        {{ item.name }}
      </div>
    </div>
    <div class="son seepage" v-if="text == '渗流场'">
      <div class="item" :class="clickItem == item.name ? 'selectedNode' : ''" v-for="(item, index) in seepageList" :key="index" @click="itemClick(item)">
        {{ item.name }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProjectFiniteElement from '@/template/dts/finite_element/ProjectFiniteElement'
import emitter from '@/utils/emitter'
import DtsFacade from '@/components/dts/DtsFacade'
// 属性定义
const props = defineProps({
  text: {
    type: String,
    default: ''
  },
  clickItem: {
    type: String,
    default: () => ''
  },
  timeAndMoXing: {
    type: Object,
    default: () => {
      return { cycleId: '', model: '' }
    }
  }
})

const moXingMap: any = {
  全坝模型: 'gzb',
  二江泄水闸: 'ejxsz',
  二江泄水闸速算: 'ejxszss',
  二江电站: 'ejdz',
  三江泄水闸: 'sjxsz'
}
// const moXing: any = ref('')
const cycleId: any = ref('default')
// 温度场
const temperatureList: any = ref([{ name: '温度', value: 's22', type: 'TEMPERATURE' }])
// 应力场
const stressList: any = ref([
  { name: '正应力X', value: 's22', type: 'STRESS' },
  { name: '正应力Y', value: 's33', type: 'STRESS' },
  { name: '正应力Z', value: 's12', type: 'STRESS' },
  { name: '剪应力XY', value: 's13', type: 'STRESS' },
  { name: '剪应力YZ', value: 's23', type: 'STRESS' },
  { name: '剪应力XZ', value: 'd1', type: 'STRESS' },
  { name: '主应力1', value: 'd2', type: 'STRESS' },
  { name: '主应力2', value: 'd3', type: 'STRESS' },
  { name: '主应力3', value: 'u1', type: 'STRESS' }
])
// 位移场
const displacementList: any = ref([
  { name: '位移X', value: 's22', type: 'DISPLACEMENT' },
  { name: '位移Y', value: 's33', type: 'DISPLACEMENT' },
  { name: '位移Z', value: 's12', type: 'DISPLACEMENT' },
  { name: '综合位移', value: 's13', type: 'DISPLACEMENT' }
])
// 渗流场
const seepageList: any = ref([
  { name: '总水头', value: 's22', type: 'SEEPAGE_P' },
  { name: '压力水头', value: 's33', type: 'SEEPAGE_P' }
])

// 节点点击
const itemClick = async (value: any) => {
  // emitter.emit('event-name', value)
  if (__xapi?.isReady) {
    await __xapi.finiteElement.clear()
    DtsFacade.setCamera([488985.8825, 2489958.511563, 277.146289, -20.993801, 2.20189], '有限元定位')
    let fe: any = await ProjectFiniteElement.addFiniteElement('ejxsz', 'TEMPERATURE', value.value, cycleId.value)
    console.log(fe, 'fe是什么东西')
    if (fe) {
      emitter.emit('showFiniteElementLegend', {
        buildingModel: moXingMap[props.timeAndMoXing.model],
        physicalQuantity: value.type,
        indicatorType: value.value,
        fe: fe.fe,
        minMax: fe.minMax
      })
    }
  } else {
    console.log('场景没有初始化')
  }
}

// 清空场景,适用于onBeforeUnmount
// 如果用reset,可能会导致下个页面的onMounted异常
function clear() {
  if (__xapi?.isReady) {
    DtsFacade.setInteractiveMode(0)
    __xapi.marker.clear()
    __xapi.finiteElement.clear()
    __xapi.polyline.clear()
  }
}
onBeforeUnmount(() => {
  emitter.off('changeTimeNode')
  if (__xapi?.isReady) {
    clear()
  }
})
</script>

<style scoped lang="scss">
.childStyle {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 1.2rem;

  .son {
    width: 100%;
    height: 100%;
    display: flex;
    flex-wrap: wrap;

    .item {
      cursor: pointer;
      width: 6.5rem;
      height: 2.5rem;
      color: #ffffff;
      font-size: 1.2rem;
      text-align: center;
      line-height: 2.5rem;
      background: url('@/assets/autoplay/child-node-blue.png') no-repeat center center / 100% 100%;
    }

    .item:nth-child(2n + 1) {
      margin-right: 1rem;
    }

    .selectedNode {
      background: url('@/assets/autoplay/child-node-green.png') no-repeat center center / 100% 100% !important;
    }
  }
}
</style>
