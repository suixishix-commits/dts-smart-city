<template>
  <div class="box-template">
    <div class="box-summary">
      <div class="item-zhan">
        <div class="itName">站点总数</div>
        <div class="itNumber">{{ totalSum }}</div>
      </div>
      <div class="item-jin">
        <div class="itName">超警戒</div>
        <div class="itNumber">{{ warn }}</div>
      </div>
      <div class="item-bao">
        <div class="itName">超保证</div>
        <div class="itNumber">{{ warngrz }}</div>
      </div>
    </div>
    <el-table ref="scrollTable" :data="listData" style="width: 100%; margin-top: 1rem; cursor: pointer; flex: 1">
      <el-table-column prop="stnm" label="站点名称" show-overflow-tooltip align="center" />
      <el-table-column prop="warn" align="center" width="15" show-overflow-tooltip>
        <template #default="{ row }">
          <div v-if="row.warn > 0" class="iconBg"></div>
          <div v-else class="iconBgNomal"></div>
        </template>
      </el-table-column>
      <el-table-column prop="waterLevel" label="实时水位" align="center" show-overflow-tooltip />
      <el-table-column prop="flow" label="流量" align="center" width="60" show-overflow-tooltip />
      <el-table-column prop="wrz" label="警戒水位" align="center" show-overflow-tooltip />
      <el-table-column prop="grz" label="保证水位" align="center" show-overflow-tooltip />
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { getTemplateData } from '@/api/fileData'
import UseScroll from '@/utils/UseScroll'

// 绑定数据
const listData: any = ref([])
// 测站总数
const totalSum = ref<any>(0)
// 超警戒
const warn = ref<any>(0)
// 超保证
const warngrz = ref<any>(0)
// 表格引用
const scrollTable = ref<any>({})
// 初始化UI
async function initGUI() {
  let res: any = await getTemplateData('water/he-dao-shui-qing/assets/data.json')
  console.log('后台数据:？', res)
  if (res?.data?.data?.riverList) {
    listData.value = res.data.data.riverList
    totalSum.value = listData.value.length
    warn.value = listData.value.filter((item: any) => item.warn > 0).length
    warngrz.value = listData.value.filter((item: any) => item.warngrz > 0).length
  }
}
onMounted(() => {
  initGUI()
  UseScroll(scrollTable.value)
})

onBeforeUnmount(() => {})
</script>

<style lang="scss" scoped>
.box-template {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  .box-summary {
    display: flex;
    justify-content: space-between;
    color: white;
    margin: 1rem 1rem 0 1rem;

    .item-zhan {
      display: flex;
      justify-content: space-around;
      align-items: center;
      background-image: url('./assets/statotal_bg.png');
      background-size: 100% 100%;
      width: 12rem;
      height: 3rem;
      pointer-events: all;
      cursor: pointer;
      .itNumber {
        background: -webkit-linear-gradient(top, rgb(255, 254, 254) 30%, #0de4d9) 70%;
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-family: 'DIN-Bold', sans-serif;
      }
    }
    .item-jin {
      display: flex;
      justify-content: space-around;
      align-items: center;
      background-image: url('./assets/cjjtotal_bg.png');
      background-size: 100% 100%;
      width: 12rem;
      height: 3rem;
      pointer-events: all;
      cursor: pointer;
      .itNumber {
        background: -webkit-linear-gradient(top, rgb(255, 254, 254) 30%, #e40d0d) 70%;
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-family: 'DIN-Bold', sans-serif;
      }
    }
    .item-bao {
      display: flex;
      justify-content: space-around;
      align-items: center;
      background-image: url('./assets/cbztotal_bg.png');
      background-size: 100% 100%;
      width: 12rem;
      height: 3rem;
      .itNumber {
        background: -webkit-linear-gradient(top, rgb(255, 254, 254) 10%, #e4d60d) 70%;
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-family: 'DIN-Bold', sans-serif;
      }
    }
  }

  :deep(.el-table) {
    --el-table-row-hover-bg-color: rgba(120, 253, 249, 0.2);
    --el-table-text-color: white;
    --el-table-fixed-box-shadow: none;
    --el-table-header-text-color: white;
    --el-table-bg-color: transparent;
    --el-table-border-color: rgba(13, 14, 14, 0.5);
    --el-table-tr-bg-color: rgba(120, 253, 249, 0.05);
    --el-table-header-bg-color: rgba(120, 253, 249, 0.3);
    --el-table-border: 3px solid rgba(120, 253, 249, 0.3);
  }
}
</style>
