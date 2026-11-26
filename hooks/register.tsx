import { atom, read, update } from 'claude-code'
import type { Register, ThemeColors, ThemeSetArgs } from 'claude-code'

import type { EdgeStatus } from './edge-client.js'
import { THECLA } from './palette.js'

// Whether the session waits on the person, for the desktop edge's pace.
export const isAsking = atom({ plugin: 'thecla-theme', key: 'isAsking' } as const, false)
// Notifications that mean a prompt is up; 'idle_prompt' is only idle.
const ASKING_NOTICES = new Set(['permission_prompt', 'elicitation_dialog'])

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

// Thecla's prompt-box edge: a thin rose -> orchid -> cyan line on the top of
// the prompt, at full strength. A theme can't style the message box and these
// sites draw no images, so the line is a row of coloured boxes. Theme tokens
// don't reach them either, so the colors are fixed: Thecla's light-mode stops,
// which also read on a dark canvas.
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

// The band's width in cells, as the desktop last told the AbovePrompt hook:
// the floating strip spans it. Module state, refilled on every draw.
let promptColumns: number | undefined

// The float counts in a narrower cell than the band, and the band's body sits
// inside a padded panel, so the message box is wider than `bodyColumns` says.
// Measured on the desktop: the box spans bodyColumns * 1.136 + 2.3 float
// cells, and its right edge stands 1.15 cells left of the gutter cell.
const BAND_TO_FLOAT = 1.136
const BAND_PADDING = 2.3
const GUTTER = 1.15
const boxColumns = (bodyColumns: number) => bodyColumns * BAND_TO_FLOAT + BAND_PADDING
// A reload clears `promptColumns`, and the float can draw before the band
// reports again, with nothing to redraw it after. Until the band reports, the
// box is taken from the pane: measured, a 102-cell pane held a 95.45-cell box.
const PANE_MARGIN = 6.55

// The box's corners round off over about 1.6 float cells, so a line that runs
// to the box's edge overhangs them. Each end runs on into its corner, half a
// cell short of the edge, and fades to clear over its last cells
// (edge-client.tsx), so the line reads as the border, not a tangent laid on it.
const CORNER = 0.5

export const register: Register = on => {
  // Mobile draws the strip in the band above the prompt. The desktop wraps the
  // band in a padded panel, so there the band stays empty and only reports its
  // width; the strip floats on the message box's top edge instead (below).
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.surface === 'desktop') {
      promptColumns = e.props.bodyColumns
      return next(e)
    }
    if (e.surface !== 'mobile' || e.props.hasSurvey) {
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

  // The desktop: a cell of width 0 at the prompt's right edge, whose floating
  // Box stands on the message box's top edge and reaches left across it. It
  // takes no room and draws no panel; its ends fade into the rounded corners.
  on('ui.render', { component: 'BesidePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop') {
      return next(e)
    }

    const { Box, Client } = $.ui.resolve(e)
    const { floatColumns } = e.props
    const box = promptColumns ? boxColumns(promptColumns) : floatColumns - PANE_MARGIN
    const span = Math.min(box, floatColumns - GUTTER)
    // The app draws the line itself (edge-client.tsx), so the colours flow on
    // its frame clock; the hook only says how fast.
    const status: EdgeStatus = (await read($, isAsking)) ? 'asking' : e.props.isWorking ? 'working' : 'idle'
    return (
      <Box width={0} height={0}>
        <Box position="absolute" anchor="above" bottom={0} right={GUTTER + CORNER} left={-span - GUTTER + CORNER} height={THICKNESS} flexDirection="row">
          <Client key="edge" module="./edge-client.tsx" props={{ status }} width="100%" height={THICKNESS} />
        </Box>
      </Box>
    )
  })

  // Waiting on the person: a permission prompt or a form the session raised,
  // or a question the model put. Any of them speeds the edge up.
  on('classic.PermissionRequest', async ($, e, next) => {
    if (!(await read($, isAsking))) await update($, isAsking, () => true)
    return next(e)
  })
  on('classic.Notification', async ($, e, next) => {
    if (ASKING_NOTICES.has(e.notification_type) && !(await read($, isAsking))) await update($, isAsking, () => true)
    return next(e)
  })
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    if (!(await read($, isAsking))) await update($, isAsking, () => true)
    try {
      return await next(e)
    } finally {
      if (await read($, isAsking)) await update($, isAsking, () => false)
    }
  })
  // The person has answered once a tool runs, they send a prompt, or the turn ends.
  on('tool.run', async ($, e, next) => {
    if (await read($, isAsking)) await update($, isAsking, () => false)
    return next(e)
  })
  on('prompt.submit', async ($, e, next) => {
    if (await read($, isAsking)) await update($, isAsking, () => false)
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    if (await read($, isAsking)) await update($, isAsking, () => false)
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    let set
    try {
      set = await $.theme.set(LOOK)
    } catch (error) {
      $.ui.log(String(error))
      set = await $.theme.set(PLAIN)
    }

    // A reload can run with no app attached yet; the theme still applies once
    // one is, so the reason goes to the debug log, not the status line.
    $.ui.status(undefined)
    if (!set.isDrawn) {
      $.ui.log(set.reason, { to: 'debug' })
    }

    return next(e)
  })
}
