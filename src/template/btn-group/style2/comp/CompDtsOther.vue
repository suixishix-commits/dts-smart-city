<template>
  <div class="airway_wrap">
    <div class="closePopover" @click="closePopover"></div>
    <div class="title" @click="tocamel">
      <p class="text">Dts 综合 API</p>
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

const tocamel = () => {
  // console.log('点击了')
  __xapi.camera.set(636226.918125, 3439044.251875, 22893.7225, -70.764763, -105.739418, 0)
}

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
    title: '拆楼',
    filterType: 'single',
    checkedValues: ['all'],
    filterOption: [
      {
        name: '实例化',
        checked: false,
        value: '拆楼-实例化'
      },
      {
        name: '弹开',
        checked: false,
        value: '拆楼-弹开'
      },
      {
        name: '收拢',
        checked: false,
        value: '拆楼-收拢'
      },
      {
        name: '拉出',
        checked: false,
        value: '拆楼-拉出'
      },
      {
        name: '推入',
        checked: false,
        value: '拆楼-推入'
      },
      {
        name: '重置',
        checked: false,
        value: '拆楼-重置'
      }
    ],
    prop: 'water'
  },
  {
    title: '开闸放水',
    filterType: 'single',
    checkedValues: ['all'],
    filterOption: [
      {
        name: '山体模拟放水',
        checked: false,
        value: '山体模拟放水'
      },
      {
        name: '停止放水',
        checked: false,
        value: '停止放水'
      },
      {
        name: '继续放水',
        checked: false,
        value: '继续放水'
      }
    ],
    prop: 'water'
  },
  {
    title: '开闸放水2',
    filterType: 'single',
    checkedValues: ['all'],
    filterOption: [
      {
        name: '开闸放水-带粒子',
        checked: false,
        value: '开闸放水-带粒子'
      }
    ],
    prop: 'water'
  },
  {
    title: '二维水动力',
    checkedValues: ['all'],
    prop: 'water',
    filterType: 'single',
    filterOption: [
      {
        name: '版本1',
        checked: false,
        value: '二维水动力-版本1'
      }
    ]
  },
  {
    title: '图层',
    checkedValues: ['all'],
    prop: 'water',
    filterType: 'single',
    filterOption: [
      {
        name: '图层树',
        checked: false,
        value: '图层树'
      },
      {
        name: '图层Actor',
        checked: false,
        value: '图层Actor'
      },
      {
        name: 'Actor绑定',
        checked: false,
        value: 'Actor绑定'
      }
    ]
  },
  {
    title: 'BIM',
    checkedValues: ['all'],
    prop: 'water',
    filterType: 'single',
    filterOption: [
      {
        name: 'BIM信息列表',
        checked: false,
        value: 'BIMActor'
      },
      {
        name: '生成BIM映射文件',
        checked: false,
        value: 'BIM-生成映射文件'
      },
      {
        name: '提取Actor坐标',
        checked: false,
        value: 'BIM-提取Actor坐标'
      },
      {
        name: '图层所有BIM信息',
        checked: false,
        value: 'BIM-图层所有BIM信息'
      }
    ]
  },
  {
    title: '无人机',
    checkedValues: ['all'],
    prop: 'water',
    filterType: 'single',
    filterOption: [
      {
        name: '无人机模拟飞行',
        checked: false,
        value: '无人机模拟飞行'
      },
      {
        name: '开启无人机监控',
        checked: false,
        value: '开启无人机监控'
      },
      {
        name: '关闭无人机监控',
        checked: false,
        value: '关闭无人机监控'
      }
    ]
  },
  {
    title: '其他',
    checkedValues: ['all'],
    prop: 'water',
    filterType: 'single',
    filterOption: [
      {
        name: '颜色面板',
        checked: false,
        value: '颜色面板'
      },
      {
        name: '开启飞行',
        checked: false,
        value: '开启飞行'
      },
      {
        name: '结束飞行',
        checked: false,
        value: '结束飞行'
      }
    ]
  }
])

// 选项点击
const itemClick = (pItem: any, item: any, itemIndex: any) => {
  console.log('选项：', item, pItem, itemIndex)
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
  console.log(result)
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
