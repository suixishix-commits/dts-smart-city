import { scalePx } from '@/utils/viewportScale'

import * as echarts from 'echarts'
export default class ScalableChart {
  public static getOption(seriesData: any) {
    const option: any = {
      animationDuration: 1500,
      // animationDelay: 500,
      textStyle: {
        color: '#fff',
        fontSize: scalePx(18),
        fontFamily: 'OPPOSans-R'
      },
      grid: {
        bottom: 20,
        top: 30,
        right: 10,
        left: 10,
        containLabel: true
      },
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'axis',
        show: true,
        axisPointer: {
          type: 'shadow'
        },
        enterable: true,
        transitionDuration: 1,
        backgroundColor: 'rgba(0, 0, 0,0.7)',
        borderColor: '#fff',
        textStyle: {
          color: '#fff'
        }
      },
      legend: {
        textStyle: {
          color: '#fff',
          fontSize: scalePx(18)
        },
        lineStyle: {
          width: scalePx(3)
        },
        data: ['WE-1液位计', '库水位'],
        orient: 'horizontal',
        top: 0,
        itemHeight: scalePx(0)
      },
      dataZoom: [
        {
          id: 'dataZoomX',
          type: 'inside',
          xAxisIndex: [0],
          filterMode: 'filter'
        }
      ],
      xAxis: {
        data: seriesData.x1,
        type: 'category',
        splitNumber: 3,
        axisLine: {
          onZero: false,
          lineStyle: {
            width: scalePx(2) // 设置x轴线条的宽度
          }
        },
        axisTick: {
          show: true, // 隐藏 x 轴刻度线
          inside: true,
          length: 5,
          alignWithLabel: true,
          lineStyle: {
            width: scalePx(2),
            type: 'solid',
            color: 'rgba(255, 255, 255,0.3)'
          }
        },
        axisLabel: {
          align: 'center',
          padding: [0, 0, 0, 0],
          margin: 6,
          fontSize: scalePx(18),
          formatter: function (value: any, index: any) {
            return value.substring(0, 10)
          }
        },
        margin: 1
      },
      yAxis: [
        {
          type: 'value',
          axisLine: {
            show: true, // 隐藏 y 轴线
            lineStyle: {
              width: scalePx(2) // 设置x轴线条的宽度
            }
          },
          axisTick: {
            show: false // 隐藏 y 轴刻度线
          },
          splitLine: {
            show: true,
            lineStyle: {
              type: 'dashed',
              color: 'rgba(255, 255, 255,0.3)'
            }
          },
          name: '渗漏量:L/S',
          nameLocation: 'end',
          nameTextStyle: {
            padding: [0, 0, -8, -8] // 可以根据需要调整
          },
          axisLabel: {
            fontSize: scalePx(18)
          },
          min: function (value: any) {
            return value.min
          },
          max: function (value: any) {
            return value.max
          }
        },
        {
          type: 'value',
          axisLine: {
            show: true, // 隐藏 y 轴线
            lineStyle: {
              width: scalePx(2) // 设置x轴线条的宽度
            }
          },
          axisTick: {
            show: false // 隐藏 y 轴刻度线
          },
          splitLine: {
            show: false
          },
          name: '水位:m',
          nameLocation: 'end',
          nameTextStyle: {
            padding: [0, 0, -8, 20] // 可以根据需要调整
          },
          axisLabel: {
            fontSize: scalePx(18)
          },
          min: function (value: any) {
            return value.min - 0.5
          },
          max: function (value: any) {
            return value.max + 0.5
          }
        }
      ],
      series: [
        {
          name: 'WE-1液位计',
          type: 'line',
          data: seriesData.s1,
          connectNulls: true,
          smooth: true,
          // symbol: 'none',
          symbol: 'circle',
          itemStyle: {
            color: '#3bf999'
          },
          lineStyle: {
            width: scalePx(1)
          },
          yAxisIndex: 0,
          areaStyle: {
            zlevel: 10,
            color: new echarts.graphic.LinearGradient(
              0,
              0,
              0,
              1,
              [
                {
                  offset: 0,
                  color: '#3bf999'
                },
                {
                  offset: 1,
                  color: 'rgba(0, 0, 0,0)'
                }
              ],
              false
            )
          }
        },
        {
          name: '库水位',
          type: 'line',
          data: seriesData.s2,
          smooth: true,
          symbol: 'circle',
          itemStyle: {
            color: '#A6B5E1'
          },
          lineStyle: {
            width: scalePx(1)
          },
          yAxisIndex: 1,
          areaStyle: {
            zlevel: 1,
            color: new echarts.graphic.LinearGradient(
              0,
              0,
              0,
              1,
              [
                {
                  offset: 0,
                  color: 'rgba(59, 249, 153,0.4)'
                },
                {
                  offset: 1,
                  color: 'rgba(0, 0, 0,0)'
                }
              ],
              false
            )
          }
        }
      ]
    }

    return option;
  }
}