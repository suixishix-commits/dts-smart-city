<template>
  <div>
    <!-- <RiskDection :visible="isShowRiskDialog" :userData="flyPathDataObj" @close="isShowRiskDialog = false"></RiskDection> -->
  </div>
</template>

<script lang="ts" setup>
import emitter from '@/utils/emitter'
import MittEvent from '@/utils/MittEvent'
// import * as turf from '@turf/turf'
import { ref } from 'vue'

// import RiskDection from '@/views/flight_plan/dialog/RiskDetection.vue'
import DtsFacade from '@/components/dts/DtsFacade'

import { startFlyByPath, createMarkerPopup, clearTimes } from '@/views/dts/FlyPlanFacade'
// import FlyWeather from '@/components/dts/FlyWeather'
// import { viewFile } from '@/api/system/file.js'
// import { fileDonwLoad } from '@/utils/request'
// import FlyPlanFacade from '@/components/dts/FlyPlanFacade'
// import ProjectSceneFacade from '@/components/dts/ProjectSceneFacade'

const currentDate = ref<Date>(new Date())

/**属性定义 */
const props = defineProps({
  flyLineData: {
    type: Array<any>,
    default: []
  }
})
/**飞行计划路线数据 */
const flyPathData = ref<any[]>([])
// 默认视角
const defaultView = [581483.97125, 3378799.150781, 43742.925, -32.088337, -97.548828]

/**是否打开风险检测对话框**/
const isShowRiskDialog = ref(false)

const popupWin = (e: MittEvent) => {
  console.log('recieve envent', e)
  let userData: any = {}
  let flyPathObj = findFlyPathData(e.data.id.split('_')[1])
  if (flyPathObj) {
    userData = flyPathObj.userData
  }
  console.log(userData)
  createMarkerPopup(e.data.mouseClickPoint, userData, { markerId: 'flyPath_m1', url: '/szdk/popup/feixingjihua.html', checkLandingPoint: true })
}

//根据飞行计划路线id查询相应数据
const findFlyPathData = (flyPathId: any) => {
  let toFindId = 'flyPath_' + flyPathId
  for (let i = 0; i < flyPathData.value.length; i++) {
    if (flyPathData.value[i].id == toFindId) {
      return flyPathData.value[i]
    }
  }
  return null
}

/********视觉跟随*********/
//为视觉跟随创建的飞 行胶囊飞行结束,需要删除
emitter.off('deleteCoCamereView')
emitter.on('deleteCoCamereView', async (id: any) => {
  console.log('deleteCoCamereView:' + id)
  __xapi.customObject.show('coFlyObj_' + id.split('_')[1])
  __xapi.customObject.delete(id)
})

const followFocus = async (dataId: string) => {
  console.log('followFocus: ' + dataId)
  let flyPathId = 'flyPath_' + dataId
  //先隐藏掉定时器中的
  __xapi.customObject.hide('coFlyObj_' + dataId)
  for (let i = 0; i < flyPathData.value.length; i++) {
    if (flyPathData.value[i].id == flyPathId) {
      let tmpArray = new Array()
      tmpArray.push(flyPathData.value[i])
      // console.log("find flyPath data", tmpArray[0]);
      await startFlyByPath(tmpArray)
      //__xapi.marker.setAttachCustomObject({ markerId: 'flyPath_marker', objectId: coFlyObjId, offset: [0, 0, 0] }, null)
      //隐藏信息弹窗
      __xapi.marker.hidePopupWindow('flyPath_marker')
      //高亮
      DtsFacade.highlightPolyline(flyPathId)
      break
    }
  }
}

emitter.off('gp_flightplan_co')
emitter.on('gp_flightplan_co', async (e: MittEvent) => {
  popupWin(e)
})
emitter.off('gp_flightplan_line')
emitter.on('gp_flightplan_line', async (e: MittEvent) => {
  console.log('recive fly evnent:gp_flightplan_line')
  popupWin(e)
})

