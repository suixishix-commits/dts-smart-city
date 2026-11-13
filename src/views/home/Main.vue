<template>
  <div class="layout-main">
    <!--左侧按钮组-->
    <BtnGroupStyle2 @click="btnGroupClick" @close="closeHandler" @item_click="itemClickHandler" class="btn-group-left"> </BtnGroupStyle2>
    <!--右上角按钮组-->
    <BtnMenu @click="btnGroupClick" class="btn-group-right"></BtnMenu>
    <!--右下按钮组-->
    <BtnGroupStyle3 @click="btnGroupClick" class="btn-group-right2"></BtnGroupStyle3>
    <!--飞行计划-->
    <FlightPlan :fly-line-data="flyPathData"></FlightPlan>

    <CommonDialog
      :title="dialogTitle"
      :component-name="displayCompName"
      :visible="displayCompVisible"
      :width="dialogWidth"
      :height="dialogHeight"
      @close="closeComp"
    ></CommonDialog>
  </div>
</template>

<script setup lang="ts">
import { getDtsToken, getFreeInstance } from '@/api/dts/dts'
import DtsFacade from '@/components/dts/DtsFacade'
import ProjectSceneFacade from '@/components/ProjectSceneFacade'
import router from '@/router'
import BimFacade from '@/template/dts/bim/BimFacade'
import DeoneControl from '@/template/dts/drone/DeoneControl'
import DtsTemplateFacade from '@/template/dts/DtsTemplateFacade'
import CoordRandomUtil from '@/utils/CoordRandomUtil'
import CustomObjectUtils from '@/views/dts/CustomObjectUtils'
import HydrodYnamic2d from '@/views/dts/HydrodYnamic2d'
import Marker3DUtils from '@/views/dts/Marker3DUtils'
import Sluice from '@/views/dts/Sluice'
import Chailou from '../dts/Chailou'
import DrawPolyline from '../dts/DrawPolyline'
import GuideLine from '@/template/dts/guide-line/GuideLine'
import { demoGuideRides } from '@/template/dts/guide-line/guideRoutes'
import DtsEffects from '@/template/dts/effects/DtsEffects'
import { EFFECT_CLEAR_ALL, EFFECT_CLEAR_PREFIX, EFFECT_PREFIX, findEffect } from '@/template/dts/effects/effectCatalog'
import MarkerPopup from '../dts/MarkerPopup'
import FlightPlan from './FlightPlan.vue'
import AiChart from '@/template/echarts-comp/ai-charts/AiChart.vue'
import { findAiChart } from '@/template/echarts-comp/ai-charts/aiChartCatalog'

// 弹窗组件名称
const displayCompName = shallowRef<any>('BaseInfoEnumItemDialog')
const displayCompVisible = ref(false)
const dialogTitle = ref('默认标题')
const dialogWidth = ref('600px')
const dialogHeight = ref('400px')

const flyPathData = ref<any[]>([])

// 关闭弹窗组件名称
const closeComp = () => {
  displayCompVisible.value = false
}

// 按钮组
function btnGroupClick(item: any, count: any) {
  console.log(`第${count}次点了1111：`, item)
  switch (item.name) {
    case '右侧按钮-侧边栏':
      router.push({ path: '/sidebar' })
      break
    case '两侧隐藏':
      router.push({ path: '/collapsible-panel' })
      break
    case '有限元':
      router.push({ path: '/finite-element' })
      break
    case '宽屏布局':
      router.push({ path: '/widescreen' })
      break
    case '前后卡片':
      router.push({ path: '/frontAndBackCardLayout' })
      break
    case 'AI生成':
      router.push({ path: '/event-monitor' })
      break
    case '重置场景':
      if (__xapi?.isReady) {
        __xapi.reset(3)
      }
      break
    default:
      break
  }
}

// 关闭窗口
function closeHandler(e: any) {
  console.log('关闭窗口', e)
}
const fluidId = ref() //流体id

