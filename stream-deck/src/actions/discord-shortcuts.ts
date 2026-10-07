/* ShortcutToggle — Copyright (c) 2026 Ethan. SPDX-License-Identifier: GPL-3.0-or-later */
import streamDeck, { action, type KeyDownEvent, SingletonAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import { type BridgeState, getState, subscribe, toggle } from "../bridge";

type Key = KeyDownEvent["action"];
type RenderSlot = { key: Key; active: boolean; desired: BridgeState; revision: number; applied: number;
    task: Promise<void> | null; retry: ReturnType<typeof setTimeout> | null };

@action({ UUID: "fr.ethan.discord-shortcuts.toggle" })
export class DiscordShortcutsAction extends SingletonAction {
    private readonly slots = new Map<string, RenderSlot>();

    constructor() {
        super();
        subscribe(state => { for (const slot of this.slots.values()) if (slot.active) void this.queue(slot, state); });
    }

    private queue(slot: RenderSlot, desired: BridgeState): Promise<void> {
        slot.desired = { ...desired }; slot.revision++;
        if (slot.task) return slot.task;
        slot.task = this.render(slot).finally(() => {
            slot.task = null;
            if (!slot.active) this.slots.delete(slot.key.id);
            else if (slot.applied !== slot.revision) void this.queue(slot, slot.desired);
        });
        return slot.task;
    }

    private async render(slot: RenderSlot) {
        while (slot.active && slot.applied !== slot.revision) {
            const revision = slot.revision, state = slot.desired;
            const current = () => slot.active && revision === slot.revision;
            try {
                await slot.key.setState(state.disabled ? 1 : 0);
                if (!current()) continue;
                await slot.key.setImage(state.connected ? undefined : "imgs/disconnected.svg");
                if (!current()) continue;
                await slot.key.setTitle(!state.connected ? "Hors ligne" : state.busy ? "…" : undefined);
                if (!current()) continue;
                slot.applied = revision;
                if (slot.retry !== null) { clearTimeout(slot.retry); slot.retry = null; }
            } catch (error) {
                streamDeck.logger.warn(`[Discord Shortcuts] Actualisation du bouton impossible : ${String(error)}`);
                slot.applied = revision;
                if (slot.active && slot.retry === null) slot.retry = setTimeout(() => {
                    slot.retry = null;
                    if (slot.active) void this.queue(slot, getState());
                }, 1000);
                return;
            }
        }
    }

    override onWillAppear(ev: WillAppearEvent) {
        if (!ev.action.isKey()) return;
        let slot = this.slots.get(ev.action.id);
        if (!slot) {
            slot = { key: ev.action, active: true, desired: getState(), revision: 0, applied: -1, task: null, retry: null };
            this.slots.set(ev.action.id, slot);
        } else { slot.key = ev.action; slot.active = true; }
        return this.queue(slot, getState());
    }

    override onWillDisappear(ev: WillDisappearEvent) {
        const slot = this.slots.get(ev.action.id);
        if (!slot) return;
        slot.active = false;
        if (slot.retry !== null) clearTimeout(slot.retry);
        slot.retry = null;
        if (!slot.task) this.slots.delete(ev.action.id);
    }

    override async onKeyDown(ev: KeyDownEvent) {
        if (getState().busy) return;
        if (!toggle()) {
            try { await ev.action.showAlert(); }
            catch (error) { streamDeck.logger.warn(`[Discord Shortcuts] Alerte indisponible : ${String(error)}`); }
        }
    }
}
