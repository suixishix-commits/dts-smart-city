
// 定义流体对象的类型
type fluidType = {
  id?: string;          // 流体对象的唯一标识符ID，可选
  groupId?: string;     // 流体对象的组ID，可选
  userData?: any;       // 用户自定义数据，可选
  bbox?: number[];      // 流体对象的边界框，格式：[minX, minY, minZ, maxX, maxY, maxZ]，可选
  style?: number;       // 流体的样式，可选
  color?: number[];     // 流体的颜色，格式：[R, G, B]，可选
  sources: any[];       // 流体的源列表，必需
}

// 定义Sluice类
export default class Sluice {
  // 使用Map存储流体对象，键为流体的ID，值为流体对象
  static mapFluid: any = new Map();

  // 异步方法，用于添加流体对象
  static async fluidAdd(fluidObjList: Array<fluidType>) {
    const fluidList: any = [];
    for (const fluidObj of fluidObjList) {
      // 如果流体对象没有ID，则生成一个随机的ID
      const id = fluidObj.id ?? Math.random().toString();
      // 如果流体对象没有组ID，则生成一个随机的组ID，并加上'group'后缀
      const groupId = fluidObj.groupId ?? Math.random().toString() + 'group';
      // 如果流体对象没有用户自定义数据，则使用空对象
      const userData = fluidObj.userData ?? {};
      // 如果流体对象没有边界框，则使用默认的边界框
      const bbox = fluidObj.bbox ?? [489376.595625, 2487792.04, 9.497031250000001, 491668.093125, 2490041.7753125, 304.32953125];
      // 如果流体对象没有样式，则使用默认样式8
      const style = fluidObj.style ?? 8;
      // 如果流体对象没有源列表，则使用默认的源列表
      const sources = fluidObj.sources?.length > 0 ? fluidObj.sources : [
        {
          "id": "ff_1",
          "rotation": [0, 0, 0], // 旋转角度，格式：[x, y, z]
          "bbox": [490211.933125, 2490391.52, 15, 490221.85625, 2490431.04, 33], // 包围盒，格式：[minX, minY, minZ, maxX, maxY, maxZ]
          "velocity": [0, 0], // 速率，格式：[x, y]
          "shape": 0, // 形状
          "duration": -1 // 周期
        }
      ];

      // 构建流体对象
      const obj = {
        id,          // 流体仿真对象的唯一标识符ID
        groupId,     // 流体仿真对象的组ID
        userData: JSON.stringify(userData),  // 用户自定义数据，转换为JSON字符串
        bbox,        // 流体仿真对象的边界框
        style,       // 流体样式
        sources      // 流体的源列表
      };

      // 将构建好的流体对象添加到流体列表中
      fluidList.push(obj);
      // 将构建好的流体对象存储到mapFluid中，键为流体的ID
      Sluice.mapFluid.set(id, obj);
    }

    // 获取所有新增流体对象的ID
    const ids = fluidList.map((item: any) => item.id);

    // 通过__xapi.fluid.delete删除已有的流体对象（根据ID）
    await __xapi.fluid.delete(ids);
    // 通过__xapi.fluid.add添加新的流体对象到系统中
    await __xapi.fluid.add(fluidList);

    // 输出添加的流体信息
    console.log('添加流体', fluidList);
    // 返回所有新增流体对象的ID
    return ids;
  }

  // 异步方法，用于添加或更新流体的源
  static async fluidSources(sourcesLists: Array<any>) {
    const listSources: any = [];
    for (const item of sourcesLists) {
      let sources: any = item.sources;
      const id = item.id;

      // 输出当前处理的item信息
      console.log(item, 'itemitem');

      // 如果item的sources属性不是数组或长度为0，则使用默认的边界框生成新的源列表
      if (!Array.isArray(item.sources) || item.sources.length <= 0) {
        const bboxs = [
          [489997.42562500003, 2488988.40875, 248.46404296875, 490053.31625000003, 2489090.4996875, 255.37417968750003],
          [489978.791875, 2488891.3315625, 260.77218750000003, 490007.246875, 2488934.52625, 262.46337890625]
        ];

        // 将默认的边界框转换为源对象，并添加到sources中
        sources = bboxs.map((bbox, index) => ({
          "id": `ff_${index + 1}`,
          "rotation": [0, 0, 0], // 旋转角度，格式：[x, y, z]
          "bbox": bbox, // 包围盒，格式：[minX, minY, minZ, maxX, maxY, maxZ]
          "velocity": [0, 0], // 速率，格式：[x, y]
          "height": 1, // 高度
          "shape": 1, // 形状
          "duration": -1 // 周期
        }));
      }

      // 构建源对象
      listSources.push({ id, sources });

      // 如果mapFluid中已经存在该ID的流体对象，则合并源列表
      if (Sluice.mapFluid.has(id)) {
        const mapData = Sluice.mapFluid.get(id);
        mapData.sources = Sluice.mergeById(mapData.sources, sources);
      }
    }

    // 构建流体ID和源ID的映射列表
    const listFluid = listSources.map((item: any) => ({
      id: item.id,
      sourceIds: item.sources.map((item: any) => item.id)
    }));

    // 通过__xapi.fluid.removeSource移除旧的源
    await __xapi.fluid.removeSource(listFluid);
    // 通过__xapi.fluid.addSource添加新的源
    await __xapi.fluid.addSource(listSources);

    // 输出添加的源信息
    console.log('添加出水口', listSources);

    // 激活新添加的源
    Sluice.continueSource(listFluid.map(i => ({ pId: i.id, cId: i.sourceIds })));

    // 返回所有源对象
    return listSources;
  }

  // 静态方法，用于激活源
  static continueSource(idContainer: any = [{ pId: 'f1', cId: ['ff_1', 'ff_2'] }]) {
    const source: any = [];

    // 遍历idContainer中的每一个项
    for (const item of idContainer) {
      const sList: any = [];
      // 遍历该项中的每一个源ID，并将其转换为激活状态的对象
      for (const s of item.cId) {
        sList.push({ id: s, active: true });
      }
      // 构建激活源的对象，包含父ID和源ID列表
      source.push({ id: item.pId, sources: sList });
    }

    // 通过__xapi.fluid.continueSource激活源，并处理返回结果
    __xapi.fluid.continueSource(source)

    // 输出激活的源信息
    console.log('激活出水口', idContainer);
  }

  // 静态方法，用于暂停源
  static stopSource(idContainer: any = [{ pId: 'f1', cId: ['ff_1', 'ff_2'] }]) {
    // 通过__xapi.fluid.stopSource暂停源
    __xapi.fluid.stopSource(idContainer.map((item: any) => {
      return {
        id: item.pId,
        sources: item.cId.map((id: string) => ({ id, active: false }))
      };
    }));

    // 输出暂停的源信息
    console.log('暂停出水', idContainer);
  }

  // 静态方法，用于合并两个源列表，新列表中的元素会覆盖旧列表中相同ID的元素
  static mergeById(list1: any, list2: any) {
    const map = new Map();

    // 将两个列表的元素合并到Map中，后者会覆盖前者相同ID的元素
    [...list1, ...list2].forEach(item => {
      map.set(item.id, item);
    });

    // 将Map中的值转换为数组并返回
    return Array.from(map.values());
  }
}

// 具名导出：unplugin-auto-import 21 按类名自动导入（import { Sluice }）
export { Sluice }
