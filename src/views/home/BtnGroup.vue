<template>
  <div class="btnGroup">
    <div v-for="(item, index) in btnData" :key="index" class="btn">
      <el-tooltip class="item" effect="light" :content="item.isSelected ? item.selectedText : item.text" placement="left">
        <img class="btnImg" :class="[item.name]" :src="item.isSelected ? item.selectedSrc : item.src" alt="" @click="btnGroupClick(item, index)" />
      </el-tooltip>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import store from '@/stores/index'

const emit = defineEmits(['click'])
// 最早出水口线id
const earliestOutletLineIds = []
const router = useRouter()

const btnData = reactive([
  {
    name: 'home',
    text: 'Home', //未选中文字
    selectedText: 'Home已选中', //选中文字
    src: new URL('./assets/home.png', import.meta.url).href, //未选中图片
    selectedSrc: new URL('./assets/home_selected.png', import.meta.url).href, //选中图片
    isSelected: true //是否选中
  },
  {
    name: 'yangmoshuiqing',
    text: '开启淹没单元',
    selectedText: '淹没单元已点击',
    src: new URL('./assets/grid.png', import.meta.url).href,
    selectedSrc: new URL('./assets/grid_selected.png', import.meta.url).href,
    isSelected: false
  },
  {
    name: 'gaochengshiqu',
    text: '高程拾取',
    selectedText: '高程拾取已点击',
    src: new URL('./assets/draw_point.png', import.meta.url).href,
    selectedSrc: new URL('./assets/draw_point_selected.png', import.meta.url).href,
    isSelected: false
  },
  {
    name: 'sanheyi',
    text: '开启手动调节水位、含沙量、流速',
    selectedText: '手动调节水位、含沙量、流速已点击',
    src: new URL('./assets/duan_mian.png', import.meta.url).href,
    selectedSrc: new URL('./assets/duan_mian_selected.png', import.meta.url).href,
    isSelected: false
  },
  {
    name: 'outLine',
    text: '外溢线',
    selectedText: '外溢线已点击',
    src: new URL('./assets/out_line.png', import.meta.url).href,
    selectedSrc: new URL('./assets/out_line_selected.png', import.meta.url).href,
    isSelected: false
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
  const iconName = item.name
  btnState[index]++ // 状态切换
  // 选中图标样式切换
  btnData.forEach((itemTmp) => {
    if (itemTmp.name != iconName) itemTmp.isSelected = false
    else itemTmp.isSelected = true
  })

  emit('click', item, btnState[index])
  switch (iconName) {
    case 'gaochengshiqu':
      break
    default:
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
.btnGroup {
  position: absolute;
  right: 0;
  top: 590px;
  display: flex;
  //padding-bottom: 3rem;
  width: 50px;
  pointer-events: none;
  flex-direction: column;
  justify-content: center;
  padding: 8px;
  gap: 2px;
  // justify-content: flex-end;
}

.btn {
  cursor: pointer;
  pointer-events: all;
  position: relative;
}

.btnImg {
  width: 50px;
  height: 50px;
}
</style>
