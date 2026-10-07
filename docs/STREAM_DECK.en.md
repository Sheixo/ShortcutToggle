# Install Discord Shortcuts for Stream Deck

The companion is optional. It provides the button that controls ShortcutToggle and reflects ON/OFF state.

This release pairs **ShortcutToggle 0.2.6** with **Discord Shortcuts 0.1.3.0**. Update `index.tsx`, rebuild Vencord, restart Discord and open the new companion installer for all reliability improvements.

## Requirements

- Windows 10 or later.
- Stream Deck application **7.1 or later**, as specified by the supplied manifest.
- ShortcutToggle enabled in Windows desktop Discord with Vencord.

## Installation

1. Download [fr.ethan.discord-shortcuts.streamDeckPlugin](../releases/fr.ethan.discord-shortcuts.streamDeckPlugin).
2. Open the file to install it in the Stream Deck application.
3. Add **Discord Shortcuts → Raccourcis Clavier Discord** to a key.
4. Open ShortcutToggle settings in Discord and enable **Activer la connexion Stream Deck**.
5. The status should show **Connecté**. Press the Stream Deck key and check that its state and Discord’s ON/OFF control change together.

The existing `fr.ethan.discord-shortcuts` UUID is retained so existing configured keys keep their association.

## Key state and recovery

Keys show **Hors ligne** until Discord supplies valid state, then confirmed ON/OFF, including changes made with the hotkey or Discord button. **…** indicates a pending command; extra presses are ignored until confirmation or timeout.

The companion checks connection health periodically and drops stalled connections so Discord can reconnect. It requests current state after a missing reply without replaying a toggle. Keys are refreshed when they reappear after page/profile changes, and failed display updates are retried while visible. Custom images/titles configured in Stream Deck take precedence; use defaults to see the supplied offline indicator.

## Troubleshooting

Click **Vérifier la connexion** in the plugin settings. The check takes at most five seconds and reports its time and result: a compatible companion reply, unavailable transport, an open connection without a compatible reply, interruption or state-send failure. Follow the displayed troubleshooting steps. If the companion replies while the main link is disconnected, click **Reconnecter**.

The check uses a temporary connection, sends only the current ON/OFF state and never sends a toggle command. It checks transport and the companion's existing message; test the physical button separately. Companion 0.1.3.0 distinguishes diagnostics from the control session. Previous versions retain basic message compatibility, but both components should be updated for all reliability improvements. Stalled background connections are abandoned after five seconds before retrying. The panel shows connection attempts and last contact time.

Check that Stream Deck, Discord and both plugins are running. Click **Reconnecter**, or wait for automatic retry (every two seconds). Use one installation of the companion so it can listen on local port **45873**.

No router port forwarding is needed: the server listens on loopback `127.0.0.1` only, on the same computer as Discord.

## Local protocol

Discord connects to the companion at `ws://127.0.0.1:45873`.

- Stream Deck to Discord: `{"type":"toggle"}` or `{"type":"getState"}`.
- Discord to Stream Deck: `{"type":"state","disabled":false}` for ON, `true` for OFF.
- Discord to Stream Deck: optional `{"type":"hello","role":"control","protocolVersion":1}`, or `role:"diagnostic"` for a temporary check. Legacy clients without an announcement become control candidates after valid state arrives.

The companion keeps one stable control session and sends each toggle once to that session. Another ready control session can take over if it disappears. Diagnostics do not drive the key. Use one target session for unambiguous control.

Periodic state requests and WebSocket ping/pong detect broken links. A toggle reply is awaited for 1.5 seconds before current state is requested; an unanswered state request is abandoned after five seconds.

## Check after installation

Try the key, hotkey and Discord button; quit/restart Discord and Stream Deck separately; switch pages/profiles and return to the keys; try two keys for the same action. Run the diagnostic while ON and OFF and confirm it does not toggle state. Restarting ShortcutToggle resets to ON as before.

The [official Elgato pack command](https://docs.elgato.com/streamdeck/cli/commands/pack/) validates the manifest and creates the `.streamDeckPlugin` installer. Sources are under `stream-deck/src`; the distributable folder is `stream-deck/fr.ethan.discord-shortcuts.sdPlugin`. Runtime logs are excluded.
