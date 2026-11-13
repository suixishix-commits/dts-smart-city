<template>
  <div class="box-btn-common">
    <div v-for="(item, index) in btnData" :key="index" class="btn">
      <el-popover
        placement="right"
        trigger="hover"
        popper-class="toolbars-popover"
        v-model:visible="popoverVisibleList[index]"
        :teleported="false"
        @before-leave="handleBeforeLeave"
      >
        <template #reference>
          <div class="tool-item" :class="[item.name, item.isSelected ? 'tool-item-checked' : '']" @click="btnGroupClick(item, index)">{{ item.text }}</div>
        </template>
        <FilterToolbox :visible="item.isSelected" :name="item.text" :popoverIndex="index" @close="closeHandler" @item_click="clickHandler"> </FilterToolbox>
      </el-popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, reactive, watch } from 'vue'

const emit = defineEmits(['click', 'close', 'item_click'])

const btnData = reactive([
  {
    name: 'water',
    text: '水行业',
    isSelected: false,
    selectedText: '水行业'
  },
  {
    name: 'CompEchart',
    text: 'Echarts',
    isSelected: false,
    selectedText: 'Echarts'
  },
  {
    name: 'CompElementUI',
    text: 'Element',
    isSelected: false,
    selectedText: 'Element'
  },
  {
    name: 'CompList',
    text: '列表项',
    isSelected: false,
    selectedText: '列表项'
  },
  {
    name: 'CompDtsMarker',
    text: '撒点',
    isSelected: false,
    selectedText: '撒点'
  },
  {
    name: 'CompDtsPolyline',
    text: '画线',
    isSelected: false,
    selectedText: '画线'
  },
  {
    name: 'CompDtsPolygon',
    text: '画面',
    isSelected: false,
    selectedText: '画面'
  },
  {
    name: 'CompDtsAPI',
    text: 'DtsAPI',
    isSelected: false,
    selectedText: 'Dts综合API'
  },
  {
    name: '多选过滤',
    text: '多选过滤',
    isSelected: false,
    selectedText: '航线'
  },
  {
    name: '高度',
    text: '高度',
    isSelected: false,
    selectedText: '高度'
  },
  {
    name: '区域',
    text: '区域',
    isSelected: false,
    selectedText: '区域'
  },
  {
    name: '时间范围',
    text: '时间范围',
    isSelected: false,
    selectedText: '时间范围'
  },
  {
    name: '时间轴',
    text: '时间轴',
    isSelected: false,
    selectedText: '时间轴'
  },
  {
    name: '视频监控',
    text: '视频监控',
    isSelected: false,
    selectedText: '视频监控'
  },
  {
    name: '拖拽',
    text: '拖拽',
    isSelected: false,
    selectedText: '拖拽'
  },
  {
    name: '其它',
    text: '其它',
    isSelected: false,
    selectedText: '其它'
  }
])

const popoverVisibleList = ref(Array.from({ length: btnData.length }, () => false))

// 图标点击状态
const btnState = Array.from({ length: btnData.length }, () => 0)

const handleBeforeLeave = () => {
  // 移除焦点
  const activeElement = document.activeElement as HTMLElement | null
  if (activeElement) {
    activeElement.blur()
  }
  return true // 允许关闭 Popover
}

/**
 * 图标点击事件
 *
 * @param item
 * @param index
 */
async function btnGroupClick(item: any, index: number) {
  btnState[index]++ // 状态切换
  btnData[index].isSelected = !btnData[index].isSelected
  popoverVisibleList.value[index] = btnData[index].isSelected
  emit('click', item, btnState[index])
}

watch(
  popoverVisibleList,
  (val) => {
    popoverVisibleList.value.forEach((item, index) => {
      if (item && !btnData[index].isSelected) {
        popoverVisibleList.value[index] = false
      }
    })
  },
  {
    deep: true
  }
)

// 关闭窗口
function closeHandler(e: any) {
  popoverVisibleList.value[e.popoverIndex] = false
  emit('close', e)
}

// 窗口点击
function clickHandler(result: any) {
  emit('item_click', result)
}

onMounted(() => {})

onBeforeUnmount(() => {})
</script>

<style lang="scss" scoped>
.box-btn-common {
  display: flex;
  pointer-events: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 8rem;
  background: #0d192c;
  box-sizing: border-box;
  padding: 1rem 0rem;

  .btn {
    pointer-events: all;
    width: 7rem;
    height: 2.5rem;
    cursor: pointer;

    &:not(:first-child) {
      margin-top: 0.8rem;
    }

    .tool-item {
      width: 7rem;
      height: 2.5rem;
      text-align: center;
      line-height: 2.5rem;
      font-family: YouSheBiaoTiHei, YouSheBiaoTiHei;
      font-weight: 400;
      font-size: 1.4rem;
      color: #bdbdbd;
      background: url('./assets/default_tool_bg.png') no-repeat 0 0 / 100% 100%;
    }

    .tool-item-checked {
      color: #34ebff;
      background: url('./assets/checked_tool_bg.png') no-repeat 0 0 / 100% 100% !important;
    }
  }

  :deep(.toolbars-popover) {
    border: none !important;
    padding: 0 !important;
    min-width: 10rem !important;
    width: fit-content !important;
    height: fit-content !important;
    background-color: transparent !important;
  }
}
</style>
