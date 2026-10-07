# Changelog

## 0.2.3 — 2026-10-07

- Show an advisory conflict warning while recording and for the saved global hotkey, listing matching Discord actions.
- Include unchecked bindings and mark disabled Discord bindings as potential conflicts when re-enabled.
- Refresh warnings after keybind additions, deletions, key/action/enabled changes, and missed notifications covered by polling.
- Compare complete native chords independently of tuple order, retaining device, modifier-side and numpad distinctions.
- Preserve user choices, ON/OFF, native favorites, the Discord author profile and Stream Deck integration.
- Add 48 conflict behavior/UI checks; complete TSX compilation and all 133 simulated checks pass.

## 0.2.2 — 2026-10-07

- Add Vencord’s native Favorite button beside the ShortcutToggle title in its first settings card.
- Use Vencord’s shared favorite preference to support sorting, the Favorites filter and persistence.
- Keep the plugin classified as a userplugin and retain its real Discord author profile.
- Refresh the interactive preview and rerun full TSX compilation and 85 simulated checks.

## 0.2.1 — 2026-10-07

- Link the Authors entry to the creator’s real Discord profile so Vencord can display its avatar and open that profile.

## 0.2.0 — 2026-10-07

- Unified settings interface with ON/OFF status, hotkey keycaps and selection counts.
- Search keybinds by key or action; bulk selection with explicit filtered-result labels.
- Optional Stream Deck connection with connection status and manual reconnect.
- Preserve the previously automatic Stream Deck connection on upgrade; leave it disabled for fresh installs.
- Select existing custom keybinds on a fresh install without hard-coded personal keys.
- Update notifications for the current Vencord API.
- Add an interactive demo, French/English installation guides and an installable Stream Deck companion.
- Retain dynamic keybind reconciliation, recorded hotkey capture, Discord panel button and the existing WebSocket protocol.

## Previous personal version

- Reconcile Discord keybind additions, deletions, key/action edits and selection changes while maintaining runtime ON/OFF.
- Record a configurable global hotkey, cancel with Escape and reset to F13.
