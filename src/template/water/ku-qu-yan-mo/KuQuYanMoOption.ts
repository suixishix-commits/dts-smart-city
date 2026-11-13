import { scalePx } from '@/utils/viewportScale'

import * as echarts from 'echarts'
export default class KuQuYanMoOption {
  public static getOption(indicator: any, s1Data: any, s2Data: any) {
    const option: any = {
      axisLabel: {
        fontFamily: 'OPPOSans-R',
        fontSize: scalePx(26)
      },
      grid: {
        containLabel: true
      },
      tooltip: {
        show: true,
        trigger: 'item',
        axisPointer: {
          type: 'line'
        },
        enterable: true,
        transitionDuration: 2,
        backgroundColor: 'rgba(0, 0, 0,1)',
        textStyle: {
          color: '#fbcd5e',
          fontFamily: 'OPPOSans-R',
          fontSize: scalePx(24)
        },
        formatter: function (params: any) {
          var result = params.name + '<br>'
          params.value.forEach(function (value: any, index: any) {
            result += option.radar.indicator[index].name + ' : ' + value + ' ' + option.radar.indicator[index].unit + '<br>'
          })
          return result
        }
      },
      radar: {
        shape: 'circle',
        radius: '80%',
        center: ['50%', '55%'],
        axisLine: {
          lineStyle: {
            color: 'rgba(211, 253, 250, 0.8)'
          }
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(211, 253, 250, 0.8)'
          }
        },
        axisName: {
          color: '#fff',
          borderRadius: scalePx(3),
          padding: [0, 0]
        },
        areaStyle: {
          // 设置区域的边框颜色
          borderColor: 'red', // 边框颜色
          borderWidth: scalePx(2) // 边框粗细
        },
        indicator: indicator,
        splitArea: {
          areaStyle: {
            color: new echarts.graphic.RadialGradient(0.1, 0.6, 1, [
              {
                color: 'rgba(255, 255, 255, 0.1)',
                offset: 0
              },
              {
                color: 'rgba(251, 205, 94,0.1)',
                offset: 1
              }
            ]),
            shadowColor: 'rgba(0, 0, 0, 0.2)',
            shadowBlur: scalePx(10)
          }
        },
        axisLabel: {
          show: false,
          color: '#000',
          formatter: function (params: any) {
            var value = params.value
            return value
          }
        }
      },
      series: [
        {
          type: 'radar',
          // emphasis: {
          // 	lineStyle: {
          // 		width: scalePx(3)
          // 	}
          // },
          //symbol: 'none', // 将数据点的标记设置为无
          symbolSize: scalePx(0), // 将数据点的大小设置为 0
          data: [
            {
              value: s1Data,
              name: '216水位',
              lineStyle: {
                type: 'solid',
                color: 'rgba(255, 145, 124, 0.9)'
              },
              areaStyle: {
                color: new echarts.graphic.RadialGradient(0.1, 0.6, 1, [
                  {
                    color: 'rgba(255, 145, 124, 0.3)',
                    offset: 0
                  },
                  {
                    color: 'rgba(255, 145, 124, 0.9)',
                    offset: 1
                  }
                ])
              }
            },
            {
              name: '220水位',
              value: s2Data,
              lineStyle: {
                type: 'dashed',
                color: '#eb6231'
              },
              itemStyle: {
                color: '#eb6231'
              },
              label: {
                show: true,
                formatter: function (params: any) {
                  return params.value
                },
                position: 'inside',
                //distance: 10,
                color: '#b1f0f7'
              },
              symbol: 'rect',
              symbolSize: scalePx(8)
            }
          ]
        }
      ]
    }

    return option;
  }
}