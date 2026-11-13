import { scalePx } from '@/utils/viewportScale'
import * as echarts from 'echarts'
export default class RollingGrafationOption {
  public static getOption(xDataArr: any, yDataArr: any, yDataArrLiu: any) {
    let option = {
      animationDuration: 1500,
      // animationDelay: 500,
      animationEasing: 'cubicOut',
      axisLabel: {
        fontSize: scalePx(20),
        fontFamily: 'OPPOSans-R'
      },
      grid: {
        left: '20',
        right: '20',
        top: '20',
        bottom: '10',
        containLabel: true
      },
      legend: {
        width: '70%',
        textStyle: {
          color: '#fff',
          fontSize: scalePx(20),
          fontFamily: 'OPPOSans-R'
        },
        data: ['水位', '警戒水位', '保证水位', '流量'],
        orient: 'horizontal',
        // top: 20,
        itemHeight: scalePx(3),
        itemWidth: scalePx(15),
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
          fontSize: scalePx(20),
          fontFamily: 'OPPOSans-R'
        },
        formatter: function (params: any) {
          let tooltipContent = ''
          for (let i = 0; i < params.length; i++) {
            const param = params[i]
            const xAxisName = param.axisValueLabel || ''
            const seriesName = param.seriesName || ''
            const dataValue = param.data || ''
            if (i === 0) {
              tooltipContent += '' + xAxisName + ' ' + '<br/>'
            }
            //tooltipContent += 'y轴:' + yAxisName + ' ' + yAxisUnit + '<br/>'
            tooltipContent += '' + seriesName + ''
            if (seriesName === '水位') {
              tooltipContent += ': ' + dataValue + 'm' + '<br/>'
            }
            if (seriesName === '流量' && dataValue != 'null') {
              tooltipContent += ': ' + dataValue + 'm³/s' + '<br/>'
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
          color: '#fff',
          fontSize: scalePx(20),
          fontFamily: 'OPPOSans-R',
          interval: 3,
          align: 'center',
          padding: [0, 0, 0, 30],
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
          name: '水位 :m',
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
          nameLocation: 'end',
          nameTextStyle: {
            padding: [0, 0, 10, -20], // 可以根据需要调整
            color: '#fff'
          },
          axisLabel: {
            color: '#fff',
            fontSize: scalePx(20),
            fontFamily: 'OPPOSans-R'
          }
        },
        {
          type: 'value',
          name: '流量:m³/s',
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
            return (value.min * 0.9).toFixed(0)
          },
          max: function (value: any) {
            return (value.max * 1.1).toFixed(0)
          },
          //interval: 20,
          nameLocation: 'end',
          nameTextStyle: {
            padding: [0, 0, 10, 20], // 可以根据需要调整
            color: '#fff'
          },
          axisLabel: {
            color: '#fff',
            fontSize: scalePx(20),
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
            color: 'rgb(46, 222, 243)'
          },
          yAxisIndex: 0
        },
        {
          name: '流量',
          type: 'line',
          data: yDataArrLiu,
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: '#5877fa'
          },
          yAxisIndex: 1
        }
      ]
    }

    return option;
  }
}
