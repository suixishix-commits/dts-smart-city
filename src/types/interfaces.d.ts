import KeyframePath from './KeyframePath'

/**
 * 用于洪水预演场景
 */
type FloodShowData = {
	/**
	 * 基本信息
	 */
	jiBenXinXi: any
	/**
	 * 方案统计
	 */
	fangAnTongJi: any
	/**
	 * 纳雨纳洪能力
	 */
	naYuNaHong: any
	/**
	 * 淹没损失
	 */
	yanMoSunShi: any
	/**
	 * 调度方案
	 */
	diaoDuFangAn: any
	/**
	 * 水位、流量过程数据
	 */
	shuiWeiLiuLiangGuoCheng: any
}

type ScenePlayerOption = {
	/**订阅消息 */
	topic: string // 默认 'ScenePlayerTopic'
	/**关键帧路线 */
	keyframePath: KeyframePath
	/**加速度 */
	speed?: number
	/**最长播放时间 */
	playDuration?: number
	/**勾子函数 */
	hookFunction?: Map<string, Function>

	//###AcotorPlayer专属配置
	/**是否显示导航线 */
	showNavLine?: boolean
	/**actor选项 */
	actorOptions?: Object
	/**轨迹线样式选项 */
	navLineOptions?: Object
	/**相机是否跟随 */
	cameraFollowing?: boolean
}
