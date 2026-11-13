<template>
  <ProjectDialog2
    ref="refProjectDialog"
    class="project-dialog"
    :visible="visible"
    title="结构缺陷"
    height="180px"
    width="420px"
    @opened="openDialog"
    @close="closeDialog"
  >
    <DefectList></DefectList>
  </ProjectDialog2>
</template>

<script setup lang="ts">
import DefectList from './DefectList.vue'
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
