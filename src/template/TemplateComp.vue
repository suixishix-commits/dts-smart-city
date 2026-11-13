<template>
  <div class="box-template"></div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'

// 绑定数据
const listData: any = ref([])
// 初始化UI
async function initGUI() {
  let res: any = await getTemplateData('/assets/data.json')
  console.log('后台数据:？', res)
  if (res?.data?.data) {
    listData.value = res.data.data
  }
}
onMounted(() => {
  initGUI()
})

onBeforeUnmount(() => {})
</script>

<style lang="scss" scoped>
.box-template {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
