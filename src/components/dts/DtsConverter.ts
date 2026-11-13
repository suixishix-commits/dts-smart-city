import RandomUtil from '@/utils/RandomUtil'
/***
 *数据格式转换工具
 */
export default class DtsConverter {
	/**
	 * @param coordinates 三维坐标数组
	 * 如果是二维坐标，可调用addZ方法，统一加Z值
	 * @param groupId 分组Id
	 * @returns { ids: dts对象ID数组, infos: dts对象核心信息 }
	 */
	public static buildPointInfo(coordinates: [[]], groupId: string): Object {
		if (coordinates?.constructor === Array && coordinates.length > 0 && (coordinates[0] as Array<any>).length == 3) {
			let ids = new Array(coordinates.length)
			let infos = coordinates.map((value, index) => {
				ids[index] = 'P_' + RandomUtil.getUUID(8) + '_' + index
				return { id: ids[index], groupId: groupId, coordinate: value }
			})
			return { ids: ids, infos: infos }
		} else {
			throw new Error('数据格式不符合要求!')
		}
	}

	/**
	 * 将bo{idMapper,textMapper,coordMapper}属性映射为bo{id,text,coordinate}
	 * 复制BO对象，对原对象不会有改变
	 * 如果属性一样，参数填''或不传参
	 * textMapper支持勾子函数，会传BO给勾子
	 * @param arrBo 业务实体数组
	 * @param groupId DTS对象分组名称，特别是用在Marker\Marker3D等对象绘制中
	 * @param idMapper
	 * @param textMapper
	 * @param coordMapper
	 * @returns { ids: dts对象ID数组, infos: dts对象核心信息 }
	 */
	public static convertPointInfo(arrBo: [any], groupId: string, idMapper: string = '', textMapper: any = '', coordMapper: string = ''): Object {
		if (arrBo?.constructor === Array && arrBo.length > 0 && arrBo[0]?.constructor === Object) {
			let ids = new Array(arrBo.length)
			let infos = arrBo.map((value, index) => {
				let obj = { ...value }
				if (idMapper) {
					//如果有映射
					ids[index] = obj[idMapper]
					obj['id'] = ids[index]
				} else if (Object.hasOwn(obj, 'id')) {
					//没映射但到本来就有
					ids[index] = String(obj['id'])
				} else {
					//没映射，也没有id属性
					obj['id'] = 'P_' + RandomUtil.getUUID(8) + '_' + index
					ids[index] = obj['id']
				}

				if (coordMapper) {
					obj['coordinate'] = obj[coordMapper]
					Reflect.deleteProperty(obj, coordMapper)
				}

				if (textMapper?.constructor === Function) {
					obj['text'] = textMapper(value)
				} else if (textMapper) {
					obj['text'] = obj[textMapper]
				}
				obj['groupId'] = groupId

				return obj
			})
			return { ids: ids, infos: infos }
		} else {
			throw new Error('数据格式不符合要求!')
		}
	}

	/**
	 *给二维坐标加上Z坐标
	 * @param coordinates 二维坐标
	 * @param z z坐标
	 * @returns
	 */
	public static addZ(coordinates: Array<any>, z: number = 0): Array<any> {
		let result: Array<any>
		if (coordinates?.constructor === Array && coordinates.length > 0) {
			let result1: Array<number>
			if (coordinates[0]?.constructor === Number) {
				result1 = Array.from(coordinates)
				if (result1.length >= 3) {
					result1 = result1.slice(0, 2)
					result1[2] = z
				} else if (result1.length == 2) {
					result1[2] = z
				}
				return result1
			} else {
				result = new Array()
				coordinates.forEach((value: any, index) => {
					result.push(this.addZ(value, z))
				})
			}
		} else {
			throw new Error('数据格式不符合要求!')
		}
		return result
	}
}
