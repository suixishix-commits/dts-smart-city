import { defineStore } from 'pinia'

export const weatherStore = defineStore('weatherStore', {
  state: () => ({
    weatherVisibility: false, //天气控制面板
    // 太阳光照强度
    sunIntensity: { text: '', default: 15, val: 15, step: 1, max: 40 },
    // 月亮光照强度
    moonIntensity: { text: '', default: 0.1, val: 0.1, step: 0.1, max: 1 },
    // 环境光强度 
    ambientLightIntensity: { text: '', default: 5, val: 5, step: 0.5, max: 5 },
    // 色温
    temperature: { text: '', default: 5500, val: 5500, min: 1700, step: 1, max: 12000 },
    // 阴影强度
    shadowIntensity: { text: '', default: 0.75, val: 0.75, step: 0.1, max: 1 },
    // 阴影质量
    shadowQuality: { text: '', default: 5, val: 5, step: 0.5, max: 5 },
    // 阴影可视距离（m）
    shadowDistance: { text: '', default: 5000, val: 5000, step: 100, max: 30000 },
    darkMode: { default: 0, val: 0, step: 0.1, max: 100 },
    cloudsColor: { default: [1, 1, 1, 1], val: [1, 1, 1, 1], step: 0.1, max: 100 },
    cloudsAltitude: { default: 8, val: 8, step: 0.1, max: 100 },
    cloudShadowStrength: { default: 0, val: 0, step: 0.1, max: 100 },
    lowCloudCoverage: { default: 0, val: 0, step: 0.1, max: 100 },
    // 云密度
    lowCloudDensity: { text: '', default: 0.1, val: 0.1, step: 0.1, min: 0.1, max: 1 },
    lowCloudHeight: { text: '', default: 0.25, val: 0.25, step: 0.1, max: 100 },
    lowCloudWindSpeed: { text: '', default: 63, val: 63, step: 0.1, max: 100 },
    lowCloudWindDirection: { text: '', default: 33, val: 33, step: 0.1, max: 100 },
    highCloudLayerCoverage: { default: 0.5, val: 0.5, step: 0.1, max: 100 },
    highCloudWindSpeed: { default: 10, val: 10, step: 0.1, max: 100 },
    highCloudWindDirection: { default: 0, val: 0, step: 0.1, max: 100 },
    cirrusCloudDensity: { default: 1, val: 1, step: 0.1, max: 100 },
    cirrostratusCloudDensity: { default: 0, val: 0, step: 0.1, max: 100 },
    cirrocumulusCloudDensity: { default: 0, val: 0, step: 0.1, max: 100 },
    // 雾浓度
    fogDensity: { text: '', default: 0, val: 0, step: 0.1, max: 2 },
    // 雾颜色
    fogColor: { text: '', default: [0, 0, 0, 0.2], val: [0, 0, 0, 0.2] },
    // 高度衰减
    fogHeightFalloff: { text: '', default: 0.2, val: 0.2, step: 0.1, max: 2 },
    // 起雾距离
    fogStartDistance: { text: '', default: 10000, val: 10000, step: 5, min: 1, max: 10000 },
    // 雾透明度
    fogOpacity: { text: '', default: 0.2, val: 0.2, step: 0.1, max: 1 },
    rainSnow: { default: 0, val: 0, step: 0.1, max: 100 },
    rainSnowStrength: { default: 0, val: 0, step: 0.1, max: 100 },
    rainSnowCamMotionAlignmentScale: { default: 0, val: 0, step: 0.1, max: 100 },
    rainSnowColor: { default: [0, 0, 0, 0], val: [0, 0, 0, 0], step: 0.1, max: 100 },
    rainSnowOvercastStrength: { default: 0, val: 0, step: 0.1, max: 100 },
    sunSize: { default: 0.6, val: 0.6, step: 0.1, max: 100 },
    moonSize: { default: 2, val: 2, step: 0.1, max: 100 },
    dateTime: {
      hour: { default: 9, val: 9, step: 0.1, max: 100 }, // 时
      minute: { default: 0, val: 0, step: 0.1, max: 100 }, // 分
      year: { default: 2021, val: 2021, step: 0.1, max: 100 }, // 年
      month: { default: 10, val: 10, step: 0.1, max: 100 }, // 月
      day: { default: 28, val: 28, step: 0.1, max: 100 }, // 日
      latitude: { default: 20, val: 20, step: 0.1, max: 100 }, // 经度
      longitude: { default: 116, val: 116, step: 0.1, max: 100 }, // 维度
      timeZone: { default: 8, val: 8, step: 0.1, max: 100 }, // 时区
      daynightLoop: { default: 0, val: 0, step: 0.1, max: 100 }, // 是否日夜循环，0关闭 1开启
      dayLength: { default: 3, val: 3, step: 0.1, max: 100 } //模拟时长，即几分钟模拟循环一天，仅在开启日夜循环后生效
    },
    // 云厚度  5+版本参数
    cloudThickness: { text: '', default: 0, val: 0, step: 0.1, max: 1 },
    // 雪效强度
    snowStrength: { text: '', default: 0, val: 0, step: 0.1, max: 1 },
    // 雪速
    snowSpeed: { text: '', default: 0, val: 0, step: 0.1, max: 1 },
    // 雪花大小
    snowflakeSize: { text: '', default: 0, val: 0, step: 0.1, max: 1 },
    // 雨颜色
    snowColor: { text: '', default: [1, 1, 1, 1], val: [1, 1, 1, 1] },
    // 雪相机移动对齐
    snowAlignCamera: { text: '', default: 0, val: 0, step: 0.1, max: 1 },
    // 雪阴天程度
    snowOvercastStrength: { text: '', default: 0, val: 0, step: 0.1, max: 1 },
    // 雨效强度
    rainStrength: { text: '', default: 0, val: 0, step: 0.1, max: 1 },
    // 雨速
    rainSpeed: { text: '', default: 0, val: 0, step: 0.1, max: 1 },
    // 雨滴大小
    raindropSize: { text: '', default: 0, val: 0, step: 0.1, max: 1 },
    // 雨颜色
    rainColor: { text: '', default: [0.5, 0.5, 0.5, 0.1], val: [0.5, 0.5, 0.5, 0.1] },
    // 雨相机移动对齐
    rainAlignCamera: { text: '', default: 0, val: 0, step: 0.1, max: 1 },
    // 雨阴天程度
    rainOvercastStrength: { text: '', default: 0, val: 0, step: 0.1, max: 1 },
    // 当前时间
    time: { text: '', default: '10:00', val: '10:00', step: '01:00', start: '01:00', end: '23:00' },
    // 模拟时长，即几分钟模拟循环一天，仅在开启日夜循环后生效
    simulateTime: { text: '', default: 0, val: 0, step: 1, max: 60 }
  }),
  persist: {
    storage: sessionStorage
  },
  getters: {},
  actions: {
    // 设置云效
    setCloud(para: any, val: any, isRest: boolean = false) {
      console.log("设置云参数：", para, isRest, val)
      val = isRest ? this.resetValByParameter(para) : val
      if (__xapi?.isReady) {
        if (para === 'lowCloudDensity') {
          __xapi.weather.setCloudDensity(val)
        } else if (para === 'cloudThickness') {
          __xapi.weather.setCloudThickness(val)
        }
        //console.log("新参数：", val);
      }
    },
    // 设置雾效
    setFog(para: any, val: any, isRest: boolean = false) {
      console.log("设置参数：", para, val, isRest)
      val = isRest ? this.resetValByParameter(para) : val
      if (__xapi?.isReady) {
        __xapi.weather.setFogParam(this.fogDensity.val, this.fogColor.val, this.fogHeightFalloff.val, this.fogStartDistance.val, this.fogOpacity.val)
        console.log("新参数：", this.fogDensity.val, this.fogColor.val, this.fogHeightFalloff.val, this.fogStartDistance.val, this.fogOpacity.val)
      }
    },
    // 设置雨效
    setRain(para: any, val: any, isRest: boolean = false) {
      console.log("设置参数：", para, val, isRest)
      val = isRest ? this.resetValByParameter(para) : val
      if (__xapi?.isReady) {
        __xapi.weather.setRainParam(this.rainStrength.val, this.rainSpeed.val, this.raindropSize.val, this.rainColor.val, this.rainAlignCamera.val, this.rainOvercastStrength.val)
        console.log("新参数：", this.rainStrength.val, this.rainSpeed.val, this.raindropSize.val, this.rainColor.val, this.rainAlignCamera.val, this.rainOvercastStrength.val)
      }
    },
    // 设置雪效
    setSnow(para: any, val: any, isRest: boolean = false) {
      console.log("设置参数：", para, val, isRest)
      val = isRest ? this.resetValByParameter(para) : val
      if (__xapi?.isReady) {
        __xapi.weather.setSnowParam(this.snowStrength.val, this.snowSpeed.val, this.snowflakeSize.val, this.snowColor.val, this.snowAlignCamera.val, this.snowOvercastStrength.val)
        console.log("新参数：", this.snowStrength.val, this.snowSpeed.val, this.snowflakeSize.val, this.snowColor.val, this.snowAlignCamera.val, this.snowOvercastStrength.val)
      }
    },
    // 设置时间
    setDateTime(para: any, val: any, isRest: boolean = false) {
      console.log("设置参数：", para, val, isRest)
      val = isRest ? this.resetValByParameter(para) : val
      if (__xapi?.isReady) {
        __xapi.weather.setDateTime(2026, 9, 10, Number(this.time.val.slice(0, 2)), 0, false)
      }
    },
    // 设置模拟时间
    setSimulateTime(para: any, val: any, isRest: boolean = false) {
      console.log("设置参数：", para, val, isRest)
      val = isRest ? this.resetValByParameter(para) : val
      if (__xapi?.isReady) {
        __xapi.weather.simulateTime(15, 10, Number(this.simulateTime.val))
        if (Number(val) <= 0) {
          __xapi.weather.setDateTime(2026, 9, 10, Number(this.time.default.slice(0, 2)), 0, false)
        }
      }
    },
    // 设置环境
    setEnvironment(para: any, val: any, isRest: boolean = false) {
      console.log("设置参数：", para, val, isRest)
      val = isRest ? this.resetValByParameter(para) : val
      if (__xapi?.isReady) {
        switch (para) {
          case "sunIntensity":
            __xapi.weather.setSunIntensity(val).then(() => {
              console.log('太阳照射强度设置成功', val)
            })
            break;
          case "moonIntensity":
            __xapi.weather.setMoonIntensity(val).then(() => {
              console.log('月亮光照强度设置成功', val)
            })
            break;
          case "ambientLightIntensity":
            __xapi.weather.setAmbientLightIntensity(val).then(() => {
              console.log('环境光设置成功', val)
            })
            break;
          case "temperature":
            __xapi.weather.setTemperature(val).then(() => {
              console.log('色温设置成功', val)
            })
            break;
          case "shadowIntensity":
            __xapi.weather.setShadowIntensity(val).then(() => {
              console.log('阴影强度设置成功', val)
            })
            break;
          case "shadowQuality":
            __xapi.weather.setShadowQuality(val).then(() => {
              console.log('阴影质量设置成功', val)
            })
            break;
          case "shadowDistance":
            __xapi.weather.setShadowDistance(val).then(() => {
              console.log('阴影可视距离设置成功', val)
            })
            break;
          default:
            break;
        }
        //console.log("新参数：", para, val)
      }
    },
    // 重置
    reset() {
    },
    // 从DTS中初始化默认参数
    initData() {
    },
    // 重置参数默认值,并返回默认值
    resetValByParameter(para: any) {
      let result = undefined
      if (Object.prototype.hasOwnProperty.call(this, para)) {
        let item = undefined
        let that: any = this
        item = that[para]
        item.val = item.default
        result = item.val
      }
      return result
    }
  }
})

export default weatherStore
