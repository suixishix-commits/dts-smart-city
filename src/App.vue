<template>
  <el-config-provider :locale="locale" :size="size">
    <router-view />
  </el-config-provider>
</template>
<script setup lang="ts">
import store from '@/stores/index'
import { messages } from '@/i18n'
const locale = computed(() => messages[store.appStore.language]?.el)
const size = computed(() => store.appStore.componentSize)
onMounted(() => {
  console.log('全局变量:', gVar)
})
</script>
