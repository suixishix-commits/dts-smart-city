import { ref } from 'vue'
const useScroll = (elRef: any) => {
	const el = elRef.$el
	const stopScroll = () => {
		clearInterval(timer.value)
	}
	const timer = ref<any>(null)
	const currentTop = ref(0)
	const startScroll = () => {
		stopScroll()
		timer.value = setInterval(() => {
			try {
				currentTop.value += 0.5
				// 获取内容器的高度
				const clientHeight = el.querySelector('.el-scrollbar__view').clientHeight
				const height = el.clientHeight
				const pointHeight = clientHeight - height
				if (pointHeight <= currentTop.value) {
					currentTop.value = 0
				}
				elRef.setScrollTop(currentTop.value)
			} catch (error) {
				console.log(error, '滚动报错')
			}
		}, 30)
	}
	el.addEventListener('mouseover', () => {
		stopScroll()
	})
	el.addEventListener('mouseleave', () => {
		currentTop.value = parseInt(el.querySelector('.el-scrollbar__wrap').scrollTop)
		startScroll()
	})
	startScroll()
}
export default useScroll
