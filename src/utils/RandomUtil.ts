/**
 * 随机数、字符工具类
 */
export default class RandomUtil {
	/**
	 * 获取uuid字符串
	 * @param { Number } len uuid长度
	 * @return { String } uuid
	 */
	static getUUID(len = 32): string {
		const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')
		const uuid: string[] = []
		let cLen = chars.length
		for (let i = 0; i < len; i++) {
			let r = this.getRandomSeed(0, cLen - 1)
			uuid.push(chars[i == 19 ? (r & 0x3) | 0x8 : r])
		}
		let uLen = uuid.length
		let timeStr = String(new Date().getTime())
		for (let i = 0; i < timeStr.length; i++) {
			let r = this.getRandomSeed(0, uLen - 1)
			uuid[r] = timeStr[i]
		}
		return uuid.join('')
	}

	/**
	 *获取某个范围内的随机数
	 *
	 * @param min 最小值
	 * @param max 最大值
	 * @returns
	 */
	static getRandomSeed(min: number, max: number): number {
		return Math.round(Math.random() * (max - min) + min)
	}
}

// 具名导出：unplugin-auto-import 21 按类名自动导入（import { RandomUtil }）
export { RandomUtil }
