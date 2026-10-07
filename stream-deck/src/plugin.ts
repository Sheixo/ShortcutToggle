import streamDeck from "@elgato/streamdeck";

import "./bridge";

import {
    DiscordShortcutsAction
} from "./actions/discord-shortcuts";

streamDeck.actions.registerAction(
    new DiscordShortcutsAction()
);

streamDeck.connect();