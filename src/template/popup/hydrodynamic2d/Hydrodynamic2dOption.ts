import { scalePx } from '@/utils/viewportScale'
export default class Hydrodynamic2dOption {
  private static defaultToolTip = {
    trigger: 'axis',
    backgroundColor: 'rgba(207, 243, 255, 0.9)',
    formatter: function (params: any) {
      let strTip = ''
      console.log("params", params);
      //如果隐藏series会导致出错      
      const name = params[0].name;
      strTip = strTip + name + '</br>'
      if (params?.length == 3) {
        const depth = Number(params[0].value) - Number(params[1].value)
        strTip = strTip + `水深：${depth.toFixed(2)}米</br>`
        strTip = strTip + `流速：${params[2].value}m³/s</br>`
        strTip = strTip + `水面高程：${params[0].value}米</br>`
      } else {
        params.forEach((item: any, index: any) => {
          strTip = strTip + `${item.seriesName}：${item.data}</br>`
        })
      }
      return strTip;
    }
  }

  private static getDepthColor(alpha = 1) {
    return `rgba(95, 121, 250, ${alpha})`;
  }
  private static getElevColor(alpha = 1) {
    return `rgba(64, 158, 255, ${alpha})`;
  }
  private static getLevelColor(alpha = 1) {
    return `rgba(230, 162, 60, ${alpha})`;
  }
  private static getSpeedColor(alpha = 1) {
    return `rgba(55, 255, 255, ${alpha})`;
  }

  private static getLinearStyle(color1: string, color2: string) {
    return {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          {
            offset: 0,
            color: color1
          },
          {
            offset: 1,
            color: color2
          }
        ]
      },
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      shadowBlur: scalePx(10)
    };
  }

  private static getYAxix(name: string) {
    return {
      type: 'value',
      name: name,
      nameTextStyle: {
        padding: [0, 0, 0, 10],
        color: 'rgba(255, 255, 255, 0.8)'
      },
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.8)',
        formatter: '{value}'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.2)'
        }
      },
      splitLine: {
        show: false,
        lineStyle: {
          type: 'dashed',
          color: 'rgba(255, 255, 255, 0.2)'
        }
      }, //设置网格
      axisTick: {
        show: false
      },
      min: function (value: any) {
        return Math.floor(value.min)
      },
      max: function (value: any) {
        return Math.floor(value.max) + 1
      },
    };
  }

  // 获取二维水动力水深过程线echart配置信息
  public static getOption(data: any[]) {
    const xData: string[] = [];
    const elevData: string[] = [];
    const depthData: string[] = [];
    const waterLevelData: string[] = [];
    const speedData: string[] = [];

    data.forEach((item) => {
      xData.push(item.tm_name);

      const depth = Number(item.avg_depth);
      const elev = Number(item.avg_elev);
      const waterLevel = depth + elev;

      const speed = Number(item.avg_totalv);

      depthData.push(depth.toFixed(2));
      elevData.push(elev.toFixed(2))
      waterLevelData.push(waterLevel.toFixed(2));
      speedData.push(speed.toFixed(2));
    });

    const option = {
      color: [this.getDepthColor(), this.getLevelColor(1), this.getSpeedColor(1)],
      tooltip: this.defaultToolTip,
      legend: {
        itemWidth: scalePx(14),
        itemHeight: scalePx(8),
        left: 'center',
        top: 30,
        data: ['水底高程', '水面高程', '流速'],
        textStyle: {
          color: '#fff'
        }
      },
      grid: {
        left: 20,
        right: 20,
        bottom: 0,
        top: 80,
        containLabel: true
      },
      xAxis: [
        {
          type: 'category',
          data: xData,
          axisLabel: {
            color: 'rgba(255, 255, 255, 0.8)',
            formatter: function (value: string) {
              const arr = value.split(' ');
              return `${arr[1]}\n${arr[0]}`;
            }
          },
          axisLine: {
            show: true,
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.2)'
            }
          },
          axisTick: {
            show: false
          }
        }
      ],
      yAxis: [this.getYAxix('高度(m)'), this.getYAxix('流速(m³/s)')],
      series: [
        {
          name: '水面高程',
          type: 'line',
          smooth: true,
          showSymbol: false,
          yAxisIndex: 0,
          lineStyle: {
            color: this.getDepthColor()
          },
          itemStyle: {
            label: {
              color: this.getDepthColor(),
              //顶部显示数字
              formatter: '{c}',
              show: false,
              position: 'right',
              textStyle: {
                color: this.getDepthColor(),
                fontSize: scalePx(12)
              }
            }
          },
          areaStyle: this.getLinearStyle(this.getDepthColor(0.4), this.getDepthColor(0)),
          data: waterLevelData
        },
        {
          name: '水底高程',
          type: 'line',
          smooth: true,
          showSymbol: false,
          yAxisIndex: 0,
          lineStyle: {
            color: this.getLevelColor()
          },
          itemStyle: {
            label: {
              color: this.getLevelColor(),
              //顶部显示数字
              formatter: '{c}',
              show: false,
              position: 'right',
              textStyle: {
                color: this.getLevelColor(),
                fontSize: scalePx(12)
              }
            }
          },
          areaStyle: this.getLinearStyle(this.getLevelColor(0.4), this.getLevelColor(0)),
          data: elevData
        },
        {
          name: '流速',
          type: 'line',
          smooth: true,
          showSymbol: false,
          yAxisIndex: 1,
          lineStyle: {
            color: this.getSpeedColor()
          },
          itemStyle: {
            label: {
              color: this.getSpeedColor(),
              //顶部显示数字
              formatter: '{c}',
              show: false,
              position: 'right',
              textStyle: {
                color: this.getSpeedColor(),
                fontSize: scalePx(12)
              }
            }
          },
          areaStyle: this.getLinearStyle(this.getSpeedColor(0.4), this.getSpeedColor(0)),
          data: speedData
        }
      ]
    };

    return option;
  }
}