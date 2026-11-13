<!--未使用封装方法版-->
<template>
  <div class="camera-players">
    <el-row>
      <el-col :span="24" :md="12">
        <el-affix :offset="8">
          <div id="player"></div>
        </el-affix>
        <el-form-item>
          分屏
          <el-radio-group v-model="splitNum" @change="arrangeWindow">
            <el-radio-button :value="1">1x1</el-radio-button>
            <el-radio-button :value="2">2x2</el-radio-button>
            <el-radio-button :value="3" v-show="!isMoveDevice">3x3</el-radio-button>
            <el-radio-button :value="4" v-show="!isMoveDevice">4x4</el-radio-button>
          </el-radio-group>
          <el-button @click="wholeFullScreen" v-show="!isMoveDevice">整体全屏</el-button>
        </el-form-item>
      </el-col>
      <el-col :span="24" :md="12">
        <div class="actions">
          <el-tabs v-model="tabActive">
            <el-tab-pane label="普通模式" name="mse" :disabled="!mseSupport"></el-tab-pane>
            <el-tab-pane label="高级模式" name="decoder"></el-tab-pane>
            <!-- <el-tab-pane label="日志" name="log"></el-tab-pane> -->
          </el-tabs>

          <el-form :label-width="labelCol.width" v-show="tabActive !== 'log'">
            <el-form-item label="预览URL">
              <el-input v-model="urls.realplay"></el-input>
            </el-form-item>
            <el-form-item label="对讲URL">
              <el-input v-model="urls.talk"></el-input>
            </el-form-item>
            <el-form-item label="预览&对讲">
              <el-button id="btn-realplay" @click="realplay">开始预览</el-button>
              <el-button id="btn-realplay-stop" @click="stopPlay">停止预览</el-button>
              <el-button id="btn-talk-start" @click="talkStart">开始对讲</el-button>
              <el-button id="btn-talk-stop" @click="talkStop">停止对讲</el-button>
              <el-button id="btn-stopall" @click="stopAllPlay">停止全部窗口</el-button>
            </el-form-item>

            <el-form-item label="回放URL">
              <el-input v-model="urls.playback"></el-input>
              <br />
              <el-date-picker
                v-model="playback.startTime"
                type="datetime"
                placeholder="开始时间"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
              >
              </el-date-picker>
              <el-date-picker v-model="playback.endTime" type="datetime" placeholder="结束时间" format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss">
              </el-date-picker>
            </el-form-item>
            <el-form-item label="回放">
              <el-button id="btn-playback" @click="playbackStart">开始回放</el-button>
              <el-button id="btn-playback-pause" @click="playbackPause">暂停</el-button>
              <el-button id="btn-playback-resume" @click="playbackResume">恢复</el-button>
              <el-button id="btn-playback-stop" @click="stopPlay">停止回放</el-button>
              <br />
              <el-row>
                <el-col :span="16">
                  <el-button id="btn-playback-slow" @click="playbackSlow">慢放</el-button>
                  <el-button id="btn-playback-fast" @click="playbackFast">快放</el-button>
                  <el-button id="btn-playback-one" @click="frameForward" v-show="tabActive === 'decoder'">单帧</el-button>
                  <br />
                  <el-date-picker
                    v-model="playback.seekStart"
                    type="datetime"
                    placeholder="开始时间"
                    format="YYYY-MM-DD HH:mm:ss"
                    value-format="YYYY-MM-DD HH:mm:ss"
                  >
                  </el-date-picker>
                  &nbsp;<el-button @click="seekTo">定位</el-button>
                </el-col>
                <el-col :span="8">
                  <el-statistic title="当前播放速度" :value="playback.rate"></el-statistic>
                </el-col>
              </el-row>
            </el-form-item>

            <el-form-item label="声音">
              <el-row>
                <el-col :span="10">
                  <el-button id="btn-sound-open" @click="openSound">开启</el-button>
                  <el-button id="btn-sound-close" @click="closeSound">关闭</el-button>
                </el-col>
                <el-col :span="12">
                  <div class="icon-wrapper">
                    <el-icon v-if="muted" :size="20">
                      <TurnOff />
                    </el-icon>
                    <el-icon v-else :size="20">
                      <ArrowUp />
                    </el-icon>
                    <el-slider v-model="volume" :default-value="50" :disabled="muted" @change="setVolume"></el-slider>
                  </div>
                </el-col>
              </el-row>
            </el-form-item>

            <el-form-item label="抓图&录像">
              <el-button id="btn-capture-jpeg" @click="capture('JPEG')">抓取JPEG</el-button>
              <el-button id="btn-capture-bmp" @click="capture('BMP')">抓取BMP</el-button>
              <br />
              <el-button id="btn-record-mp4" @click="recordStart('MP4')">录制MP4</el-button>
              <el-button id="btn-record-ps" @click="recordStart('PS')">录制PS</el-button>
              <el-button id="btn-record-save" @click="recordStop">停止录制并保存文件</el-button>
            </el-form-item>

            <el-form-item label="视频信息&OSD时间">
              <el-button id="btn-video-info" @click="getvideoInfo">获取视频信息</el-button>
              <el-button id="btn-ose-time" @click="getOSDTime">获取OSD时间</el-button>
            </el-form-item>

            <el-form-item label="电子放大&智能信息" v-show="tabActive === 'decoder'">
              <el-button id="btn-enlarge-open" @click="enlarge">开启电子放大</el-button>
              <el-button id="btn-enlarge-close" @click="enlargeClose">关闭电子放大</el-button>
              <el-button id="btn-intellect-open" @click="intellectTrigger(true)">开启智能信息</el-button>
              <el-button id="btn-intellect-close" @click="intellectTrigger(false)">关闭智能信息</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import moment from 'moment'
