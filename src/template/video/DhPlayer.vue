<template>
  <div class="dh-player-container">
    <!-- 播放器容器（唯一 ID 用于实例绑定） -->
    <div :id="videoId" class="dh-player"></div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue'

// 1. 定义 props
const props = defineProps({
  channelCode: {
    type: String,
    default: '1000010$1$0$0' // 通道编码（多个通道用逗号分隔）
  },
  channelName: {
    type: String,
    default: '通道名称'
  },
  videoId: {
    type: String,
    default: () => `dhplayer-${Math.floor(Math.random() * 1000000)}` // 唯一 ID
  },
  playerType: {
    type: Number,
    default: 0 // 0-实时预览；3-录像回放；7-支持倒放的回放
  },
  division: {
    type: Number,
    default: 1 // 窗口数量（与通道数量一致）
  }
})

// 2. 状态管理与响应式数据
// const store = useStore()
const jingTou_show = true // 从 Vuex 获取显示状态
const myVideoPlayer = ref(null) // 播放器实例
const pluginLoginInfo = reactive({
  host: '60.12.169.229', // 大华平台 IP
  port: '10443', // 端口
  username: 'OpenAPI', // 用户名
  password: 'ylgj1234' // 密码
})

// 3. 初始化配置（从环境变量读取配置，优先于默认值）
if (import.meta.env.VITE_DH_PLUGIN_INFO) {
  Object.assign(pluginLoginInfo, JSON.parse(import.meta.env.VITE_DH_PLUGIN_INFO))
}

// 4. 生命周期钩子
onMounted(() => {
  if (typeof VideoPlayer != 'undefined') {
    // 确保 DOM 加载完成后初始化播放器
    if (props.channelCode) {
      initDHPlayer()
    }
  } else {
    console.log('未安装大华播放器插件，请安装插件后重试！')
  }
})

onBeforeUnmount(() => {
  // 销毁播放器实例，避免内存泄漏
  if (myVideoPlayer.value) {
    myVideoPlayer.value.destroy()
    myVideoPlayer.value = null
  }
})

// 5. 监听数据变化
watch(
  () => props.channelCode,
  (newVal) => {
    if (!newVal) return
    // 先销毁旧实例，再初始化新实例
    if (myVideoPlayer.value) {
      myVideoPlayer.value.destroy()
      myVideoPlayer.value = null
    }
    // 延迟初始化，确保 DOM 已更新
    setTimeout(() => initDHPlayer(), 300)
  },
  { immediate: true }
)

watch(
  () => jingTou_show.value,
  (newVal) => {
    if (newVal) {
      myVideoPlayer.value?.show()
    } else {
      myVideoPlayer.value?.hide()
    }
  }
)

// 6. 核心方法：初始化播放器
function initDHPlayer() {
  // 创建播放器实例
  myVideoPlayer.value = new VideoPlayer({
    videoId: props.videoId, // 绑定容器 ID
    windowType: props.playerType, // 播放器类型
    usePluginLogin: true, // 启用插件登录
    pluginLoginInfo: pluginLoginInfo, // 登录信息
    division: props.channelCode.split(',').length, // 窗口数量（与通道数一致）
    draggable: false, // 禁止窗口拖拽
    showBar: false, // 隐藏底部操作栏

    // 7. 回调函数
    createSuccess: (versionInfo) => {
      console.log('播放器初始化成功', versionInfo)
      // 初始化成功后加载通道
      const channels = props.channelCode.split(',')
      channels.forEach((code, index) => {
        startReal(code, index) // 每个通道对应一个窗口
      })
    },

    createError: (err) => {
      console.error('播放器初始化失败', err)
      // 提示安装插件
      if (confirm('未检测到大华播放器插件，是否下载安装？')) {
        window.open('/DhPlugin/DHPlayerSetup.exe') // 插件下载地址
      }
    },

    // 实时预览成功回调
    realSuccess: (info) => {
      console.log('实时预览成功', info)
    },

    // 抓图成功回调（处理 base64 图片）
    snapshotSuccess: ({ base64Url }) => {
      const byteCharacters = atob(base64Url.replace(/^data:image\/(png|jpeg);base64,/, ''))
      const byteArray = new Uint8Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i)
      }
      const blob = new Blob([byteArray], { type: 'image/png' })
      // 下载图片
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `snapshot-${new Date().getTime()}.png`
      a.click()
    },

    // 其他回调（按需实现）
    clickWindow: (snum) => console.log('点击窗口：', snum),
    dbClickWindow: (snum) => console.log('双击窗口：', snum),
    closeWindowSuccess: () => console.log('窗口关闭成功')
  })

  // 暴露实例到全局，方便调试
  window.__dhPlayerInstance = myVideoPlayer.value
}

// 8. 播放实时预览
function startReal(channelCode, snum = 0) {
  if (!myVideoPlayer.value) return
  myVideoPlayer.value.startReal([
    {
      channelId: channelCode, // 通道编码
      channelName: props.channelName, // 通道名称
      snum: snum, // 窗口序号（从 0 开始）
      streamType: 1, // 1-主码流；2-辅码流
      deviceType: 5, // 设备类型（对讲用）
      cameraType: '1', // 摄像头类型
      capability: '00000000000000000000000000000001' // 设备能力集
    }
  ])
}

// 9. 其他方法（按需扩展）
function startPlayback(date) {
  // 录像回放逻辑（需传入日期参数）
  if (!myVideoPlayer.value || props.playerType !== 3) return
  myVideoPlayer.value.startPlayback([
    {
      channelId: props.channelCode,
      startTime: `${date} 00:00:00`,
      endTime: `${date} 23:59:59`,
      snum: 0
    }
  ])
}
</script>

<style scoped>
.dh-player-container {
  color: red;
  width: 100%;
  height: 100%;
  position: relative;
}

.dh-player {
  width: 100%;
  height: 100%;
  min-height: 400px; /* 确保容器有初始高度 */
  background: #000;
}
</style>
