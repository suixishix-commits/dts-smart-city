<!--使用类封装方法，将播放器的创建、播放控制、分屏、全屏等功能封装成一个组件。-->
<template>
  <el-row class="camera-players">
    <!-- 左侧列，用于分屏和全屏操作 -->
    <el-col :span="10" :md="10" class="left-col" style="margin-right: 6rem">
      <!-- 固定分屏窗口 -->
      <el-affix :offset="8">
        <div id="player"></div>
      </el-affix>
      <!-- 分屏数量选择 -->
      <el-form-item>
        分屏
        <el-radio-group v-model="splitNum" @change="player.arrangeWindow">
          <el-radio-button :value="1">1x1</el-radio-button>
          <el-radio-button :value="2">2x2</el-radio-button>
          <el-radio-button :value="3" v-show="!isMoveDevice">3x3</el-radio-button>
          <el-radio-button :value="4" v-show="!isMoveDevice">4x4</el-radio-button>
        </el-radio-group>
        <!-- 整体全屏按钮，仅在非移动设备上显示 -->
        <el-button @click="player.wholeFullScreen" v-show="!isMoveDevice">整体全屏</el-button>
      </el-form-item>
    </el-col>
    <!-- 右侧列，用于操作播放器的各种功能 -->
    <el-col :span="20" :md="12">
      <div class="actions">
        <!-- 标签页导航，用于选择不同的播放模式 -->
        <el-tabs v-model="tabActive">
          <el-tab-pane label="普通模式" name="mse" :disabled="!mseSupport"></el-tab-pane>
          <el-tab-pane label="高级模式" name="decoder"></el-tab-pane>
        </el-tabs>
        <!-- 表单，用于输入播放器的各种配置 -->
        <el-form :label-width="labelCol.width" v-show="tabActive !== 'log'">
          <!-- 输入预览URL -->
          <el-form-item label="预览URL">
            <el-input v-model="urls.realplay"></el-input>
          </el-form-item>
          <!-- 输入对讲URL -->
          <el-form-item label="对讲URL">
            <el-input v-model="urls.talk"></el-input>
          </el-form-item>
          <!-- 预览和对讲操作按钮 -->
          <el-form-item label="预览&对讲">
            <el-button @click="startRealPlay">开始预览</el-button>
            <el-button @click="stopRealPlay">停止预览</el-button>
            <el-button @click="startTalk">开始对讲</el-button>
            <el-button @click="stopTalk">停止对讲</el-button>
            <el-button @click="stopAllPlay">停止全部窗口</el-button>
          </el-form-item>
          <!-- 输入回放URL -->
          <el-form-item label="回放URL">
            <el-input v-model="urls.playback" style="margin-bottom: 1rem"></el-input>
            <!-- 选择回放的开始时间 -->
            <el-date-picker
              v-model="playback.startTime"
              type="datetime"
              placeholder="开始时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
            ></el-date-picker>
            <!-- 选择回放的结束时间 -->
            <el-date-picker
              v-model="playback.endTime"
              type="datetime"
              placeholder="结束时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
            ></el-date-picker>
          </el-form-item>
          <!-- 回放操作按钮 -->
          <el-form-item label="回放">
            <el-button @click="startPlayback">开始回放</el-button>
            <el-button @click="player.playbackPause">暂停</el-button>
            <el-button @click="player.playbackResume">恢复</el-button>
            <el-button @click="stopPlayback" style="margin-right: 2rem">停止回放</el-button>
            <el-button @click="slowPlayback" style="margin: 0">慢放</el-button>
            <el-button @click="fastPlayback">快放</el-button>
            <!-- 单帧前进按钮，仅在高级模式下显示 -->
            <el-button @click="frameForward" v-show="tabActive === 'decoder'">单帧</el-button>
            <!-- 定位回放开始时间 -->
            <el-date-picker
              v-model="playback.seekStart"
              type="datetime"
              placeholder="开始时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
            ></el-date-picker>
            <!-- 定位按钮 -->
            <el-button @click="seekTo" style="margin: 0 2rem">定位</el-button>
            <!-- 显示当前回放速度 -->
            <el-statistic title="当前播放速度" :value="playback.rate"></el-statistic>
          </el-form-item>
          <!-- 声音控制按钮和滑动条 -->
          <el-form-item label="声音">
            <!-- 开启或关闭声音按钮 -->
            <el-button id="btn-sound-open" @click="toggleSound('openSound')">开启</el-button>
            <el-button id="btn-sound-close" @click="toggleSound('closeSound')">关闭</el-button>
            <!-- 声音图标和音量滑动条 -->
            <div class="icon-wrapper">
              <!-- 根据声音是否被静音显示不同图标 -->
              <el-icon style="margin: 0 1rem">
                <Microphone v-if="!muted" />
                <Mute v-else />
              </el-icon>
              <!-- 音量调节滑动条，如果声音被静音则不可用 -->
              <div style="width: 30rem">
                <el-slider v-model="volume" :disabled="muted" @change="setVolume"></el-slider>
              </div>
            </div>
          </el-form-item>
          <!-- 抓图和录像操作按钮 -->
          <el-form-item label="抓图&录像">
            <el-button @click="capture('JPEG')">抓取JPEG</el-button>
            <el-button @click="capture('BMP')">抓取BMP</el-button>
            <el-button @click="record('MP4')">录制MP4</el-button>
            <el-button @click="record('PS')">录制PS</el-button>
            <el-button @click="stopRecord" style="margin-top: 1.5rem; margin-left: 0">停止录制并保存文件</el-button>
          </el-form-item>
          <!-- 获取视频信息和OSD时间按钮 -->
          <el-form-item label="视频信息&OSD时间">
            <el-button @click="getVideoInfo">获取视频信息</el-button>
            <el-button @click="getOSDTime">获取OSD时间</el-button>
          </el-form-item>
          <!-- 电子放大和智能信息操作按钮，仅在高级模式下显示 -->
          <el-form-item label="电子放大&智能信息" v-show="tabActive === 'decoder'">
            <el-button @click="player.enlarge">开启电子放大</el-button>
            <el-button @click="player.enlargeClose">关闭电子放大</el-button>
            <el-button @click="player.intellectTrigger(true)">开启智能信息</el-button>
            <el-button @click="player.intellectTrigger(false)" style="margin: 0; margin-top: 1.5rem">关闭智能信息</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-col>
  </el-row>
