import ProjectSceneFacade from '../ProjectSceneFacade';
// [118.7089414, 31.9744170, 5], [118.7104130, 31.9617931, 5]
export const startPos = {
  id: `meituan_startpoint`, //自定义对象唯一id
  pakFilePath: '@path:DTS_Library.pak', //资源库pak文件路径,推荐使用cloud内置的文件资源管理器加载pak并使用@path方式传入参数
  assetPath: '/JC_CustomAssets/ObjectLibrary/Exhibition/无人机/设备柜2',
  groupId: 'lac_box',
  location: ProjectSceneFacade.pro4jTransform([118.7089414, 31.9744170, 7]), //位置坐标
  coordinateType: 0, // 坐标系类型
  rotation: [0, 0, 0], // 世界坐标系旋转
  localRotation: [0, 0, 0], //模型自身旋转
  scale: [1, 1, 1], //模型缩放
  isEffectRotation: true, //是否开启旋转效果
  smoothMotion: 1, //1: 平滑移动，0: 跳跃移动
  supportAttach: false, //不支持贴画贴合
  visible: true, //模型加载后默认是否显示
  userData: 'meituan_startpoint', //自定义数据
}

export const endPos = {
  id: `meituan_endpoint`, //自定义对象唯一id
  pakFilePath: '@path:DTS_Library.pak', //资源库pak文件路径,推荐使用cloud内置的文件资源管理器加载pak并使用@path方式传入参数
  assetPath: '/JC_CustomAssets/ObjectLibrary/Exhibition/无人机/设备组合',
  groupId: 'lac_box',
  location: ProjectSceneFacade.pro4jTransform([118.7104130, 31.9617931, 10]), //位置坐标
  coordinateType: 0, // 坐标系类型
  rotation: [0, 60, 0], // 世界坐标系旋转
  localRotation: [0, 0, 0], //模型自身旋转
  scale: [1, 1, 1], //模型缩放
  isEffectRotation: true, //是否开启旋转效果
  smoothMotion: 1, //1: 平滑移动，0: 跳跃移动
  supportAttach: false, //不支持贴画贴合
  visible: true, //模型加载后默认是否显示
  userData: 'meituan_endpoint', //自定义数据
}