import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../labelImage', () => ({
  drawLabel: (spec: { text: string; variant?: string }) => ({ url: `${spec.variant}:${spec.text}`, size: [10, 10], anchor: [-5, 10] })
}))

const { registerPin, resetPinSelection, selectionUpdates } = await import('../pinSelection')

const spec = (text: string) => ({ text, color: '#ff0000', lead: 30 })

describe('pinSelection', () => {
  beforeEach(() => {
    resetPinSelection()
    registerPin('incident-a', 'a', spec('A'), 'normal:A')
    registerPin('incident-b', 'b', spec('B'), 'normal:B')
  })

  it('swaps the selected object to the highlighted image and back', () => {
    expect(selectionUpdates(['a', null])).toEqual([{ id: 'incident-a', imagePath: 'selected:A' }])
    // 换选另一个：旧的换回普通图，新的换成选中图
    expect(selectionUpdates([null, 'b'])).toEqual([
      { id: 'incident-a', imagePath: 'normal:A' },
      { id: 'incident-b', imagePath: 'selected:B' }
    ])
    // 选中没变：不发指令
    expect(selectionUpdates(['b'])).toEqual([])
    expect(selectionUpdates([null])).toEqual([{ id: 'incident-b', imagePath: 'normal:B' }])
  })

  it('treats a redrawn pin as unselected again', () => {
    selectionUpdates(['a'])
    registerPin('incident-a', 'a', spec('A2'), 'normal:A2')
    expect(selectionUpdates(['a'])).toEqual([{ id: 'incident-a', imagePath: 'selected:A2' }])
  })

  it('ignores ids that have no pin', () => {
    expect(selectionUpdates(['nope'])).toEqual([])
  })
})
