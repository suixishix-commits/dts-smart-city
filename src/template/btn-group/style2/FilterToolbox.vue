<template>
  <SelectFilter v-if="name == '多选过滤'" data="多选过滤" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></SelectFilter>
  <HeightChoose v-if="name == '高度'" data="高度" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></HeightChoose>
  <AreaChoose
    v-if="name == '区域'"
    data="区域"
    :popoverIndex="popoverIndex"
    :visible="visible"
    @close="closeHandler"
    @item_click="itemClickHandler"
  ></AreaChoose>
  <TimeChoose v-if="name == '时间范围'" data="时间范围" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></TimeChoose>
  <WaterUI v-if="name == '水行业'" data="水行业" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></WaterUI>
  <CompEchart v-if="name == 'Echarts'" data="Echarts" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></CompEchart>
  <CompElementUI v-if="name == 'Element'" data="Element" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></CompElementUI>
  <CompList v-if="name == '列表项'" data="列表项" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></CompList>
  <CompDtsMarker v-if="name == '撒点'" data="撒点" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></CompDtsMarker>
  <CompDtsPolyline v-if="name == '画线'" data="画线" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></CompDtsPolyline>
  <CompDtsPolygon v-if="name == '画面'" data="画面" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></CompDtsPolygon>
  <CompDtsOther v-if="name == 'DtsAPI'" data="DtsAPI" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></CompDtsOther>
  <CompCamera v-if="name == '视频监控'" data="视频监控" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></CompCamera>
  <CompDateTime v-if="name == '时间轴'" data="时间轴" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></CompDateTime>
  <CompDrag v-if="name == '拖拽'" data="拖拽" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></CompDrag>
  <CompOther v-if="name == '其它'" data="其它" :popoverIndex="popoverIndex" @close="closeHandler" @item_click="itemClickHandler"></CompOther>
</template>

<script setup lang="ts">
import SelectFilter from './comp/SelectFilter.vue'
import HeightChoose from './comp/HeightChoose.vue'
import AreaChoose from './comp/AreaChoose.vue'
import TimeChoose from './comp/TimeChoose.vue'
import WaterUI from './comp/WaterUI.vue'
import { onMounted } from 'vue'

const emit = defineEmits(['close', 'item_click'])

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  popoverIndex: {
    type: Number,
    required: true
  }
})

// 关闭窗口
function closeHandler(e: any) {
  emit('close', e)
}

// 窗口点击
function itemClickHandler(result: any) {
  emit('item_click', result)
}

onMounted(() => {})
</script>

<style scoped lang="scss"></style>
