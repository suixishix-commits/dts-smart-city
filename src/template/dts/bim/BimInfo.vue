<template>
  <PartitionPanel class="box-structural-info" :title="compName" :goToVisible="false">
    <el-table :data="tableData" style="width: 100%; height: 100%">
      <el-table-column prop="field" min-width="30" label="参数" />
      <el-table-column prop="fieldValue" min-width="70" label="特征值" />
    </el-table>
  </PartitionPanel>
</template>

<script setup lang="ts">
// 属性定义
const props = defineProps({
  title: {
    type: String,
    default: '构件信息'
  },
  dataSource: {
    type: Array<any>,
    default: {}
  }
})
// 表格数据
const tableData: any = ref([])
// 选中构件名称
const compName = ref('构件信息')

// 属性监听
watch([() => props.dataSource, () => props.title], (newVal, oldVal) => {
  if (newVal[0] != oldVal[0]) {
    //console.log('dataSource属性发生变化了啊', newVal[0], oldVal[0])
    initGUI(newVal[0])
  }

  if (newVal[1] != oldVal[1]) {
    //console.log('title属性发生变化了啊', newVal[0], oldVal[0])
    compName.value = newVal[1]
  }
})

// 初始化表格
function initGUI(bimInfo: any) {
  tableData.value = bimInfo
}

onMounted(() => {
  if (Object.keys(props.dataSource)) {
    initGUI(props.dataSource)
    compName.value = props.title
  }
})
</script>

<style lang="scss" scoped>
.box-structural-info {
  :deep(.el-table thead.is-group th.el-table__cell) {
    background-color: transparent;
  }

  :deep(.el-table) {
    --el-table-row-hover-bg-color: rgba(120, 253, 249, 0.2);
    --el-table-text-color: white;
    --el-table-fixed-box-shadow: none;
    --el-table-header-text-color: white;
    --el-table-bg-color: transparent;
    --el-table-border-color: rgba(13, 14, 14, 0);
    --el-table-tr-bg-color: rgba(120, 253, 249, 0.05);
    --el-table-header-bg-color: rgba(47, 148, 218, 0.3493);
    --el-table-border: 0rem solid rgba(120, 253, 249, 0.3);

    /* 奇数行背景色 */
    .el-table__body tr:nth-child(odd) {
      background-color: rgba(107, 175, 235, 0);
    }

    /* 偶数行背景色 */
    .el-table__body tr:nth-child(even) {
      background: linear-gradient(90deg, rgba(47, 148, 218, 0) 0%, rgba(47, 148, 218, 0.3493) 69%, rgba(47, 148, 218, 0.5) 100%);
      //background-color: rgba(107, 175, 235, 0.6);
    }
  }

  :deep(.el-table td.el-table__cell, .el-table th.el-table__cell.is-leaf) {
    font-size: 1.4rem;
  }

  :deep(.el-table--default .cell) {
    font-size: 1.4rem;
  }
}
</style>
