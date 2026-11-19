<template>
  <!-- 只有三维场景：不放任何面板。地址参数：palette=warm|ocean|risk 色板；lines=1 显示热力值的线（等值线）；animate=1 每 6 秒随机改一次数值，看过渡效果 -->
  <div class="heatdemo-main"><p v-if="error" class="error">{{ error }}</p></div>
</template>

<script setup lang="ts">
import { getRegionHeat } from '@/api/regionHeat'
import { cityBase } from '@/scene/CityBase'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
import { applyAmbience, plainMap } from '@/scene/effects'
import { whenSceneReady } from '@/scene/sceneReady'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { HeatDemoScene, PALETTES } from './HeatDemoScene'

const route = useRoute()
const error = ref('')
let scene: HeatDemoScene | null = null
const unmounting = new AbortController()

const paletteKey = () => {
  const q = String(route.query.palette ?? '')
  return PALETTES.some(p => p.key === q) ? q : PALETTES[0].key
}

const linesOn = () => route.query.lines === '1'

watch(
  () => route.query.palette,
  () => scene?.setPalette(paletteKey())
)
watch(
  () => route.query.lines,
  () => scene?.setLines(linesOn())
)

/** 演示数值变化：每个片区在原值的 0.5–1.5 倍之间随机浮动，热力原地平滑过渡 */
let animTimer = 0
function startAnimate(base: { code: string; value: number }[]) {
  window.clearInterval(animTimer)
  if (route.query.animate !== '1') return
  animTimer = window.setInterval(() => {
    void scene?.setValues(Object.fromEntries(base.map(r => [r.code, r.value * (0.5 + Math.random())])))
  }, 6000)
}

onMounted(async () => {
  let data
  try {
    data = await getRegionHeat()
  } catch (e) {
    error.value = (e as Error).message ?? String(e)
    return
  }
  // 不启动城市底座（黄昏色调、路网、开场动画）：干净的底图上只画热力
  if (!(await whenSceneReady(unmounting.signal))) return
  try {
    if (cityBase.geo) await cityBase.setRoadsVisible(false)
    else await Promise.all((['marker', 'polygon', 'polyline', 'customMesh', 'radiationPoint', 'heatmap'] as const).map(t => __xapi[t].clear()))
    await plainMap()
  } catch (e) {
    console.warn('[片区热力] 底图准备失败', e)
  }
  if (unmounting.signal.aborted) return
  scene = new HeatDemoScene(new DtsSceneApi(), data)
  await scene.setPalette(paletteKey())
  await scene.setLines(linesOn())
  // 渲染端断开时场景调用会抛错：只记日志
  await scene.enter().catch(e => console.warn('[片区热力] 场景图层创建失败', e))
  startAnimate(data.regions.map(r => ({ code: r.code, value: r.value })))
})

onBeforeUnmount(async () => {
  unmounting.abort()
  window.clearInterval(animTimer)
  const leaving = scene?.leave()
  scene = null
  // 回到其它模块时恢复底座路网和色调
  if (cityBase.geo) void Promise.all([cityBase.setRoadsVisible(true), applyAmbience()]).catch(() => {})
  await leaving?.catch(e => console.warn('[片区热力] 场景图层清理失败', e))
})
</script>

<style lang="scss" scoped>
.heatdemo-main {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.error {
  position: absolute;
  left: 24px;
  bottom: 24px;
  margin: 0;
  color: $level-1;
}
</style>
