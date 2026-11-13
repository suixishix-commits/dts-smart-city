<template>
  <div>
    <sortAndRag
        title="我的技术栈（可拖拽排序）"
        :initial-tags="myTags"
        @sort-change="handleSortChange"
    ></sortAndRag>
  </div>
</template>

<script setup>
import sortAndRag from './sortAndRag.vue';
// 自定义初始标签
const myTags = ref([
  { id: 101, name: 'TypeScript' },
  { id: 102, name: 'Node.js' },
  { id: 103, name: 'Webpack' },
  { id: 104, name: 'Vite' },
  { id: 105, name: 'Pinia' }
]);

// 监听排序变化
const handleSortChange = (sortedTags) => {
  console.log('排序后的标签：', sortedTags);
  // 可在这里同步更新父组件数据或提交到后端
};
</script>