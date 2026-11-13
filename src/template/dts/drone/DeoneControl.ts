import { getData } from '@/api/fileData'

/**
 * 无人机方法
 */

export default class DeoneControl {
  /**
   * 航线数据
   * @param initialPoint 起始点位坐标
   * @param endPoint 终点点位坐标
   * @param dronePerspective 无人机视角
   * @param camera 相机视角
   * @param movementSpeed 飞行速度
   * @param data 飞行数据
   */
  public static flightPathData: any = [
    // 广场到医院
    {
      name: '指挥中心到医院',
      initialPoint: [595686.874, 3808006.716, 336.6],
      endPoint: [595323.46, 3807993.16, 360.3],
      dronePerspective: [0, 0, 0],
      camera: [-45, -178, 0],
      movementSpeed: 200,
      data: 'center2Hospital'
    },
    // 医院到社区
    {
      name: '医院到社区医院',
      initialPoint: [595323.46, 3807993.16, 360.3],
      endPoint: [593472.65328125, 3808384.71734375, 337],
      dronePerspective: undefined,
      camera: null,
      movementSpeed: 160,
      data: 'hospital2Station'
    },
    {
      name: '社区医院到指挥中心',
      initialPoint: [593472.65328125, 3808384.71734375, 337],
      endPoint: [595686.874, 3808006.716, 336.6],
      dronePerspective: undefined,
      camera: [-30, 10, 0],
      movementSpeed: 300,
      data: 'station2Center'
    }
  ];

  // 无人机模拟飞行
  public static async showUavFlyLine(route: string, showDrone: boolean = true) {
    if (showDrone) {
      // 更具name找到对应的航线数据
      let routeData = DeoneControl.flightPathData.find(item => item.name === route)
      console.log(routeData)
      // 创建co对象
      let co = {
        id: 'drone_flightplan_co', //自定义对象唯一id
        groupId: "gp_flightplan_co",
        pakFilePath: '', //资源库pak文件路径,推荐使用cloud内置的文件资源管理器加载pak并使用@path方式传入参数
        //assetPath: '/JC_CustomAssets/ObjectLibrary/Exhibition/交通工具/其他/无人机_1', //资源目录，自定义对象在pak文件资源包里的相对路径
        assetPath: '/JC_CustomAssets/ObjectLibrary/Exhibition/大疆无人机/BP_无人机_空',
        // location: [595323.46, 3807993.16, 359.6870703125], //位置坐标
        location: routeData.initialPoint, //位置坐标
        coordinateType: 0, // 坐标系类型
        rotation: [0, 0, 0], // 世界坐标系旋转
        localRotation: [0, 0, 0], //模型自身旋转
        scale: [0.3, 0.3, 0.3], //模型缩放
        isEffectRotation: true, //是否开启旋转效果
        smoothMotion: 0, //1: 平滑移动，0: 跳跃移动
        supportAttach: false, //不支持贴画贴合
        visible: true, //模型加载后默认是否显示
      }
      await __xapi.customObject.delete('drone_flightplan_co'); // 清除之前的自定义对象
      await __xapi.customObject.add(co, () => {
        // 执行蓝图函数
        this.setDroneRotate(true)
      })

      // // 飞行路径添加
      await this.showFlightPath(routeData)
      // 航线展示---判断是否展示航线

      // await this.setUavFlyLine(route, showDrone, { color: [1, 0.6471, 0, 0.8], shape: 1, thickness: 5, style: 5, intensity: 10 })

      await this.setUavFlyLineStatus(route)
    } else {
      await __xapi.customObject.delete('drone_flightplan_co'); // 关闭无人机
      await __xapi.customObject.stop('drone_flightplan_co'); // 停止无人机移动
    }
  }

  // 设置无人机旋转\停止
  public static setDroneRotate(rotate: boolean, id: string = 'drone_flightplan_co') {
    __xapi.customObject.callBPFunction([
      {
        id: id,
        functionName: '旋转',
        parameters: [
          { "paramType": 0, "paramValue": rotate },
          { "paramType": 3, "paramValue": 100000 },
          { "paramType": 0, "paramValue": false },
        ]
      }
    ]);
  }

  // 设置无人机飞行路径
  private static async showFlightPath(data: any) {
    // 获取无人机飞行坐标
    const flightPathArr = await this.setDroneCoordinate(data)
    // console.log("无人机飞行路径：", flightPathArr)
    // 设置无人机移动轨迹点的坐标
    //let pathPointArr = initFlyStartMove(flightPathArr, data.movementSpeed, 0, 30, data.dronePerspective)
    let pathPointArr = this.calcPathTime(flightPathArr, data.movementSpeed, data.dronePerspective);
    // console.log('CO移动关键点：', pathPointArr)
    //开始移动
    __xapi.customObject.startMove('drone_flightplan_co', 0, pathPointArr)
    // 定位
    //__xapi.customObject.focus('drone_flightplan_co', 30, 2, data.camera, 1)
    __xapi.customObject.focus('drone_flightplan_co', 22, 2, data.camera, 1)
    console.log('飞行计划移动', 'drone_flightplan_co', data, flightPathArr, pathPointArr);
  }

