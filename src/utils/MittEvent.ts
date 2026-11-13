export default class MittEvent {
	/**
	 * 消息数据
	 */
	type: string
	data: any
	constructor(type: string, data: any = null) {
		this.type = type
		this.data = data
	}
}

// 具名导出：unplugin-auto-import 21 按类名自动导入（import { MittEvent }）
export { MittEvent }
