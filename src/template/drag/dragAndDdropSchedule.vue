<template>
  <div class="timetable-container">
    <div class="timetable-header">
      <h2>周课表（可拖拽调整）</h2>
      <p>拖动课程卡片调整位置</p>
    </div>

    <table class="timetable">
      <thead>
      <tr>
        <th>时间/星期</th>
        <th>星期一</th>
        <th>星期二</th>
        <th>星期三</th>
        <th>星期四</th>
        <th>星期五</th>
      </tr>
      </thead>
      <tbody>
      <!-- 课程时间段 -->
      <tr v-for="(period, periodIndex) in periods" :key="periodIndex">
        <td class="time-slot">{{ period.time }}</td>
        <!-- 星期几 -->
        <td
            v-for="day in 5"
            :key="day"
            class="table-cell"
            :data-day="day"
            :data-period="periodIndex + 1"
            @dragover.prevent="handleDragOver"
            @dragenter.prevent="handleDragEnter($event, day, periodIndex + 1)"
            @dragleave="handleDragLeave"
            @drop.prevent="handleDrop($event, day, periodIndex + 1)"
        >
          <!-- 渲染当前单元格的课程 -->
          <div
              v-for="course in getCoursesByDayAndPeriod(day, periodIndex + 1)"
              :key="course.id"
              class="course"
              :class="course.type"
              draggable="true"
              @dragstart="handleDragStart($event, course)"
              @dragend="handleDragEnd"
          >
            <strong>{{ course.name }}</strong>
            <div>{{ course.teacher }}</div>
          </div>
        </td>
      </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// 课程时间段数据
const periods = [
  { time: '08:00-09:40' },
  { time: '10:00-11:40' },
  { time: '14:00-15:40' },
  { time: '16:00-17:40' }
]

// 初始化课程数据（响应式）
const courses = ref([
  { id: 1, name: '高等数学', teacher: '张教授', type: 'math', day: 1, period: 1 },
  { id: 2, name: '大学英语', teacher: '李老师', type: 'english', day: 1, period: 2 },
  { id: 3, name: '物理实验', teacher: '王老师', type: 'physics', day: 2, period: 1 },
  { id: 4, name: '中国现代史', teacher: '刘老师', type: 'chinese', day: 2, period: 3 },
  { id: 5, name: '有机化学', teacher: '赵老师', type: 'chemistry', day: 3, period: 2 },
  { id: 6, name: '线性代数', teacher: '张教授', type: 'math', day: 4, period: 1 },
  { id: 7, name: '计算机基础', teacher: '孙老师', type: 'english', day: 5, period: 3 }
])

// 拖拽状态管理
const draggingCourse = ref(null)
const originalPosition = ref({ day: null, period: null })
const dragOverCell = ref({ day: null, period: null })

// 根据星期和节次获取课程
const getCoursesByDayAndPeriod = (day, period) => {
  return courses.value.filter(course => course.day === day && course.period === period)
}

// 开始拖拽
const handleDragStart = (e, course) => {
  draggingCourse.value = { ...course }
  originalPosition.value = { day: course.day, period: course.period }

  // 延迟添加拖拽样式
  setTimeout(() => {
    e.target.classList.add('dragging')
  }, 0)
}

// 结束拖拽
const handleDragEnd = (e) => {
  e.target.classList.remove('dragging')
  dragOverCell.value = { day: null, period: null }
}

// 拖拽经过
const handleDragOver = (e) => {
  e.dataTransfer.dropEffect = 'move'
}

// 拖拽进入单元格
const handleDragEnter = (e, day, period) => {
  if (originalPosition.value.day !== day || originalPosition.value.period !== period) {
    dragOverCell.value = { day, period }
  }
}

// 拖拽离开单元格
const handleDragLeave = (e) => {
  // 检查是否完全离开单元格
  const rect = e.target.getBoundingClientRect()
  const isOutside = e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
  if (isOutside) {
    dragOverCell.value = { day: null, period: null }
  }
}

// 放置课程
const handleDrop = (e, day, period) => {
  if (!draggingCourse.value) return

  // 更新课程位置
  courses.value = courses.value.map(course => {
    if (course.id === draggingCourse.value.id) {
      return { ...course, day, period }
    }
    return course
  })

  // 重置状态
  dragOverCell.value = { day: null, period: null }
  console.log(`课程 ${draggingCourse.value.name} 已移动到：星期${day} 第${period}节`)
}
</script>

<style scoped>
/* 基础样式 */
body {
  font-family: 'Arial', sans-serif;
  padding: 20px;
  background-color: #f5f5f5;
}

.timetable-container {
  max-width: 1000px;
  margin: 40px auto 0 ;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  overflow: hidden;
}

.timetable-header {
  text-align: center;
  padding: 15px;
  background-color: #3498db;
  color: white;
}

/* 课表表格样式 */
.timetable {
  width: 100%;
  border-collapse: collapse;
}

.timetable th,
.timetable td {
  border: 1px solid #ddd;
  padding: 8px;
  min-width: 120px;
  min-height: 80px;
  vertical-align: top;
  position: relative;
}

.timetable th {
  background-color: #f8f9fa;
  text-align: center;
  font-weight: bold;
}

.time-slot {
  text-align: center;
  background-color: #f1f1f1;
  font-weight: 500;
}

/* 课程卡片样式 */
.course {
  padding: 8px;
  margin-bottom: 5px;
  border-radius: 4px;
  cursor: grab;
  user-select: none;
  transition: all 0.2s ease;
  position: relative;
  z-index: 1;
}

.course:active {
  cursor: grabbing;
}

.course.dragging {
  opacity: 0.7;
  transform: scale(1.02);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  z-index: 100;
}

/* 拖拽目标区域高亮 */
.table-cell:has(+ .drag-over),
.table-cell.drag-over {
  background-color: rgba(52, 152, 219, 0.1);
  border-color: #3498db;
}

/* 不同课程类型颜色 */
.course.math { background-color: #ffeaa7; border-left: 4px solid #fdcb6e; }
.course.chinese { background-color: #a8e6cf; border-left: 4px solid #55efc4; }
.course.english { background-color: #dcedc1; border-left: 4px solid #81c784; }
.course.physics { background-color: #ffaaa5; border-left: 4px solid #e74c3c; }
.course.chemistry { background-color: #b8e986; border-left: 4px solid #7cb342; }
</style>