/********风险对话框绑定属性******/
//飞行计划信息
const flyPathDataObj = ref<any>()

//弹窗事件处理
emitter.off('MarkerCallBack')
emitter.on('MarkerCallBack', (e: MittEvent) => {
  console.log('marker callback:', e)
  let msgObj = JSON.parse(e.data.Data)
  if (msgObj && msgObj.module == 'flyPlan') {
    //关闭事件
    if (msgObj.type == 'close') {
      __xapi.marker.delete(e.data.ID)
    }
    //文件下载
    else if (msgObj.type == 'download') {
      console.log('download...')
      // viewFile({ domain_type: 'flightplan', id: msgObj.data.fileId }).then((res: any) => {
      //   console.log('viewFile', res)
      //   if (res.data.files && res.data.files.length > 0) {
      //     console.log(res.data.files[0].originalUrl)
      //     fileDonwLoad(res.data.files[0].originalUrl, msgObj.data.fileName)
      //   }
      // })
    }
    //视角跟随
    else if (msgObj.type == 'followFocus') {
      let dataId = msgObj.data.id
      followFocus(dataId)
    }
    //风险监控
    else if (msgObj.type == 'riskMonitor') {
      let dataId = msgObj.data.id
      console.log('riskMonitor:' + dataId)
      __xapi.marker.hide('flyPath_marker')
      isShowRiskDialog.value = true
      let flyPathObj = findFlyPathData(dataId)
      console.log('risk findFlyPathData:' + flyPathData)
      if (flyPathData) {
        let item = flyPathObj.userData
        flyPathDataObj.value = item
      }
    }
  }
})

/********过滤事件处理**********/
const filterObj = reactive({
  //时间范围选择值
  timeRange: { startTime: '', endTime: '', isSelected: false },
  //高度范围选择值
  heightRange: { heightMin: NaN, heightMax: NaN, isSelected: false },
  //行政区域选择值
  region: {},
  //可能的其它属性过滤参数
  where: {}
})

watch(
  () => props.flyLineData,
  (newVal, oldVal) => {
    flyPathData.value = newVal
    // console.log("flyLineData changed!", flyPathData.value)
  }
)

onMounted(async () => {
  if (__xapi?.isReady) {
    // 清空其它模块渲染对象,如果放在Unmount中，可能执行比较晚，
    // 导致本模块新添加的对象被删除。特别是线对象
    await __xapi.polyline.clear()
    // initFlyPlanPath().then(data => {
    //   console.log('飞行计划路线', data)
    //   flyPathData.value = data
    //   // startFlyByPath(data)
    //   startFlyByLocation(data)
    // })
    // FlyWeather.show(true)
    // __xapi.camera.set(...defaultView)
  }
})

onBeforeUnmount(async () => {
  emitter.off('gp_flightplan_co')
  emitter.off('gp_flightplan_line')
  emitter.off('MarkerCallBack')
  emitter.off('currentSelectedTime')
  emitter.off('currentSelectedHeight')
  emitter.off('currentSelectedArea')
  emitter.off('set_weather_visible')
  emitter.off('deleteCoCamereView')

  //清除还在运行中的定时器
  clearTimes()

  // __xapi.marker.delete('flyPath_m1')
  // __xapi.infoTree.deleteByGroupId('gp_flightplan_line')
  // __xapi.infoTree.deleteByGroupId('gp_flightplan_co')
  __xapi.marker.clear()
  __xapi.customObject.clear()
  //await __xapi.polyline.clear()
  //清除天气设置
  // FlyWeather.show(false)
})
</script>

<style lang="scss" scoped>
//标题栏最外层容器
#layout_home_main {
  position: absolute;
  top: 0;
  z-index: 9999;
  width: 100%;
  height: 100%;
  // background: url('@/assets/home/both_side.png') no-repeat;
  background-size: 100% 100%;

  .titleBg {
    width: 100%;
    height: var(--titleHeight);
    // background: url('@/assets/title/top@2x.png') no-repeat center center / 100% 100%;
  }
}
</style>
