<template>
  <div class="scroll-table-box">
    <el-table
      ref="scrollTable"
      :data="tableDataList"
      style="width: 100%; height: calc(100% - 1.2rem); margin: 0.5rem 0 0.5rem 0; cursor: pointer"
      @row-click="rowClickHandle"
    >
      <el-table-column prop="buildingName" label="部位名称" show-overflow-tooltip align="center" min-width="2" />
      <el-table-column prop="measureNo" label="测点名称" show-overflow-tooltip align="center" min-width="3">
        <template #default="{ row }">
          <el-tooltip content="点击定位">
            <span>{{ row.measureNo }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="monitorItemId" label="监控项目" show-overflow-tooltip align="center" min-width="5" />
      <el-table-column prop="measureValue" label="监测数值" align="center" min-width="2">
        <template #default="{ row }">
          {{ row.measureValue.toFixed(2) }}
        </template>
      </el-table-column>
      <el-table-column prop="publishLevel" label="预警等级" align="center" min-width="3">
        <template #default="{ row }">
          <span :class="[row.publishLevel == 2 ? 'colorTextRed' : row.publishLevel == 1 ? 'colorTextOrange' : 'colorTextBlue']">{{
            getPublicText(row.publishLevel)
          }}</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import useScroll from './UseScroll'
// 表格数据
const tableDataList = ref<any[]>([])
// 表格引用
const scrollTable = ref<any>({})
const fetchHander = async () => {
  let res: any = await getTemplateData('table/scroll-able/assets/data.json')
  if (res?.data?.data?.records?.length > 0) {
    tableDataList.value = res.data.data.records
  }
  console.log('河道水情数据', res, tableDataList.value)
}
const getPublicText = (publishLevel: any) => {
  if (publishLevel == 0) {
    return '一般预警'
  } else if (publishLevel == 1) {
    return '较重预警'
  } else if (publishLevel == 2) {
    return '严重预警'
  }
}

// 点击某行
const rowClickHandle = async (row: any) => {
  console.log('点了哪行？', row)
}

onMounted(() => {
  fetchHander()
  useScroll(scrollTable.value)
})
</script>

<style lang="scss" scoped>
.scroll-table-box {
  position: relative;
  width: 100%;
  height: 100%;
}
:deep(.el-table) {
  --el-table-row-hover-bg-color: rgba(120, 253, 249, 0.2);
  --el-table-text-color: white;
  --el-table-fixed-box-shadow: none;
  --el-table-header-text-color: white;
  --el-table-bg-color: transparent;
  --el-table-border-color: transparent;
  --el-table-tr-bg-color: rgba(255, 255, 255, 0.05);
}
:deep(.el-table th.is-leaf) {
  font-size: 1.4rem;
  background-color: transparent;
  color: rgba(255, 255, 255, 0.8);
  height: 5rem;
  background-image: linear-gradient(to bottom, rgba(132, 255, 219, 0), rgba(132, 255, 219, 0.4));
  border-bottom: 0.4rem solid #91debb;
}
//设置表格的行间距；
:deep(.el-table__body) {
  font-size: 1.4rem;
  height: 100%;
  -webkit-border-vertical-spacing: 0.5rem;
}
:deep(.el-table--default .cell) {
  padding: 0 0.2rem;
}

:deep(.el-table__cell) {
  padding: 0.8rem 0 !important;
}
</style>
