import type { Register, ThemeColors, ThemeSetArgs } from 'claude-code'

import { THECLA } from './palette.js'

// Thecla: luminous rose, orchid pink and cyan on a soft pink canvas in light
// mode and deep black in dark mode.

// The person's bubble takes Thecla's rose wash, flattened onto the canvas:
// 10% rose in light, 12% in dark.
const colors: ThemeColors = {
  ...THECLA,
  inputs: {
    light: { ...THECLA.inputs.light, 'bg-user-message': '#f3dfe9', 'text-user-message': '#2c1723' },
    dark: { ...THECLA.inputs.dark, 'bg-user-message': '#1d1319', 'text-user-message': '#f2eaf0' },
  },
}

const PLAIN: ThemeSetArgs = { colors }

// Thecla sets every font to a monospaced face; a mod can only name the
// generic family, so it asks for mono throughout.
const LOOK: ThemeSetArgs = {
  colors,
  style: {
    Text: { fontFamily: ['mono'] },
    Heading: { fontFamily: ['mono'] },
    ToolUse: { fontFamily: ['mono'] },
  },
}

// Thecla's prompt-box edge: a thin rose -> orchid -> cyan line just above the
// prompt, at full strength. A theme can't style the message box and the
// desktop band draws no images, so the line is a row of coloured boxes in the
// band. Theme tokens don't reach the band, so the colors are fixed: Thecla's
// light-mode stops, which also read on a dark canvas.
const STOPS = ['#a32c6a', '#91376d', '#236e84'] as const
const SEGMENTS = 32
const THICKNESS = 0.1 // of a text row: a hairline

const mix = (a: string, b: string, t: number) => {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const rgb = [0, 1, 2].map(i => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t))
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')
}

// Orchid sits at 55%, as in Thecla's edge.
export const EDGE = Array.from({ length: SEGMENTS }, (_, i) => {
  const [rose, orchid, cyan] = STOPS
  const t = i / (SEGMENTS - 1)
  return t <= 0.55 ? mix(rose, orchid, t / 0.55) : mix(orchid, cyan, (t - 0.55) / 0.45)
})

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    // Only where the look itself draws; yield the band to a survey.
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.hasSurvey) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" width="100%" height={THICKNESS}>
        {EDGE.map((color, i) => (
          <Box key={String(i)} flexGrow={1} height={THICKNESS} backgroundColor={color} />
        ))}
      </Box>
    )
  })

  on('session.start', async ($, e, next) => {
    let set
    try {
      set = await $.theme.set(LOOK)
    } catch (error) {
      $.ui.log(String(error))
      set = await $.theme.set(PLAIN)
    }

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }

    return next(e)
  })
}
