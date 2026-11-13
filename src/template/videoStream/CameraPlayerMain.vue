<template>
  <!-- 摄像头播放器的主容器 -->
  <div class="camera-players">
    <el-radio-group v-model="value" style="margin-left: 32rem">
      <el-radio-button value="CameraPlayer">单个监控</el-radio-button>
      <el-radio-button value="CameraPlayers">监控加云台控制</el-radio-button>
      <el-radio-button value="kfzn">开发指南</el-radio-button>
    </el-radio-group>
    <component :is="isComponent" :props-urls="propsUrls" :props-playback="propsPlayback" />
  </div>
</template>

<script setup lang="ts">
import moment from 'moment' // 引入moment库，用于日期和时间的操作
import CameraPlayer from './CameraPlayer.vue' //单个视频
import CameraPlayers from './CameraPlayers.vue' //多个视频加云台控制
const value = ref('CameraPlayers') // 默认显示第一个选项卡
const isComponent = computed(() => {
  return value.value === 'CameraPlayer' ? CameraPlayer : CameraPlayers
})

watch(
  () => value.value,
  (val) => {
    if (val === 'kfzn') {
      window.open(window.location.origin + '/static/haikuang/H5playerV2.1.2开发指南.html')
      return
    }
    val === 'CameraPlayer' ? CameraPlayer : CameraPlayers
  },
  { immediate: true }
)

// 定义组件的props
const props = defineProps({
  cWidth: {
    //容器宽
    type: String,
    default: '100%'
  },
  cHeight: {
    //容器高
    type: String,
    default: '100%'
  },
  propsUrls: {
    type: Object,
    default: () => ({
      realplay: 'ws://10.19.147.22:559/EUrl/q2jQie4', // 默认预览URL
      talk: 'wss://10.41.163.126:6014/proxy/10.41.163.126:559/EUrl/6gFx47S', // 默认对讲URL
      playback: 'wss://10.41.163.126:6014/proxy/10.41.163.126:559/EUrl/6gFx47S' // 默认回放URL
    })
  },
  propsPlayback: {
    type: Object,
    default: () => ({
      startTime: moment().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss'), // 默认回放开始时间为当前时间的前一小时
      endTime: moment().format('YYYY-MM-DD HH:mm:ss'), // 默认回放结束时间为当前时间
      valueFormat: 'YYYY-MM-DD HH:mm:ss', // 回放时间格式
      seekStart: moment().format('YYYY-MM-DD HH:mm:ss'), // 定位开始时间，默认为当前时间
      rate: 0 // 回放速度，默认为0
    })
  }
})

onMounted(() => {
  console.log('海康H5Player Main Onmounted')
})
</script>

<style scoped lang="scss">
.camera-players {
  position: absolute;
  top: 20px;
  z-index: 1000;
  pointer-events: all; // 允许所有指针事件
  width: v-bind('cWidth');
  height: v-bind('cHeight');
}
</style>
