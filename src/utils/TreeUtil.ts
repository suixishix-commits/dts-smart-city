/**
 * 树数据工具类
 */
export default class TreeUtil {

  /**
   * 数组转树
   * 
   * @param items 数组
   * @param idMapper id属性字段名
   * @param parentMapper 父id属性字段名   
   * @returns 
   */
  public static arrayToTree(items: any, idMapper: string = 'id', parentMapper: string = 'pid') {
    const lookup: any = {};
    const result: any = [];
    // 第一步：创建查找表  
    items.forEach((item: any) => {
      lookup[item[idMapper]] = { ...item, children: [] };
    });

    // 第二步：构建树  
    items.forEach((item: any) => {
      if (item[parentMapper] === null) {
        // 如果没有parentId，则是根节点  
        result.push(lookup[item[idMapper]]);
      } else {
        // 否则，找到父节点并添加到其子节点列表中  
        if (lookup[item[parentMapper]]) {
          lookup[item[parentMapper]].children.push(lookup[item[idMapper]]);
        } else {//游离的根节点
          result.push(lookup[item[idMapper]])
        }
      }
    });

    return result;
  }

  /**
   * 数组转树
   * 
   * @param items 数组
   * @param idPidMapper id\pid属性字段名,字段值为10、1010、101010这样的规则
   * @returns 
   */
  public static arrayToTree2(items: any, idPidMapper: string = 'id', idLengthPerLevel: number = 2) {
    const lookup: any = {};
    const result: any = [];
    // 第一步：创建查找表  
    items.forEach((item: any) => {
      lookup[item[idPidMapper]] = { ...item, children: [] };
    });

    console.log("Mapper是啥？", lookup)

    // 第二步：构建树  
    items.forEach((item: any) => {
      if (item[idPidMapper].length <= 2) {
        // 如果没有parentId，则是根节点  
        result.push(lookup[item[idPidMapper]]);
      } else {
        // 否则，找到父节点并添加到其子节点列表中 
        let pid = item[idPidMapper].substring(0, item[idPidMapper].length - idLengthPerLevel)
        if (lookup[pid]) {
          //console.log("pid是啥？", pid, lookup[pid], lookup[item[idPidMapper]]);
          lookup[pid].children.push(lookup[item[idPidMapper]]);
        } else {//游离的根节点
          result.push(lookup[item[idPidMapper]])
        }
      }
    });

    return result;
  }

  /**
   * 数组指定父节点转树
   * 
   * @param items 数组
   * @param idMapper id属性字段名
   * @param parentMapper 父id属性字段名   
   * @param filterNode 过滤父节点
   * @returns 
   */
  public static arrayToTreeForFilter(items: any, idMapper: string = 'id', parentMapper: string = 'pid', filterNode: Array<String> = []) {
    const lookup: any = {};
    const result: any = [];
    // 第一步：创建查找表  
    items.forEach((item: any) => {
      lookup[item[idMapper]] = { ...item, children: [] };
    });

    // 第二步：构建树  
    items.forEach((item: any) => {
      // 将子节点追加到父节点上
      if (item[parentMapper] && lookup[item[parentMapper]]) {
        lookup[item[parentMapper]].children.push(lookup[item[idMapper]]);
      }
      if (filterNode.indexOf(item[idMapper]) >= 0) {
        result.push(lookup[item[idMapper]]);
      }
    });

    return result;
  }

  /**
   * 扁平化树
   * @param tree 
   * @returns 
   */
  public static treeToArray(tree: any) {
    const result: any = [];
    if (tree) {
      // 统一处理：如果是单个节点，先转为数组形式
      const stack = Array.isArray(tree) ? [...tree] : [tree];
      while (stack.length > 0) {
        const node: any = stack.pop(); // 取出最后一个节点
        result.push(node); // 添加到结果数组
        // 如果有子节点，将子节点添加到栈中（使用unshift保持原有顺序）
        if (node.children && Array.isArray(node.children) && node.children.length) {
          stack.unshift(...node.children);
        }
      }
    }
    return result;
  }
}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { TreeUtil }）
export { TreeUtil }
