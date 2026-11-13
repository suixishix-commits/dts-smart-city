import { scalePx } from '@/utils/viewportScale'

import * as echarts from 'echarts'
export default class ShuiKuShuiQingOption {
  public static getOption(xDataArr: any, yDataArr: any, yckflz: any, ydsflz: any, ynormz: any, yxun: any, yDataArrLiu: any) {
    const option: any = {
      animationDuration: 1500,
      animationDelay: 500,
      axisLabel: {
        fontSize: scalePx(12),
        fontFamily: 'OPPOSans-R'
      },
      grid: {
        left: '8%',
        right: '8%',
        top: '12%',
        bottom: '8%'
      },
      animationEasing: 'cubicOut',
      legend: {
        width: '70%',
        textStyle: {
          color: '#fff',
          fontSize: scalePx(12),
          fontFamily: 'OPPOSans-R'
        },
        data: ['水位', '校核洪水位(219.90)', '设计洪水位(218.15)', '正常蓄水位(216.00)', '汛限水位(213.37)', '入库流量'],
        orient: 'horizontal',
        top: 20,
        itemHeight: scalePx(3),
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        show: true,
        axisPointer: {
          type: 'cross'
        },
        enterable: true,
        transitionDuration: 2,
        backgroundColor: 'rgba(0, 0, 0,0.2)',
        //borderColor:'#1658ac',
        textStyle: {
          color: '#fff',
          fontSize: scalePx(12),
          fontFamily: 'OPPOSans-R'
        },
        formatter: function (params: any) {
          var tooltipContent = ''
          for (var i = 0; i < params.length; i++) {
            var param = params[i]
            var xAxisName = param.axisValueLabel || ''
            var yAxisName = param.axisName || ''
            var seriesName = param.seriesName || ''
            var dataValue = param.data || ''
            var xAxisUnit = param.axisValueLabel ? param.axisValueLabel.split(' ').push() : ''
            var yAxisUnit = param.axisName ? param.axisName.split(' ').pop() : ''
            if (i === 0) {
              tooltipContent += '' + xAxisName + ' ' + '<br/>'
            }
            //tooltipContent += 'y轴:' + yAxisName + ' ' + yAxisUnit + '<br/>'
            if (seriesName === '水位') {
              tooltipContent += seriesName + ': ' + dataValue + 'm³/s' + '<br/>'
            }
            if (seriesName === '入库流量') {
              tooltipContent += seriesName + ': ' + dataValue + 'm³/s' + '<br/>'
            }
            if (seriesName.includes('校核洪水位')) {
              seriesName = '校核洪水位'
              tooltipContent += seriesName + ': ' + dataValue + 'm³/s' + '<br/>'
            }
            if (seriesName.includes('设计洪水位')) {
              seriesName = '设计洪水位'
              tooltipContent += seriesName + ': ' + dataValue + 'm³/s' + '<br/>'
            }
            if (seriesName.includes('正常蓄水位')) {
              seriesName = '正常蓄水位'
              tooltipContent += seriesName + ': ' + dataValue + 'm³/s' + '<br/>'
            }
            if (seriesName.includes('汛限水位')) {
              seriesName = '汛限水位'
              tooltipContent += seriesName + ': ' + dataValue + 'm³/s' + '<br/>'
            }
          }
          return tooltipContent
        }
      },
      xAxis: {
        data: xDataArr,
        type: 'category',
        axisTick: {
          show: false // 隐藏 x 轴刻度线
        },
        axisLabel: {
          interval: 7,
          color: '#fff',
          fontSize: scalePx(12),
          fontFamily: 'OPPOSans-R',
          align: 'center',
          padding: [0, 0, 0, 50]
        },
        axisLine: {
          lineStyle: {
            width: scalePx(2) // 设置x轴线条的宽度
          }
        }
      },
      yAxis: [
        {
          type: 'value',
          axisLine: {
            show: true, // 隐藏 y 轴线
            lineStyle: {
              width: scalePx(2) // 设置轴线条的宽度
            }
          },
          axisTick: {
            show: false // 隐藏 y 轴刻度线
          },
          splitLine: {
            show: false
          },
          min: function (value: any) {
            const diff = (value.max - value.min) * 0.05
            return Math.floor(value.min - diff)
          },
          max: function (value: any) {
            const diff = (value.max - value.min) * 0.05
            return Math.ceil(value.max + diff)
          },
          name: '水位 :m',
          nameLocation: 'end',
          nameTextStyle: {
            padding: [0, 0, 10, -20], // 可以根据需要调整
            color: '#fff'
          },
          axisLabel: {
            color: '#fff',
            fontSize: scalePx(12),
            fontFamily: 'OPPOSans-R'
          }
        },
        {
          type: 'value',
          axisLine: {
            show: false // 隐藏 y 轴线
          },
          axisTick: {
            show: false // 隐藏 y 轴刻度线
          },
          splitLine: {
            show: false
          },
          min: function (value: any) {
            return (value.min * 0.8).toFixed(0)
          },
          max: function (value: any) {
            return (value.max * 1.2).toFixed(0)
          },
          //interval: 20,
          name: '流量 :m³/s',
          nameLocation: 'end',
          nameTextStyle: {
            padding: [0, 0, 10, 30], // 可以根据需要调整
            color: '#fff'
          },
          axisLabel: {
            color: '#fff',
            fontSize: scalePx(12),
            fontFamily: 'OPPOSans-R'
          }
        }
      ],
      series: [
        {
          name: '水位',
          type: 'line',
          data: yDataArr,
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: '#3bf999'
          },
          yAxisIndex: 0,
          areaStyle: {
            color: 'rgba(0, 0, 0, 0)',
            zlevel: 1
          }
        },
        {
          name: '校核洪水位(219.90)',
          type: 'line',
          data: yckflz,
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: '#A6B5E1'
          },
          yAxisIndex: 0,
          areaStyle: {
            color: 'rgba(0, 0, 0, 0)',
            zlevel: 1
          },
          lineStyle: {
            type: 'dashed'
          }
        },
        {
          name: '设计洪水位(218.15)',
          type: 'line',
          data: ydsflz,
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: '#fbbc5e'
          },
          yAxisIndex: 0,
          areaStyle: {
            color: 'rgba(0, 0, 0, 0)',
            zlevel: 1
          },
          lineStyle: {
            type: 'dotted'
          }
        },
        {
          name: '正常蓄水位(216.00)',
          type: 'line',
          data: ynormz,
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: 'rgb(46, 222, 243)'
          },
          yAxisIndex: 0,
          areaStyle: {
            color: 'rgba(0, 0, 0, 0)',
            zlevel: 1
          }
          // lineStyle: {
          // 	type: 'dotted'
          // }
        },
        {
          name: '汛限水位(213.37)',
          type: 'line',
          data: yxun,
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: 'rgb(148, 13, 13)'
          },
          yAxisIndex: 0,
          areaStyle: {
            color: 'rgba(0, 0, 0, 0)',
            zlevel: 1
          },
          lineStyle: {
            type: 'dashed'
          }
        },
        {
          name: '入库流量',
          type: 'line',
          data: yDataArrLiu,
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: '#b1f0f7'
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(177, 240, 247,0.8)' },
              { offset: 1, color: 'rgba(177, 240, 247,0.1)' }
            ]),
            zlevel: 2
          },
          yAxisIndex: 1
        }
      ]
    }

    return option;
  }
}