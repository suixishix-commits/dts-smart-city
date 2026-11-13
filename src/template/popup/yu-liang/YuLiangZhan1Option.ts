
import * as echarts from 'echarts'
export default class YuLiangZhan1Option {  // 获取配置信息
  // static xData = ref([]);
  // static rainList = ref([]); //降雨
  // static simulatedFlow = ref([]); //模拟流量

  public static getOption(xData:any, rainList:any, simulatedFlow:any) {
    const option = {
      grid: {
        top: 40,
        left: 10,
        right: 10,
        bottom: 10,
        containLabel: true, //防止标签溢出
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          animation: false,
          label: {
            backgroundColor: "#505765",
          },
        },
      },
      legend: {
        data: ["降雨", { name: "模拟流量", itemStyle: { opacity: 0 } }],
        top: 5,
        textStyle: {
          color: "#fff",
        },
      },
      xAxis: [
        {
          type: "category",
          data: xData,
          axisTick: {
            show: false, // 隐藏 x 轴刻度线
          },
          axisLine: {
            lineStyle: {
              color: "#fff",
            },
          },
          axisLabel: {
            interval: "auto",
            rotate: 90,
          },
        },
      ],
      yAxis: [
        {
          name: "流量(m³/s)",
          type: "value",
          min:0,
          max:1600,
          minInterval:1,
          interval:400,
          axisLine: {
            show: true,
            lineStyle: {
              color: "#fff",
            },
          },
          axisTick: {
            show: false, // 隐藏 y 轴刻度线
          },
          splitLine: {
            show: false,
          },
        },
        {
          name: "降雨(mm)",
          nameLocation: "start",
          axisLine: {
            show: true,
            lineStyle: {
              color: "#fff",
            },
          },
          axisTick: {
            show: false, // 隐藏 y 轴刻度线
          },
          splitLine: {
            show: false,
          },
          alignTicks: true,
          type: "value",
          inverse: true,
          min:0,
          max:40,
          minInterval:1,
          interval:10
        },
      ],
      series: [
        {
          name: "降雨",
          type: "bar",
          yAxisIndex: 1,
          backgroundStyle: {
            color: "#00d7fe",
          },
          data: rainList,
          itemStyle: {
            color: "#00D4FF",
          },
        },
        {
          name: "模拟流量",
          type: "line",
          yAxisIndex: 0,
          showSymbol: false,
          data: simulatedFlow,
          itemStyle: {
            color: "#00D88C",
          },
        },
      ],
    };

    return option;
  }
}