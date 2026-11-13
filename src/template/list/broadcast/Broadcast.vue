<template>
  <div class="TopCard">
    <!-- 小喇叭 -->
    <div style="width: 4rem">
      <div class="img" style="width: 3rem; height: 3rem" />
    </div>
    <!-- 滚动文字外层div，文字能展示的区域-->
    <div
      class="noticeBox"
      :style="
        'width:' +
        noticeWidth / 10 +
        'rem;height:3rem;line-height:3rem;position:relative;overflow:hidden;display:inline-block;vertical-align:middle;font-size:2rem; font-weight: bold;color:#30b9ff;'
      "
    >
      <!-- 滚动div，marginLeft变化-->
      <div :style="'margin-left:' + marginLeft + 'px;white-space:nowrap'">
        <span class="showNotice">{{ showNotice }}</span>
        <!-- 不会展示，用来测量第二条与第一条重合时的长度 -->
        <span class="notice">{{ notice }}</span>
      </div>
    </div>
  </div>
</template>
<script setup>
import { onMounted, ref, onBeforeUnmount } from 'vue'
const props = defineProps({
  noticeData: {
    type: Array,
    default: []
  }
})
// 文字滚动宽度限制
let noticeWidth = ref(375)
// 公告展示（过长时会重复两遍）
let showNotice = ref('')
// 用于公告过长时，获取重复两遍中第一遍的长度
let notice = ref('')
// 公告初始位置
let marginLeft = ref(150)

let timer = null
onMounted(() => {
  props.noticeData.forEach((val, index) => {
    if (index === 0) {
      showNotice.value += '【' + (index + 1) + '】' + val
    } else {
      showNotice.value += '\xa0\xa0\xa0\xa0\xa0\xa0【' + (index + 1) + '】' + val
    }
  })
  // 公告上面先赋值，再获取宽度
  setTimeout(() => {
    // 公告div长度
    var oneNoticeWidth = document.getElementsByClassName('showNotice')[0].offsetWidth
    // 公告外层div长度
    var noticeBoxWidth = document.getElementsByClassName('noticeBox')[0].offsetWidth
    // 一条公告长度太大时，才滚动
    if (oneNoticeWidth > noticeBoxWidth) {
      // 滚动公告需要将公告重复两遍进行滚动，两遍中间需要加空格
      notice.value = showNotice.value + '\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0'
      // 上面先赋值，再获取宽度
      setTimeout(() => {
        // 获取一遍加中间空格的长度，即左移时第二遍与第一遍完全重合时的长度
        var oneNoticeAddEmptyWidth = document.getElementsByClassName('notice')[0].offsetWidth
        // 公告内容重复两遍
        showNotice.value = notice.value + showNotice.value
        timer = setInterval(() => {
          console.log('滚动中')
          marginLeft.value -= 1
          // 第二遍与第一遍起始位置重合时（第一条已完全移到左侧隐藏），marginLeft置0，即回到第一条
          if (marginLeft.value === -1 * oneNoticeAddEmptyWidth) {
            marginLeft.value = 0
          }
        }, 20)
      }, 10)
    } else {
      //公告并没有很长时不滚动
      marginLeft.value = 0
    }
  }, 10)
})
onBeforeUnmount(() => {
  clearInterval(timer)
})
</script>

<style lang="scss" scoped>
.TopCard {
  display: flex;
  flex-direction: row;
  align-items: center;
  .img {
    background-repeat: no-repeat;
    background-size: 100% 100%;
    background-image: url('./assets/broadcast.png');
  }
}
</style>
