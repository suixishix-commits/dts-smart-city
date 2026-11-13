<template>
  <div :class="`popup_layout ${bgClass}`" @click="divClickHandle">
    <div class="title">{{ title }}</div>
    <div class="content">
      <div class="progress-chart">
        <el-progress type="dashboard" :width="scalePx(46)" :show-text="true" :percentage="percentage" :color="colors" />
      </div>
      <div class="right-content">
        <div :class="`txtTitle ${txtTitleClass}`">总体安全度</div>
        <div>{{ score }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { scalePx } from '@/utils/viewportScale'
import { useRoute } from 'vue-router'
const route = useRoute()
const { query }: any = toRefs(route)
// 标题
const title = ref('')
// 得分
const score = ref(0)
const percentage = ref(0)
// 等级
const level = ref('安全')
// 背景样式
const bgClass: any = ref('level1')
// 文字颜色
const txtTitleClass: any = ref('txt-level1')

// 根据等级进行样式映射
const colorMap: any = reactive({
  安全: { bgClass: 'level1', txtClass: 'txt-level1' },
  一般安全: { bgClass: 'level2', txtClass: 'txt-level2' },
  异常: { bgClass: 'level3', txtClass: 'txt-level3' },
  危险: { bgClass: 'level4', txtClass: 'txt-level4' }
})

// 进度圈颜色
const colors = [
  { color: '#FF4444', percentage: 40 },
  { color: '#FF7944', percentage: 60 },
  { color: '#E3FF44', percentage: 80 },
  { color: '#45c7a3', percentage: 100 }
]

function divClickHandle() {
  ue.internal.postevent(JSON.stringify({ module: 'online-monitor', type: 'OverallSafty', data: query.value }))
  ue.internal.closewindow()
}

onMounted(async () => {
  level.value = query.value?.level ? query.value.level : '安全'
  score.value = query.value?.score ? query.value.score : 0
  title.value = query.value?.buildingText ? query.value.buildingText : '未知'
  bgClass.value = colorMap[level.value]?.bgClass ? colorMap[level.value].bgClass : 'level1'
  txtTitleClass.value = colorMap[level.value]?.txtClass ? colorMap[level.value].txtClass : 'txt-level1'
  percentage.value = (score.value / 10) * 100
  console.log('传进了啥？', query.value, level.value, score.value, title.value, bgClass.value)
})
</script>

<style lang="scss" scoped>
.popup_layout {
  width: 137px; //137px
  height: 103px; //103px
  position: relative;
  --title-height: 4px;
  display: flex;
  flex-direction: column;
  padding-top: 3px;
  gap: 10px;
  .title {
    top: 4px;
    font-family: OPPOSans;
    font-size: 14px;
    text-align: center;
    letter-spacing: 0px;
    color: #ffffff;
  }
  .content {
    display: flex;
    gap: 3px;
    padding: 0 8px;
    .right-content {
      display: flex;
      flex-direction: column;
      gap: 5px;

      .txtTitle {
        font-family: OPPOSansR;
        color: #45c7a3;
      }

      .txt-level1 {
        color: #45c7a3;
      }

      .txt-level2 {
        color: #e3ff44;
      }

      .txt-level3 {
        color: #ff7944;
      }

      .txt-level4 {
        color: #ff4444;
      }

      div:last-child {
        color: #ffffff;
        font-family: DIN;
        font-size: 20px;
        font-weight: bold;
        text-align: center;
      }
    }
  }
}
.level1 {
  background: url('./assets/level1.png') no-repeat center center / 100% 100%;
}
.level2 {
  background: url('./assets/level2.png') no-repeat center center / 100% 100%;
}
.level3 {
  background: url('./assets/level3.png') no-repeat center center / 100% 100%;
}
.level4 {
  background: url('./assets/level4.png') no-repeat center center / 100% 100%;
}
</style>
