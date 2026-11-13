<template>
  <div class="popover">
    <PopoverModule :childValue="childValue"></PopoverModule>
    <!--有限元图例-->
    <FiniteElementLegend ref="refLegend" v-show="legendVisible" class="feLegend"></FiniteElementLegend>
  </div>
</template>
<script setup lang="ts">
import DtsFacade from '@/components/dts/DtsFacade'

// 子节点数据
const childValue: any = ref({})

// 有限元同步防真展示,控制图例显隐
// 图例显隐控制
const legendVisible = ref<boolean>(false)
const refLegend = ref()
const colors = [
  'rgba(255, 0, 0,1)',
  'rgba(255, 74, 0,1)',
  'rgba(255, 210, 0,1)',
  'rgba(249, 255, 0,1)',
  'rgba(145, 255, 0,1)',
  'rgba(20, 255, 0,1)',
  'rgba(0, 255, 20,1)',
  'rgba(0, 255, 145,1)',
  'rgba(0, 255, 249,1)',
  'rgba(0, 210, 255,1)',
  'rgba(0, 74, 255,1)',
  'rgba(0, 0, 255,1)'
]

emitter.off('showFiniteElementLegend')
emitter.on('showFiniteElementLegend', (e: any) => {
  console.log('图例控制', e)
  //如果有模型
  if (e.fe) {
    legendVisible.value = true
    let minMax: any = e.minMax
    let title = '温度场'
    console.log('模型改变切换图例', minMax)

    if (minMax && minMax.hasOwnProperty('min')) {
      let min = minMax.min * minMax.scale
      let max = minMax.max * minMax.scale
      let interval = (max - min) / 12
      let vals = [min.toFixed(3)]
      let tmp
      for (let index = 1; index < 12; index++) {
        tmp = min + interval * index
        vals.push(tmp.toFixed(3))
      }
      vals.push(max.toFixed(3))
      vals = vals.reverse()
      vals = DtsFacade.rightAlign(vals)
      console.log('右对齐：', vals)
      let data = { title: title, color: colors, values: vals }
      refLegend.value.initGUI(data)
    } else {
      let data = { title: '图例', color: colors, values: [] }
      refLegend.value.initGUI(data)
    }
  }
})

onBeforeUnmount(() => {
  legendVisible.value = false
})
</script>
<style lang="scss" scoped>
.popover {
  pointer-events: all;
  position: absolute;
  top: 10rem;
  right: 1.5rem;
  width: 10rem;
  height: 20rem;
}
// 有限元图例
.feLegend {
  position: fixed;
  left: 2rem;
  bottom: 2rem;
}
</style>