  // 无人机飞行时航线状态
  public static async setUavFlyLineStatus(name: string, color: any = []) {
    let splineMeshData: any = [];
    let BPFn: any = [];
    const data = await this.getFlightPathCoordinates(name)
    // console.log(data)
    if (data.length > 0) {
      data.forEach((item: any, index: number) => {
        let ids = `splineMesh_${DeoneControl.flightPathData.find(item => item.name === name)?.name || DeoneControl.flightPathData[index].name}`
        // console.log(ids)
        splineMeshData.push({
          id: ids,
          groupId: "group_sm",
          userData: "路径模型1",
          coordinateType: 0,// 坐标系类型
          coordinates: [
            item.initialPoint, // 无人机初始点位
            ...item.data.features[0].geometry.paths[0],
            item.endPoint // 无人机结束点位
          ],//路径模型坐标数组
          range: [0, 10000],// 可见范围
          scale: 10, //路径模型的缩放值，默认值：1
          style: 15 //样式枚举
        })
        if(color.length > 0) {
          BPFn.push(...this.getSplineMeshColorList(ids, color))
        }else {
          BPFn = []
        }
      })
      await __xapi.splineMesh.delete(splineMeshData.map((item: any) => item.id)) // 清除之前的自定义对象
      await __xapi.splineMesh.add(splineMeshData, async () => { // 绘制航线状态
        console.log('绘制航线状态', splineMeshData)
        // 更改航线颜色
        await __xapi.splineMesh.callBPFunction(BPFn)
      })
    }
  }

  public static calculateDistance3D(startPoint, endPoint) {
    const x1 = startPoint[0]
    const y1 = startPoint[1]
    const z1 = startPoint[2]
    const x2 = endPoint[0]
    const y2 = endPoint[1]
    const z2 = endPoint[2]
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1))
  }

  /**
   * 计算飞行路径时间点
   * 
   * @param coordinates 坐标串
   * @param speed 速度，Km/h
   * @param perspective 视角
   */
  public static calcPathTime(coordinates: string, speed: number, perspective: any = undefined) {
    if (Array.isArray(coordinates) && coordinates.length > 2) {
      let pointCount = coordinates.length
      let distance = 0
      let lastTime = 0
      let pathPointArr: any = []
      let angle = [0, 0, 0]
      for (let i = 0; i < pointCount; i++) {
        if (i > 0) {
          // console.log("i:"+i, insertedPoints[i - 1], insertedPoints[i])
          distance = this.calculateDistance3D(coordinates[i - 1], coordinates[i])
          lastTime = lastTime + Number((distance * 3.6 / speed).toFixed(2))  // 毫秒
          // 计算欧拉角
          angle = __xapi.camera.getEulerAngle(coordinates[i - 1], coordinates[i])
        }

        if (!perspective) {
          pathPointArr.push({
            time: lastTime,
            coordinate: coordinates[i],
            rotation: [angle[0] < 0 ? 0 : angle[0], angle[1], angle[2]],
          })
        } else {
          pathPointArr.push({
            time: lastTime,
            coordinate: coordinates[i],
            rotation: perspective,
          })
        }
      }
      return pathPointArr
    }

  }

  // 配置无人机飞行坐标
  private static async setDroneCoordinate(coordinate: any) {
    let flightPathArr: any = [];
    // 获取无人机数据
    let res = await getData(`drones/${coordinate.data}.json`)
    console.log(res)
    flightPathArr = [
      coordinate.initialPoint, // 无人机初始点位
      ...res.data.features[0].geometry.paths[0], // 无人机飞行路径点位
      coordinate.endPoint // 无人机结束点位
    ]

    return flightPathArr
  }

  // 配置管道蓝图函数信息
  private static getSplineMeshColorList(id: string, color: any = []) {
    return [
      {
        id: id,
        functionName: '透明度',
        parameters: [
          { "paramType": 3, "paramValue": 0.1 }
        ]
      },
      {
        id: id,
        functionName: '颜色',
        parameters: [
          { "paramType": 6, "paramValue": color }
        ]
      }
    ]
  }

  // 无人机飞行坐标数据
  public static async getFlightPathCoordinates(name: string) {
    let routeData: any = [];
    if (name === '全选') {
      const promises = DeoneControl.flightPathData.map(async (item: any) => {
        let res: any = await getData(`drones/${item.data}.json`);
        res.initialPoint = item.initialPoint;
        res.endPoint = item.endPoint;
        // console.log(res);
        return res;
      });
      routeData = await Promise.all(promises);
    } else {
      // 根据name找对对应的航线数据
      let res = DeoneControl.flightPathData.find(item => item.name === name)
      if (res) {
        let data: any = await getData(`drones/${res.data}.json`)
        // data.initialPoint = res.initialPoint;
        // data.endPoint = res.endPoint;
        routeData.push({
          ...data,
          initialPoint: res.initialPoint,
          endPoint: res.endPoint
        });
      } else {
        console.error(`未找到名称为${name}的航线数据`)
      }
    }

    return routeData;
  }
}
