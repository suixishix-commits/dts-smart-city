<template>
  <div class="airway_wrap">
    <div class="closePopover" @click="closePopover"></div>
    <div class="title">
      <p class="text">EchartsUI</p>
    </div>
    <div class="content_box">
      <div class="item" v-for="(item, index) in listData" :key="index">
        <div class="left">
          <span class="text">{{ item.title }}</span>
        </div>
        <div class="right">
          <div
            :class="['filterOption', filterOption.checked || filterOption.checked ? 'checkedItem' : '']"
            @click="itemClick(item, filterOption, filterIndex)"
            v-for="(filterOption, filterIndex) in item.filterOption"
            :key="filterIndex"
          >
            {{ filterOption.name }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { aiChartOptionsOf } from '@/template/echarts-comp/ai-charts/aiChartCatalog'

const emit = defineEmits(['close', 'item_click'])
const props = defineProps({
  data: null,
  popoverIndex: {
    type: Number,
    required: true
  }
})

// 绑定数据
const listData = ref([
  {
    title: '柱状图',
    filterType: 'single',
    checkedValues: ['all'],
    filterOption: [
      {
        name: '渐变&圆弧顶部',
        checked: false,
        value: '柱状图-渐变&圆弧顶部'
      },
      ...aiChartOptionsOf('柱状图')
    ],
    prop: 'water'
  },
  {
    title: '折线图',
    filterType: 'single',
    checkedValues: ['all'],
    filterOption: [
      {
        name: '自动滚动',
        checked: false,
        value: '曲线图-自动滚动'
      },
      ...aiChartOptionsOf('折线图')
    ],
    prop: 'water'
  },
  {
    title: '雷达图',
    filterType: 'single',
    checkedValues: ['all'],
    filterOption: [
      {
        name: '淹没损失',
        checked: false,
        value: '灾情-库区淹没经济损失'
      },
      ...aiChartOptionsOf('雷达图')
    ],
    prop: 'water'
  },
  {
    title: '饼环图',
    prop: 'water',
    filterType: 'single',
    checkedValues: ['all'],
    filterOption: [
      {
        name: '饼环图',
        checked: false,
        value: '饼环图'
      },
      ...aiChartOptionsOf('饼环图')
    ]
  },
  {
    title: '综合图',
    checkedValues: ['all'],
    prop: 'water',
    filterType: 'single',
    filterOption: aiChartOptionsOf('综合图')
  }
])

// 选项点击
const itemClick = (pItem: any, item: any, itemIndex: any) => {
  //console.log('选项：', item, pItem, itemIndex)
  let list = listData.value
  item.checked = true
  for (let index = 0; index < list.length; index++) {
    const element = list[index]
    for (let index2 = 0; index2 < element.filterOption.length; index2++) {
      const filterOption = element.filterOption[index2]
      if (filterOption.value != item.value) filterOption.checked = false
    }
  }

  // 控制输出结果
  let result: any = {}
  result['water'] = [item.value]
  // 事件转发
  emit('item_click', result)
}

// 关闭窗口
const closePopover = () => {
  // 关闭事件传递
  emit('close', { popoverIndex: props.popoverIndex, data: props.data })
}

onMounted(() => {})
</script>

<style scoped lang="scss">
.airway_wrap {
  width: 61.467rem;
  height: 42.5rem;
  // height: 30.5rem;
  background: url('../assets/pop_bg_airway.png') no-repeat 0 0 / 100% 100%;
  position: relative;
  font-size: 1.4rem;
  font-weight: 500;
  font-family: OPPOSans;
  color: #ffffff;

  .closePopover {
    position: absolute;
    top: 0;
    right: 0;
    width: 3.235rem;
    height: 1.646rem;
    z-index: 9;
    cursor: pointer;
  }

  .title {
    position: absolute;
    left: 0.186rem;
    top: 1.879rem;
    width: 39.45%;
    height: 6.76%;
    background: url('../assets/airway_title.png') no-repeat 0% 100% / 100% 81.34%;

    .text {
      margin-left: 4.142rem;
      height: 2.2rem;
      line-height: 2.2rem;
      font-size: 1.8rem;
    }
  }

  .content_box {
    position: absolute;
    left: 2.17rem;
    top: 5.634rem;
    width: 58.8rem;

    .item {
      display: flex;
      width: 100%;

      .left {
        margin-top: 0.8rem;
        width: 10.8rem;
        height: 2rem;
        line-height: 2rem;
        background: url('../assets/airway_left_bg.png') no-repeat 0 0 / 100% 100%;

        .text {
          margin-left: 1.45rem;
        }
      }

      .right {
        display: flex;
        flex-wrap: wrap;
        width: 48rem;

        .filterOption {
          cursor: pointer;
          margin-bottom: 0.4rem;
          padding: 0 2rem;
          height: 3.6rem;
          line-height: 3.6rem;
        }

        .checkedItem {
          // font-size: 1.5rem;
          background: url('../assets/airway_item_checked_bg.png') no-repeat 0 0 / 100% 100%;
          color: #3afbf7;
        }
      }
    }
  }
}
</style>
