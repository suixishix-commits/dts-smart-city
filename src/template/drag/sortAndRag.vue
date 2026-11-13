<template>
  <div class="tag-container">
    <h3 style="color:#fff">{{ title }}</h3>
    <ul class="tag-list">
      <!-- 遍历标签列表，绑定拖拽属性和事件 -->
      <li
          v-for="(tag, index) in tags"
          :key="tag.id"
      class="tag-item"
      :class="{
      dragging: draggedIndex === index,  // 拖拽中样式
      'drag-over': dragOverIndex === index  // 拖拽经过样式
      }"
      draggable="true"
      @dragstart="handleDragStart(index)"
      @dragend="handleDragEnd"
      @dragover.prevent
      @dragenter.prevent="handleDragEnter(index)"
      @dragleave="handleDragLeave(index)"
      @drop.prevent="handleDrop(index)"
      >
      {{ tag.name }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue';

// 组件props：接收标题和初始标签列表
const props = defineProps({
  title: {
    type: String,
    default: '热门标签（可拖拽排序）'
  },
  initialTags: {
    type: Array,
    default: () => [
      { id: 1, name: '前端开发' },
      { id: 2, name: 'HTML5' },
      { id: 3, name: 'JavaScript' },
      { id: 4, name: 'CSS3' },
      { id: 5, name: 'Vue' },
      { id: 6, name: 'React' }
    ]
  }
});

// 响应式数据：标签列表、拖拽状态
const tags = ref([...props.initialTags]); // 复制初始数据，避免修改源数据
const draggedIndex = ref(-1); // 被拖拽元素的索引（-1表示无拖拽）
const dragOverIndex = ref(-1); // 拖拽经过元素的索引

// 拖拽开始：记录被拖拽元素索引
const handleDragStart = (index) => {
  draggedIndex.value = index;
};

// 拖拽结束：重置拖拽状态
const handleDragEnd = () => {
  draggedIndex.value = -1;
  dragOverIndex.value = -1;
};

// 拖拽进入：记录经过元素的索引（显示提示样式）
const handleDragEnter = (index) => {
  // 排除自身，且只在拖拽状态下生效
  if (draggedIndex.value !== -1 && draggedIndex.value !== index) {
    dragOverIndex.value = index;
  }
};

// 拖拽离开：清除经过元素的提示样式
const handleDragLeave = (index) => {
  if (dragOverIndex.value === index) {
    dragOverIndex.value = -1;
  }
};

// 放置元素：调整标签顺序，抛出排序结果
const handleDrop = (targetIndex) => {
  // 避免自己拖自己
  if (draggedIndex.value === targetIndex) return;

  // 复制当前数组（避免直接修改响应式数组导致的问题）
  const newTags = [...tags.value];
  // 从原位置删除被拖拽元素
  const [movedItem] = newTags.splice(draggedIndex.value, 1);
  // 插入到目标位置
  newTags.splice(targetIndex, 0, movedItem);

  // 更新响应式数组（触发DOM更新）
  tags.value = newTags;
  // 重置状态
  dragOverIndex.value = -1;

  // 抛出排序后的结果（供父组件使用）
  emit('sort-change', [...tags.value]);
};

// 定义组件事件：排序变化时触发
const emit = defineEmits(['sort-change']);
</script>

<style scoped>
.tag-container {
  width: 500px;
  margin: 50px auto;
  padding: 20px;
  border: 2px dashed #ccc;
  border-radius: 8px;
}

.tag-container h3 {
  text-align: center;
  color: #333;
  margin: 0 0 20px;
}

.tag-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tag-item {
  padding: 10px 15px;
  margin: 8px 0;
  background: #f0f7ff;
  border: 1px solid #e1f0fe;
  border-radius: 20px;
  cursor: grab;
  transition: all 0.2s;
}

/* 拖拽中样式 */
.tag-item.dragging {
  opacity: 0.5;
  transform: scale(1.02);
  background: #e1f0fe;
  cursor: grabbing;
}

/* 拖拽经过样式（提示插入位置） */
.tag-item.drag-over {
  border-top: 2px solid #4096ff;
}
</style>