</template>

<script setup>
import moment from 'moment' // 引入moment库，用于日期和时间的操作
import { ref, computed, onMounted } from 'vue' // 引入Vue的响应式API
import { Microphone, Mute } from '@element-plus/icons-vue' // 引入Element Plus的图标组件
import CameraPlayers from './CameraPlayers' // 引入CameraPlayers类
// 创建一个CameraPlayers实例的引用
const player = ref(new CameraPlayers())

// 表单标签宽度设置
const labelCol = { span: 5 }

// 定义组件的props
const props = defineProps({
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

// 是否为移动设备的响应式引用
const isMoveDevice = ref(window.innerWidth < 992)

// 分屏数量的响应式引用，初始值根据是否为移动设备决定
const splitNum = ref(isMoveDevice.value ? 1 : 2)

// 是否支持MSE的响应式引用
const mseSupport = ref(!!window.MediaSource)

// 当前活动标签页的响应式引用，初始值根据是否支持MSE决定
const tabActive = ref(mseSupport.value ? 'mse' : 'decoder')

// 将props中的URLs赋值给响应式引用urls
const urls = ref(props.propsUrls)

// 将props中的播放配置赋值给响应式引用playback
const playback = ref(props.propsPlayback)

// 声音是否被静音的响应式引用
const muted = ref(true)

// 当前音量的响应式引用
const volume = ref(50)

// 计算属性，根据当前活动标签页决定模式（0为普通模式，1为高级模式）
const mode = computed(() => (tabActive.value === 'mse' ? 0 : 1))

// 监听窗口大小的变化，调整isMoveDevice和splitNum的值
window.addEventListener('resize', () => {
  isMoveDevice.value = window.innerWidth < 992
  splitNum.value = isMoveDevice.value ? 1 : 2
})

// 在组件挂载时初始化播放器
onMounted(() => {
  player.value.createPlayer(
    new window.JSPlugin({
      szId: 'player', // 播放器容器ID
      szBasePath: '/static/haikuang/playctrl1/', // 插件基础路径
      iMaxSplit: 4, // 最大分屏数量
      iCurrentSplit: splitNum.value, // 当前分屏数量
      openDebug: true, // 开启调试模式
      oStyle: {
        borderSelect: isMoveDevice.value ? '#000' : '#FFCC00' // 根据设备类型设置选中窗口的边框颜色
      }
    })
  )
})

// 定义一些方法来处理事件
// 开始预览
const startRealPlay = () => player.value.realplay(mode.value, urls.value)
// 停止预览
const stopRealPlay = () => player.value.stopPlay(playback.value)
// 开始对讲
const startTalk = () => player.value.talkStart(urls.value)
// 停止对讲
const stopTalk = () => player.value.talkStop()
// 停止所有播放窗口
const stopAllPlay = () => player.value.stopAllPlay(playback.value)
// 开始回放
const startPlayback = () => player.value.playbackStart(mode.value, urls.value, playback.value)
// 停止回放
const stopPlayback = () => player.value.stopPlay(playback.value)
// 慢放回放
const slowPlayback = () => player.value.playbackSlow(playback.value)
// 快放回放
const fastPlayback = () => player.value.playbackFast(playback.value)
// 单帧前进
const frameForward = () => player.value.frameForward(playback.value)
// 定位回放开始时间
const seekTo = () => player.value.seekTo(playback.value)
// 开启或关闭声音
const toggleSound = async (type) => {
  muted.value = await player.value[type]()
}
// 设置音量
const setVolume = () => player.value.setVolume(volume.value)
// 抓图
const capture = (type) => player.value.capture(type)
// 开始录像
const record = (type) => player.value.recordStart(type)
// 停止录像并保存文件
const stopRecord = () => player.value.recordStop()
// 获取视频信息
const getVideoInfo = () => player.value.getvideoInfo()
// 获取OSD时间
const getOSDTime = () => player.value.getOSDTime()
</script>

<style scoped lang="scss">
.camera-players {
  margin-top: 40px;
}
:deep(.el-col) {
  box-sizing: border-box;
  align-items: end;
  flex-direction: column;
  display: flex;
}
.icon-wrapper {
  display: flex;
  align-items: center;
}
:deep(.el-tabs__item),
:deep(.el-form-item__label),
:deep(.el-statistic__head),
:deep(.el-statistic__content),
:deep(.el-form-item__content) {
  color: #fff;
}
.left-col {
  :deep(.el-form-item__content) {
    margin-top: 2rem;
    gap: 2rem;
  }
}
</style>