import { ArrowUp, TurnOff } from '@element-plus/icons-vue'

const IS_MOVE_DEVICE = document.body.clientWidth < 992 // 是否移动设备
const MSE_IS_SUPPORT = !!window.MediaSource // 是否支持mse

const isMoveDevice = ref(IS_MOVE_DEVICE)
const player = ref(null)
const splitNum = ref(IS_MOVE_DEVICE ? 1 : 2)
const mseSupport = ref(MSE_IS_SUPPORT)
const tabActive = ref(MSE_IS_SUPPORT ? 'mse' : 'decoder')
const labelCol = { span: 5 }
const wrapperCol = { span: 18 }
const urls = ref({
  realplay: 'ws://10.19.147.22:559/EUrl/q2jQie4',
  talk: 'wss://10.41.163.126:6014/proxy/10.41.163.126:559/EUrl/6gFx47S',
  playback: 'wss://10.41.163.126:6014/proxy/10.41.163.126:559/EUrl/6gFx47S'
})
const playback = ref({
  startTime: '2021-07-26T00:00:00',
  endTime: '2021-07-26T23:59:59',
  valueFormat: 'YYYY-MM-DDTHH:mm:ss',
  seekStart: '2021-07-26T12:00:00',
  rate: 0
})
const muted = ref(true)
const volume = ref(50)

const volumeOnSvg = {
  template:
    '<svg t="1624453273744" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1421" width="200" height="200"><path d="M597.994667 138.005333q130.005333 28.010667 213.994667 132.992t84.010667 241.002667-84.010667 241.002667-213.994667 132.992l0-88q93.994667-28.010667 153.002667-106.005333t59.008-180.010667-59.008-180.010667-153.002667-106.005333l0-88zM704 512q0 120-106.005333 172.010667l0-344q106.005333 52.010667 106.005333 172.010667zM128 384l170.005333 0 213.994667-213.994667 0 684.010667-213.994667-213.994667-213.994667-170.005333 0 0-256 202.005333 0-202.005333-202.005333zM810.005333 512q0-101.994667-59.008-180.010667t-153.002667-106.005333l0-88q130.005333 28.010667 213.994667 132.992t84.010667 241.002667q0 96-44.010667 178.005333l-64-66.005333q21.994667-53.994667 21.994667-112zM704 512q0 18.005333-2.005333 26.005333l-104-104 0-93.994667q106.005333 52.010667 106.005333 172.010667z" p-id="1422"></path></svg>'
}

const volumeOffSvg = {
  template:
    '<svg t="1624453193279" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="9147" width="200" height="200"><path d="M512 170.005333l0 180.010667-90.005333-90.005333zM181.994667 128l714.005333 714.005333-53.994667 53.994667-88-88q-74.005333 58.005333-156.010667 77.994667l0-88q50.005333-13.994667 96-50.005333l-181.994667-181.994667 0 288-213.994667-213.994667-170.005333 0 0-256 202.005333 0-202.005333-202.005333zM810.005333 512q0-101.994667-59.008-180.010667t-153.002667-106.005333l0-88q130.005333 28.010667 213.994667 132.992t84.010667 241.002667q0 96-44.010667 178.005333l-64-66.005333q21.994667-53.994667 21.994667-112zM704 512q0 18.005333-2.005333 26.005333l-104-104 0-93.994667q106.005333 52.010667 106.005333 172.010667z" p-id="9148"></path></svg>'
}

