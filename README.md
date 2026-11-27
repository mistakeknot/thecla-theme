# thecla-theme

A Claude Code mod that rethemes the desktop and mobile apps in Thecla:
luminous rose, orchid pink and cyan, on a soft pink canvas in light mode and
deep black in dark mode.

- The whole palette (surfaces, text, accents, diffs, status colors) for light and dark.
- Your messages sit on Thecla's rose wash.
- Monospaced type throughout.
- A thin rose → orchid → cyan line on the prompt box. On the desktop it sits on
  the box's top edge, fades into its rounded corners, and its colours flow
  along it at a pace set by the session: slow while idle (16 s a loop),
  faster while it works (4 s), and fastest while it waits on you for a
  permission or a question (1.4 s).
  It rests while the window is in the background unless it needs you, and
  stays still when the system asks for reduced motion.

The terminal keeps its own colors; the theme draws in the desktop and mobile apps.

## Install

At the prompt of a terminal session:

```
/plugin install thecla-theme --marketplace mistakeknot/thecla-theme
```

From a shell:

```bash
claude plugin install thecla-theme --marketplace mistakeknot/thecla-theme
```

In the desktop app, where `/plugin` does not run: click + next to the prompt
box, then Plugins, Add marketplace with `mistakeknot/thecla-theme`, then Add
plugin.

Answer `y` to add the marketplace and pick the user scope, so every session
you start afterwards loads it.

## Changing the colors

`palette.seed.json` holds the seed colors. `hooks/palette.ts` is generated from
it with the `make-colors` helper that ships with Claude Code's plugin-authoring
skill, which works out every design-system token for light and dark:

```js
import { makeColors } from './make-colors.js' // from the plugin-authoring skill
import seed from './palette.seed.json' with { type: 'json' }
console.log(JSON.stringify(makeColors(seed).theme, null, 2))
```

The prompt-box line's stops are `STOPS` in `hooks/register.tsx` (the mobile
line) and in `hooks/edge-client.tsx` (the desktop line, with its speeds in
`PERIOD`).

## Developing

```bash
claude plugin validate .
claude plugin test .
```

Once Claude Code has loaded the mod, `.claude-plugin/types/` holds its types and
`tsc -p .` type-checks it.

## Limits

- Theme tokens and images don't reach the prompt edge, so the line is a row of
  fixed-color boxes in Thecla's light-mode stops (they also read on black).
- The mobile line stays still: only the desktop draws it on its own frame clock.
- The fastest pace follows the app's permission and notification hooks and
  questions the model asks; a prompt that raises neither keeps the working pace.
- A mod can only ask for the generic monospaced family, not a specific font.

## License

MIT. See [LICENSE](LICENSE).
