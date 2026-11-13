<template>
  <div class="colorPanelStyle">
    <div class="color-picker">
      <el-color-picker-panel v-model="color1" show-alpha />
    </div>
    <div class="colorPanelValue">
      <div class="publicStyle rgbColor">
        <div class="textStyle">RGB颜色:</div>
        <el-input type="text" v-model="colorArr.rgb" class="inputStyle" />
      </div>
      <div class="publicStyle hexColor">
        <div class="textStyle">16进制颜色:</div>
        <el-input type="text" v-model="colorArr.hex" class="inputStyle" />
      </div>
      <div class="publicStyle colorArr">
        <div class="textStyle">数组颜色 支持透明度设置:</div>
        <el-input type="text" v-model="colorArr.alpha" class="inputStyle" />
      </div>
    </div>
    <div class="DTSDrawn">
      <el-button type="primary" @click="drawnPolygon">画面</el-button>
      <el-button type="primary" @click="drawnLine">划线</el-button>
      <el-button type="primary" @click="drawnCO">co对象</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import emitter from '@/utils/emitter'
import { onMounted, ref } from 'vue'
import ColorPanelControl from '../../../views/dts/ColorPanelControl'

// 颜色选择器
const color1 = ref('')
// 当前操作对象
const currTarget = ref('polygon')

// 监听count的变化
watch(
  color1, // 要监听的ref对象
  (newVal, oldVal) => {
    // 变化后的回调：新值、旧值
    if (newVal && newVal.indexOf('rgb') !== -1) {
      let rgbaArr: any
      if (newVal?.indexOf('rgba') !== -1) {
        // rgba格式
        rgbaArr = newVal.split('rgba(')[1].split(')')[0].split(',')
      } else {
        rgbaArr = newVal.split('rgb(')[1].split(')')[0].split(',')
        rgbaArr.push('1')
      }
      console.log(`color1从${oldVal}变为${newVal}`, rgbaArr)
      colorArr.rgb = rgbToHex(Number(rgbaArr[0]), Number(rgbaArr[1]), Number(rgbaArr[2]))
      colorArr.hex = `${Number(rgbaArr[0])},${Number(rgbaArr[1])},${Number(rgbaArr[2])}`
      let rgba = [Number((rgbaArr[0] / 255).toFixed(6)), Number((rgbaArr[1] / 255).toFixed(6)), Number((rgbaArr[2] / 255).toFixed(6)), Number(rgbaArr[3])]
      colorArr.alpha = `[${rgba.toString()}]`

      switch (currTarget.value) {
        case 'polygon':
          ColorPanelControl.showPolygon(rgba)
          break
        case 'polyline':
          ColorPanelControl.showPolyline(rgba)
          break
        case 'co':
          ColorPanelControl.showCoObject(rgba)
          break
        default:
          break
      }
    }
    // handleColorChange()
  },
  {
    immediate: true, // 可选：是否立即执行一次（初始值也触发）
    deep: false // 简单类型无需深度监听，默认false
  }
)

// 颜色值
// const rgbColorValue = ref('#1f1f1f')
const colorArr = reactive({
  rgb: '',
  hex: '',
  alpha: ''
})

// RGB 到 十六进制
function rgbToHex(r: any, g: any, b: any) {
  // 确保 r, g, b 都在有效范围内
  r = Math.min(Math.max(0, r), 255)
  g = Math.min(Math.max(0, g), 255)
  b = Math.min(Math.max(0, b), 255)

  // 将每个颜色分量转换为16进制，并确保总是两位数
  let componentToHex = (x: any) => {
    let hex = x.toString(16)
    return hex.padStart(2, '0') // 如果是单个字符，则前面补0
  }

  let redHex = componentToHex(r)
  let greenHex = componentToHex(g)
  let blueHex = componentToHex(b)

  return `#${redHex}${greenHex}${blueHex}`.toUpperCase()
}

// 绘制面
const drawnPolygon = () => {
  currTarget.value = 'polygon'
}

// 绘制线
const drawnLine = () => {
  currTarget.value = 'polyline'
}

// 绘制co对象
const drawnCO = () => {
  currTarget.value = 'co'
}

const getLayerInfo = (e: any) => {
  if (e.data.Type === 'Polygon') {
    // 面
    __xapi.polygon.get(['polygon1']).then((res: any) => {
      console.log(res.data[0].color, '面')
    })
  } else if (e.data.Type === 'Polyline') {
    // 线
    __xapi.polyline.get(['p2']).then((res: any) => {
      console.log(res.data[0].color, '线')
    })
  }
}

// 点击图层触发
emitter.on('SceneLeftMouseClick', (e) => {
  // 获取图层信息
  getLayerInfo(e)
})

onMounted(() => {
  // 初始化颜色参数
  color1.value = gVar.colorPanel.rgb
  colorArr.rgb = color1.value
  colorArr.hex = gVar.colorPanel.hex
  colorArr.alpha = gVar.colorPanel.alpha
})
</script>

<style lang="scss" scoped>
// 公共字体颜色
$public-color: #020f18;

.colorPanelStyle {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  .color-picker {
    width: 32rem;
    height: 26rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .colorPanelValue {
    width: 100%;
    height: 40%;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    color: #fff;
    box-sizing: border-box;
    padding: 0 20px;

    .publicStyle {
      display: flex;
      align-items: center;
      gap: 30px;

      .textStyle {
        width: 175px;
        text-align: right;
      }
    }

    .inputStyle {
      width: 300px;
      --el-input-text-color: #1f1f1f;
      --el-text-color-regular: #1f1f1f;

      .el-input__wrapper {
        // height:2.6rem;
        background: linear-gradient(180deg, rgba(47, 148, 218, 0.8) 0%, rgba(47, 148, 218, 0) 100%);
        box-shadow: 0 0 0 0rem var(--el-input-border-color, var(--el-border-color)) inset;
        box-sizing: border-box;
        border: 0.1rem solid;
        border-image: linear-gradient(360deg, #72c6f2 -5%, #72c6f2 -5%, rgba(114, 198, 242, 0) 101%) 1;

        &:hover {
          box-shadow: none;
        }

        &:focus-within {
          box-shadow: none;
        }

        .el-input__inner {
          color: #97d5ff;
        }
      }
    }
  }

  .DTSDrawn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-around;

    // 按钮样式
    .el-button {
      --el-font-size-base: 1.4rem;
      border-radius: 0.4rem;
      border: 0.1rem solid;
      background: linear-gradient(180deg, #0e5ce3 0%, rgba(14, 110, 255, 0.5) 100%);
      border-image: linear-gradient(180deg, rgba(104, 212, 237, 0) 0%, #68d4ed 100%) !important;
    }
  }
}
</style>
