<template>
  <div :id="props.playerVariable" class="player"></div>
</template>

<script lang="ts" setup>
import { getDtsToken, getFreeInstance } from '@/api/dts/dts'
import DtsFacade from '@/components/dts/DtsFacade'
import EventDispatcher from '@/components/dts/event/EventDispatcher'
import store from '@/stores/index'
import LocalStorage from '@/utils/LocalStorage'
import { ElMessage } from 'element-plus'
import { onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'

let digitalTwinApi = ref()
let digitalTwinPlayer = ref()

const props = defineProps({
  playerVariable: {
    type: String,
    default: '__xapi',
    required: false
  },
  msg: String
})

onMounted(() => {
  initDts()
  window.addEventListener('resize', onResize)
  window.addEventListener('beforeunload', _windowsCloseHandler)
})

onBeforeUnmount(() => {
  console.log('onUnmounted事件')
  digitalTwinPlayer.value && digitalTwinPlayer.value.destroy()
  digitalTwinApi.value && digitalTwinApi.value.destroy()
  window.removeEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', _windowsCloseHandler)
})

const onResize = () => {
  console.log('场景onResize', digitalTwinPlayer.value)
  if (digitalTwinApi.value?.isReady) {
    digitalTwinPlayer.value.ui_onResize && digitalTwinPlayer.value.ui_onResize()
    digitalTwinPlayer.value.resize && digitalTwinPlayer.value.resize()
    // 更新指南针位置
    if (gVar?.dtsCloud?.campass?.visible) {
      DtsFacade.updateCampassPostion()
    }
  }
}

//DTS初始化
const initDts = async () => {
  console.log('---DtsPlayer初始化---')
  //AirCloud云渲染服务器地址和端口
  let host = gVar.dtsCloud.player
  let username = gVar.dtsCloud.username
  let password = gVar.dtsCloud.password
  let pid: String = gVar.dtsCloud.pid || ''
  let iid: String = gVar.dtsCloud.iid || ''
  let needInstanceId = gVar.dtsCloud.needInstanceId || false
  //构造AirCityPlayer对象所需的参数选项，更多参数详情请参考API开发手册里AirCityPlayer对象
  if (iid == '' && needInstanceId) {
    let tokenRes: any = await getDtsToken(username, password)
    let authorization = tokenRes?.data?.authorization
    //console.log('tokenRes', tokenRes, authorization)
    if (authorization?.length > 0) {
      LocalStorage.setItem('ManageAuthorization', authorization)
    } else {
      console.info('连接DTS验证失败,请联系管理员！')
    }
    let resultObj = await getFreeInstance(pid)

    if (resultObj.data.result == 0) {
      iid = resultObj.data.id
    } else {
      ElMessage.error('无可用DTS实例,请联系管理员！')
      return
    }
  }

  let options = {
    //必选参数，网页显示视频流的domId
    domId: props.playerVariable,
    //实例id 如果想连接指定的云渲染实例，可以指定这个参数 不传入直接指定空闲实例
    iid: iid,
    //工程id
    pid: pid, //工程id不能写错会导致cloud工程无法切换
    //指定是否重置实例。如果设置reset为true，每次连接（包括刷新）都会得到一个全新的实例
    reset: gVar.dtsCloud?.reset || false,
    //必选参数，二次开发时必须指定，否则无法进行二次开发
    apiOptions: {
      //必选参数，与云渲染主机通信成功后的回调函数
      //注意：只有在onReady之后才可以调用AirCityAPI接口
      onReady: _onReady,
      onEvent: _onEvent //可选参数，三维场景交互事件回调函数
    },

    ui: {
      startupInfo: false, //可选参数，是否显示页面加载详细信息，默认值false
      statusButton: false, //可选参数，是否显示状态按钮，默认false
      fullscreenButton: gVar.dtsCloud?.showFullscreenButton || true, //全屏按钮
      homeButton: false, //场景默认视角
      mainUI: gVar.dtsCloud?.showMainUI || false, //Explorer UI
      campass: gVar.dtsCloud?.campass?.visible || false //指北针
    },

    //可选参数，设置三维交互的键盘事件接收者
    //注意：接收类型有视频标签(video)，网页文档(document)，空(none)
    keyEventTarget: 'video'
  }
  //构造player对象
  digitalTwinPlayer.value = new DigitalTwinPlayer(host, options)
  //构造AirCityAPI对象并初始化
  digitalTwinApi.value = digitalTwinPlayer.value.getAPI()
  //为避免实例化多个dts api问题，重新命名全局变量名
  let dtsApiObj: any = {}
  dtsApiObj[props.playerVariable] = digitalTwinPlayer.value.getAPI()
  Object.assign(window, dtsApiObj)
  store.dtsStore.dtApi = digitalTwinPlayer.value.getAPI()
}

/**
 * 事件传递包装器
 * @param e
 */
let _onReady = async (e: any) => {
  e = {}
  let context = { type: 'index', playerId: props.playerVariable }
  console.log('RtcPlayer onReady:', e, props)
  e.playerId = props?.playerVariable || '__xapi'

  // 仅当第一个场景初始化时获取图层树
  if (props.playerVariable == '__xapi') {
    await DtsFacade.getLayerTree()
  }

  EventDispatcher.onReady(e, context)
}

/**
 * 事件传递包装器
 * @param e
 */
let _onEvent = async (e: any) => {
  e.playerId = props.playerVariable
  EventDispatcher.onEvent(e)
}

/**
 * 窗口关闭监听
 */
let _windowsCloseHandler = () => {
  console.log('窗口关闭监听事件触发了')
}
</script>

<style lang="scss" scoped>
.player {
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 0;
}
</style>
