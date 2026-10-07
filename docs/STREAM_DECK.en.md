# Install Discord Shortcuts for Stream Deck

The companion is optional. It provides the button that controls ShortcutToggle and reflects ON/OFF state.

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

## Troubleshooting

Check that Stream Deck, Discord and both plugins are running. Click **Reconnecter**, or wait for automatic retry (every two seconds). Use one installation of the companion so it can listen on local port **45873**.

No router port forwarding is needed: the server listens on loopback `127.0.0.1` only, on the same computer as Discord.

## Local protocol

Discord connects to the companion at `ws://127.0.0.1:45873`.

- Stream Deck to Discord: `{"type":"toggle"}` or `{"type":"getState"}`.
- Discord to Stream Deck: `{"type":"state","disabled":false}` for ON, `true` for OFF.

Multiple connected Discord clients receive toggle commands. Use one target session for unambiguous control.

The [official Elgato pack command](https://docs.elgato.com/streamdeck/cli/commands/pack/) validates the manifest and creates the `.streamDeckPlugin` installer. Sources are under `stream-deck/src`; the distributable folder is `stream-deck/fr.ethan.discord-shortcuts.sdPlugin`. Runtime logs are excluded.
