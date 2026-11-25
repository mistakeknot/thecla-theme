import { expect, test } from 'claude-code/testing'

import { EDGE } from './register.js'

const BAND = { plugin: 'thecla-theme', component: 'AbovePrompt' } as const

const PROPS = {
  hasSurvey: false,
  isCollapsed: false,
  isWorking: false,
  maxRows: 4,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 24 },
  view: {},
}

const painted = async (ui: { findAll: (q: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }) =>
  (await ui.findAll({ type: 'Box' })).some(b => b.props.backgroundColor === EDGE[0])

test('the edge runs rose to cyan', () => {
  expect(EDGE.length).toBe(32)
  expect(EDGE[0]).toBe('#a32c6a')
  expect(EDGE[EDGE.length - 1]).toBe('#236e84')
})

test('desktop and mobile draw the edge, idle or working', async $ => {
  for (const [surface, isWorking] of [['desktop', false], ['mobile', true]] as const) {
    const ui = await $.ui.mount({ ...BAND, surface, props: { ...PROPS, isWorking } })
    const [row, ...segments] = await ui.findAll({ type: 'Box' })

    expect(row?.props.height).toBeLessThan(1)
    expect(segments.map(s => s.props.backgroundColor)).toEqual(EDGE)
    expect(await ui.find({ type: 'Text' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the terminal and a survey get no edge', async $ => {
  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal', props: PROPS })
  expect(await painted(terminal)).toBe(false)
  await terminal.unmount()

  const survey = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...PROPS, hasSurvey: true } })
  expect(await painted(survey)).toBe(false)
  await survey.unmount()
})
