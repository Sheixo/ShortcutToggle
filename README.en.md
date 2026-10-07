# ShortcutToggle

[Français](README.md)

Enable or suspend selected custom Discord keybinds using a Discord button, a global keyboard shortcut, or a Stream Deck.

**Version 0.2.3** · French settings interface · **Discord desktop on Windows** · Independent community plugin.

## Features

- Visible ON/OFF status and a button next to Discord’s microphone/headphone controls.
- A favorite star in the first settings card pins ShortcutToggle to the top of Vencord’s plugin list and remembers that preference.
- Record a global hotkey by pressing and releasing keys. Escape cancels; a reset button restores F13.
- Warn when the same complete chord is already assigned to a Discord action, both during recording and for the saved hotkey.
- Search keybinds by key or action, select them in bulk, and view selection counts.
- Bulk actions affect only search results when a filter is active; their labels reflect this scope.
- Add, delete, edit and select keybinds without changing the current ON/OFF state.
- New keybinds are selected automatically. Editing an unchecked keybind does not select it again.
- Keybinds disabled in Discord remain disabled, including when ShortcutToggle returns to ON.
- Optional Stream Deck connection with visible status and automatic/manual reconnection.

ON allows selected keybinds to run. OFF suppresses their actions. Unchecked keybinds remain available.

## Preview

After downloading the repository, open [the interactive preview](docs/apercu.html) in your browser. It uses the plugin’s components with demo data and does not modify Discord. Its theme button affects the preview only. Record G or B to try the conflict warning.

## Install the Vencord plugin

1. Use a Vencord installation built from source, as explained in the [official custom-plugin guide](https://docs.vencord.dev/installing/custom-plugins/).
2. Copy this repository’s `shortcutToggle` folder into `Vencord/src/userplugins/`.
3. From your Vencord folder, run `pnpm build` (`pnpm.cmd build` in Windows PowerShell).
4. Fully quit Discord, including its system-tray process, then restart it.
5. Enable **ShortcutToggle** under **Settings → Vencord → Plugins** and open its settings.

To update, replace `src/userplugins/shortcutToggle/index.tsx`, rebuild, and restart Discord. An already injected installation normally does not require reinjection for this update.

A fresh installation selects existing custom keybinds and leaves Stream Deck disabled. Upgrading our previous version retains its selection and enables the previously automatic Stream Deck connection. ON/OFF resets to ON when the plugin starts; it is not persisted between restarts.

## Record a hotkey

Press **Enregistrer un raccourci**, press a key with optional Ctrl, Shift, Alt or Windows modifiers, then release all keys. Letters, digits, F1–F24, navigation keys and common numeric-keypad keys are supported; right-side modifiers are distinguished.

Escape, window blur, or closing settings cancels capture. The global hotkey and captured custom Discord actions are suppressed while recording. Changes to Discord keybinds update the list automatically.

The conflict warning lists matching Discord actions, including bindings unchecked in ShortcutToggle. Disabled Discord bindings are marked as potential conflicts if re-enabled. Adding, deleting or editing a binding refreshes the warning. It is advisory and allows you to retain the chord.

Comparison uses complete chords found in Discord’s keybind store, independently of tuple order. Keyboard/mouse devices, left/right modifiers and numeric-keypad keys remain distinct. Shortcuts from other applications and fixed Discord shortcuts absent from the store cannot be detected.

## Optional Stream Deck integration

See the [English Stream Deck guide](docs/STREAM_DECK.en.md). The companion **Discord Shortcuts 0.1.2.0** source and assets are under `stream-deck/`; its installer is under `releases/`.

The connection uses loopback `127.0.0.1:45873` only, exchanging ON/OFF state and toggle commands. No Discord account or token is requested. Keyboard and Discord-button controls work without the integration.

## Development

Run `npm install` followed by `npm test` to compile the complete TSX source and run simulated behavior/UI-control tests.

For semantic checking against a Vencord checkout:

```powershell
npm run typecheck -- "C:\path\to\Vencord"
```

Build the companion using `npm --prefix stream-deck ci` and `npm --prefix stream-deck run build`.

Package it using:

```powershell
npx --prefix stream-deck streamdeck pack stream-deck/fr.ethan.discord-shortcuts.sdPlugin --output releases --no-update-check
```

The preparation report is in [VALIDATION.fr.md](docs/VALIDATION.fr.md). Tests are simulated unless stated otherwise; installation still needs to be checked in Discord and the Stream Deck application.

## Compatibility and project status

This release targets Windows desktop Discord. Browser, Linux and macOS support is not claimed. Discord’s internal APIs may change; report reproducible steps and your Discord/Vencord versions when a regression occurs. Never include account tokens or session files in reports.

Development was assisted by **Codex**. This repository is independent of Vencord, Discord and Elgato. Official Vencord inclusion would require their review and compliance with their [contribution rules](https://github.com/Vendicated/Vencord/blob/main/CONTRIBUTING.md).

License: [GPL-3.0-or-later](LICENSE). Bundled companion dependencies retain their licenses: [third-party notices](stream-deck/THIRD_PARTY_NOTICES.txt).
