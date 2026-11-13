
/**
 * 防抖函数
 * 
 * //原则：一个函数进行做一件事情，一个变量也用于记录一种状态
 * 
 * // 使用
 * const debounceFilterMonitorPoint = debounce(filterMonitorPoint, 500)
 * debounceFilterMonitorPoint()
 * 
 * @param fn 
 * @param delay 
 * @param immediate 
 * @param resultCallback 
 * @returns 
 */
export function debounce(fn: Function, delay: number, immediate = false, resultCallback: Function | null = null) {
  // 1.用于记录上一次事件触发的timer
  let timer: any = null;
  let isInvoke = false

  // 2.触发事件时执行的函数
  const _debounce = function (...args: any) {
    return new Promise((resolve, reject) => {
      try {
        // 2.1.如果有再次触发(更多次触发)事件，那么取消上一次的事件
        if (timer) clearTimeout(timer)

        // 第一次操作是不需要延迟
        let res = undefined
        if (immediate && !isInvoke) {
          isInvoke = true
          res = fn.apply(this, args)
          if (resultCallback) resultCallback(res)
          resolve(res)
          isInvoke = false
          return
        } else {
          // 2.2. 延迟去执行的对应的fn函数(传入的回调函数)
          timer = setTimeout(() => {
            res = fn.apply(this, args)
            if (resultCallback) resultCallback(res)
            resolve(res)
            timer = null  //执行过函数之后，将timer重新置为null
            isInvoke = false
          }, delay);
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  // 3.给_debounce绑定一个取消的函数
  _debounce.cancel = function () {
    if (timer) clearTimeout(timer)
    timer = null
    isInvoke = false
  }

  //返回一个新的函数
  return _debounce
}


/**
 * 获取字体大小
 * 
 * @param px 在1920*1080分辨上的字体大小，px
 * @returns
 */
export function px2rem(px: number) {
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return parseFloat((px / rootFontSize).toFixed(4));
}

/**
   * rem 转px
   * 
   * @param rem 
   * @returns 
   */
export function rem2px(rem) {
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return rem * rootFontSize;
}