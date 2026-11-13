import { ElMessage, ElMessageBox } from 'element-plus'
import TimeUtil from './TimeUtil'

/**
 * 计时器管理
 */
export default class Timer {
  static map: Map<string, any> = new Map()

  static delay(millisecond?: number) {
    return new Promise<void>(resolve => {
      Timer.once(() => resolve(), millisecond ?? 0)
    })
  }

  /**
   * 执行列表
   */
  static run = (...run: { run: () => void; time?: number }[]) => {
    run.forEach(el => {
      let time = el.time ?? 0
      Timer.once(() => {
        if (el.run) {
          el.run()
        }
      }, time)
    })
  }

  /**
   * 异步执行列表,执行完所有任务会调用回调
   */
  static runAsync = async (
    run: {
      run: () => void
      time?: number | undefined
    }[],
    callback?: any
  ) => {
    await run.reduce((prev, cur) => {
      return Promise.resolve().then(() => {
        return Timer.onceAsync(cur.run, cur.time ?? 0)
      })
    }, {})
    if (callback) {
      callback()
    }
  }

  /**
   *按序执行
   *
   * @param arr 业务对象数组，每个依次按给定时间传给handler
   * @param timeAtt 业务对象中用于存储定时器时长的字段，默认为time属性
   * @param handler 处理函数,接受{当前值，index,arr,定时器id}
   */
  static runSync = async (arr: Array<any>, handler: Function, timeAtt: string = 'time') => {
    if (!arr || handler?.constructor !== Function) {
      throw new Error('传入的数组格式不符合要求')
    }

    await arr.reduce(
      async (prev: any, curr: any, index: number, arr: any[]) => {
        await prev
        return this.playKeyFrame(prev, curr, index, arr, handler, timeAtt)
      },
      this.playKeyFrame(
        //执行首帧
        new Promise((resolve, reject) => {
          resolve(['初始'])
        }),
        { time: 0 },
        -1,
        arr,
        () => { },
        timeAtt
      )
    )
  }

  /**按序执行内部函数 */
  private static playKeyFrame(prev: any, curr: any, index: number, arr: any[], handler: Function, timeAtt: string) {
    return new Promise((resolve, reject) => {
      if (index >= 0 && index < arr.length) {
        console.log('playKey' + curr + '-' + curr[timeAtt])
        console.log(prev)
        let tId = this.once(() => {
          resolve([curr.data])
        }, Number(curr[timeAtt]))
        handler(curr, index, arr, tId)
      } else {
        resolve(['ok:' + index])
      }
    })
  }

  /**
   * 循环执行
   * @param callback
   * @param time 毫秒
   * @param runOne 只运行一次
   * @returns
   */
  static on = (callback: Function, time: number, runOne: boolean = false): string => {
    let timer = setInterval(callback, time)
    this.map.set('i_' + timer, timer)
    if (runOne) {
      callback()
    }
    return 'i' + timer
  }

  /**
   * 执行一次
   * @param callback
   * @param time 毫秒
   * @returns
   */
  static once = (callback: Function, time: number): string => {
    let timer = setTimeout(callback, time)
    this.map.set('t_' + timer, timer)
    return 't' + timer
  }

  /**
   * 异步执行一次
   */
  static onceAsync = (callback: Function, time: number): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        callback()
        resolve()
      }, time)
    })
  }

  /**
   * 注销循环
   */
  static remove(...name: any) {
    for (let i = 0; i < name.length; i++) {
      clearInterval(this.map.get(name[i]))
      this.map.delete(name[i])
    }
  }

  /**
   * 注销一次
   */
  static removeOnce(...name: any) {
    for (let i = 0; i < name.length; i++) {
      clearTimeout(this.map.get(name[i]))
      this.map.delete(name[i])
    }
  }

  /**
   * 注销所有循环
   */
  static removeAll() {
    this.map.forEach((value: any, key: any) => {
      // console.log(key, value);
      if (key.indexOf('t_') == 0) {
        clearTimeout(value)
      } else if (key.indexOf('i_') == 0) {
        clearInterval(value)
      }
    })
    this.map.clear()
  }

  /**
   *添加自定义定时器
   * @param timerKey timeout,以t_开头，interval，以i_开头
   * @param timerId
   */
  static addCustTimer(timerKey: any, timerId: any) {
    this.map.set(timerKey, timerId)
  }

  /**
   * 定时执行某个函数
   *
   * @param min 最小值
   * @param max 最小值
   * @param duration 执行时间 秒
   * @param step 步长
   * @param handler 同步回调函数
   */
  static intervalExecute(
    handler: Function,
    callback: Function | null = null,
    min: number = 0,
    max: number = 30,
    duration: number | null = null,
    step: number = 1
  ) {
    if (step == 0 || max == min) {
      throw new Error('步长为0,或最大最小值相等')
    }
    let totalSteps = (max - min) / step
    if (!duration) {
      duration = max - min
    }
    let stepDuration = duration / totalSteps
    let i = 0

    let timer = setInterval(() => {
      i++
      if (i > totalSteps) {
        //console.log('intervalExecute停止啦')
        if (callback) {
          callback()
        }
        clearInterval(timer)
      } else {
        handler(min + step * i, timer)
      }
    }, stepDuration * 1000)
    this.map.set('i_' + timer, timer)
  }

  /**
   * 休眠
   * @param second 秒
   * @returns
   */
  static sleep(second: number) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(null)
      }, second * 1000)
    })
  }

  // 获取所有计时器
  static getTimer() {
    return this.map
  }


  /**
   * 循环调用
   * 
   * @param callback 执行函数
   * @param params 执行参数 {dataList:[],sliceSize:number,result:[]}
   */
  static async loopCallFunction(callback: Function, params: any) {
    let batchData = undefined
    if (params.dataList.length <= params.sliceSize) {
      batchData = params.dataList
      params.dataList = []
    } else {
      batchData = params.dataList.slice(0, params.sliceSize)
      params.dataList = params.dataList.slice(params.sliceSize)
    }
    // 获取数据
    try {
      params.result = params.result.concat(await callback(batchData))
    } catch (error) {
      console.log("loopCallFunction出错", params)
    }

    if (Object.hasOwn(params, 'count')) {
      params.count++
    } else {
      params.count = 1
    }
    //console.log('loopCallFunction', params, batchData.length)
    if (params.dataList?.length > 0 && params.count < 100) {
      await this.loopCallFunction(callback, params)
    }
  }
}

// 具名导出：unplugin-auto-import 21 按类名自动导入（import { Timer }）
export { Timer }
