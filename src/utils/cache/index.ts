import LocalStorage from '@/utils/LocalStorage'
import CacheKey from '@/utils/cache/key'

// 缓存
class Cache {
  getLanguage = (): string => {
    return LocalStorage.getItem(CacheKey.LangKey) || 'zh-CN'
  }

  setLanguage = (value: string) => {
    LocalStorage.setItem(CacheKey.LangKey, value)
  }

  getComponentSize = (): string => {
    return LocalStorage.getItem(CacheKey.ComponentSizeKey) || 'default'
  }

  setComponentSize = (value: string) => {
    LocalStorage.setItem(CacheKey.ComponentSizeKey, value)
  }
}

export default new Cache()
