<template>
  <div class="container">
    <canvas ref="roadCanvas" class="canvasMain"></canvas>
    <div class="controls">
      <div class="control-group">
        <label>道路宽度</label>
        <input type="range" min="50" max="500" :value="roadWidth" @input="handleRoadWidthChange" />
        <span class="value-display">{{ roadWidth }}px</span>
      </div>
      <div class="control-group">
        <label>固定长度（段数）</label>
        <input type="range" min="1" max="7" :value="totalSegments" @input="handleRoadLengthChange" />
        <span class="value-display">{{ totalSegments }}段</span>
      </div>
      <div class="control-group">
        <label>路口弯曲度</label>
        <input type="range" min="-360" max="360" :value="curveDegree" @input="handleCurveDegreeChange" />
        <span class="value-display">{{ curveDegree }}</span>
      </div>
      <div class="control-group">
        <label>车道数量</label>
        <input type="range" min="1" max="5" :value="totalLanes" @input="handleLaneCountChange" />
        <span class="value-display">{{ totalLanes }}条</span>
      </div>
      <!--      <div
          class="status"
          :class="{ allow: isAllowed, forbid: !isAllowed }"
      >
        {{ isAllowed ? '可以前进' : '弯曲度过大，禁止前进' }}
      </div>-->
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'

// 画布相关
const roadCanvas = ref(null)
let ctx = null

// 道路参数
const roadWidth = ref(200)
const totalLanes = ref(2)
const segmentLength = 40 // 每段长度固定
const curveDegree = ref(10) // 路口弯曲度
const maxAllowedCurve = 3 // 允许前进的最大弯曲度
const totalSegments = ref(7) // 固定段数
const roadSegments = ref([]) // 道路段数据
const isAllowed = ref(true) // 是否允许前进状态

// 初始化道路段
function initRoadSegments() {
  roadSegments.value = []
  for (let i = 0; i < totalSegments.value; i++) {
    // 弯曲度分布：越往后弯曲越明显
    const curveFactor = (i / totalSegments.value) * curveDegree.value
    roadSegments.value.push({
      y: i * segmentLength,
      curve: curveFactor,
      hasLaneMarking: i % 2 === 0 // 固定车道线间隔
    })
  }
}

// 更新道路段（基于当前弯曲度重新计算）
function updateRoadSegments() {
  roadSegments.value.forEach((segment, i) => {
    segment.y = i * segmentLength
    segment.curve = (i / totalSegments.value) * curveDegree.value
  })
  drawRoad()
  updateStatus()
}

// 判断是否允许前进
function updateStatus() {
  isAllowed.value = Math.abs(curveDegree.value) <= maxAllowedCurve
}

// 绘制道路
function drawRoad() {
  if (!ctx) return

  ctx.clearRect(0, 0, roadCanvas.value.width, roadCanvas.value.height)

  // 道路边线样式
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 3

  // 计算车道宽度
  const laneWidth = roadWidth.value / totalLanes.value
  const centerX = roadCanvas.value.width / 2

  // 绘制左侧边线
  ctx.beginPath()
  let leftX = centerX - roadWidth.value / 2
  ctx.moveTo(leftX, 0)

  roadSegments.value.forEach((segment) => {
    leftX += segment.curve
    ctx.lineTo(leftX, segment.y)
  })
  ctx.stroke()

  // 绘制右侧边线
  ctx.beginPath()
  let rightX = centerX + roadWidth.value / 2
  ctx.moveTo(rightX, 0)

  roadSegments.value.forEach((segment) => {
    rightX += segment.curve
    ctx.lineTo(rightX, segment.y)
  })
  ctx.stroke()

  // 绘制固定车道线
  ctx.setLineDash([10, 15])
  ctx.lineWidth = 2
  ctx.strokeStyle = '#ccc'

  for (let lane = 1; lane < totalLanes.value; lane++) {
    ctx.beginPath()
    let laneX = centerX - roadWidth.value / 2 + lane * laneWidth
    ctx.moveTo(laneX, 0)

    roadSegments.value.forEach((segment) => {
      laneX += segment.curve
      if (segment.hasLaneMarking) {
        ctx.lineTo(laneX, segment.y)
      } else {
        ctx.moveTo(laneX, segment.y)
      }
    })
    ctx.stroke()
  }
  ctx.setLineDash([])
}

// 设置画布尺寸
function resizeCanvas() {
  if (!roadCanvas.value) return
  const controlsHeight = document.querySelector('.controls').offsetHeight
  roadCanvas.value.width = window.innerWidth
  roadCanvas.value.height = '300'
  drawRoad()
}

// 事件处理函数
function handleRoadWidthChange(e) {
  roadWidth.value = parseInt(e.target.value)
  drawRoad()
}

function handleRoadLengthChange(e) {
  totalSegments.value = parseInt(e.target.value)
  initRoadSegments()
  drawRoad()
}

function handleCurveDegreeChange(e) {
  curveDegree.value = parseInt(e.target.value)
  updateRoadSegments()
}

function handleLaneCountChange(e) {
  totalLanes.value = parseInt(e.target.value)
  drawRoad()
}

// 初始化
onMounted(() => {
  ctx = roadCanvas.value.getContext('2d')
  initRoadSegments()
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)

  // 初始状态判断
  updateStatus()
})

// 监听参数变化重新绘制
watch([roadWidth, totalLanes, curveDegree], () => {
  drawRoad()
})
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

#roadCanvas {
  display: block;
  flex-grow: 1;
  border-bottom: 0.1rem solid #555;
}
.canvasMain {
  transform: rotate(-180deg);
}
.controls {
  /*ackground-color: #333*/
  padding: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  align-items: center;
  justify-content: center;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 1.4rem;
  color: #fff;
  font-family: Arial, sans-serif;
}

input[type='range'] {
  width: 18rem;
}

.value-display {
  color: #fff;
  font-size: 1.4rem;
  font-family: Arial, sans-serif;
}

.status {
  margin-left: auto;
  padding: 0.8rem 1.5rem;
  border-radius: 0.4rem;
  font-weight: bold;
  font-family: Arial, sans-serif;
}

.status.allow {
  background-color: #4caf50;
}

.status.forbid {
  background-color: #f44336;
}
</style>
