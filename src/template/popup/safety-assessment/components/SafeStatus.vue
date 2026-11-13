<template>
  <div class="safe-status">
    <SafeStatusListItem v-for="(item, index) in safeStatusDataList" :key="index" :safeStatusItemData="item"
      @tabsChange="tabsChange"></SafeStatusListItem>
  </div>
</template>

<script setup lang="ts">
import SafeStatusListItem from "./SafeStatus/SafeStatusListItem.vue"
import { ref, reactive, onMounted } from "vue"

const safeStatusDataList = reactive([
  {
    id: 0,
    title: "泄水建筑",
    safeLevelJudge: {
      tableData: [
        {
          name: "大江冲沙闸",
          safeDegree: 9.5,
          safeLevel: "安全"
        },
        {
          name: "二江冲沙闸",
          safeDegree: "7.0",
          safeLevel: "较安全"
        },
        {
          name: "三江冲沙闸",
          safeDegree: 6.8,
          safeLevel: "一般安全"
        },
      ]
    },
    subitemEvaluate: {
      tableData: [
        {
          affiliateSubitem: "实测运行状态",
          evaluateQuota: "坝体变形",
          evaluateAccord: "超标点21个",
          evaluateResult: "7.0",
        },
        {
          affiliateSubitem: "实测运行状态",
          evaluateQuota: "坝基渗流",
          evaluateAccord: "超标点21个",
          evaluateResult: "6.0",
        },
        {
          affiliateSubitem: "现场安全检查",
          evaluateQuota: "坝体缺陷",
          evaluateAccord: "32处缺陷",
          evaluateResult: "8.0",
        },
        {
          affiliateSubitem: "结构安全度",
          evaluateQuota: "抗滑稳定",
          evaluateAccord: "最小安全系数1.15",
          evaluateResult: "6.0",
        },
        {
          affiliateSubitem: "结构安全度",
          evaluateQuota: "坝基应力",
          evaluateAccord: "最小抗裂安全系数1.20",
          evaluateResult: "5.0",
        },
        {
          affiliateSubitem: "结构安全度",
          evaluateQuota: "坝体应力",
          evaluateAccord: "最小抗裂安全系数1.20",
          evaluateResult: "5.0",
        }
      ]
    }
  },
  {
    id: 1,
    title: "挡水建筑",
    safeLevelJudge: {
      tableData: [
        {
          name: "左岸土石坝",
          safeDegree: 9.5,
          safeLevel: "安全"
        },
        {
          name: "三江非溢留坝",
          safeDegree: "7.0",
          safeLevel: "较安全"
        },
        {
          name: "黄草坝混凝土坝",
          safeDegree: 6.8,
          safeLevel: "一般安全"
        },
      ]
    },
    subitemEvaluate: {
      tableData: [
        {
          affiliateSubitem: "实测运行状态",
          evaluateQuota: "坝体变形",
          evaluateAccord: "超标点21个",
          evaluateResult: "7.0",
        },
        {
          affiliateSubitem: "实测运行状态",
          evaluateQuota: "坝基渗流",
          evaluateAccord: "超标点21个",
          evaluateResult: "6.0",
        },
        {
          affiliateSubitem: "现场安全检查",
          evaluateQuota: "坝体缺陷",
          evaluateAccord: "32处缺陷",
          evaluateResult: "8.0",
        },
        {
          affiliateSubitem: "结构安全度",
          evaluateQuota: "抗滑稳定",
          evaluateAccord: "最小安全系数1.15",
          evaluateResult: "6.0",
        },
        {
          affiliateSubitem: "结构安全度",
          evaluateQuota: "坝基应力",
          evaluateAccord: "最小抗裂安全系数1.20",
          evaluateResult: "5.0",
        },
        {
          affiliateSubitem: "结构安全度",
          evaluateQuota: "坝体应力",
          evaluateAccord: "最小抗裂安全系数1.20",
          evaluateResult: "5.0",
        }
      ]
    }
  },
  {
    id: 2,
    title: "电站建筑",
    safeLevelJudge: {
      tableData: [
        {
          name: "大江电厂",
          safeDegree: 9.5,
          safeLevel: "安全"
        },
        {
          name: "二江电厂",
          safeDegree: "7.0",
          safeLevel: "较安全"
        },
      ]
    },
    subitemEvaluate: {
      tableData: [
        {
          affiliateSubitem: "实测运行状态",
          evaluateQuota: "坝体变形",
          evaluateAccord: "超标点21个",
          evaluateResult: "7.0",
        },
        {
          affiliateSubitem: "实测运行状态",
          evaluateQuota: "坝基渗流",
          evaluateAccord: "超标点21个",
          evaluateResult: "6.0",
        },
        {
          affiliateSubitem: "现场安全检查",
          evaluateQuota: "坝体缺陷",
          evaluateAccord: "32处缺陷",
          evaluateResult: "8.0",
        },
        {
          affiliateSubitem: "结构安全度",
          evaluateQuota: "抗滑稳定",
          evaluateAccord: "最小安全系数1.15",
          evaluateResult: "6.0",
        },
        {
          affiliateSubitem: "结构安全度",
          evaluateQuota: "坝基应力",
          evaluateAccord: "最小抗裂安全系数1.20",
          evaluateResult: "5.0",
        },
        {
          affiliateSubitem: "结构安全度",
          evaluateQuota: "坝体应力",
          evaluateAccord: "最小抗裂安全系数1.20",
          evaluateResult: "5.0",
        }
      ]
    }
  },
  {
    id: 3,
    title: "通航建筑",
    safeLevelJudge: {
      tableData: [
        {
          name: "1号船闸",
          safeDegree: 9.5,
          safeLevel: "安全"
        },
        {
          name: "2号船闸",
          safeDegree: "7.0",
          safeLevel: "较安全"
        },
        {
          name: "3号船闸",
          safeDegree: 6.8,
          safeLevel: "一般安全"
        },
      ]
    },
    subitemEvaluate: {
      tableData: [
        {
          affiliateSubitem: "实测运行状态",
          evaluateQuota: "坝体变形",
          evaluateAccord: "超标点21个",
          evaluateResult: "7.0",
        },
        {
          affiliateSubitem: "实测运行状态",
          evaluateQuota: "坝基渗流",
          evaluateAccord: "超标点21个",
          evaluateResult: "6.0",
        },
        {
          affiliateSubitem: "现场安全检查",
          evaluateQuota: "坝体缺陷",
          evaluateAccord: "32处缺陷",
          evaluateResult: "8.0",
        },
        {
          affiliateSubitem: "结构安全度",
          evaluateQuota: "抗滑稳定",
          evaluateAccord: "最小安全系数1.15",
          evaluateResult: "6.0",
        },
        {
          affiliateSubitem: "结构安全度",
          evaluateQuota: "坝基应力",
          evaluateAccord: "最小抗裂安全系数1.20",
          evaluateResult: "5.0",
        },
        {
          affiliateSubitem: "结构安全度",
          evaluateQuota: "坝体应力",
          evaluateAccord: "最小抗裂安全系数1.20",
          evaluateResult: "5.0",
        }
      ]
    }
  }
])

const tabsChange = (id: number, title: string, curTabs: string) => {
  console.log(`id为${id}，title为${title}，的组件的tabs标签页切换为${curTabs}`);
}

onMounted(() => {})
</script>

<style scoped lang="scss">
.safe-status {
  display: flex;
  justify-content: space-between;
}
</style>