const mode = computed(() => (tabActive.value === 'mse' ? 0 : 1))

const init = () => {
  // 设置播放容器的宽高并监听窗口大小变化
  window.addEventListener('resize', () => {
    player.value.JS_Resize()
  })
}

const createPlayer = () => {
  player.value = new window.JSPlugin({
    szId: 'player',
    szBasePath: '/static/haikuang/',
    iMaxSplit: 4,
    iCurrentSplit: IS_MOVE_DEVICE ? 1 : 2,
    openDebug: true,
    oStyle: {
      borderSelect: IS_MOVE_DEVICE ? '#000' : '#FFCC00'
    }
  })

  // 事件回调绑定
  player.value.JS_SetWindowControlCallback({
    windowEventSelect: (iWndIndex) => {
      //插件选中窗口回调
      console.log('windowSelect callback: ', iWndIndex)
    },
    pluginErrorHandler: (iWndIndex, iErrorCode, oError) => {
      //插件错误回调
      console.log('pluginError callback: ', iWndIndex, iErrorCode, oError)
    },
    windowEventOver: (iWndIndex) => {
      //鼠标移过回调
      console.log(iWndIndex)
    },
    windowEventOut: (iWndIndex) => {
      //鼠标移出回调
      console.log(iWndIndex)
    },
    windowEventUp: (iWndIndex) => {
      //鼠标mouseup事件回调
      console.log(iWndIndex)
    },
    windowFullCcreenChange: (bFull) => {
      //全屏切换回调
      console.log('fullScreen callback: ', bFull)
    },
    firstFrameDisplay: (iWndIndex, iWidth, iHeight) => {
      //首帧显示回调
      console.log('firstFrame loaded callback: ', iWndIndex, iWidth, iHeight)
    },
    performanceLack: () => {
      //性能不足回调
      console.log('performanceLack callback: ')
    }
  })
}

const arrangeWindow = (val) => {
  player.value.JS_ArrangeWindow(splitNum.value).then(
    () => {
      console.log(`arrangeWindow to ${splitNum}x${splitNum} success`)
    },
    (e) => {
      console.error(e)
    }
  )
}

const wholeFullScreen = () => {
  player.value.JS_FullScreenDisplay(true).then(
    () => {
      console.log(`wholeFullScreen success`)
    },
    (e) => {
      console.error(e)
    }
  )
}

/* 预览&对讲 */
const realplay = () => {
  const index = player.value.currentWindowIndex
  player.value.JS_Play(urls.value.realplay, { playURL: urls.value.realplay, mode: mode.value }, index).then(
    () => {
      console.log('realplay success')
    },
    (e) => {
      console.error(e)
    }
  )
}

const stopPlay = () => {
  player.value.JS_Stop().then(
    () => {
      playback.value.rate = 0
      console.log('stop realplay success')
    },
    (e) => {
      console.error(e)
    }
  )
}

const talkStart = () => {
  player.value.JS_SetConnectTimeOut(0, 1000)
  player.value.JS_StartTalk(urls.value.talk).then(
    () => {
      console.log('talkStart success')
    },
    (e) => {
      console.error(e)
    }
  )
}

const talkStop = () => {
  player.value.JS_StopTalk().then(
    () => {
      console.log('talkStop success')
    },
    (e) => {
      console.error(e)
    }
  )
}

const stopAllPlay = () => {
  player.value.JS_StopRealPlayAll().then(
    () => {
      playback.value.rate = 0
      console.log('stopAllPlay success')
    },
    (e) => {
      console.error(e)
    }
  )
}

/* 回放 */
const playbackStart = () => {
  const index = player.value.currentWindowIndex
  let { startTime, endTime } = playback.value

  startTime += 'Z'
  endTime += 'Z'

  player.value.JS_Play(urls.value.playback, { playURL: urls.value.playback, mode: mode.value }, index, startTime, endTime).then(
    () => {
      console.log('playbackStart success')
      playback.value.rate = 1
    },
    (e) => {
      console.error(e)
    }
  )
}

