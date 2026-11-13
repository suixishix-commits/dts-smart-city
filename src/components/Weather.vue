<template>
  <div class="box-weather">
    <i :class="weatherIcon"></i>
    <div>
      <div>{{ temp }}℃</div>
      <div>{{ text }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from 'axios'
import LocalStorage from '@/utils/LocalStorage'

// 属性定义
const props = defineProps({
  location: {
    type: String,
    default: ''
  }
})

//和风样式
const weatherIcon = ref('weather qi-100')
//温度℃
const temp = ref()
const text = ref()

// 初始化天气UI
async function initWeatherUI() {
  //避免多次查询，超过1小时更新一次
  let weatherObj = LocalStorage.getItem('weather')
  let needUpdate = false
  let weather
  if (weatherObj?.time && weatherObj?.weather?.now) {
    let time = new Date().getTime()
    let lastTime = weatherObj.time
    const interval = gVar?.weather?.interval
    if (time - lastTime > 1000 * 60 * interval) {
      needUpdate = true
    } else {
      weather = weatherObj?.weather?.now
    }
  } else {
    needUpdate = true
  }
  // 需要更新天气信息
  if (needUpdate) {
    let time = new Date().getTime()
    const key = gVar?.weather?.key //zhouxq的和风项目
    let location = props.location ? props.location : gVar?.weather?.location // 长沙市，从天地图上获取
    if (key && location) {
      const url = `${gVar?.weather?.url}?location=${location}&key=${key}`
      let res = await axios.get(url)
      //console.log('和风天气是啥？', res, url)
      weather = res.data?.now
      LocalStorage.setItem('weather', { time: time, weather: res.data, location: location })
    }
  }

  if (weather) {
    //console.log('天气初始化UI', weather)
    temp.value = weather.temp
    text.value = weather.text
    weatherIcon.value = `weather qi-${weather.icon}`
  } else {
    console.log('初始化UI失败：没有天气信息')
  }
}

onMounted(() => {
  initWeatherUI()
})
</script>

<style lang="scss" scoped>
.box-weather {
  position: relative;
  display: flex;
  color: #fff;
  justify-content: center;
  align-items: center;
  gap: 10px;
  .weather {
    font-size: 32px;
  }
}
</style>
