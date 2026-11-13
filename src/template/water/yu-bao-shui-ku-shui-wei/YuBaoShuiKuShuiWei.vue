<template>
  <div class="chartBox">
    <ChartFrame :option="chartOption" ref="myChart" />
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import YuBaoShuiKuShuiWeiOption from './YuBaoShuiKuShuiWeiOption'
//echart引用
const myChart = ref()
// echart配置信息
const chartOption = ref({})

// 获取Echart数据，并绑定chart
async function initGUI() {
  let res: any = await getTemplateData('water/yu-bao-shui-ku-shui-wei/assets/data.json')
  console.log('后台数据', res)
  if (res?.data?.data?.front) {
    let resData: any = res.data.data
    let frontData = resData.front
    let futureRk = resData.futureRk

    const frontDataTm = frontData.map((item: any) => item.ymdh)
    const futureRkTm = futureRk.map((item: any) => item.ymdh)
    const allDataTime = frontDataTm.concat(futureRkTm).filter(function (item: any, index: any, array: any) {
      return array.indexOf(item) === index
    })

    //汛限水位
    let xxsw: any = []
    // 末水位
    let erz: any = []
    //正常蓄水位
    let normz: any = []
    //设计洪水位
    let dsflz: any = []
    //校核洪水位
    let ckflz: any = []
    //水位
    let rz: any = []

    let frontMap = new Map()
    let futureRkMap = new Map()
    frontData.forEach((item: any, index: any) => {
      frontMap.set(item.ymdh, { normz: item.normz, xxsw: item.xxsw, ckflz: item.ckflz, yb_otq: null, yb_q: item.dsflz, rz: item.rz })
    })
    futureRk.forEach((item: any, index: any) => {
      futureRkMap.set(item.ymdh, { normz: null, xxsw: null, ckflz: null, yb_otq: item.erz, yb_q: null, rz: null })
    })

    allDataTime.forEach((date: any, index: any) => {
      let front = frontMap.get(date)
      let futureRk = futureRkMap.get(date)
      erz.push(futureRk ? futureRk.yb_otq : null)
      dsflz.push(front ? front.yb_q : null)
      normz.push(front ? front.normz : null)
      xxsw.push(front ? front.xxsw : null)
      ckflz.push(front ? front.ckflz : null)
      rz.push(front ? front.rz : null)
    })

    const rzFirstNullIndex = rz.findIndex((value: any) => value === null)
    const erzFirstNonNullIndex = erz.findIndex((value: any) => value !== null)
    if (rzFirstNullIndex !== -1 && erzFirstNonNullIndex !== -1) {
      erz[erzFirstNonNullIndex - 1] = rz[rzFirstNullIndex - 1]
    }

    chartOption.value = YuBaoShuiKuShuiWeiOption.getOption(allDataTime, xxsw, normz, erz, rz, dsflz, ckflz)
  }
}

onMounted(() => {
  initGUI()
})
</script>

<style lang="scss" scoped>
.chartBox {
  position: relative;
  width: 100%;
  height: 100%;
  padding-bottom: 3px;
  display: flex;
}
</style>
