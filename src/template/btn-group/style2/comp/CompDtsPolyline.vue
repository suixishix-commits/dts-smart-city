<template>
  <div class="airway_wrap">
    <div class="closePopover" @click="closePopover"></div>
    <div class="title">
      <p class="text">画线</p>
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
      <!-- dts-vue 示例中心的特效 -->
      <EffectRows group="线与路径" @item_click="(r) => emit('item_click', r)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

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
    title: 'Polyline',
    filterType: 'single',
    checkedValues: ['all'],
    filterOption: [
      {
        name: '飞行计划',
        checked: false,
        value: '飞行计划'
      },
      {
        name: '牵引线',
        checked: false,
        value: '牵引线-静态'
      },
      {
        name: '牵引线生长',
        checked: false,
        value: '牵引线-生长'
      },
      {
        name: '清除牵引线',
        checked: false,
        value: '牵引线-清除'
      }
    ],
    prop: 'water'
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
