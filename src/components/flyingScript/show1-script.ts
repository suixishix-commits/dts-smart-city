/**
 * 说明：
 * 1、durationType:两帧之间的时差计算方式，time:使用dateTime字段计算
 * duration:使用playDuration字段，单位秒，代表本帧coordinate到下帧定义的coordinate之间的耗时
 * 2、isStopFrame:false/true 在本位置暂停，需要点一下才能继续前进
 * 3、waitingTime:10 在本位置停留10秒
 * 4、第一帧可设置toDuration，代表到该位置的时间
 * 5、topic:消息主题
 * 6、text不为空时，播放到该帧会显示文本信息；description为该帧的描述信息，不会有提示。 
 */
export default {
  id: 'Show-001',
  name: '飞行脚本示例',
  moveObject: 'camera',
  timingType: 'duration',
  displayText: true,
  keyframes: [
    {
      index: 1,
      text: '空域概览',
      description: '宏观视角',
      dateTime: '2025-12-18 08:00:00',
      coordinate: [493007.654678, 2491809.908301, 11568.255],
      rotation: [-85.993561, -89.999557, 0],
      toDuration: 1,
      playDuration: 3,
      visbleLayer: [],
      hiddenLayer: [],
      waitingTime: 0,
      weatherConfig: {},
      hookFunction: '',
      topic: ''
    },
    {
      index: 2,
      text: '智慧园区',
      description: '智慧园区俯视',
      dateTime: '2025-12-18 08:00:00',
      coordinate: [493007.654678, 2491809.908301, 11568.255],
      rotation: [-85.993561, -89.999557, 0],
      playDuration: 3,
      visbleLayer: [],
      hiddenLayer: [],
      waitingTime: 0,
      weatherConfig: {},
      hookFunction: '',
    },
    {
      index: 3,
      text: '',
      description: '从东北角进入',
      dateTime: '2025-12-18 08:00:00',
      coordinate: [493361.908242, 2492154.55418, 1595.471563],
      rotation: [-74.880714, -168.245697, 0],
      playDuration: 3,
      visbleLayer: [],
      hiddenLayer: [],
      waitingTime: 0,
      weatherConfig: {},
      isStopFrame: false,
      hookFunction: '',
      topic: ''
    },
    {
      index: 3,
      text: '',
      description: '从东北角进入',
      dateTime: '2025-12-18 08:00:00',
      coordinate: [493766.829688, 2492355.405859, 274.931035],
      rotation: [-21.112114, 154.182983, 0],
      playDuration: 3,
      visbleLayer: [],
      hiddenLayer: [],
      waitingTime: 0,
      weatherConfig: {},
      isStopFrame: false,
      hookFunction: '',
      topic: 'initPopupBuilding'
    },
    {
      index: 3,
      text: 'BIM拆解',
      description: '大楼近前',
      dateTime: '2025-12-18 08:00:00',
      coordinate: [493227.46375, 2492207.911641, 150.865645],
      rotation: [-15.976406, 150.558609, 0],
      playDuration: 3,
      visbleLayer: [],
      hiddenLayer: [],
      waitingTime: 0,
      weatherConfig: {},
      isStopFrame: false,
      hookFunction: '',
      topic: 'showPopupBuilding'
    },
    {
      index: 3,
      text: '',
      description: '看拆楼',
      dateTime: '2025-12-18 08:00:00',
      coordinate: [492663.67168, 2492159.193867, 79.531152],
      rotation: [-10.654411, 44.686169, 0],
      playDuration: 3,
      visbleLayer: [],
      hiddenLayer: ['4DECD1704AD8119E33CF658A64A70AD2'],
      waitingTime: 20,
      weatherConfig: {
      },
      isStopFrame: false,
      hookFunction: '',
      topic: ''
    },
    {
      index: 3,
      text: '下雪啦',
      description: '看雨',
      dateTime: '2025-12-18 08:00:00',
      coordinate: [492889.255918, 2492111.668828, 3.857537],
      rotation: [-6.552733, 44.413635, 0],
      playDuration: 3,
      visbleLayer: [],
      hiddenLayer: [],
      waitingTime: 10,
      weatherConfig: {
        dateTime: {
          state: 'on',
          time: '2026-06-06 09:06:06'
        },
        fog: {
          state: 'on',
          fogDensity: 0.1,
          fogColor: [1, 1, 1],
          fogHeightFalloff: 0.05,
          fogStartDistance: 10,
          fogOpacity: 0.2
        },
        rain: {
          state: 'on',
          cloudThickness: 2,
          strength: 1,
          speed: 1,
          raindropSize: 1,
          rainColor: [0.5, 0.5, 0.5, 0.1],
          alignCamera: 0.5,
          overcastStrength: 0.5
        }
      },
      isStopFrame: false,
      hookFunction: '',
      topic: ''
    },
    {
      index: 3,
      text: '下雪啦',
      description: '看雪',
      dateTime: '2025-12-18 08:00:00',
      coordinate: [492745.126875, 2492292.046406, 241.050723],
      rotation: [-39.658943, 78.00547, 0],
      playDuration: 3,
      visbleLayer: [],
      hiddenLayer: [],
      waitingTime: 0,
      weatherConfig: {
        fog: {
          state: 'off'
        },
        rain: {
          state: 'off'
        },
        snow: {
          state: 'on',
          cloudThickness: 2,
          strength: 1,
          speed: 1,
          snowflakeSize: 1,
          snowColor: [0.5, 0.5, 0.5, 0.1],
          alignCamera: 0.5,
          overcastStrength: 0.5
        }
      },
      isStopFrame: false,
      hookFunction: '',
      topic: 'showOver'
    }
  ]
}
