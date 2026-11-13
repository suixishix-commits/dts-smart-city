import { scalePx } from '@/utils/viewportScale'

import * as echarts from 'echarts'
export default class LiuYuYuQingOption {
  public static getOption(xDataArr: any, yDataArr: any) {
    const option: any = {
      animationDuration: function (idx: any) {
        return idx * 200
      },
      axisLabel: {
        fontSize: scalePx(12),
        fontFamily: 'OPPOSans-R'
      },
      // animationDelay: 500,
      animationEasing: 'cubicOut',
      grid: {
        left: '20',
        right: '20',
        top: '20',
        bottom: '20',
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        show: true,
        axisPointer: {
          type: 'shadow'
        },
        enterable: true,
        // transitionDuration: 2,
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
            if (seriesName == '雨情信息') {
              tooltipContent += '地区: ' + xAxisName + ' ' + '<br/>'
              tooltipContent += '面平均降雨量：' + dataValue + 'mm' + '<br/>'
            }
          }
          return tooltipContent
        }
      },
      yAxis: {
        data: yDataArr,
        type: 'category',
        axisLabel: {
          color: '#fff',
          fontSize: scalePx(12),
          fontFamily: 'OPPOSans-R'
        },
        axisTick: {
          show: false
        },
        axisLine: {
          show: true,
          lineStyle: {
            width: scalePx(2) // 设置轴线条的宽度
          }
        },
        min: function (value: any) {
          return (value.min * 0.9).toFixed(2)
        },
        max: function (value: any) {
          return (value.max * 1.1).toFixed(2)
        }
      },
      xAxis: {
        type: 'value',
        axisLine: {
          show: true,
          lineStyle: {
            width: scalePx(2)
          }
        },
        axisTick: {
          show: false
        },
        splitLine: {
          show: false
        },
        min: function (value: any) {
          return (value.min * 0.9).toFixed(2)
        },
        max: function (value: any) {
          return (value.max * 1.1).toFixed(2)
        },
        nameLocation: 'end',
        nameTextStyle: {
          padding: [0, 0, 15, -5], // 可以根据需要调整
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
          name: '雨情信息',
          z: 1,
          type: 'bar',
          barGap: '0%',
          data: xDataArr,
          barWidth: scalePx(15),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#9fedf7' },
              { offset: 1, color: '#1658ac' }
            ])
          },
          label: {
            show: true,
            position: 'right',
            color: '#fcaf17',
            fontSize: scalePx(20),
            fontFamily: 'DIN-Bold'
          }
        }
      ]
    }

    return option;
  }
}