import streamDeck from "@elgato/streamdeck";

import "./bridge";
import { initializeInspector, startCompanionUpdates } from "./inspector";

import {
    DiscordShortcutsAction
} from "./actions/discord-shortcuts";

streamDeck.actions.registerAction(
    new DiscordShortcutsAction()
);

initializeInspector();
streamDeck.connect().then(startCompanionUpdates).catch(() => {
    streamDeck.logger.error("[Discord Shortcuts] Initialisation Stream Deck indisponible");
});
