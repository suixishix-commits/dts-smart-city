/**
 * co对象工具类
 * */
export default class CustomObjectUtils {
    // 创建自定义对象，options参数为数组，每个元素为一个自定义对象参数，，pakFilePath为资源库pak文件路径，assetPath为资源目录，groupId为分组id
    static async createCustomObject(options={}, pakFilePath: any = null,assetPath: any = null,groupId: any = null): Promise<any> {
        return new Promise(async (resolve, reject) => {
            if (__xapi?.isReady){
                const listCo: any = []
                const coOptions = Array.isArray(options)? options : [options]
                for (let i = 0; i < coOptions?.length; i++) {
                    const item = coOptions[i]
                    listCo.push(
                        {
                            id: item?.id || Math.random() + 'o1',//自定义对象唯一id
                            pakFilePath: pakFilePath || '@path:DTS_Library.pak',//资源库pak文件路径,推荐使用cloud内置的文件资源管理器加载pak并使用@path方式传入参数
                            assetPath: assetPath || '/Game/Common/Asset_Bank/Mesh/Car/BP_Car_JiuHuChe',//资源目录，自定义对象在pak文件资源包里的相对路径
                            location: item?.id || [493132.125, 2492028.25, 2.1155664920806885],//位置坐标
                            coordinateType: item?.coordinateType || 0,// 坐标系类型
                            rotation: item?.rotation || [0, 0, 0],// 世界坐标系旋转
                            range: item?.range || [0, 1000],//可见范围
                            groupId: groupId || "coGroup",//分组id
                            localRotation: item?.localRotation || [0, 0, 0],//模型自身旋转
                            scale: item?.scale || [1, 1, 1],//模型缩放
                            isEffectRotation:  item?.isEffectRotation || true,//是否开启旋转效果
                            smoothMotion: item?.smoothMotion || 1,   //1: 平滑移动，0: 跳跃移动
                            supportAttach: item?.supportAttach || false, //不支持贴画贴合
                            visible: item?.visible || true,//模型加载后默认是否显示
                            autoHeight: item?.autoHeight || false, //是否开启自动高度 开启后自动贴地不再使用坐标Z
                            collision: item?.collision || true, //可选，设置自定义对象加载后是否开启碰撞，默认：true
                        }
                    )
                }
                const coIds = listCo.map(i=>i.id)
                //删除之前的3d标注
                await __xapi.customObject.delete(coIds);
                await __xapi.customObject.add(listCo);
                await __xapi.customObject.focus(coIds,20,1);
                console.log('批量创建co对象成功',listCo)
                resolve({ids:coIds})
            }
        })
    }
}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { CustomObjectUtils }）
export { CustomObjectUtils }
