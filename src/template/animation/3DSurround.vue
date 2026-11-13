<template>
  <div class="container">
    <div class="center"></div> <!-- 中心参考点 -->
    <!-- 基于父组件传入的items渲染元素 -->
    <div
        v-for="(item, index) in processedItems"
        :key="item.key || index"
        class="item"
        :style="{
        backgroundColor: item.color,
        transform: item.transform,
        zIndex: item.zIndex
      }"
        :title="`z: ${item.z.toFixed(1)}px, y: ${item.y.toFixed(1)}px, zIndex: ${item.zIndex}`"
    >
      {{ item.text }}
    </div>
  </div>
</template>

<script setup>
import {ref, onMounted, onUnmounted, watch} from 'vue';

// 接收父组件传入的items（必传，数组类型）
const props = defineProps({
  items: {
    type: Array,
    required: true,
    // 验证每个item的结构
    validator: (value) => {
      return value.every(item => {
        // 至少需要color属性，text可选（默认用索引+1）
        return typeof item.color === 'string';
      });
    },
    default: [
      {color: '#ff4444', text: 'A'},
      {color: '#ffbb33', text: 'B'},
      {color: '#00C851', text: 'C'},
      {color: '#33b5e5', text: 'D'},
      {color: '#aa66cc', text: 'E'},
      {color: '#ff8800', text: 'F'},
// 可以任意增减元素数量
    ]
  },
  // 可选配置参数（父组件可自定义）
  radius: {
    type: Number,
    default: 300
  },
  heightFactor: {
    type: Number,
    default: 0.4
  },
  speed: {
    type: Number,
    default: 0.01
  }
});

// 处理后的元素数据（存储动态属性：transform、z、y、zIndex）
const processedItems = ref([]);
let angleOffset = 0;
let animationId = null;

// 初始化处理后的元素（结合props.items和动态属性）
const initProcessedItems = () => {
  processedItems.value = props.items.map((item, index) => ({
    ...item,
    text: item.text ?? (index + 1), // 文本默认用索引+1
    key: item.key ?? index, // 默认为索引
    transform: '',
    z: 0,
    y: 0,
    zIndex: 0
  }));
};

// 更新元素位置和层级
const updatePositions = () => {
  angleOffset += props.speed;
  const itemZValues = [];
  const count = processedItems.value.length;

  processedItems.value.forEach((item, index) => {
    const angle = (index / count) * Math.PI * 2 + angleOffset;
    const x = Math.sin(angle) * props.radius;
    const z = Math.cos(angle) * props.radius; // z值越大，离观察者越近
    const y = z * props.heightFactor;

    // 计算3D变换矩阵
    const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
    item.transform = `matrix3d(${matrix.join(', ')})`;

    // 存储z值用于排序
    itemZValues.push({item, z});
    // 保存当前z和y值（用于调试title）
    item.z = z;
    item.y = y;
  });

  // 根据z值排序并设置zIndex（近处元素层级更高）
  itemZValues.sort((a, b) => b.z - a.z);
  itemZValues.forEach(({item}, index) => {
    item.zIndex = count - index;
  });

  animationId = requestAnimationFrame(updatePositions);
};

// 监听props.items变化，重新初始化
watch(
    () => props.items,
    () => {
      initProcessedItems();
    },
    {deep: true}
);

// 组件挂载时初始化并启动动画
onMounted(() => {
  initProcessedItems();
  updatePositions();
});

// 组件卸载时停止动画
onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
});
</script>

<style scoped>
.container {
  width: 800px;
  height: 600px;
  margin: 50px auto;
  perspective: 1000px;
  position: relative;
  border: 1px dashed #666;
}

.center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.item {
  width: 120px;
  height: 120px;
  position: absolute;
  top: 50%;
  left: 50%;
  margin: -60px 0 0 -60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  transition: transform 0.1s linear;
  border-radius: 8px;
}
</style>