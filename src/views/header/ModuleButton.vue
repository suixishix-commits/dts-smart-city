<template>
  <div class="module-group">
    <div class="left-module-group">
      <div v-for="(item, index) in btnLeftData" :key="index" class="btn">
        <img class="btnImg" :class="[item.name]" :src="item.isSelected ? item.selectedSrc : item.src" alt="" @click="btnGroupClick(item, index)" />
      </div>
    </div>
    <div class="right-module-group">
      <div v-for="(item, index) in btnRightData" :key="index" class="btn">
        <img
          class="btnImg"
          :class="[item.name]"
          :src="item.isSelected ? item.selectedSrc : item.src"
          alt=""
          @click="btnGroupClick(item, btnLeftData.length + index)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import store from '@/stores/index'

const emit = defineEmits(['click'])
const router = useRouter()

// 左边按钮数据
const btnLeftData = reactive([
  {
    name: 'online_moniter',
    text: '在线监控',
    src: new URL('@/assets/framework/module/online_moniter.png', import.meta.url).href, //未选中图片
    selectedSrc: new URL('@/assets/framework/module/online_moniter_selected.png', import.meta.url).href, //选中图片
    isSelected: false //是否选中
  },
  {
    name: 'data_analysis',
    text: '数据分析',
    src: new URL('@/assets/framework/module/data_analysis.png', import.meta.url).href,
    selectedSrc: new URL('@/assets/framework/module/data_analysis_selected.png', import.meta.url).href,
    isSelected: true
  },
  {
    name: 'rehearsal',
    text: '工况预演',
    src: new URL('@/assets/framework/module/rehearsal.png', import.meta.url).href,
    selectedSrc: new URL('@/assets/framework/module/rehearsal_selected.png', import.meta.url).href,
    isSelected: false
  }
])
// 右侧按钮数据
const btnRightData = reactive([
  {
    name: 'moniter_mgr',
    text: '监测管理',
    src: new URL('@/assets/framework/module/moniter_mgr.png', import.meta.url).href,
    selectedSrc: new URL('@/assets/framework/module/moniter_mgr_selected.png', import.meta.url).href,
    isSelected: false
  },
  {
    name: 'defect',
    text: '缺陷管理',
    src: new URL('@/assets/framework/module/defect.png', import.meta.url).href,
    selectedSrc: new URL('@/assets/framework/module/defect_selected.png', import.meta.url).href,
    isSelected: false
  },
  {
    name: 'model_mgr',
    text: '模型管理',
    src: new URL('@/assets/framework/module/model_mgr.png', import.meta.url).href,
    selectedSrc: new URL('@/assets/framework/module/model_mgr_selected.png', import.meta.url).href,
    isSelected: false
  }
])

// 图标点击状态
const btnState = Array.from({ length: btnLeftData.length + btnRightData.length }, () => 0)

/**
 * 图标点击事件
 *
 * @param item
 * @param index
 */
async function btnGroupClick(item, index) {
  const iconName = item.name
  btnState[index]++ // 状态切换
  // 左侧选中图标样式切换
  btnLeftData.forEach((itemTmp) => {
    if (itemTmp.name != iconName) itemTmp.isSelected = false
    else itemTmp.isSelected = true
  })
  // 右侧选中图标样式切换
  btnRightData.forEach((itemTmp) => {
    if (itemTmp.name != iconName) itemTmp.isSelected = false
    else itemTmp.isSelected = true
  })

  emit('click', item, btnState[index])
  console.log(`第${btnState[index]}次点了`, item)
  switch (iconName) {
    case 'online_moniter':
      // router.push({ path: 'home' })
      break
    default:
      router.push({ path: 'home' })
      break
  }
}

onMounted(() => {
  if (__xapi?.isReady) {
  }
})

onBeforeUnmount(async () => {
  if (__xapi?.isReady) {
  }
})
</script>

<style lang="scss" scoped>
.module-group {
  position: absolute;
  right: 0;
  top: 3.2rem;
  width: 100%;
  pointer-events: none;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  gap: 50rem;
  // justify-content: flex-end;
  .left-module-group {
    display: flex;
    flex-direction: row;
    justify-content: center;
    padding: 8px;
    gap: 2px;
  }
  .right-module-group {
    display: flex;
    flex-direction: row;
    justify-content: center;
    padding: 8px;
    gap: 2px;
  }
  .btn {
    cursor: pointer;
    pointer-events: all;
    position: relative;
  }

  .btnImg {
    width: 13.8rem;
    height: 3.4rem;
  }
}
</style>
