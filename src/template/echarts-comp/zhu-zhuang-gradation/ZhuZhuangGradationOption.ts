import { scalePx } from '@/utils/viewportScale'
import * as echarts from 'echarts'
export default class WaterOfMultiYearOption {
  public static getOption(xAxisdata: any, seriesdata1: any) {
    let option: any = {
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "shadow",
          },
        },
        grid: {
          top: "25%",
          left: "3%",
          right: "4%",
          bottom: "3%",
          containLabel: true,
        },
        xAxis: [
          {
            type: "category",
            data: xAxisdata,
            // 坐标轴轴线
            axisLine: {
              show: false, //是否显示轴线
            },
            // 刻度文本颜色
            axisLabel: {
              show: true,
              fontSize: scalePx(24),
              color: "#fff",
              // interval: 0
            },
          },
        ],
        yAxis: [
          {
            type: "value",
            // 坐标轴轴线
            axisLine: {
              show: false, //是否显示轴线
            },
            name: "t",
            nameLocation: "end",
            nameTextStyle: {
              fontSize: scalePx(24),
              color: "#A1ABB3",
              padding: [0, 30, 0, 0],
            },
            // 刻度文本颜色
            axisLabel: {
              show: true,
              fontSize: scalePx(24),
              color: "#fff",
            },
            splitLine: {
              show: true,
              lineStyle: {
                color: "#27435D",
                width: scalePx(2),
              },
            },
          },
        ],
        series: [
          {
            name: "总燃料量",
            // data: data1,
            data: seriesdata1,
            barWidth: scalePx(24),
            // data: data.t1,
            type: "bar",
            itemStyle: {
              normal: {
                barBorderRadius: scalePx(20),
              //图形样式
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  //调用图形相关方法——渐变色生成器
                  offset: 0, //这四个参数用于配置渐变色起止位置，依次对应右/下/左/上四个方位
                  color: "#FF5709", //数组，用于配置颜色渐变过程，每一项为一个对象，包含offset和color两个参数
                }, //offset的范围0-1,对应位置
                {
                  offset: 1,
                  color: "rgba(9,255,107,0.00)",
                },
              ]),
            },
            },
          },
        ],
      }

    return option;
  }
}