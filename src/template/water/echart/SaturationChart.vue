<script setup lang="ts">
import { scalePx, setScaledOption } from '@/utils/viewportScale'
import * as echarts from 'echarts'
import emitter from '@/utils/emitter'
import _ from 'lodash'
const echartsFontSize = (value: number, n: number = 1) => {
  const screenWidth: any = document.body.clientWidth
  return value * (screenWidth / 1920) * n
}
const echartOptions = ref<any>()
const damLeftWidth = 0 //X轴起点
const damWidth = 30 //X轴终点
const damHeight = 105 //Y轴终点
const damBottomHeight = 70 //Y轴起始值
const ckflz = 85.7 // 校核洪水位
const rz = shallowRef(79) // 当前水位
//测压管轮廓坐标data数据
const cyglkData = reactive([
  [14.9, 0, 15.1, 85.8],
  [17.9, 0, 18.1, 84.2],
  [20.9, 0, 21.1, 81.2]
])

// 渗压data数据
const cyData = reactive([
  [14.9, 0, 15.1, 79],
  [17.9, 0, 18.1, 77.1],
  [20.9, 0, 21.1, 75.2]
])

/*// 水位矩形
const rzArr = reactive([
  [0, rz.value],
  [7, rz.value],
  [4.5, 75.4],
  [4, 75.4],
  [0, 70],
])*/

// 校核洪水位数组
const ckflzArr = reactive([
  [0, ckflz],
  [14, ckflz]
])

