module.exports = {
  plugins: {
    'postcss-preset-env': {
      autoprefixer: true
    },
    // 将第三方组件的px转换为rem
    'postcss-pxtorem': {
      rootValue: 10, // 基准字体大小
      unitPrecision: 5, // 转换后的rem保留小数点位数
      propList: ['*'], // 要转换的属性，默认转换所有属性
      selectorBlackList: ['html'], // 配置需要忽略的选择器
      minPixelValue: 2 // 小于 2px 不转（1px 细线保持清晰）
    }
  }
}
