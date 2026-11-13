import { scalePx } from '@/utils/viewportScale'

import * as echarts from 'echarts'
export default class ShuiKuDiaoDuOption {
  public static getOption(xDataArr1: any, xDataArr2: any, xDataArr3: any, arrZcXSW: any, arrFanXunLine: any, arrFefg: any, get_normal: any, get_limit1: any, get_limit2: any, arrDeadline: any, arrYJX: any, arrReal: any) {
    console.log("水库调度图表数据", arguments);

    const option: any = {
      animationDuration: 2000,
      // animationDelay: 500,
      animationEasing: 'cubicOut',
      axisLabel: {
        fontSize: scalePx(12)
      },
      tooltip: {
        trigger: 'axis',
        show: true,
        enterable: true,
        axisPointer: {
          type: 'cross',
          label: {
            show: false
          }
        },
        transitionDuration: 2,
        backgroundColor: '#fff',
        textStyle: {
          color: 'black',
          fontFamily: 'OPPOSans-R',
          fontSize: scalePx(12)
        },
        formatter: function (params: any) {
          let strDate = ''
          var tooltipContent = ''
          //console.log('tooltip', params, myCharts.getOption().series)
          for (var i = 0; i < params.length; i++) {
            var param = params[i]
            if (param.axisValueLabel.indexOf('-') > 0) {
              strDate = param.axisValueLabel + '<br/>'
            }
            var seriesName = param.seriesName || ''
            var dataValue = param.data || ''
            if (dataValue) {
              tooltipContent += '' + seriesName + ': ' + dataValue + 'm' + '<br/>'
            }
            // else {
            // 	dataValue = getSerieData(param, myCharts.getOption().series)
            // 	if (dataValue) {
            // 		tooltipContent += '' + seriesName + ': ' + dataValue + 'm' + '<br/>'
            // 	}
            // }
          }
          return strDate + tooltipContent
        }
      },
      grid: {
        bottom: '8%',
        top: '8%',
        right: '5%',
        left: '6%'
      },
      xAxis: [
        // 日线刻度
        {
          position: 'bottom',
          type: 'category',
          data: xDataArr2,
          splitLine: {
            show: false //隐藏
          },
          axisTick: {
            show: false
          },
          axisLine: {
            lineStyle: {
              color: '#fff'
            },
            show: false
          },
          boundaryGap: false,
          axisLabel: {
            padding: [0, 0, 0, 3],
            color: '#fff',
            align: 'left',
            fontSize: scalePx(9),
            show: false
          },
          axisPointer: {
            type: 'line',
            label: {
              show: true,
              backgroundColor: 'rgb(110,112,121)'
            }
          }
        },
        // 月份刻度
        {
          type: 'category',
          position: 'bottom',
          offset: 0,
          data: xDataArr3,
          splitLine: {
            interval: (index: number, value: string) => { return index % 3 === 0 },
            lineStyle: {
              color: 'rgba(255, 255, 255,0.3)',
              type: 'dashed' //虚线
            },
            show: true //隐藏
          },
          axisTick: {
            show: true
          },
          axisLabel: {
            color: '#fff',
            align: 'center',
            fontSize: scalePx(12),
            interval: 0,
            show: true
          },
          axisPointer: {
            type: 'none'
          }
        },
        // 旬刻度
        {
          type: 'category',
          position: 'bottom',
          offset: 0,
          data: xDataArr1,
          splitLine: {
            show: false //隐藏
          },
          axisTick: {
            show: false
          },
          axisLabel: {
            color: 'rgba(255, 255, 255,0.3)',
            align: 'center',
            fontSize: scalePx(12),
            interval: 0,
            show: true,
            margin: -16
          },
          axisPointer: {
            type: 'none'
          }
        }
      ],
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
          lineStyle: {
            type: 'dashed',
            color: 'rgba(255, 255, 255,0.3)'
          }
        },
        min: 194,
        max: 218,
        interval: 3,
        name: '单位: m',
        nameLocation: 'end',
        nameTextStyle: {
          padding: [0, 0, 10, -20], // 可以根据需要调整
          color: '#fff'
        },
        axisLabel: {
          color: '#fff',
          fontSize: scalePx(12)
        },
        axisPointer: {
          type: 'line',
          label: {
            show: true
          }
        }
      },
      series: [
        {
          name: '正常蓄水位',
          type: 'line',
          data: arrZcXSW,
          step: 'middle',
          smooth: false,
          symbol: 'none',
          itemStyle: {
            color: 'green'
          },
          connectNulls: false,
          symbolOffset: ['-50%', '-50%'],
          xAxisIndex: 1
        },
        {
          name: '汛期限制水位',
          type: 'line',
          data: arrFanXunLine,
          smooth: false,
          symbol: 'none',
          itemStyle: {
            color: 'rgb(148, 13, 13)'
          },
          connectNulls: true,
          xAxisIndex: 1
        },
        {
          name: '防弃水线',
          type: 'line',
          data: arrFefg,
          smooth: false,
          symbol: 'none',
          itemStyle: {
            color: 'rgb(137, 62, 208)'
          },
          connectNulls: true,
          xAxisIndex: 1
        },
        {
          name: '正常供水线',
          type: 'line',
          data: get_normal,
          smooth: false,
          symbol: 'none',
          label: {
            show: true
          },
          itemStyle: {
            color: '#fbbc5e'
          },
          connectNulls: true,
          xAxisIndex: 1
        },
        {
          name: '限制供水I线',
          type: 'line',
          data: get_limit1,
          smooth: false,
          symbol: 'none',
          itemStyle: {
            color: 'gray'
          },
          connectNulls: true,
          xAxisIndex: 1
        },
        {
          name: '限制供水II线',
          type: 'line',
          data: get_limit2,
          smooth: false,
          symbol: 'none',
          itemStyle: {
            color: '#5877fa'
          },
          connectNulls: true,
          xAxisIndex: 1
        },
        {
          name: '死水位',
          type: 'line',
          data: arrDeadline,
          smooth: false,
          symbol: 'none',
          itemStyle: {
            color: 'rgb(148, 13, 13)'
          },
          lineStyle: {
            type: 'dotted',
            color: 'rgb(148, 13, 13)',
            width: scalePx(2)
          },
          connectNulls: true,
          xAxisIndex: 1
        },
        {
          name: '应急供水线',
          type: 'line',
          data: arrYJX,
          smooth: false,
          symbol: 'none',
          lineStyle: {
            color: 'rgb(56, 223, 56)',
            //width: scalePx(4),
            type: 'dashed'
          },
          connectNulls: true,
          xAxisIndex: 1
        },
        {
          name: '库水位',
          type: 'line',
          data: arrReal,
          smooth: false,
          symbol: 'none',
          itemStyle: {
            color: 'rgb(0, 212, 228)'
          },
          connectNulls: true,
          xAxisIndex: 0,
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
                  color: 'rgba(170, 231, 237, 0.2)' // 0% 处的颜色
                },
                {
                  offset: 1,
                  color: 'rgba(255,255,255, 0)' // 100% 处的颜色
                }
              ],
              global: false // 缺省为 false
            }
          }
        }
      ],
      graphic: [
        {
          type: 'text',
          left: '8%',
          top: '33%',
          rotation: 6,
          style: {
            fill: 'white',
            text: '正常供水线',
            textAlign: 'center',
            fontSize: scalePx(15)
          }
        },
        {
          type: 'text',
          left: '8%',
          top: '37%',
          rotation: 6,
          style: {
            fill: 'white',
            text: '限制供水I线',
            textAlign: 'center',
            fontSize: scalePx(15)
          }
        },
        {
          type: 'text',
          left: '8%',
          top: '70%',
          style: {
            fill: 'white',
            text: '应急供水线(199.00)',
            textAlign: 'center',
            fontSize: scalePx(15)
          }
        },
        {
          type: 'text',
          left: '8%',
          top: '11%',
          style: {
            fill: 'white',
            text: '正常蓄水位 (216.00)',
            textAlign: 'center',
            fontSize: scalePx(15)
          }
        },
        {
          type: 'text',
          left: '8%',
          top: '28%',
          style: {
            fill: 'white',
            text: '水位过程线',
            textAlign: 'center',
            fontSize: scalePx(15)
          }
        },
        {
          type: 'text',
          left: '8%',
          top: '50%',
          rotation: 6,
          style: {
            fill: 'white',
            text: '限制供水II线',
            textAlign: 'center',
            fontSize: scalePx(15)
          }
        },
        {
          type: 'text',
          left: '17%',
          top: '16%',
          rotation: 6,
          style: {
            fill: 'white',
            text: '防弃水线',
            textAlign: 'center',
            fontSize: scalePx(15)
          }
        },
        {
          type: 'text',
          left: '8%',
          bottom: '13%',
          style: {
            fill: 'white',
            text: '死水位 (195.00)',
            textAlign: 'center',
            fontSize: scalePx(15)
          }
        },
        {
          type: 'text',
          left: '28.5%',
          top: '20%',
          style: {
            fill: 'red',
            text: '汛限水位 (213.37)',
            textAlign: 'center',
            fontSize: scalePx(15)
          }
        },
        {
          type: 'group',
          right: '10%',
          top: '18%',
          children: [
            {
              type: 'rect',
              left: 'center',
              top: 'middle',
              shape: {
                width: scalePx(350),
                height: 25
              },
              style: {
                fill: 'rgb(230, 231, 173)',
                stroke: 'rgb(238, 238, 102)'
              },
              zlevel: 1
            },
            {
              type: 'text',
              left: 'center',
              top: 'middle',
              style: {
                fill: 'black',
                text: '正常供水区: 各业正常供水',
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fontSize: scalePx(15)
              },
              zlevel: 2
            }
          ]
        },
        {
          type: 'group',
          right: '10%',
          top: '28%',
          children: [
            {
              type: 'rect',
              left: 'center',
              top: 'middle',
              shape: {
                width: scalePx(400),
                height: 25
              },
              style: {
                fill: 'rgb(230, 231, 173)',
                stroke: 'rgb(238, 238, 102)'
              },
              zlevel: 1
            },
            {
              type: 'text',
              left: 'center',
              top: 'middle',
              style: {
                fill: 'black',
                text: '限制供水I区: 河道外湿地供水减少50%,其他行业正常供水',
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fontSize: scalePx(15)
              },
              zlevel: 2
            }
          ]
        },
        {
          type: 'group',
          right: '10%',
          top: '36%',
          children: [
            {
              type: 'rect',
              left: 'center',
              top: 'middle',
              shape: {
                width: scalePx(400),
                height: 40
              },
              style: {
                fill: 'rgb(230, 231, 173)',
                stroke: 'rgb(238, 238, 102)'
              },
              zlevel: 1
            },
            {
              type: 'text',
              left: 'center',
              top: 'middle',
              style: {
                fill: 'black',
                text: ['{a|限制供水II区: 农业供水减少30%,河道外湿地供水减少50%}', '{b|与丰满等水库联合满足航运用水要求,其他行业正常供水}'].join('\n'),
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fontSize: scalePx(15),
                rich: {
                  a: {
                    lineHeight: scalePx(20),
                    color: '#fff'
                  },
                  b: {
                    lineHeight: scalePx(20),
                    color: '#fff'
                  }
                }
              },
              zlevel: 2
            }
          ]
        },
        {
          type: 'group',
          right: '10%',
          bottom: '33%',
          children: [
            {
              type: 'rect',
              left: 'center',
              top: 'middle',
              shape: {
                width: scalePx(360),
                height: 40
              },
              style: {
                fill: 'rgb(230, 231, 173)',
                stroke: 'rgb(238, 238, 102)'
              },
              zlevel: 1
            },
            {
              type: 'text',
              left: 'center',
              top: 'middle',
              style: {
                fill: 'black',
                text: ['{a|限制供水III区: 农业供水减少30%,河道外湿地不供水},', '{b|其他行业正常供水,兼顾航运用水要求}'].join('\n'),
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fontSize: scalePx(15),
                rich: {
                  a: {
                    lineHeight: scalePx(20),
                    color: '#fff'
                  },
                  b: {
                    lineHeight: scalePx(20),
                    color: '#fff'
                  }
                }
              },
              zlevel: 2
            }
          ]
        },
        {
          type: 'group',
          right: '10%',
          bottom: '17%',
          children: [
            {
              type: 'rect',
              left: 'center',
              top: 'middle',
              shape: {
                width: scalePx(350),
                height: 25
              },
              style: {
                fill: 'rgb(230, 231, 173)',
                stroke: 'rgb(238, 238, 102)'
              },
              zlevel: 1
            },
            {
              type: 'text',
              left: 'center',
              top: 'middle',
              style: {
                fill: 'black',
                text: '应急供水区: 用于应急水量调度',
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fontSize: scalePx(15)
              },
              zlevel: 2
            }
          ]
        },
        {
          type: 'group',
          left: '25%',
          top: '30%',
          children: [
            {
              type: 'rect',
              left: 'center',
              top: 'middle',
              shape: {
                width: scalePx(265),
                height: 25
              },
              style: {
                fill: 'rgb(230, 231, 173)',
                stroke: 'rgb(238, 238, 102)'
              },
              zlevel: 1
            },
            {
              type: 'text',
              left: 'center',
              top: 'middle',
              style: {
                fill: 'black',
                text: '防弃水区: 各业正常供水,适当加大放流',
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fontSize: scalePx(15)
              },
              zlevel: 2
            }
          ]
        }
      ]
    }

    return option;
  }
}