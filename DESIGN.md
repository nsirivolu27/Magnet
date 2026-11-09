# Magnet application design

Magnet uses a monochrome black-and-white interface with neutral grays, sentence-case
labels, readable message text, and a persistent composer. Conversation history,
imports, sharing, and settings live in the navigation menu. Infrastructure and
cloud-provider details belong in deployment docs, not the conversation screen.

This direction replaces Magnet's previous shared magenta branding. The separate
Magentic product keeps its own design system.

## Tokens and themes

Use `apps/mobile/src/theme.ts` for native colors, `apps/mobile/src/styles.ts` for
native layout, and the root variables in `apps/web/src/styles.css` for the landing
page and advanced console. Both have neutral dark and light palettes that follow
the system preference, with dark as the fallback. No external fonts or sibling
checkout are required.

Use semantic tokens. Never write raw color utilities or opacity modifiers on CSS
variables. Legacy `--green` and `--lime` variable names are neutral compatibility
aliases used by the console; they are not colored accents.

Use system fonts, generous whitespace, subtle borders, and rounded controls.
Hierarchy comes from spacing and weight, not banners or all-caps dashboards.
Tap targets must be at least 44px. Status and errors must have text labels rather
than relying on color. Buttons need accessible labels and disabled states.

## Behavior

The composer saves human messages. Imported assistant responses retain their
source attribution; the app does not invent model replies or delivery receipts.
Show the transcript first. Put analysis and origin details behind Details, and
keep cloud infrastructure out of the primary navigation. Do not imply that an
access-controlled conversation is end-to-end encrypted.
