<template>
  <!-- 只有三维场景：不放任何面板。色板从地址里取：#/heatmap?palette=warm | ocean | risk -->
  <div class="heatdemo-main"><p v-if="error" class="error">{{ error }}</p></div>
</template>

<script setup lang="ts">
import { getRegionHeat } from '@/api/regionHeat'
import { cityBase } from '@/scene/CityBase'
import { DtsSceneApi } from '@/scene/DtsSceneApi'
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

watch(
  () => route.query.palette,
  () => scene?.setPalette(paletteKey())
)

onMounted(async () => {
  let data
  try {
    data = await getRegionHeat()
  } catch (e) {
    error.value = (e as Error).message ?? String(e)
    return
  }
  if (!(await cityBase.start()) || unmounting.signal.aborted) return
  scene = new HeatDemoScene(new DtsSceneApi(), data)
  await scene.setPalette(paletteKey())
  // 渲染端断开时场景调用会抛错：只记日志
  await scene.enter().catch(e => console.warn('[片区热力] 场景图层创建失败', e))
})

onBeforeUnmount(async () => {
  unmounting.abort()
  const leaving = scene?.leave()
  scene = null
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
