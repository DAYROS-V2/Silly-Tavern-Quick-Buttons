# Quick Format

Quick Format is a SillyTavern extension that adds a movable formatting toolbar, AI spellchecking, mood rewriting, auto-reply drafting, and mobile-friendly utility buttons directly above the chat input.

It is built for people who write a lot in SillyTavern and want fast text cleanup without leaving the message box.

## Features

- Movable quick-format toolbar for the chat input
- Mobile-friendly floating and docked layouts
- Optional grouped widget mode for a compact 1x4 or 2x2 tool cluster
- Action, dialogue, OOC, and code formatting buttons
- Toggle-style wrapping: press the same format again to unwrap selected text
- AI spellcheck/rewrite button for the current draft
- Mood/tone rewrite menu with editable presets
- Auto-reply drafting using recent chat context
- Undo button for restoring the previous draft after an AI tool runs
- Global API mode, or separate API settings per tool
- OpenRouter and OpenAI-compatible endpoint support
- Custom base URL support for compatible providers
- Manual persona box with `{{persona}}` prompt replacement
- Optional debug logging for troubleshooting API payloads
- Position, scale, z-index, and visibility controls

## Installation

Install it like any other SillyTavern third-party extension.

Option 1: Extension installer

1. Open SillyTavern.
2. Go to Extensions.
3. Paste the repository URL into the extension install box.
4. Install and enable Quick Format.

Option 2: Manual install

1. Place this folder here:

```text
SillyTavern/public/scripts/extensions/third-party/Quick-Format
```

2. Restart SillyTavern or reload the browser tab.
3. Enable the extension in the Extensions panel.

## Quick Start

1. Open Extensions, then Quick Format.
2. Turn on Enable Extension.
3. Choose Connect All Models if you want one API setup for spellcheck, moods, and auto-reply.
4. Pick OpenRouter or OpenAI.
5. Paste your API key.
6. Click Fetch Models and choose a model.
7. Type something in the chat input and press the wand button to test spellcheck.

If you only want the formatting toolbar and do not want AI tools, leave the API fields empty and hide the extra widgets.

## Toolbar Buttons

Quick Format can show these text buttons:

- `*` wraps text in `*action*`
- `"` wraps text in dialogue quotes
- `(OOC)` wraps text as an OOC note
- `` ``` `` wraps text in code/thought fences

You can enable or hide each button in Toolbar & Layout.

## Mobile Controls

Quick Format is designed to be usable on mobile screens.

- Use Docked mode to keep the main toolbar attached near the input box.
- Use Floating mode if you want to drag the toolbar higher.
- Double tap any Quick Format toolbar/widget to unlock edit mode.
- Drag the toolbar or widgets while edit mode is unlocked.
- Press the lock button to save the layout.
- Use Reset All Positions if a widget ends up somewhere annoying.
- Use Group Widgets to combine spellcheck, undo, moods, and auto-reply into one compact tool cluster.

The extension clamps dragged items inside the visible screen area so they do not vanish off the side of the phone UI.

## AI Tools

### Spellcheck

The wand button sends your current draft to the configured model and replaces it with the corrected version.

Default behavior: fix grammar and spelling only, then return the corrected text.

### Moods

The brain button opens a mood menu. Each mood has:

- Label
- FontAwesome icon class
- Prompt text

The selected mood rewrites your current draft with the chosen tone. You can add or remove moods in settings.

Tap a mood to use it. Hold a mood, or right-click it on desktop, to edit its name, icon, or prompt.

### Auto-Reply

The comment button asks the model to draft the next response using recent chat context.

If your message box already has text, the model treats it like a partial thought to continue. If the box is empty, it drafts a fresh reply from the recent chat context.

### Undo

The undo button restores the text that was in the message box before the last AI tool changed it.

## Prompt Macros

Quick Format supports a small set of prompt replacements:

- `{{persona}}` is replaced with the text from Universal Persona (Manual Paste)
- `{{user}}` is replaced with the active SillyTavern user name when available

If your prompt does not include `{{persona}}`, Quick Format appends the manual persona block automatically when the persona box has text.

## API Notes

Quick Format talks to OpenAI-style chat completion endpoints.

Built-in provider presets:

- OpenRouter: `https://openrouter.ai/api/v1`
- OpenAI: `https://api.openai.com/v1`

You can edit the Base URL field for other compatible endpoints.

Your API key is saved wherever SillyTavern stores extension settings. Treat exported settings files like secrets if they contain keys.

## Troubleshooting

No buttons show up:

- Make sure Enable Extension is turned on.
- Reload the browser tab after installing.
- Check that `index.js`, `style.css`, `settings.html`, and `manifest.json` are all in the extension folder.

AI button says API key missing:

- Add a key in Global API Settings if Connect All Models is enabled.
- If Connect All Models is disabled, add a key in the specific tool section.

Models will not fetch:

- Confirm the provider is correct.
- Confirm the Base URL ends with `/v1` for OpenAI-compatible APIs.
- Confirm the key has permission to list models.
- Turn on Debug Logging only while troubleshooting.

Toolbar is in the wrong place:

- Double tap the toolbar to unlock edit mode and drag it.
- Use Reset All Positions from settings.
- Lower the Scale slider if the toolbar is too large for your screen.

Mood icons look wrong:

- Use free FontAwesome classes such as `fa-heart`, `fa-fire`, or `fa-face-smile`.
- Quick Format automatically adds `fa-solid` if you only enter the icon name.

## What's New In 1.1.0

- Cleaner settings UI with grouped top toggles
- Safer mood rendering for custom mood labels, icons, and prompts
- Mobile drag clamping so widgets stay on screen
- Fixed touch drag cleanup to avoid stuck mobile drag listeners
- Fixed model dropdown handling for unusual model IDs
- Added debug logging toggle
- Added provider base URL presets when switching OpenRouter/OpenAI
- Removed bold and spoiler buttons to keep the toolbar focused for roleplay
- Added long-press mood editing from the mood menu
- Active stop state now only appears on the AI tool currently generating
- Replaced blue settings accents with white accents
- Improved undo state handling
- Added toggle unwrap behavior for formatting buttons
- Added README and cleaned manifest metadata

## Files

```text
index.js       Main extension logic
style.css      Toolbar and settings styling
settings.html  SillyTavern settings panel
manifest.json  Extension metadata
README.md      This file
```

## License

Add your preferred license before publishing if this fork is going public.
