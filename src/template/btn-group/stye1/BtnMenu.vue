<template>
  <div class="box-btn-group">
    <div v-for="(item, index) in btnData" :key="index" class="btn">
      <div class="tool-item" :class="[item.name, item.isSelected ? 'tool-item-checked' : '']" @click="btnGroupClick(item, index)">{{ item.text }}</div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive } from 'vue'

const emit = defineEmits(['click'])

const btnData = reactive([
  {
    name: '两侧隐藏',
    text: '两侧隐藏',
    isSelected: false,
    selectedText: '两侧隐藏'
  },
  {
    name: '右侧按钮-侧边栏',
    text: '侧边栏',
    isSelected: false,
    selectedText: '行政区划'
  },
  {
    name: '有限元',
    text: '有限元',
    isSelected: false,
    selectedText: '有限元'
  },
  {
    name: '宽屏布局',
    text: '宽屏布局',
    isSelected: false,
    selectedText: '宽屏布局'
  },
  {
    name: '前后卡片',
    text: '前后卡片',
    isSelected: false,
    selectedText: '前后卡片布局'
  },
  {
    name: 'AI生成',
    text: 'AI生成',
    isSelected: false,
    selectedText: 'AI生成'
  }
])

// 图标点击状态
const btnState = Array.from({ length: btnData.length }, () => 0)

/**
 * 图标点击事件
 *
 * @param item
 * @param index
 */
async function btnGroupClick(item, index) {
  btnState[index]++ // 状态切换
  btnData[index].isSelected = !btnData[index].isSelected
  if (btnData[index].isSelected) {
    const iconName = item.name
    btnData.forEach((itemTmp) => {
      if (itemTmp.name != iconName) itemTmp.isSelected = false
    })
  }
  emit('click', item, btnState[index])
}

onMounted(() => {})

onBeforeUnmount(async () => {})
</script>

<style lang="scss" scoped>
.box-btn-group {
  display: flex;
  pointer-events: none;
  flex-direction: column;
  align-items: center;
  width: 8rem;
  background: #0d192c;
  padding-top: 1rem;
  .btn {
    pointer-events: all;
    width: 7rem;
    height: 2.5rem;
    cursor: pointer;
    &:not(:first-child) {
      margin-top: 0.8rem;
    }
    &:last-child {
      margin-bottom: 3.1rem;
      position: relative;

      &::before {
        content: '';
        display: block;
        width: 4.3rem;
        height: 0.1rem;
        position: absolute;
        left: 50%;
        bottom: -1.5rem;
        transform: translateX(-50%);
        background: #14424c;
      }
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
}
</style>
