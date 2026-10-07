import {
    action,
    type KeyDownEvent,
    SingletonAction,
    type WillAppearEvent
} from "@elgato/streamdeck";

import {
    getState,
    subscribe,
    toggle
} from "../bridge";

@action({
    UUID: "fr.ethan.discord-shortcuts.toggle"
})
export class DiscordShortcutsAction
    extends SingletonAction {

    constructor() {
        super();

        subscribe(state => {
            this.actions.forEach(
                async action => {
                    if (!action.isKey())
                        return;

                    if (!state.connected) {
                        await action.setTitle("");
                        return;
                    }

                    await action.setState(
                        state.disabled ? 1 : 0
                    );

                    await action.setTitle("");
                }
            );
        });
    }

    override async onWillAppear(
        ev: WillAppearEvent
    ) {
        if (!ev.action.isKey())
            return;

        const state = getState();

        if (!state.connected) {
            await ev.action.setTitle("");
            return;
        }

        await ev.action.setState(
            state.disabled ? 1 : 0
        );

        await ev.action.setTitle("");
    }

    override async onKeyDown(
        ev: KeyDownEvent
    ) {
        if (!toggle()) {
            await ev.action.showAlert();
        }
    }
}