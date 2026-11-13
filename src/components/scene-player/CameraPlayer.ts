import ScenePlayer from './ScenePlayer'
export default class CameraPlayer extends ScenePlayer {
	//播放
	public async play() {
		super.play()
	}

	//暂停
	public async pause() {
		await this.dtsApi.camera.stop()
		super.pause()
	}

	//恢复
	public async resume() {
		await this.dtsApi.camera.stop()
		super.play()
	}

	//下一帧
	public async next() {
		await this.dtsApi.camera.stop()
		await super.pause()
		this.currentPlayIndex++
		await super.play()
	}

	//上一帧
	public async back() {
		await this.dtsApi.camera.stop()
		this.currentPlayIndex = this.currentPlayIndex - 2 >= 0 ? this.currentPlayIndex - 2 : 0
		await super.pause()
		await super.play()
	}

	// 跳到第几帧
	public async go(index: number) {
		await this.dtsApi.camera.stop()
		this.currentPlayIndex = index
		await super.pause()
		await super.play()
	}

	//停止
	public async stop() {
		await this.dtsApi.camera.stop()
		await super.stop()
	}

	/**记录点击暂停位置 */
	protected async recordInterruptedLocation() {}

	/**播放被打断过的帧 */
	protected playInterruptedFrame(): number {
		return 0
	}
}
