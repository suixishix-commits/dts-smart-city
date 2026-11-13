/**
 * 3d marker方法类
 */
export default class Marker3DUtils {
    //传入options数组，批量创建3d标注，groupId为批量创建的3d标注的groupId
    static async createMarker3D(options={},groupId='marker3dTest'): Promise<any> {
        return new Promise(async (resolve, reject)=>{
            if (__xapi?.isReady){
                const list3D: any = []
                const Moptions = Array.isArray(options)? options : [options]
                for (let i = 0; i < Moptions?.length; i++) {
                    const item = Moptions[i]
                    list3D.push({
                        'id': item?.id || 'm1',
                        'groupId': groupId || 'marker3dTest',
                        'text': item?.text || 'Building No.1',//3D标注显示文字
                        'textSize': item?.textSize || 32,//3D标注显示文字大小
                        'textColor': item?.textColor || '#6BF4F7',//3D标注显示文字颜色
                        'textOutlineSize': item?.textOutlineSize || 1,//3D标注显示文字轮廓大小
                        'textOutlineColor': item?.textOutlineColor || Color.Black,// 3D标注显示文字轮廓颜色
                        'textFixed': item?.textFixed || true,// 3D标注显示文字是否固定文本朝向
                        'fixedSize': item?.fixedSize || true,// 默认尺寸 非近大远小
                        'textVisible': item?.textVisible ||true,//3D标注显示文字是否显示文本
                        'textLocation': item?.textLocation || [0, 0, 0],// 文字位置
                        'textRotation':  item?.textRotation || [0, 90, 0],// 文字旋转
                        'textScale':item?.textScale || [10, 10, 10],// 文字缩放
                        'pointName': item?.pointName || 'Point_B_5',//3D标注展示的特效名称
                        'pointVisible': item?.pointVisible || true,//3D标注是否显示
                        'pointScale': item?.pointScale || 5,//3D标注整体缩放比例
                        'coordinate': item?.coordinate || [492847.15625, 2491823, 108], //3D标注的坐标位置 注意：若坐标Z设置高度为0时 autoHeight=true则会显示在物体上方
                        'coordinateType': item?.coordinateType || 0, //坐标系类型
                        'range': item?.range || [1, 1000], //3D标注的可视距离范围：[min,max]，单位：米
                        'viewHeightRange': item?.viewHeightRange || [0,1000],//可见高度范围
                        'autoHeight': item?.autoHeight || false, //自动判断下方是否有物体，设置正确高度，默认值：false
                        'collision': item?.collision || true //默认开启碰撞
                    })
                }
                const m3Did = list3D.map(i=>i.id)
                //删除之前的3d标注
                await __xapi.marker3d.deleteByGroupId(groupId);
                await __xapi.marker3d.add(list3D);
                await __xapi.marker3d.focus(m3Did,100,1);
                console.log('批量创建3d标注成功',list3D)
                resolve({ids:list3D})
            }
        })
    }
}
// 具名导出：unplugin-auto-import 21 按类名自动导入（import { Marker3DUtils }）
export { Marker3DUtils }
