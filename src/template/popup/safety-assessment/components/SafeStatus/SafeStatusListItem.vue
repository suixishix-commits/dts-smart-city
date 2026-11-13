<template>
  <div class="safe-status-list-item">
    <p class="title">{{ safeStatusItemData.title }}</p>
    <div class="safe-level-judge safe-status-content">
      <p class="title">
        <img src="../../assets/safe-level-judge-title-bg.png">
        <span>安全等级评判</span>
      </p>
      <el-table class="safe-level-judge-table safe-status-table" :data="safeStatusItemData.safeLevelJudge.tableData"
        :row-class-name="tableRowClassName">
        <el-table-column prop="name" label="" show-overflow-tooltip />
        <el-table-column prop="safeDegree" label="总体安全度" show-overflow-tooltip />
        <el-table-column label="安全等级" show-overflow-tooltip>
          <template #default="scope">
            <span class="safe-level">{{ scope.row.safeLevel }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div class="subitem-evaluate safe-status-content">
      <p class="title">
        <img src="../../assets/subitem-evaluate-title-bg.png">
        <span>分项评价</span>
      </p>
      <el-tabs class="subitem-evaluate-tabs" v-model="activeName" @tab-change="handleClick">
        <el-tab-pane v-for="(tabsItem, tabsIndex) in safeStatusItemData.safeLevelJudge.tableData" :key="tabsIndex"
          :label="tabsItem.name" :name="tabsItem.name"></el-tab-pane>
      </el-tabs>
      <el-table class="subitem-evaluate-table safe-status-table" :data="safeStatusItemData.subitemEvaluate.tableData"
        :row-class-name="tableRowClassName" :span-method="objectSpanMethod">
        <el-table-column prop="affiliateSubitem" label="所属分项" />
        <el-table-column prop="evaluateQuota" label="评价指标" />
        <el-table-column prop="evaluateAccord" label="评价依据" />
        <el-table-column prop="evaluateResult" label="评价结果" />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"

interface SpanMethodProps {
  row: any
  column: any
  rowIndex: number
  columnIndex: number
}

const props = defineProps({
  safeStatusItemData: { type: Object, required: true },
})
const emit = defineEmits(["tabsChange"])

const activeName = ref('');
let spanArr: string[] = ['affiliateSubitem'];
let mergeObj: any = {};

const tableRowClassName = ({
  row,
  rowIndex,
}: {
  row: any
  rowIndex: number
}) => {
  if (rowIndex % 2 === 0) {
    return 'zebra-stripes'
  }
  return ''
}
function getSpanArr(tableData: any[]) {
  spanArr.forEach((key) => {
    let count = 0;
    mergeObj[key] = [];
    tableData.forEach((item, index) => {
      if (index === 0) {
        mergeObj[key].push(1)
      } else {
        if (item[key] === tableData[index - 1][key]) {
          mergeObj[key][count] += 1
          mergeObj[key].push(0)
        } else {
          count = index;
          mergeObj[key].push(1);
        }
      }
    })
  })
}
function objectSpanMethod({ row, column, rowIndex, columnIndex }: SpanMethodProps) {
  if (spanArr.includes(column.property)) {
    if (mergeObj[column.property][rowIndex]) {
      return [mergeObj[column.property][rowIndex], 1]
    } else {
      return [0, 0]
    }
  }
}
const handleClick = (name: any) => {
  emit("tabsChange", props.safeStatusItemData.id, props.safeStatusItemData.title, name)
}

onMounted(() => {
  activeName.value = props.safeStatusItemData.safeLevelJudge.tableData[0].name;
  getSpanArr(props.safeStatusItemData.subitemEvaluate.tableData);
})
</script>

<style scoped lang="scss">
.safe-status-list-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 42rem;
  height: 100%;
  background: url("../../assets/safe-status-list-item-bg.png") no-repeat 0 0 / 100% 100%;
  &>.title {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    // height: 6rem;
    height: calc(100% * (6 / 84));
    background: url("../../assets/safe-status-list-item-title-bg.png") no-repeat 0 0 / 100% 100%;
    // text-align: center;
    // line-height: 6rem;
    font-family: YouSheBiaoTiHei;
    font-size: 3rem;
    letter-spacing: 0.05em;
    color: #FFFFFF;
    text-shadow: 0 0.2rem 0.4rem #162250;
  }
  .safe-status-content {
    margin-top: 1.6rem;
    width: 40rem;
    box-sizing: border-box;
    border: 0.1rem solid #004892;
    background: rgba(21, 106, 189, 0.06);
    .title {
      display: flex;
      align-items: center;
      // height: 5.2rem;
      img {
        // width: 2.4rem;
        // height: 2.4rem;
      }
      span {
        margin-left: 1rem;
        font-family: OPPOSans;
        font-size: 2rem;
        background: linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        text-fill-color: transparent;
      }
    }
    .safe-status-table {
      width: 100%;
      background: transparent;
      :deep(.el-table__inner-wrapper) {
        &::before {
          display: none;
        }
        .el-table__header-wrapper {
          tr {
            height: 100%;
            padding: 0;
            width: 100%;
            height: 4.8rem;
            background: transparent;
            th {
              border: none;
              background: transparent;
              .cell {
                text-align: center;
                font-family: OPPOSans;
                font-size: 1.8rem;
                color: rgba(161, 218, 247, 0.6);
              }
            }
          }
        }
        .el-table__body-wrapper {
          tr {
            width: 100%;
            height: 4.5rem;
            background: transparent;
            &:hover>td {
              background: transparent;
            }
            td {
              height: 100%;
              padding: 0;
              border: none;
              background: transparent;
              .cell {
                text-align: center;
                font-family: OPPOSans;
                font-size: 1.8rem;
                color: #A1DAF7;
                .safe-level {
                  background: linear-gradient(180deg, #FFFFFF 0%, #28A986 70%);
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
                  background-clip: text;
                  text-fill-color: transparent;
                }
              }
            }
          }
          .zebra-stripes {
            background: linear-gradient(270deg, rgba(21, 105, 189, 0) 0%, rgba(21, 106, 189, 0.16) 100%);
          }
        }
      }
    }
  }
  .safe-level-judge {
    // height: 26rem;
    height: calc(100% * (26 / 84));
    .title {
      width: 100%;
      // height: 5.2rem;
      height: calc(100% * (5.2 / 26));
      box-sizing: border-box;
      border-bottom: 0.1rem solid #004892;
      background: linear-gradient(180deg, rgba(48, 148, 219, 0.3) 0%, rgba(48, 148, 219, 0) 99%);
      img {
        margin-left: 1.4rem;
        // width: 2.4rem;
        // height: 2.4rem;
        height: calc(100% * (2.4 / 5.2));
      }
    }
    .safe-level-judge-table {
      // height: 20.8rem;
      height: calc(100% * (20.8 / 26));
    }
  }
  .subitem-evaluate {
    display: flex;
    flex-direction: column;
    position: relative;
    // height: 47.2rem;
    height: calc(100% * (47.2 / 84));
    .title {
      position: absolute;
      left: 1.4rem;
      height: 5.2rem;
      img {
        // width: 2.4rem;
        // height: 2.4rem;
        height: calc(100% * (2.4 / 5.2));
      }
    }
    .subitem-evaluate-tabs {
      :deep(.el-tabs__header) {
        margin: 0;
        height: 5.2rem;
        .el-tabs__nav-wrap {
          margin: 0;
          height: 100%;
          box-sizing: border-box;
          border-bottom: 0.1rem solid #004892;
          background: linear-gradient(180deg, rgba(48, 148, 219, 0.3) 0%, rgba(48, 148, 219, 0) 99%);
          &::after {
            display: none;
          }
          .el-tabs__nav-scroll {
            height: 100%;
            .el-tabs__nav {
              height: 100%;
              float: right;
              .el-tabs__active-bar {
                display: none;
              }
              .el-tabs__item {
                height: 100%;
                margin: 0 1.2rem 0 0 ;
                padding: 0;
                font-family: OPPOSans;
                font-size: 1.4rem;
                font-weight: normal;
                color: #A1DAF7;
                &.is-active {
                  position: relative;
                  color: #18E4F3;
                  &::after {
                    display: block;
                    content: "";
                    position: absolute;
                    left: 50%;
                    bottom: 0;
                    transform: translateX(-50%);
                    width: 1.2rem !important;
                    height: 0.5rem;
                    background: url("../../assets/checked-tabs-item.png") no-repeat 0 0 / 100% 100%;
                  }
                }
              }
            }
          }
        }
      }
    }
    .subitem-evaluate-table {
      // height: 42rem;
      // height: calc(100% * (42 / 47.2));
      flex-grow: 1;
    }
  }
}
</style>