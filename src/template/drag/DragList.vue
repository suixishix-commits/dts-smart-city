<template>
  <div
    class="drag-list"
    :class="{ 'drag-over': isDragOver }"
    @dragover.prevent="handleDragOver"
    @dragenter.prevent="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <h3>{{ title }}</h3>
    <div
      v-for="item in items"
      :key="item.id"
      class="drag-item"
      draggable="true"
      :data-id="item.id"
      @dragstart="handleDragStart(item, $event)"
      @dragend="handleDragEnd($event)"
    >
      {{ item.content }}
    </div>
  </div>
</template>

<script setup>
import { dragState } from './dragState.js'

const props = defineProps({
  listId: { type: String, required: true },
  title: { type: String, required: true },
  items: { type: Array, required: true }
})

const emit = defineEmits(['update:items', 'remove-item'])
const isDragOver = ref(false)

// 允许拖拽放置
const handleDragOver = (e) => {
  e.dataTransfer.dropEffect = 'move'
}

// 开始拖拽
const handleDragStart = (item, e) => {
  dragState.setDragging(item, props.listId)
  e.target.classList.add('dragging')
  e.dataTransfer.setData('text/plain', JSON.stringify(item))
  // 创建拖拽视觉反馈
  const dragImage = e.target.cloneNode(true)
  dragImage.style.position = 'absolute'
  dragImage.style.top = '-1000px'
  document.body.appendChild(dragImage)
  e.dataTransfer.setDragImage(dragImage, 0, 0)
}

// 结束拖拽
const handleDragEnd = (e) => {
  e.target.classList.remove('dragging')
  isDragOver.value = false
  document.querySelectorAll('.drag-item[style*="top: -1000px"]').forEach((img) => img.remove())
}

// 拖拽进入列表
const handleDragEnter = () => {
  isDragOver.value = true // 允许同一列表内拖拽时也高亮
}

// 拖拽离开列表
const handleDragLeave = (e) => {
  const container = e.currentTarget
  const rect = container.getBoundingClientRect()
  const isOutside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom
  if (isOutside) {
    isDragOver.value = false
  }
}

// 处理放置（核心逻辑：支持同列表排序和跨列表拖拽）
const handleDrop = (e) => {
  const draggedItem = dragState.draggingItem
  const fromList = dragState.fromList

  if (!draggedItem) return

  // 1. 同一列表内拖拽排序
  if (fromList === props.listId) {
    const dropTarget = e.target.closest('.drag-item')
    // 排除拖拽自身的情况
    if (dropTarget && dropTarget.dataset.id !== draggedItem.id) {
      const newItems = [...props.items]
      const dragIndex = newItems.findIndex((item) => item.id === draggedItem.id)
      const targetIndex = newItems.findIndex((item) => item.id === dropTarget.dataset.id)

      if (dragIndex !== -1 && targetIndex !== -1) {
        const [movedItem] = newItems.splice(dragIndex, 1)
        // 根据拖拽方向插入（上方/下方）
        newItems.splice(targetIndex, 0, movedItem)
        emit('update:items', newItems)
      }
    }
  }
  // 2. 跨列表拖拽
  else {
    // 添加到当前列表
    const newItems = [...props.items, { ...draggedItem }]
    emit('update:items', newItems)
    // 通知原列表移除
    emit('remove-item', fromList, draggedItem.id)
  }

  dragState.clear()
  isDragOver.value = false
}
</script>

<style scoped>
.drag-list {
  flex: 1;
  min-height: 300px;
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 10px;
  transition: all 0.3s ease;
}

.drag-over {
  border-color: #42b983;
  background: rgba(66, 185, 131, 0.1);
}

.drag-item {
  padding: 12px 15px;
  margin-bottom: 10px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: grab;
  transition: all 0.2s ease;
  user-select: none;
}

.drag-item:active {
  cursor: grabbing;
}

.drag-item.dragging {
  opacity: 0.6;
  transform: scale(0.98);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}
</style>
