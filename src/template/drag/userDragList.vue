<template>
  <div class="drag-app">
    <h2 class="title">左右列表拖拽（支持内部排序）</h2>
    <div class="drag-container">
      <!-- 列表一：支持内部拖拽和跨列表拖拽 -->
      <DragList
          list-id="list1"
          title="列表一"
          :items="list1Items"
          @update:items="list1Items = $event"
          @remove-item="handleRemoveItem"
      />
      <!-- 列表二：支持内部拖拽和跨列表拖拽 -->
      <DragList
          list-id="list2"
          title="列表二"
          :items="list2Items"
          @update:items="list2Items = $event"
          @remove-item="handleRemoveItem"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DragList from './DragList.vue'

// 初始化数据（确保id唯一）
const list1Items = ref([
  { id: 'list1-1', content: '项目 1' },
  { id: 'list1-2', content: '项目 2' },
  { id: 'list1-3', content: '项目 3' }
])

const list2Items = ref([
  { id: 'list2-1', content: '项目 A' },
  { id: 'list2-2', content: '项目 B' },
  { id: 'list2-3', content: '项目 C' }
])

// 处理跨列表拖拽时从原列表移除元素
const handleRemoveItem = (listId, itemId) => {
  if (listId === 'list1') {
    list1Items.value = list1Items.value.filter(item => item.id !== itemId)
  } else if (listId === 'list2') {
    list2Items.value = list2Items.value.filter(item => item.id !== itemId)
  }
}
</script>

<style scoped>
.drag-app {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

.title {
  text-align: center;
  color: #fff;
  margin: 30px 0 20px;
}

.drag-container {
  display: flex;
  gap: 20px;
  padding: 10px;
}
</style>