// 运行 / 清除特效，失败时提示原因
async function runEffect(value: string) {
  const clearing = value.startsWith(EFFECT_CLEAR_PREFIX)
  const id = value.slice((clearing ? EFFECT_CLEAR_PREFIX : EFFECT_PREFIX).length)
  const name = findEffect(id)?.name ?? '全部特效'
  try {
    if (value === EFFECT_CLEAR_ALL) await DtsEffects.clearAll()
    else if (clearing) await DtsEffects.clear(id)
    else await DtsEffects.run(id)
  } catch (err) {
    console.error(`特效「${name}」${clearing ? '清除' : '运行'}失败`, err)
    ElMessage.error(`特效「${name}」${clearing ? '清除' : '运行'}失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

// 按钮点击次数
const itemClountCount = {}
// 窗口点击
async function itemClickHandler(result: any) {
  let strClickItem = ''
  if (result?.water) {
    strClickItem = result.water[0]
  }

  // 点击次数计数
  if (itemClountCount[strClickItem]) {
    itemClountCount[strClickItem]++
  } else {
    itemClountCount[strClickItem] = 1
  }
  console.log(`第${itemClountCount[strClickItem]}次点击${strClickItem}`, result)
  // usecase AI 模块的图表样式
  const aiChart = findAiChart(strClickItem)
  if (aiChart) {
    dialogTitle.value = `${aiChart.group}-${aiChart.name}`
    dialogWidth.value = '800px'
    dialogHeight.value = '420px'
    displayCompName.value = markRaw({ render: () => h(AiChart, { type: aiChart.type }) })
    displayCompVisible.value = true
    return
  }
  // dts-vue 示例中心的特效
  if (strClickItem.startsWith(EFFECT_PREFIX) || strClickItem.startsWith(EFFECT_CLEAR_PREFIX)) {
    runEffect(strClickItem)
    return
  }
  switch (strClickItem) {
    case '浸润线':
      dialogTitle.value = '浸润线'
      dialogWidth.value = '700px'
      dialogHeight.value = '400px'
      displayCompName.value = 'SaturationChart'
      displayCompVisible.value = true
      break
    case '3D图形展示':
      Marker3DUtils.createMarker3D()
      break
    case 'Co对象展示':
      CustomObjectUtils.createCustomObject()
      break
    case '水深流速曲线':
      //console.log('点了水深流速曲线')
      dialogTitle.value = '水深流速曲线'
      dialogWidth.value = '700px'
      dialogHeight.value = '400px'
      displayCompName.value = 'Hydrodynamic2d'
      displayCompVisible.value = true
      break
    case '水文站曲线':
      console.log('点了水文站曲线')
      dialogTitle.value = '水情-水文站曲线'
      dialogWidth.value = '1200px'
      dialogHeight.value = '600px'
      displayCompName.value = 'ShuiQing'
      displayCompVisible.value = true
      break
    case '工程安全评估':
      console.log('工程安全评估')
      dialogTitle.value = '工情-工程安全评估'
      dialogWidth.value = '100vw'
      dialogHeight.value = '100vh'
      displayCompName.value = 'SafetyAssessment'
      displayCompVisible.value = true
      break
    case '工情-滚动表格':
      console.log('点了工情-滚动表格')
      dialogTitle.value = '工情-测点滚动表格'
      dialogWidth.value = '600px'
      dialogHeight.value = '400px'
      displayCompName.value = 'ScrollTable'
      displayCompVisible.value = true
      break
    case '工情-重要测点曲线':
      console.log('点了工情-重要测点曲线')
      dialogTitle.value = '工情-重要测点曲线'
      dialogWidth.value = '500px'
      dialogHeight.value = '300px'
      displayCompName.value = 'ScalableChart'
      displayCompVisible.value = true
      break
    case '枚举-水库基本信息':
      console.log('点了枚举-水库基本信息')
      dialogTitle.value = '枚举-水库基本信息'
      dialogWidth.value = '600px'
      dialogHeight.value = '300px'
      displayCompName.value = 'BaseInfoEnumItem'
      displayCompVisible.value = true
      break
    case '水情-多年同期来水':
      dialogTitle.value = '水情-多年同期来水'
      dialogWidth.value = '1200px'
      dialogHeight.value = '600px'
      displayCompName.value = 'WaterOfMultiYear'
      displayCompVisible.value = true
      break
    case '列表项-结构缺陷':
      dialogTitle.value = '列表项-结构缺陷'
      dialogWidth.value = '420px'
      dialogHeight.value = '180px'
      displayCompName.value = 'DefectList'
      displayCompVisible.value = true
      break
    case '列表项-循环播报':
      dialogTitle.value = '列表项-循环播报'
      dialogWidth.value = '420px'
      dialogHeight.value = '100px'
      displayCompName.value = 'BroadcastParent'
      displayCompVisible.value = true
      break
    case '列表项-环形图':
      dialogTitle.value = '列表项-环形图'
      dialogWidth.value = '620px'
      dialogHeight.value = '300px'
      displayCompName.value = 'RingParent'
      displayCompVisible.value = true
      break
    case '列表项-带背景环形图':
      dialogTitle.value = '列表项-带背景环形图'
      dialogWidth.value = '820px'
      dialogHeight.value = '520px'
      displayCompName.value = 'RingBackgroundParent'
      displayCompVisible.value = true
      break
    case '列表项-摄像头统计':
      dialogTitle.value = '列表项-摄像头统计'
      dialogWidth.value = '620px'
      dialogHeight.value = '650px'
      displayCompName.value = 'CameraStatistics'
      displayCompVisible.value = true
      break
    case '列表项-CPU使用率排名':
      dialogTitle.value = '列表项-CPU使用率排名'
      dialogWidth.value = '1220px'
      dialogHeight.value = '650px'
      displayCompName.value = 'CpuUsageRank'
      displayCompVisible.value = true
      break
    case '列表项-完成情况':
      dialogTitle.value = '列表项-完成情况'
      dialogWidth.value = '700px'
      dialogHeight.value = '300px'
      displayCompName.value = 'CompletionStatus'
      displayCompVisible.value = true
      break
    case '灾情-库区淹没经济损失':
      dialogTitle.value = '灾情-库区淹没经济损失'
      dialogWidth.value = '460px'
      dialogHeight.value = '300px'
      displayCompName.value = 'KuQuYanMo'
      displayCompVisible.value = true
      break
    case '工情-水库调度图':
      dialogTitle.value = '工情-水库调度图'
      dialogWidth.value = '1345px'
      dialogHeight.value = '750px'
      displayCompName.value = 'ShuiKuDiaoDu'
      displayCompVisible.value = true
      break
    case '雨情-严坪村':
      dialogTitle.value = '雨情-严坪村2号桥处模拟结果'
      dialogWidth.value = '1000px'
      dialogHeight.value = '480px'
      displayCompName.value = 'YuLiangZhan1'
      displayCompVisible.value = true
      break
    case '雨情-流域雨情':
      dialogTitle.value = '雨情-流域雨情'
      dialogWidth.value = '460px'
      dialogHeight.value = '320px'
      displayCompName.value = 'LiuYuYuQing'
      displayCompVisible.value = true
      break
    case '水情-水库水情':
      dialogTitle.value = '水情-水库水情'
      dialogWidth.value = '1355px'
      dialogHeight.value = '640px'
      displayCompName.value = 'ShuiKuShuiQing'
      displayCompVisible.value = true
      break
    case '水情-河道实时水情':
      dialogTitle.value = '水情-河道实时水情'
      dialogWidth.value = '450px'
      dialogHeight.value = '350px'
      displayCompName.value = 'HeDaoShuiQing'
      displayCompVisible.value = true
      break
    case '枚举-纳洪纳雨':
      dialogTitle.value = '枚举-纳洪纳雨'
      dialogWidth.value = '460px'
      dialogHeight.value = '246px'
      displayCompName.value = 'NaHongNaYu'
      displayCompVisible.value = true
      break
    case '雨情-降雨预报':
      dialogTitle.value = '雨情-降雨预报'
      dialogWidth.value = '1000px'
      dialogHeight.value = '600px'
      displayCompName.value = 'YuBaoJiangYu'
      displayCompVisible.value = true
      break
    case '水情-水库水位预报':
      dialogTitle.value = '水情-水库水位预报'
      dialogWidth.value = '900px'
      dialogHeight.value = '520px'
      displayCompName.value = 'YuBaoShuiKuShuiWei'
      displayCompVisible.value = true
      break
    case 'Dts其它-天气系统':
      dialogTitle.value = 'Dts其它-天气系统'
      dialogWidth.value = '800px'
      dialogHeight.value = '420px'
      displayCompName.value = 'WeatherSetting'
      displayCompVisible.value = true
      break
    case '柱状图-渐变&圆弧顶部':
      dialogTitle.value = '柱状图-渐变&圆弧顶部'
      dialogWidth.value = '800px'
      dialogHeight.value = '420px'
      displayCompName.value = 'ZhuZhuangGradation'
      displayCompVisible.value = true
      break
    case '曲线图-自动滚动':
      dialogTitle.value = '柱状图-自动滚动'
      dialogWidth.value = '800px'
      dialogHeight.value = '420px'
      displayCompName.value = 'QuXianRollingGrafation'
      displayCompVisible.value = true
      break
    case '飞行计划':
      DrawPolyline.drawFlyRoute(CoordRandomUtil.multiLine).then((result: any) => {
        console.log('drawFlyRoute result:', result)
        flyPathData.value = result
      })
      break
    case '牵引线-静态':
      GuideLine.start(demoGuideRides(), false)
      break
    case '牵引线-生长':
      GuideLine.start(demoGuideRides(), true)
      break
    case '牵引线-清除':
      GuideLine.stop()
      break
    case '画面并附加文字':
      console.log('画面并附加文字')
      DrawPolygon.drawPolygon3DText()
      break
    case '弹框展示':
      MarkerPopup.showMarkerPopup([
        { name: '水库1', lnglat: [116.307428, 39.986762] },
        { name: '水库2', lnglat: [116.307428, 39.986762] }
      ])
      // console.log('弹框展示')
      break
    case '二维水动力-版本1':
      HydrodYnamic2d.drawHydrodYnamic2dshp('Cell4').then((result: any) => {
        console.log('二维水动力-版本1:加载成功')
      })
      break
    case '颜色面板':
      dialogTitle.value = '颜色面板'
      dialogWidth.value = '600px'
      dialogHeight.value = '620px'
      displayCompName.value = 'ColorPanelView'
      displayCompVisible.value = true
      break
    case '列表项-完成进度':
      dialogTitle.value = '列表项-完成进度'
      dialogWidth.value = '700px'
      dialogHeight.value = '200px'
      displayCompName.value = 'CompletionProgress'
      displayCompVisible.value = true
      break
    case 'sider图':
      dialogTitle.value = 'sider图'
      dialogWidth.value = '400px'
      dialogHeight.value = '300px'
      displayCompName.value = 'sider'
      displayCompVisible.value = true
      break
    case '饼环图':
      dialogTitle.value = '饼环图'
      dialogWidth.value = '300px'
      dialogHeight.value = '300px'
      displayCompName.value = 'Piechart'
      displayCompVisible.value = true
      break
    case '拆楼-实例化':
      Chailou.newInstance()
    case '拆楼-弹开':
      Chailou.moveUp()
      break
    case '拆楼-收拢':
      Chailou.moveDown()
      break
    case '拆楼-拉出':
      let pullData = [
        { floorId: 'floor-2', verticalMoveDistance: 30 },
        { floorId: 'floor-3', verticalMoveDistance: 10 }
      ]
      Chailou.pull(pullData)
      break
    case '拆楼-推入':
      let pushData = ['floor-3', 'floor-2']
      Chailou.push(pushData)
      break
    case '拆楼-重置':
      Chailou.reset()
      break
    case '图层树':
      dialogTitle.value = '图层树'
      dialogWidth.value = '25vw'
      dialogHeight.value = '80vh'
      displayCompName.value = 'InfoTree'
      displayCompVisible.value = true
      break
    case '图层Actor':
      dialogTitle.value = '图层Actor'
      dialogWidth.value = '30vw'
      dialogHeight.value = '80vh'
      displayCompName.value = 'BasicActorView'
      displayCompVisible.value = true
      break
    case 'Actor绑定':
      dialogTitle.value = 'Actor绑定'
      dialogWidth.value = '30vw'
      dialogHeight.value = '80vh'
      displayCompName.value = 'ActorDataBind'
      displayCompVisible.value = true
      break
    case 'BIMActor':
      dialogTitle.value = 'Bim Actor'
      dialogWidth.value = '60vw'
      dialogHeight.value = '80vh'
      displayCompName.value = 'BimActorView'
      displayCompVisible.value = true
      break
    case '山体模拟放水':
      fluidId.value = await Sluice.fluidAdd([{ id: 'fffff_1', sources: [] }])
      await Sluice.fluidSources([{ id: fluidId.value[0], sources: [] }])
      __xapi.camera.set([490435.450625, 2488810.2825, 557.175313, -36.43644, -156.514771, 0])
      break
    case '停止放水':
      Sluice.stopSource([{ pId: fluidId.value[0], cId: Sluice.mapFluid.get(fluidId.value[0]).sources.map((i: any) => i.id) }])
      break
    case '继续放水':
      Sluice.continueSource([{ pId: fluidId.value[0], cId: Sluice.mapFluid.get(fluidId.value[0]).sources.map((i: any) => i.id) }])
      break
    case '时间轴-每天':
      dialogTitle.value = '时间轴-每天'
      dialogWidth.value = '1200px'
      dialogHeight.value = '160px'
      displayCompName.value = 'DateAxis'
      displayCompVisible.value = true
      break
    case '时间轴-24小时':
      dialogTitle.value = '时间轴-24小时'
      dialogWidth.value = '1200px'
      dialogHeight.value = '196px'
      displayCompName.value = 'TimeLine'
      displayCompVisible.value = true
      break
    case '视频监控-大华':
      dialogTitle.value = '大华播放器'
      dialogWidth.value = '700px'
      dialogHeight.value = '400px'
      displayCompName.value = 'DhPlayer'
      displayCompVisible.value = true
      break
    case '视频监控-海康H5':
      dialogTitle.value = '海康监控'
      dialogWidth.value = '120rem'
      dialogHeight.value = '85rem'
      displayCompName.value = 'CameraPlayerMain'
      displayCompVisible.value = true
      break
    case '后台API-登录验证':
      let res: any = await getDtsToken(gVar.dtsCloud.username, gVar.dtsCloud.password)
      console.log('后台请求返回结果:', res)
      if (res?.data?.authorization) {
        SessionStorage.setItem('userInfo', { token: res.data.authorization })
      }
      break
    case '后台API-带token请求':
      let res2: any = await getFreeInstance(1)
      console.log('后台请求返回结果:', res2)
      break
    case '开闸放水-带粒子':
      if (itemClountCount[strClickItem] % 2 == 1) {
        DtsTemplateFacade.toggleSluiceWaterFlow(true)
      } else {
        DtsTemplateFacade.toggleSluiceWaterFlow(false)
      }
      break
    case 'BIM-生成映射文件':
      let layerId = DtsFacade.getLayerId('villa')[0]
      // 一个BIM字段值可对应多个Actor,也可只返回最后一个Actor
      let actorMapper = await BimFacade.getActorIdMapper(layerId, '类型', true)
      console.log('actorMapper:', actorMapper)
      alert('请在控制台查看映射文件内容')
      break
    case 'BIM-提取Actor坐标':
      let layerId1 = DtsFacade.getLayerId('villa')[0]
      // 一个BIM字段值可对应多个Actor,也可只返回最后一个Actor
      let actorMapper1 = await BimFacade.getActorMapper(layerId1, '类型', true)
      console.log('actorMapper:', actorMapper1)
      alert('请在控制台查看返回结果')
      break
    case 'BIM-图层所有BIM信息':
      let layerId2 = DtsFacade.getLayerId('villa')[0]
      // 一个BIM字段值可对应多个Actor,也可只返回最后一个Actor
      let bimDs = await BimFacade.getBimLayerDbDataInculdingLocation(layerId2)
      console.log('actorMapper:', bimDs)
      alert('请在控制台查看返回结果')
      break
    case '无人机模拟飞行':
      DeoneControl.showUavFlyLine('指挥中心到医院', true)
      console.log('无人机模拟飞行')
      break
    case '车辆轨迹':
      dialogTitle.value = '车辆轨迹'
      dialogWidth.value = '140rem'
      dialogHeight.value = '40rem'
      displayCompName.value = 'VehicleTrajectory'
      displayCompVisible.value = true
      break
    case '顺序排序':
      dialogTitle.value = '顺序排序'
      dialogWidth.value = '60rem'
      dialogHeight.value = '60rem'
      displayCompName.value = 'sortAndRag'
      displayCompVisible.value = true
      break
    case '双向排序':
      dialogTitle.value = '双向排序'
      dialogWidth.value = '100rem'
      dialogHeight.value = '60rem'
      displayCompName.value = 'userDragList'
      displayCompVisible.value = true
      break
    case '课表排序':
      dialogTitle.value = '课表排序'
      dialogWidth.value = '120rem'
      dialogHeight.value = '60rem'
      displayCompName.value = 'dragAndDdropSchedule'
      displayCompVisible.value = true
      break
    case '3d环绕':
      dialogTitle.value = '3d环绕'
      dialogWidth.value = '100rem'
      dialogHeight.value = '80rem'
      displayCompName.value = '3DSurround'
      displayCompVisible.value = true
      break
    case '开启无人机监控':
      ProjectSceneFacade.startMonitor()
      break
    case '关闭无人机监控':
      ProjectSceneFacade.stopMonitor()
      break
    case '开启飞行':
      ProjectSceneFacade.startScenePlayer()
      break
    case '关闭飞行':
      ProjectSceneFacade.stopScenePlayer()
      break
    default:
      break
  }
}
</script>

<style lang="scss" scoped>
.layout-main {
  position: absolute;
  width: 100%;
  height: calc(100% - $titleHeight);
  display: flex;
  margin-top: $titleHeight;
  overflow: hidden;

  .btn-group-left {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
  }

  .btn-group-right {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
  }

  .btn-group-right2 {
    position: absolute;
    right: 1rem;
    bottom: 1rem;
  }
}
</style>
