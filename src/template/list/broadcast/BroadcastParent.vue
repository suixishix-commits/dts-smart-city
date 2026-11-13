<template>
  <Broadcast v-if="noticeData.length > 0" :noticeData="noticeData"></Broadcast>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import Broadcast from './broadcast.vue'

const noticeData = ref([])

onMounted(async () => {
  getBroadcastInfo()
})
async function getBroadcastInfo() {
  const data = [{ content: '这是一条广播消息111' }, { content: '这是一条广播消息222' }, { content: '这是一条广播消息333' }]
  data.forEach((item) => {
    noticeData.value.push(item.content)
  })
}
</script>

<style lang="scss" scoped></style>
