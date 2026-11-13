import { scalePx } from '@/utils/viewportScale'

import * as echarts from 'echarts'
export default class WaterOfMultiYearOption {
  public static getOption(allDataTime: any, xxsw: any, normz: any, erz: any, rz: any, dsflz: any, ckflz: any) {
    let option: any = {
      axisLabel: {
        fontSize: scalePx(12),
        fontFamily: 'OPPOSans-R'
      },
      grid: {
        left: '20',
        right: '20',
        top: '20',
        bottom: '20',
        containLabel: true
      },
      legend: {
        textStyle: {
          color: '#fff',
          fontSize: scalePx(12),
          fontFamily: 'OPPOSans-R'
        },
        data: ['汛限水位', '正常蓄水位', '水位', '设计洪水位', '校核洪水位'],
        orient: 'horizontal',
        top: 20,
        itemHeight: scalePx(4),
        itemWidth: scalePx(15)
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
          let tooltipContent = ''
          let xAxisNameArray: string[] = []
          let hasMeasuredData = false
          let hasForecastData = false
          for (let i = 0; i < params.length; i++) {
            const param = params[i]
            const xAxisName = param.axisValueLabel || ''
            if (xAxisNameArray.indexOf(xAxisName) < 0) {
              xAxisNameArray.push(xAxisName)
            }
            const yAxisName = param.axisName || ''
            const seriesName = param.seriesName || ''
            const dataValue = param.data
            const xAxisUnit = param.axisValueLabel ? param.axisValueLabel.split(' ').pop() : ''
            const yAxisUnit = param.axisName ? param.axisName.split(' ').pop() : ''
            if (seriesName === '汛限水位' || seriesName === '正常蓄水位' || seriesName === '设计洪水位' || seriesName === '校核洪水位') {
              if (dataValue !== null) {
                tooltipContent += `${seriesName} ${dataValue}m<br/>`
                hasMeasuredData = true
              }
            } else if (seriesName === '末水位' || seriesName === '水位') {
              if (dataValue !== null) {
                tooltipContent += `${seriesName} ${dataValue}m<br/>`
                hasForecastData = true
              }
            }
          }
          if (xAxisNameArray.length > 0) {
            tooltipContent = `时间: ${xAxisNameArray.join(', ')}<br/>` + tooltipContent
          }
          if (!hasMeasuredData && hasForecastData) {
            tooltipContent = tooltipContent.replace(/末水位/g, '末水位: ').replace(/水位/g, '水位: ')
          }
          return tooltipContent
        }
      },
      xAxis: {
        data: allDataTime,
        type: 'category',
        axisTick: {
          show: false // 隐藏 x 轴刻度线
        },
        axisLabel: {
          color: '#fff',
          fontSize: scalePx(12),
          fontFamily: 'OPPOSans-R',
          formatter: function (value: any) {
            return value.substring(0, 10)
          },
          align: 'center',
          padding: [0, 0, 0, 50]
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
        min: function (val: any) {
          return (val.min * 0.98).toFixed(0)
        },
        max: function (val: any) {
          return (val.max * 1.01).toFixed(0)
        },
        interval: 2,
        name: '单位: m',
        nameLocation: 'end',
        nameTextStyle: {
          padding: [0, 0, 20, -10], // 可以根据需要调整
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
          name: '汛限水位',
          type: 'line',
          data: xxsw,
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: 'rgb(148, 13, 13)'
          },
          z: 2,
          connectNulls: true,
          lineStyle: {
            type: 'dashed'
          }
        },
        {
          name: '正常蓄水位',
          type: 'line',
          data: normz,
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: '#42fa76'
          },
          z: 2,
          connectNulls: true
        },
        {
          name: '末水位',
          data: erz,
          type: 'line',
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: 'rgb(31, 195, 221)'
          },
          lineStyle: {
            type: 'dashed'
          },
          connectNulls: true,
          //填充面
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: 'rgba(170, 231, 237, 1)' // 0% 处的颜色
                },
                {
                  offset: 1,
                  color: 'rgba(255,255,255, 0)' // 100% 处的颜色
                }
              ],
              global: false // 缺省为 false
            }
          }
        },
        {
          name: '水位',
          data: rz,
          type: 'line',
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: 'rgb(31, 195, 221)'
          },
          connectNulls: true,
          //填充面
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: 'rgba(170, 231, 237, 0.5)' // 0% 处的颜色
                },
                {
                  offset: 1,
                  color: 'rgba(255,255,255, 0)' // 100% 处的颜色
                }
              ],
              global: false // 缺省为 false
            }
          }
        },
        {
          name: '设计洪水位',
          data: dsflz,
          type: 'line',
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: 'rgb(31, 195, 221)'
          },
          connectNulls: true
        },
        {
          name: '校核洪水位',
          data: ckflz,
          type: 'line',
          smooth: true,
          symbol: 'none',
          itemStyle: {
            color: '#fbbc5e'
          },
          connectNulls: true
        }
      ]
    }

    return option;
  }
}