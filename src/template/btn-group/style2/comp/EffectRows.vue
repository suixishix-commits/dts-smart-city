<template>
  <div class="effect_rows">
    <div class="item">
      <div class="left">
        <span class="text">{{ title }}</span>
      </div>
      <div class="right">
        <div
          v-for="effect in effects"
          :key="effect.id"
          :class="['filterOption', on.has(effect.id) ? 'checkedItem' : '']"
          :title="`${effect.desc}${effect.pak === 'single' ? `\n需要单独的 PAK：${effect.pakFile}` : ''}\n再点一次清除`"
          @click="toggle(effect.id)"
        >
          {{ effect.name }}
        </div>
        <div class="filterOption" title="清除本面板运行的特效" @click="clearAll">清除特效</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 面板里的「特效」行：dts-vue 示例中心某个分组的特效（effectCatalog）。点一下运行，再点一下清除；
 * 运行后页面右侧有实时调节面板。输出 `{ water: ['特效-<id>'] }` / `['特效清除-<id>']`，由 Main.vue 交给 DtsEffects 执行。
 */
import { EFFECT_CLEAR_PREFIX, EFFECT_PREFIX, findGroup } from '@/template/dts/effects/effectCatalog'

const props = defineProps({
  /** effectCatalog 里的分组名 */
  group: {
    type: String,
    required: true
  },
  /** 行标题 */
  title: {
    type: String,
    default: '特效'
  }
})
const emit = defineEmits(['item_click'])

const effects = computed(() => findGroup(props.group)?.items ?? [])

/** 已运行（选中）的特效 */
const on = reactive(new Set<string>())

const toggle = (id: string) => {
  const running = on.has(id)
  if (running) on.delete(id)
  else on.add(id)
  emit('item_click', { water: [`${running ? EFFECT_CLEAR_PREFIX : EFFECT_PREFIX}${id}`] })
}

const clearAll = () => {
  for (const id of [...on]) toggle(id)
}
</script>

<style scoped lang="scss">
// 与所在面板（CompDtsPolyline 等）的行样式一致
.item {
  display: flex;
  width: 100%;

  .left {
    flex: none;
    margin-top: 0.8rem;
    width: 10.8rem;
    height: 2rem;
    line-height: 2rem;
    background: url('../assets/airway_left_bg.png') no-repeat 0 0 / 100% 100%;

    .text {
      margin-left: 1.45rem;
    }
  }

  .right {
    display: flex;
    flex-wrap: wrap;
    width: 48rem;

    .filterOption {
      cursor: pointer;
      margin-bottom: 0.4rem;
      padding: 0 2rem;
      height: 3.6rem;
      line-height: 3.6rem;
    }

    .checkedItem {
      background: url('../assets/airway_item_checked_bg.png') no-repeat 0 0 / 100% 100%;
      color: #3afbf7;
    }
  }
}
</style>