/*// 浸润线数据
const lineArr = reactive([
  [7.9, rz.value],
  [cyData[0][0], cyData[0][3]],
  [cyData[1][0], cyData[1][3]],
  [cyData[2][0], cyData[2][3]],
  [damWidth, 0]
])*/
onMounted(async () => {
  await getChartData()
})
const getChartData = async () => {
  //大坝轮廓坐标data数据
  const dbData = reactive([
    [0, 70],
    [4, 75.4],
    [4.5, 75.4],
    [7, rz.value],
    [7.9, rz.value],
    [14, 85.6],
    [14, 86.6],
    [14.2, 86.6],
    [14.2, 85.6],
    [16, 85.6],
    [16, 86.6],
    [16.2, 86.6],
    [16.2, 85.6],
    [24, 78],
    [24, 77],
    [24.5, 77],
    [24.5, 78],
    [27.5, 78],
    [28, 77],
    [30, 77]
  ])
  // 水位矩形
  const rzArr = [
    [0, rz.value],
    [7, rz.value],
    [4.5, 75.4],
    [4, 75.4],
    [0, 70]
  ]
  // 浸润线数据
  const lineArr = [
    [7, rz.value],
    [7.9, rz.value],
    [cyData[0][0], cyData[0][3]],
    [cyData[1][0], cyData[1][3]],
    [cyData[2][0], cyData[2][3]],
    [damWidth, 0]
  ]
  echartOptions.value = {
    grid: {
      left: '10%',
      right: '10%',
      bottom: '5%',
      top: '5%'
    },
    calculable: false,
    xAxis: [
      {
        type: 'value',
        axisLabel: {
          show: false
        },
        axisTick: {
          show: false
        },
        splitLine: {
          show: false
        },
        min: damLeftWidth,
        max: damWidth
      }
    ],
    yAxis: [
      {
        type: 'value',
        scale: true,
        axisLabel: {
          formatter: '{value}',
          color: 'rgba(255,255,255,0.7)',
          fontSize: echartsFontSize(12)
        },
        splitLine: {
          show: false
        },
        min: damBottomHeight,
        max: damHeight,
        interval: 3
      }
    ],
    series: [
      {
        name: '大坝轮廓',
        type: 'line',
        symbol: 'none',
        data: dbData,
        silent: false,
        areaStyle: {
          normal: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: 'rgba(245,238,188,0.7)'
                },
                {
                  offset: 1,
                  color: 'rgba(161,152,37,0.7)'
                }
              ],
              globalCoord: false // 缺省为 false
            }
          }
        },
        lineStyle: {
          color: 'rgb(9,9,9)'
        }
      },
      {
        name: '水位线',
        type: 'line',
        symbol: 'none',
        data: rzArr,
        silent: false,
        markPoint: {
          data: [{ name: `水位：${rz.value}m`, x: '15.67%', y: '70%' }],
          symbol: 'circle',
          symbolSize: scalePx(12),
          label: {
            show: true,
            // color: '#0095FF',
            color: 'rgba(82,166,251,0.9)',
            fontSize: echartsFontSize(12),
            symbolSize: scalePx(12),
            position: 'top',
            rich: {
              font: {
                fontFamily: 'DINOT',
                fontSize: echartsFontSize(14)
              }
            },
            // formatter: '{b}',
            formatter: (params: any) => {
              return `{font|${params.name}}`
            },
            fontWeight: 'bold'
          },
          itemStyle: {
            color: 'transparent'
          },
          emphasis: {
            disabled: false // 关闭高亮状态
          },
          blur: {
            label: {
              show: false
            }
          },
          silent: false, // 响应和触发鼠标事件
          animation: false // 关闭动画
        },
        areaStyle: {
          normal: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: '#0095FF'
                },
                {
                  offset: 1,
                  color: '#0095FF'
                }
              ],
              globalCoord: false // 缺省为 false
            }
          }
        },
        lineStyle: {
          color: '#0095FF'
        }
      },
      {
        name: '校核洪水位',
        type: 'line',
        symbol: 'none',
        data: ckflzArr,
        silent: false,
        lineStyle: {
          color: 'red',
          type: 'dashed'
        },
        markPoint: {
          data: [{ name: `校核洪水位：${ckflz}m`, x: '22.67%', y: '56%' }],
          symbol: 'circle',
          symbolSize: scalePx(12),
          label: {
            show: true,
            color: 'red',
            fontSize: echartsFontSize(14),
            rich: {
              font: {
                fontFamily: 'DINOT',
                fontSize: echartsFontSize(14)
              }
            },
            symbolSize: scalePx(12),
            position: 'top',
            formatter: (params: any) => {
              return `{font|${params.name}}`
            }
          },
          itemStyle: {
            color: 'transparent'
          },
          emphasis: {
            disabled: false // 关闭高亮状态
          },
          blur: {
            label: {
              show: false
            }
          },
          silent: false, // 响应和触发鼠标事件
          animation: false // 关闭动画
        }
      },
      {
        type: 'custom',
        silent: false,
        renderItem: function (params, api) {
          var start = api.coord([api.value(0), api.value(1)])
          var end = api.coord([api.value(2), api.value(3)])
          var height = api.size([0, 1])[1] * (api.value(3) - api.value(1))
          var rectShape = echarts.graphic.clipRectByRect(
            {
              x: start[0],
              y: end[1],
              width: end[0] - start[0],
              height: height
            },
            {
              x: params.coordSys.x,
              y: params.coordSys.y,
              width: params.coordSys.width,
              height: params.coordSys.height
            }
          )
          return {
            type: 'group',
            children: [
              {
                type: 'rect',
                shape: rectShape,
                style: api.style({ fill: 'transparent', stroke: 'black' })
              },
              {
                type: 'text',
                style: {
                  text: `UPD${params.dataIndex + 1}`,
                  x: start[0] - 12,
                  y: end[1] - 13,
                  fill: '#fff',
                  fontSize: echartsFontSize(12),
                  fontFamilly: 'DINOT'
                }
              }
            ]
          }
        },
        encode: {
          x: [1, 3], // 表示维度 3、1 映射到 x 轴。
          y: [2, 4] // 表示维度 2、4 映射到 y 轴。
        },
        data: cyglkData
      },
      {
        name: '渗压',
        type: 'custom',
        renderItem: function (params, api) {
          var start = api.coord([api.value(0), api.value(1)])
          var end = api.coord([api.value(2), api.value(3)])
          var height = api.size([0, 1])[1] * (api.value(3) - api.value(1))

          var rectShape = echarts.graphic.clipRectByRect(
            {
              x: start[0],
              y: end[1],
              width: end[0] - start[0],
              height: height
            },
            {
              x: params.coordSys.x,
              y: params.coordSys.y,
              width: params.coordSys.width,
              height: params.coordSys.height
            }
          )

          return {
            type: 'group',
            children: [
              {
                type: 'rect',
                shape: rectShape,
                style: api.style({
                  fill: 'rgb(37,183,239)',
                  stroke: 'transparent',
                  fonsSize: echartsFontSize(12)
                })
              },
              {
                type: 'text',
                style: {
                  x: start[0] - 30,
                  y: end[1] - 10,
                  fonsSize: echartsFontSize(12)
                }
              }
            ]
          }
        },
        encode: {
          x: [1, 3], // 表示维度 3、1 映射到 x 轴。
          y: [2, 4] // 表示维度 2、4 映射到 y 轴。
        },
        data: cyData
      },
      {
        name: '浸润线',
        type: 'line',
        smooth: true,
        data: lineArr,
        silent: false,
        symbolSize: scalePx(0),
        z: 10,
        lineStyle: {
          color: '#097FFE'
        },
        label: {
          show: true,
          fonsSize: echartsFontSize(12),
          distance: 12,
          position: 'right',
          offset: [5, 0],
          rich: {
            f: {
              fontSize: echartsFontSize(10),
              padding: [0, 0, 0, 15],
              color: '#fff',
              fontFamily: 'DINOT'
            },
            f1: {
              fontSize: echartsFontSize(10),
              padding: [0, 0, 0, 0],
              color: '#fff',
              fontFamily: 'DINOT'
            },
            f2: {
              fontSize: echartsFontSize(10),
              padding: [0, 0, 0, -10],
              color: '#fff',
              fontFamily: 'DINOT'
            }
          },
          formatter: function (params) {
            if (params.dataIndex == 0 || params.dataIndex == 4) return ''
            if (params.dataIndex == 1) return `{f1|${params.data[1] + 'm'}}`
            if (params.dataIndex == 2) return `{f2|${params.data[1] + 'm'}}`
            return `{f|${params.data[1] + 'm'}}`
          }
        },
        emphasis: {
          disabled: true
        }
      }
    ]
  }
}
const initChart = () => {}
const openModal = (e: any) => {
  const optionData = _.cloneDeep(echartOptions.value)
  optionData.series.forEach((item: any) => {
    if (item.name === '浸润线') {
      Object.keys(item.label.rich).forEach((key: any) => {
        item.label.rich[key].padding = [0, 0, 0, 0]
        item.label.rich[key].fontSize = echartsFontSize(14)
        if (key == 'f1') {
          item.label.rich[key].padding = [0, 0, 0, 70]
        }
      })
    }
  })
  emitter.emit('openModal', {
    type: 'openModal',
    data: optionData,
    title: '渗压图'
  })
}
const echartsRef = ref(null)
const echartsMain = shallowRef()
nextTick(() => {
  if (echartsMain.value) {
    echartsMain.value.clear()
  }
  echartsMain.value = echarts.init(echartsRef.value)
  setScaledOption(echartsMain.value, echartOptions.value)
})
</script>

<template>
  <div id="echartsId" ref="echartsRef" :style="{ minHeight: '100%', width: '100%', height: '100%' }"></div>
</template>

<style scoped lang="scss"></style>
