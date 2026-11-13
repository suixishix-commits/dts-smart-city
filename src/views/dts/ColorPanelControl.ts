
export default class ColorPolyline {
  /**
   * 画面
   */

  static async showPolygon(colorSurfaceValue: any) {
    console.log('画面颜色值:', colorSurfaceValue)
    __xapi.polygon.clear() //先清除上次的

    let p1 = {
      id: 'polygon1',
      coordinates: gVar.colorPanel.polygon,
      coordinateType: 0, //坐标系类型，取值范围：0为Projection类型，1为WGS84类型，2为火星坐标系(GCJ02)，3为百度坐标系(BD09)，默认值：0
      range: [1, 10000], //可视范围：[近裁距离, 远裁距离]，取值范围: [任意负值, 任意正值]
      color: colorSurfaceValue, //多边形的填充颜色
      frameColor: colorSurfaceValue, //边框颜色
      frameThickness: 5, //边框厚度
      intensity: 1, //亮度
      // style: PolygonStyle.SingleColor,//单色 请参照API开发文档选取枚举
      depthTest: false, //是否做深度检测 开启后会被地形高度遮挡
      priority: 1 //显示优先级 值越大显示越靠上
    }
    console.log("画面对象", p1)
    await __xapi.polygon.add([p1])
    await __xapi.polygon.focus('polygon1', 200)
  }

  /**
   * 画线
   */
  static async showPolyline(colorLineValue: any) {
    console.log(colorLineValue)
    __xapi.polyline.clear() //先清除上次的

    let p2 = {
      id: 'p2', //折线唯一标识id
      coordinates: gVar.colorPanel.polyline, //构成折线的坐标点数组
      coordinateType: 0, //坐标系类型，取值范围：0为Projection类型，1为WGS84类型，2为火星坐标系(GCJ02)，3为百度坐标系(BD09)，默认值：0
      range: [1, 10000], //可视范围：[近裁距离, 远裁距离]，取值范围: [任意负值, 任意正值]
      color: colorLineValue, //折线颜色绿色 半透明
      thickness: 120, //折线宽度
      intensity: 1, //亮度
      flowRate: 0.5, //流速
      shape: 0, //折线类型 0：直线， 1：曲线  注意：设置为曲线非常影响添加效率
      depthTest: false, //是否做深度检测 开启后会被地形高度遮挡
      // style: PolylineStyle.Normal, //折线样式 参考样式枚举：PolylineStyle
      tiling: 0 //材质贴图平铺比例
      // material: '/JC_CustomAssets/PolylineLibrary/Exhibition/混合线_4', //自定义材质路径 设置后style相关参数会失效
      // scalarParameters: [{ name: '亮度1', value: 0.5 }], //材质数值类型参数
      // vectorParameters: [{ name: '颜色1', value: [0, 1, 0] }] //材质数组类型参数
    }
    console.log("画线对象", p2)

    await __xapi.polyline.add([p2])
    __xapi.polyline.focus(p2.id, 380, 2)
  }

  /**
   * co对象
   */

  // static async showCoObject(colorCoValue: any) {
  //   //添加前清空所有customObject 防止id重复
  //   __xapi.customObject.clear()
  //   //投影坐标
  //   let co_location = [493132.125, 2492028.25, 2.1155664920806885]

  //   // 准备材质替换参数
  //   //根据材质路径查询材质包含的参数
  //   let res = await __xapi.misc.getMaterial('/JC_CustomAssets/MaterialLibrary/Exhibition/玻璃/玻璃_5')

  //   //颜色参数名称
  //   let colorParamName = res.data[0].params[0].name
  //   //颜色参数默认值
  //   let colorParamValue = res.data[0].params[0].defaultValue

  //   //不透明度参数名称
  //   let opacityParamName = res.data[0].params[4].name
  //   //不透明度默认值
  //   let opacityParamValue = res.data[0].params[4].defaultValue

  //   //自定义对象
  //   let o = {
  //     id: 'o1', //自定义对象唯一id
  //     pakFilePath: '@path:DTS_Library.pak', //资源库pak文件路径,推荐使用cloud内置的文件资源管理器加载pak并使用@path方式传入参数
  //     assetPath: '/Game/Common/Asset_Bank/Mesh/Car/BP_Car_JiuHuChe', //资源目录，自定义对象在pak文件资源包里的相对路径
  //     location: co_location, //位置坐标
  //     coordinateType: 0, // 坐标系类型
  //     rotation: [0, 0, 0], // 世界坐标系旋转
  //     range: [0, 1000], //可见范围
  //     groupId: 'coGroup', //分组id
  //     localRotation: [0, 0, 0], //模型自身旋转
  //     scale: [1, 1, 1], //模型缩放
  //     isEffectRotation: true, //是否开启旋转效果
  //     smoothMotion: 1, //1: 平滑移动，0: 跳跃移动
  //     supportAttach: false, //不支持贴画贴合
  //     visible: true //模型加载后默认是否显示
  //   }
  //   await __xapi.customObject.add(o)
  //   //使用资源库的玻璃材质替换自定义对象的材质，控制颜色和不透明度
  //   await __xapi.customObject.overrideMaterial([
  //     {
  //       id: 'o1',
  //       material: '/JC_CustomAssets/MaterialLibrary/Exhibition/玻璃/玻璃_5',
  //       scalarParameters: [{ name: opacityParamName, value: opacityParamValue }], //数值类型参数
  //       vectorParameters: [{ name: colorParamName, value: colorParamValue }] //数组类型参数
  //     }
  //   ])
  //   await __xapi.customObject.setTintColor(o.id, colorCoValue)
  //   __xapi.customObject.focus(o.id)
  // }

  static async showCoObject(colorCoValue: any) {
    //添加前清空所有customObject 防止id重复
    await __xapi.customObject.clear()
    //小别墅3dt的图层id
    let tileLayerId = gVar.colorPanel.tileLayerId
    //查询图层内部包含的构件objectIds
    let result = await __xapi.tileLayer.getObjectIDs(tileLayerId)
    console.log(result)
    let objectIds = result.data[0].objectIds
    //执行合并复制
    await __xapi.customObject.addByTileLayer({
      id: 'mergeActors',
      location: [492498.71875, 2492250.75, 3],
      tileLayerId: tileLayerId,
      //注意5.3新增特性：数组参数 也支持复制单个构件
      objectId: objectIds,
      coordinateType: 0, // 坐标系类型
      rotation: [0, 90, 0], //模型旋转
      scale: [1, 1, 1], //模型缩放
      smoothMotion: 0 //1: 平滑移动，0: 跳跃移动
    })
    console.log("改变Acotor颜色", colorCoValue);

    __xapi.customObject.setTintColor('mergeActors', colorCoValue); // 设置颜色
    __xapi.customObject.focus('mergeActors', 10)
  }
}

// 具名导出：unplugin-auto-import 21 按类名自动导入（import { ColorPolyline }）
export { ColorPolyline }
