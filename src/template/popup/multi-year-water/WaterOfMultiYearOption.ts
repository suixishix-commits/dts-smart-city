import { scalePx } from '@/utils/viewportScale'

import * as echarts from 'echarts'
export default class WaterOfMultiYearOption {
  public static getOption(xDateArr: any, yDataArr: any, avgData: any) {
    let option: any = {
      animation: true,
      grid: {
        left: '20',
        right: '20',
        top: '50',
        bottom: '20',
        containLabel: true
      },
      axisLabel: {
        fontSize: scalePx(16),
        fontFamily: 'OPPOSans-R'
      },
      tooltip: {
        trigger: 'axis',
        show: true,
        axisPointer: {
          type: 'shadow'
        },
        enterable: true,
        // transitionDuration: 2,
        backgroundColor: 'rgba(0, 0, 0,0.7)',
        borderColor: '#1658ac',
        textStyle: {
          color: '#fff',
          fontFamily: 'OPPOSans-R',
          fontSize: scalePx(16)
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
            //tooltipContent += '年份:' + xAxisName + ' ' + '年' + '<br/>'
            //tooltipContent += 'y轴:' + yAxisName + ' ' + yAxisUnit + '<br/>'
            if (seriesName == '平均值' || seriesName == '多年同期来水') {
              tooltipContent += '' + seriesName.replace('多年同期来水', '同期来水') + ': ' + ''
              tooltipContent += '' + dataValue + '亿m³' + '<br/>'
            }
          }
          return tooltipContent
        }
      },
      legend: {
        textStyle: {
          color: '#fff'
        },
        data: [{ name: '平均值', color: '#426ab3' }],
        orient: 'horizontal',
        top: 17,
        itemHeight: scalePx(2)
      },
      xAxis: {
        data: xDateArr,
        type: 'category',
        axisTick: {
          show: false // 隐藏 x 轴刻度线
        },
        axisLabel: {
          rotate: 45,
          interval: 0, //不留间隙展示所有
          color: '#fff',
          fontSize: scalePx(16),
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
          return Math.floor(value.min)
        },
        max: function (value: any) {
          return Math.ceil(value.max)
        },
        name: '单位: 亿m³',
        nameLocation: 'end',
        nameTextStyle: {
          padding: [0, 0, 10, 12], // 可以根据需要调整
          color: '#fff'
        },
        axisLabel: {
          color: '#fff',
          fontSize: scalePx(16),
          fontFamily: 'OPPOSans-R'
        }
      },
      series: [
        {
          name: '平均值',
          type: 'line',
          data: avgData,
          lineStyle: {
            type: 'solid',
            color: '#5877fa',
            width: scalePx(3)
          },
          z: -1,
          smooth: true,
          symbol: 'none'
        },
        {
          name: '多年同期来水',
          type: 'bar',
          data: yDataArr,
          barWidth: scalePx(10),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#9fedf7' },
              { offset: 1, color: '#1658ac' }
            ])
          },
          label: {
            show: true,
            position: 'top',
            color: '#fcaf17',
            fontSize: scalePx(18),
            fontFamily: 'DIN-Bold',
            formatter: function (params: any) {
              if (yDataArr.length > 10 && params.dataIndex % 2 === 1) {
                return ''
              } else {
                return params.value
              }
            }
          }
        }
      ]
    }

    return option;
  }
}