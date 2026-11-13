<template>
  <div class="box-datetime">
    <span class="hms">{{ HMS }}</span>
    <span class="ymd-week">
      <span class="ymd">{{ YMD }}</span>
      <span class="week">{{ week }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import moment from 'moment'
const HMS = ref('')
const YMD = ref('')
const week = ref('')

const weeks = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const getDay = () => {
  const m = moment()

  HMS.value = m.format('HH:mm:ss')
  YMD.value = m.format('YYYY/MM/DD')

  week.value = weeks[m.weekday()]

  window.requestAnimationFrame(() => {
    getDay()
  })
}

onMounted(() => {
  getDay()
})
</script>

<style lang="scss" scoped>
.box-datetime {
  display: flex;
  flex-direction: column;
  .hms {
    font-family: OPPOSansM;
    font-size: 18px;
    font-weight: normal;
    line-height: 18px;
    letter-spacing: 1px;

    color: #ffffff;
  }
  .ymd-week {
    font-family: OPPOSansM;
    font-size: 10px;
    font-weight: normal;
    line-height: 12px;
    letter-spacing: 0em;

    color: #ffffff;
    .ymd {
      margin-right: 2px;
    }
  }
}
</style>
