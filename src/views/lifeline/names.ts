import type { LifelineSystem } from '@/types/lifeline'

/** 各系统的中文短名（列表、卡片标题用） */
export const SYSTEM_NAME: Record<LifelineSystem, string> = { water: '供水', power: '电力', gas: '燃气', drain: '排水', cooling: '供冷', bridge: '桥梁' }
