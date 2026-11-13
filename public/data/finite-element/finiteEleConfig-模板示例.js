let config = {
  //建筑物列表
  二江泄水闸: {
    bsm: 'bsm00036',
    name: '二江泄水闸',
    // 模型坐标及旋转
    coordinate: [-6443.255, -15087.2, 4.998],
    rotation: [0, 0, 0],
    // 三维模型配,有些项目会有二维有限元
    threeDimensionalModel: {},
    // 物理量：温度、变形、应力、压力
    physicalQuantity: [
      {
        name: '变形场',
        name_en: 'displacements',
        //分量
        indicator: [
          {
            name: '横河向变形',
            title: '横河向变形',
            unit: 'mm',
            // __g.finiteElement.option.type类型
            type: 'D2',
            selected: true,
            // 有限元值范围，如果为空，默认最大\最小值
            valueRange: []
          }
        ]
      }
    ],
    // 结构材料中文映射，会从模型中读取值，但无中文信息，所以需要手动映射
    materialMapper: [
      {
        name: '坝体',
        checked: true,
        value: 1
      },
      {
        name: '坝基',
        checked: true,
        value: 0
      }
    ],
    // 显示图层
    showLayerId: [],
    // 隐藏图层
    hideLayerId: []
  },
  // 分量与finiteElement.option.type的映射
  typeMapper: { s22: 4, s33: 5, s12: 6, s13: 7, s23: 8, d1: 9, d2: 10, d3: 11, u1: 0, u2: 1 }
}
