# thecla-theme

A Claude Code mod that rethemes the desktop and mobile apps in Thecla:
luminous rose, orchid pink and cyan, on a soft pink canvas in light mode and
deep black in dark mode.

- The whole palette (surfaces, text, accents, diffs, status colors) for light and dark.
- Your messages sit on Thecla's rose wash.
- Monospaced type throughout.
- A thin rose → orchid → cyan line just above the prompt box.

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

The prompt-box line's stops are `STOPS` in `hooks/register.tsx`.

## Developing

```bash
claude plugin validate .
claude plugin test .
```

Once Claude Code has loaded the mod, `.claude-plugin/types/` holds its types and
`tsc -p .` type-checks it.

## Limits

- The desktop band above the prompt draws no images and no theme colors, so the
  line is a row of fixed-color boxes in Thecla's light-mode stops (they also
  read on black), and it sits in the band just above the prompt box rather
  than on its border.
- A mod can only ask for the generic monospaced family, not a specific font.
