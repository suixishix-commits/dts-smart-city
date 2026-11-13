<template>
  <ProjectDialog2
    ref="refProjectDialog"
    class="project-dialog"
    :visible="visible"
    title="工情监测"
    height="400px"
    width="600px"
    @opened="openDialog"
    @close="closeDialog"
  >
    <ScrollTable></ScrollTable>
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
  refProjectDialog.value.visible = false
}

onMounted(() => {})

defineExpose({
  visible
})
</script>

<style lang="scss" scoped>
.project-dialog {
  .chartBox {
    position: relative;
    width: 100%;
    height: 100%;
    padding-bottom: 3px;
    .location {
      position: absolute;
      padding-left: 33px;
      z-index: 99;
      color: white;
    }
  }
}
</style>