const playbackPause = () => {
  player.value.JS_Pause().then(
    () => {
      console.log('playbackPause success')
    },
    (e) => {
      console.error(e)
    }
  )
}

const playbackResume = () => {
  player.value.JS_Resume().then(
    () => {
      console.log('playbackResume success')
    },
    (e) => {
      console.error(e)
    }
  )
}

const seekTo = () => {
  let { seekStart, endTime } = playback.value
  seekStart += 'Z'
  endTime += 'Z'
  player.value.JS_Seek(player.value.currentWindowIndex, seekStart, endTime).then(
    () => {
      console.log('seekTo success')
    },
    (e) => {
      console.error(e)
    }
  )
}

const playbackSlow = () => {
  player.value.JS_Slow().then(
    (rate) => {
      playback.value.rate = rate
    },
    (e) => {
      console.error(e)
    }
  )
}

const playbackFast = () => {
  player.value.JS_Fast().then(
    (rate) => {
      playback.value.rate = rate
    },
    (e) => {
      console.error(e)
    }
  )
}

const frameForward = () => {
  player.value.JS_FrameForward(player.value.currentWindowIndex).then(
    () => {
      playback.value.rate = 1
      console.log('frameForward success')
    },
    (e) => {
      console.error(e)
    }
  )
}

/* 声音、抓图、录像 */
const openSound = () => {
  player.value.JS_OpenSound().then(
    () => {
      console.log('openSound success')
      muted.value = false
    },
    (e) => {
      console.error(e)
    }
  )
}

const closeSound = () => {
  player.value.JS_CloseSound().then(
    () => {
      console.log('closeSound success')
      muted.value = true
    },
    (e) => {
      console.error(e)
    }
  )
}

const setVolume = (value) => {
  const index = player.value.currentWindowIndex
  player.value.JS_SetVolume(index, value).then(
    () => {
      console.log('setVolume success', value)
    },
    (e) => {
      console.error(e)
    }
  )
}

const capture = (imageType) => {
  const index = player.value.currentWindowIndex
  player.value.JS_CapturePicture(index, 'img', imageType).then(
    () => {
      console.log('capture success', imageType)
    },
    (e) => {
      console.error(e)
    }
  )
}

const recordStart = (type) => {
  const codeMap = { MP4: 5, PS: 2 }
  const index = player.value.currentWindowIndex
  const fileName = `${moment().format('YYYYMMDDHHmm')}.mp4`
  const typeCode = codeMap[type]

  player.value.JS_StartSaveEx(index, fileName, typeCode).then(
    () => {
      console.log('record start ...')
    },
    (e) => {
      console.error(e)
    }
  )
}

const recordStop = () => {
  const index = player.value.currentWindowIndex
  player.value.JS_StopSave(index).then(
    () => {
      console.log('record stoped, saving ...')
    },
    (e) => {
      console.error(e)
    }
  )
}

/* 电子放大、智能信息 */
const enlarge = () => {
  const index = player.value.currentWindowIndex
  player.value.JS_EnableZoom(index).then(
    () => {
      console.log('enlarge start..., select range...')
    },
    (e) => {
      console.error(e)
    }
  )
}

const enlargeClose = () => {
  const index = player.value.currentWindowIndex
  player.value.JS_DisableZoom(index).then(
    () => {
      console.log('enlargeClose success')
    },
    (e) => {
      console.error(e)
    }
  )
}

const intellectTrigger = (openFlag) => {
  const index = player.value.currentWindowIndex
  const result = player.value.JS_RenderALLPrivateData(index, openFlag)
  console.log(`${openFlag ? 'open' : 'close'} intellect ${result === 1 ? 'success' : 'failed'}`)
}

const getvideoInfo = () => {
  const index = player.value.currentWindowIndex
  player.value.JS_GetVideoInfo(index).then((videoInfo) => {
    console.log('videoInfo:', videoInfo)
  })
}

const getOSDTime = () => {
  const index = player.value.currentWindowIndex
  player.value.JS_GetOSDTime(index).then((time) => {
    console.log('osdTime:', new Date(time))
  })
}

onMounted(() => {
  init()
  createPlayer()
})
</script>

<style scoped lang="scss">
.camera-players {
  margin-top: 200px;
  pointer-events: all;
}
</style>
