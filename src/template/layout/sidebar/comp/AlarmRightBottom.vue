<template>
  <div class="region-block">
    <div class="region-title">
      <p class="title-text">异常测点信息</p>
    </div>
    <div class="region-content">
      <el-table ref="refTable" :data="tableData" style="width: 100%">
        <el-table-column property="name" label="名称" min-width="120" show-overflow-tooltip />
        <el-table-column property="status" label="状态" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.status }}</span>
          </template>
        </el-table-column>
        <el-table-column property="time" label="报警时间" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="iconBg"></div>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
// 属性定义
const props = defineProps({
  dataSource: {
    type: Object
  }
})
// 表格数据源
let tableData = ref([
  { name: '测点1', status: '正常', time: '2023-05-04 23: 34: 12', operate: '' },
  { name: '测点2', status: '危险', time: '2023-05-05 23: 34: 12', operate: '' },
  { name: '测点3', status: '异常', time: '2023-05-06 23: 34: 12', operate: '' },
  { name: '测点4', status: '轻度异常', time: '2023-05-07 23: 34: 12', operate: '' },
  { name: '测点5', status: '停用', time: '2023-05-09 23: 34: 12', operate: '' },
  { name: '测点6', status: '正常', time: '2023-05-08 23: 34: 12', operate: '' },
  { name: '测点7', status: '异常', time: '2023-05-10 23: 34: 12', operate: '' },
  { name: '测点1', status: '正常', time: '2023-05-04 23: 34: 12', operate: '' },
  { name: '测点2', status: '危险', time: '2023-05-05 23: 34: 12', operate: '' },
  { name: '测点3', status: '异常', time: '2023-05-06 23: 34: 12', operate: '' },
  { name: '测点4', status: '轻度异常', time: '2023-05-07 23: 34: 12', operate: '' },
  { name: '测点5', status: '停用', time: '2023-05-09 23: 34: 12', operate: '' },
  { name: '测点6', status: '正常', time: '2023-05-08 23: 34: 12', operate: '' },
  { name: '测点7', status: '异常', time: '2023-05-10 23: 34: 12', operate: '' },
  { name: '测点1', status: '正常', time: '2023-05-04 23: 34: 12', operate: '' },
  { name: '测点2', status: '危险', time: '2023-05-05 23: 34: 12', operate: '' },
  { name: '测点3', status: '异常', time: '2023-05-06 23: 34: 12', operate: '' },
  { name: '测点4', status: '轻度异常', time: '2023-05-07 23: 34: 12', operate: '' },
  { name: '测点5', status: '停用', time: '2023-05-09 23: 34: 12', operate: '' },
  { name: '测点6', status: '正常', time: '2023-05-08 23: 34: 12', operate: '' },
  { name: '测点7', status: '异常', time: '2023-05-10 23: 34: 12', operate: '' }
])
</script>

<style lang="scss" scoped>
.region-block {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 41.1rem;
  height: 45.7rem;
  box-sizing: border-box;
  background: url('../assets/right_bag.png') no-repeat center center / 100% 100%;

  .region-title {
    position: relative;
    width: 100%;
    height: 3.4rem;
    background: url('../assets/areaPic.png') no-repeat center center / 100% 100%;

    .title-text {
      position: absolute;
      left: 5.9rem;
      top: 0;
      height: 100%;
      font-family: YouSheBiaoTiHei;
      font-size: 2rem;
      line-height: 3.4rem;
      letter-spacing: 0.05em;
      background: linear-gradient(180deg, #ffffff 0%, #94e0ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  }

  .region-content {
    width: 41rem;
    height: 41.6rem;
    box-sizing: border-box;
    padding-top: 0.5rem;
    overflow-y: auto;
    :deep(.el-table) {
      --el-table-row-hover-bg-color: rgba(120, 253, 249, 0.2);
      --el-table-text-color: white;
      --el-table-fixed-box-shadow: none;
      --el-table-header-text-color: white;
      --el-table-bg-color: transparent;
      --el-table-border-color: rgba(13, 14, 14, 0);
      --el-table-tr-bg-color: rgba(120, 253, 249, 0.05);
      --el-table-header-bg-color: rgba(47, 148, 218, 0.3493);
      --el-table-border: 0px solid rgba(120, 253, 249, 0.3);

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

    .iconBg {
      background: url('../assets/caozuoiconft.png') no-repeat center center / 100% 100%;
      height: 2.2rem;
      width: 2.2rem;
    }
  }
}
</style>
