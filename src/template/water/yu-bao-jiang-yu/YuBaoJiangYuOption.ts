import { scalePx } from '@/utils/viewportScale'

import * as echarts from 'echarts'
export default class WaterOfMultiYearOption {
  public static getOption(xDateArr: any, yDataArr: any) {
    const colorArr = ['#2886c6', '#50bfda', '#abecfc'] //左右和上的颜色
    let option: any = {
      animationDuration: function (idx: any) {
        return idx * 200
      },
      // animationDelay: 500,
      grid: {
        left: '20',
        right: '20',
        top: '20',
        bottom: '20',
        containLabel: true
      },
      animationEasing: 'cubicOut',
      axisLabel: {
        fontSize: scalePx(12),
        fontFamily: 'OPPOSans-R'
      },
      tooltip: {
        trigger: 'axis',
        show: true,
        axisPointer: {
          type: 'shadow'
        },
        enterable: true,
        transitionDuration: 2,
        backgroundColor: 'rgba(0, 0, 0,0.9)',
        borderColor: '#1658ac',
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
            var seriesName = param.seriesName || ''
            var dataValue = param.data || ''
            if (seriesName == '全流域降雨量') {
              tooltipContent += '时间:' + xAxisName + ' ' + '<br/>'
              tooltipContent += '全流域降雨量：' + dataValue + 'mm' + '<br/>'
            }
          }
          return tooltipContent
        }
      },
      xAxis: {
        data: xDateArr,
        type: 'category',
        axisTick: {
          show: false // 隐藏 x 轴刻度线
        },
        axisLabel: {
          color: '#fff',
          fontSize: scalePx(12),
          fontFamily: 'OPPOSans-R'
        },
        axisLine: {
          lineStyle: {
            width: scalePx(2) // 设置x轴线条的宽度
          }
        }
      },
      yAxis: {
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
          return (value.min * 0.9).toFixed(0)
        },
        max: function (value: any) {
          return (value.max * 1.1).toFixed(0)
        },
        name: '单位: mm',
        nameLocation: 'end',
        nameTextStyle: {
          padding: [0, 0, 10, -5], // 可以根据需要调整
          color: '#fff'
        },
        axisLabel: {
          color: '#fff',
          fontSize: scalePx(12),
          fontFamily: 'OPPOSans-R'
        }
      },
      series: [
        {
          name: '全流域降雨量',
          z: 1,
          type: 'bar',
          barGap: '0%',
          data: yDataArr,
          barWidth: scalePx(15),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: '#8ee7fd' // 渐变起始颜色
              },
              {
                offset: 1,
                color: 'rgba(23, 147, 182,0.1)' // 渐变结束颜色
              }
            ])
          },
          label: {
            show: true,
            position: 'top',
            color: '#befb9d',
            fontSize: scalePx(20),
            fontFamily: 'DIN-Bold'
          }
        },
        {
          z: 3,
          type: 'pictorialBar',
          symbolSize: [15 - 2, (10 * (15 - 2)) / 15],
          symbol: 'diamond',
          symbolOffset: ['0%', '-120%'],
          symbolPosition: 'end',
          data: yDataArr,
          itemStyle: {
            borderColor: colorArr[2],
            borderWidth: scalePx(2),
            color: colorArr[2]
          }
        }
      ]
    }

    return option;
  }
}