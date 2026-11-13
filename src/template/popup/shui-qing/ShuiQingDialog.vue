<template>
  <ProjectDialog2
    ref="refProjectDialog"
    class="project-dialog"
    :visible="visible"
    title="河道水情"
    height="600px"
    width="1200px"
    @opened="openDialog"
    @close="closeDialog"
  >
    <ShuiQing></ShuiQing>
  </ProjectDialog2>
</template>

<script setup lang="ts">
// 属性定义
const props = defineProps({
  visible: {
    type: Boolean,
    default: true
  }
})
// 事件定义
const emit = defineEmits(['opened', 'close'])
//弹窗引用
const refProjectDialog = ref()
const visible = ref(props.visible)

// 监测属性变化
watch([() => props.visible], (newVal, oldVal) => {
  let flag = false
  if (newVal[0] != oldVal[0]) {
    visible.value = newVal[0]
    if (visible.value) {
      flag = true
    }
  }
})

// 显示Dialog
const openDialog = () => {
  emit('opened', {})
  //console.log('显示Dialog', props)
}
// 关闭Dialog
const closeDialog = () => {
  //console.log('关闭Dialog')
  emit('close', {})
  visible.value = false
}

onMounted(() => {})

defineExpose({
  visible
})
</script>

<style lang="scss" scoped></style>
