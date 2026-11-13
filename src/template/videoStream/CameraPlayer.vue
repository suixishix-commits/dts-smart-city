<template>
  <div class="playerWrapper" v-loading="loading">
    <div :id="cameraPlayer" class="cameraPlayer"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  previewUrl: {
    type: String,
    default: 'ws://172.16.4.2:559/openUrl/iaHRMHe' //后端返回监控地址
  },
  height: {
    type: Number,
    default: 180
  },
  width: {
    type: Number,
    default: 30
  },
  cameraPlayer: {
    type: String,
    default: 'cameraPlayer'
  }
})
const loading = ref(false)
let player: any = null
onMounted(() => {
  loading.value = true
  // 创建 H5 播放器
  player = new (window as any).JSPlugin({
    szId: props.cameraPlayer,
    szBasePath: '/static/haikuang/playctrl1/',
    iMaxSplit: 1,
    iCurrentSplit: 1,
    openDebug: true
  })
  // 事件回调绑定
  player
    .JS_SetWindowControlCallback({
      windowEventSelect: function (iWndIndex: any) {
        //插件选中窗口回调
        console.log('windowSelect callback: ', iWndIndex)
      },
      pluginErrorHandler: function (iWndIndex: any, iErrorCode: any, oError: any) {
        //插件错误回调
        console.log('pluginError callback: ', iWndIndex, iErrorCode, oError)
      },
      windowEventOver: function (iWndIndex: any) {
        //鼠标移过回调
        console.log(iWndIndex)
      },
      windowEventOut: function (iWndIndex: any) {
        //鼠标移出回调
        console.log(typeof iWndIndex)
      },
      windowEventUp: function (iWndIndex: any) {
        //鼠标mouseup事件回调
        //console.log(iWndIndex);
      },
      windowFullCcreenChange: function (bFull: any) {
        //全屏切换回调
        console.log('fullScreen callback: ', bFull)
      },
      firstFrameDisplay: function (iWndIndex: any, iWidth: any, iHeight: any) {
        //首帧显示回调
        console.log('firstFrame loaded callback: ', iWndIndex, iWidth, iHeight)
      },
      performanceLack: function () {
        //性能不足回调
        console.log('performanceLack callback: ')
      }
    })
    .then(() => {
      //自动播放监控视频
      let playURL = props.previewUrl
      let mode = 0
      let index = player.currentWindowIndex
      player.JS_Play(playURL, { playURL, mode }, index).then(
        () => {
          loading.value = false
          console.log('JS_Play success')
        },
        (e: any) => console.error(e)
      )
    })
})
window.addEventListener('resize', () => {
  player && player.JS_Resize()
})
onBeforeUnmount(() => {
  let index = player.currentWindowIndex
  player &&
    player.JS_Stop(index).then(
      () => {
        console.info('JS_Stop success')
      },
      (e: any) => console.info('JS_Stop failed:', e)
    )
  player = null
})
</script>

<style scoped lang="scss">
.playerWrapper {
  /*   @include boxhHeight(v-bind('props.height'));
    @include boxWidth(v-bind('props.width'));*/
  //width: v-bind('props.width')+'%' ;
  width: 30%;
  margin: 100px auto 0;

  .cameraPlayer {
    width: 100% !important;
    height: 100%;
  }

  :deep(.sub-wnd) {
    border: none !important;
  }
}
</style>
