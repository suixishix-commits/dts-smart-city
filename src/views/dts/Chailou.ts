import DismantleBuilding from '@/components/DismantleBuilding/DismantleBuilding.js';

/**
 * Chailou类用于管理建筑物的拆分和移动操作
 */
export default class Chailou {
  // 存储拆分建筑物的对象
  static dismantleBuildingObj: any = null;

  /**
   * 构造函数，初始化拆分建筑物的对象
   */
  static newInstance(autoZoom = true) {
    // 定义建筑物拆分和移动的选项
    let options: any = {
      verticalMoveOnceDistance: 0.5,
      horizontalMoveOnceDistance: 0.5,
      verticalMoveDistance: 20,
      horizontalMoveDirection: 180,
      horizontalMoveDistance: 50,
      floorInfoArr: [
        // 定义每一层的信息，包括图层ID、楼层ID、移动类型、对象ID、楼层名称、楼层索引和楼层底部高程
        {
          layerId: "4DECD1704AD8119E33CF658A64A70AD2",
          floorId: "floor-1",
          moveType: 'actor',
          objectId: "zhihuizhongxin_lang_11",
          floorName: "1层",
          floorIndex: 1,
          floorBottomElevation: 0
        },
        {
          layerId: "4DECD1704AD8119E33CF658A64A70AD2",
          floorId: "floor-2",
          moveType: 'actor',
          objectId: "zhihuizhongxin_lang_13",
          floorName: "2层",
          floorIndex: 2,
          floorBottomElevation: 3,
        },
        // 故意设置不存在的图层ID，用于测试
        {
          layerId: "noExits",
          floorId: "floor-2",
          moveType: 'actor',
          objectId: "zhihuizhongxin_lang_13_1",
          floorName: "2层",
          floorIndex: 2,
          floorBottomElevation: 3,
        },
        {
          layerId: "4DECD1704AD8119E33CF658A64A70AD2",
          floorId: "floor-3",
          moveType: 'actor',
          objectId: "zhihuizhongxin_lang_15",
          floorName: "3层",
          floorIndex: 3,
          floorBottomElevation: 6,
        },
        {
          layerId: "4DECD1704AD8119E33CF658A64A70AD2",
          floorId: "floor-4",
          moveType: 'actor',
          objectId: "zhihuizhongxin_lang_17",
          floorName: "楼顶",
          floorIndex: 4,
          floorBottomElevation: 9,
        },
        {
          layerId: "DC2C768A4A0F131C2039F4A445913247",
          floorId: "floor-3",
          floorName: "旁边建筑",
          moveType: 'tilelayer',
          floorIndex: 1,
          floorBottomElevation: 0,
        },
      ]
    }
    if (__xapi?.isReady && !Chailou.dismantleBuildingObj) {
      // 创建拆分建筑物的对象
      Chailou.dismantleBuildingObj = new DismantleBuilding(options)
      if (autoZoom) {
        __xapi.camera.set(492663.664687, 2492159.200781, 79.533003, -10.654418, 44.686253)
      }
    } else {
      console.log("场景未准备好，或拆分建筑物对象已存在");
    }
  }

  /**
   * 向上移动建筑物
   */
  static async moveUp() {
    Chailou.dismantleBuildingObj?.moveUp()
  }

  /**
   * 向下移动建筑物
   */
  static async moveDown() {
    Chailou.dismantleBuildingObj?.moveDown()
  }

  /**
   * 拉动建筑物
   * @param data 拉动的数据
   */
  static async pull(data: any) {
    Chailou.dismantleBuildingObj?.pull(data)
  }

  /**
   * 推动建筑物
   * @param data 推动的数据
   */
  static async push(data: any) {
    Chailou.dismantleBuildingObj?.push(data)
  }

  /**
   * 重置建筑物的位置
   */
  static async reset() {
    Chailou.dismantleBuildingObj?.reset()
  }

}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { Chailou }）
export { Chailou }
