<template>
  <div id="legend">
    <div v-if="strTitle?.length > 0" class="title">{{ strTitle }}</div>
    <div class="content">
      <ul class="colorUl">
        <li v-for="(item, index) in arrColor" :key="index">
          <div class="box" :style="{ backgroundColor: item }" :class="{ 'column-mode': false }"></div>
        </li>
      </ul>
      <ul>
        <li v-for="(item, index) in arrVal" :key="index">
          <div class="text">
            <div><span>—&nbsp;</span></div>
            <div><span v-for="i in item?.spaces" :key="i">&nbsp;</span>{{ item.content }}</div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ref, onMounted } from 'vue'

// 标题
const strTitle = ref('')
// 颜色分组
const arrColor = ref([])
// 值分组
const arrVal = ref([])

const initGUI = (cfg: any) => {
  console.log('图例更新', cfg)
  strTitle.value = cfg.title
  arrColor.value = cfg.color
  arrVal.value = cfg.values
}
defineExpose({ initGUI })
onMounted(() => {})
</script>
<style lang="scss" scoped>
#legend {
  box-sizing: border-box;
  padding: 1rem;
  background-color: rgba($color: #000000, $alpha: 0.68);
  color: #fff;
  .title {
    font-size: 1.6rem;
    font-weight: bold;
    margin-bottom: 1rem;
    width: 100%;
  }
  .content {
    position: relative;
    display: flex;
  }

  ul {
    li {
      display: flex;
      color: #c9c9c9;
      .box {
        box-sizing: border-box;
        width: 2rem;
        height: 2rem;
        border: 0.1rem solid #454444;
        border-bottom: none;
      }
      &:last-child {
        .box {
          border-bottom: 0.1rem solid #454444;
        }
      }
      .column-mode {
        margin-bottom: 1rem;
        border-bottom: 0.1rem solid #454444;
      }
      .two-columns {
        width: 50%;
      }
      .text {
        text-align: right;
        vertical-align: middle;
        margin-left: 0.5rem;
        line-height: 2rem;
        white-space: nowrap;
        width: 100%;
        display: flex;
        justify-content: space-between;
      }
    }
  }
  .colorUl {
    position: relative;
    top: 1.05rem;
  }
}
</style>
