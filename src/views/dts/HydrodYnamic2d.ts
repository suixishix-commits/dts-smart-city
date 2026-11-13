/**
 * 二维水动力
 */
export default class HydrodYnamic2d {
    // 添加二维水动力Shapefile
    /**
     * 绘制二维水动力学图形
     * @param shpname 图形文件名，默认为'Cell4'
     * @returns 返回线数组
     *
     * 本函数通过调用API，清除当前的二维水动力学图形，并根据指定的Shapefile文件和数据文件
     * 动态加载和更新图形显示它主要用于展示水动力学模拟结果，通过Shapefile定义地理空间结构，
     * 并通过一系列数据文件更新图形的显示效果
     */
    static async drawHydrodYnamic2dshp(shpname: any='Cell4') {
        let lineArr :any = []
        if (__xapi?.isReady && shpname?.length > 0) {
            // 清除当前的二维水动力学图形
            await __xapi.hydrodynamic2d.clear()
            // 定义要添加的二维水动力学图形的配置
            let hydrodynamic2d_add = {
                "id": "hdm_shp1",
                "offset": [0, 0, 0],
                "displayMode": 1,//显示样式，取值范围：[0,1]，0水体样式（默认值），1热力样式
                "waterMode": 1,
                "arrowColor": [1, 0, 0, 0],
                "alphaMode": 0,//使用colors色带透明度
                // "collision": true,//开启碰撞
                "valueRange": [0, 1],
                // 指定Shapefile文件路径
                "shpFilePath":  '@path:shp1/'+shpname+'.shp',
            };
            // 添加二维水动力图
            __xapi.hydrodynamic2d.add(hydrodynamic2d_add);
            // 聚焦于新添加的图形
            __xapi.hydrodynamic2d.focus('hdm_shp1', 2000);
            let index = 0;
            //
            let hydrodynamicModel_for_update = {
                "id": "hdm_shp1",
                "updateTime": 1,
                "displayMode": 1,
                "shpDataFilePath": ""
            }
            // 使用dat数据填充shp网格
            let updateTimer = setInterval(async () => {
                index = index + 1;
                // 根据索引更新数据文件路径
                hydrodynamicModel_for_update.shpDataFilePath = "@path:dat1/hydrodynamic_" + index + ".dat";
                // 360 是.dat文件的数量 相当于360个时间点
                if (index > 360) {
                    // 达到最大索引后停止更新
                    clearInterval(updateTimer)
                } else {
                    // 同步更新二维水动力学图形
                    await __xapi.hydrodynamic2d.update(hydrodynamicModel_for_update);
                }
            }, 100);
        }
        // 返回空的线数组
        return lineArr;
    }
}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { HydrodYnamic2d }）
export { HydrodYnamic2d }
