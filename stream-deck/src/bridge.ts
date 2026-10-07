/* ShortcutToggle — Copyright (c) 2026 Ethan. SPDX-License-Identifier: GPL-3.0-or-later */
import streamDeck from "@elgato/streamdeck";
import { WebSocket, WebSocketServer } from "ws";

export type BridgeState = { connected: boolean; disabled: boolean; busy: boolean };
type Client = {
    socket: WebSocket;
    role: "legacy" | "control" | "diagnostic";
    ready: boolean;
    disabled: boolean;
    alive: boolean;
    order: number;
    lastStateAt: number;
    waitingAt: number | null;
};
const PORT = 45873;
const STATE_TIMEOUT = 5000;
const clients = new Map<WebSocket, Client>();
const listeners = new Set<(state: BridgeState) => void>();
let server: WebSocketServer | null = null;
let serverRetry: ReturnType<typeof setTimeout> | null = null;
let activeClient: Client | null = null;
let order = 0;
let stopped = false;
let state: BridgeState = { connected: false, disabled: false, busy: false };
let pending: { client: Client; expected: boolean; timer: ReturnType<typeof setTimeout> } | null = null;

function clearPending() {
    if (pending) clearTimeout(pending.timer);
    pending = null;
}

function usable(client: Client): boolean {
    return client.ready && client.role !== "diagnostic" && client.socket.readyState === WebSocket.OPEN
        && (client.waitingAt === null || Date.now() - client.waitingAt < STATE_TIMEOUT);
}

function synchronize() {
    if (!activeClient || !clients.has(activeClient.socket) || !usable(activeClient)) {
        const previous = activeClient;
        activeClient = [...clients.values()].filter(usable).sort((a, b) => b.order - a.order)[0] ?? null;
        if (pending && previous !== activeClient) clearPending();
    }
    const next = { connected: activeClient !== null, disabled: activeClient?.disabled ?? state.disabled, busy: pending !== null };
    if (next.connected === state.connected && next.disabled === state.disabled && next.busy === state.busy) return;
    state = next;
    for (const listener of listeners) {
        try { listener(getState()); }
        catch (error) { streamDeck.logger.warn(`[Discord Shortcuts] Affichage indisponible : ${String(error)}`); }
    }
}

function drop(client: Client) {
    if (clients.get(client.socket) !== client) return;
    clients.delete(client.socket);
    if (pending?.client === client) clearPending();
    try { client.socket.terminate(); } catch {}
    synchronize();
}

function send(client: Client, message: object): boolean {
    if (clients.get(client.socket) !== client || client.socket.readyState !== WebSocket.OPEN) return false;
    try {
        client.socket.send(JSON.stringify(message), error => { if (error) drop(client); });
        return clients.get(client.socket) === client && client.socket.readyState === WebSocket.OPEN;
    } catch { drop(client); return false; }
}

function requestState(client: Client) {
    if (client.role === "diagnostic" || client.waitingAt !== null) return;
    client.waitingAt = Date.now();
    send(client, { type: "getState" });
}

function scheduleServerRetry() {
    if (stopped || serverRetry !== null) return;
    serverRetry = setTimeout(() => { serverRetry = null; startServer(); }, 2000);
}

function retireServer(current: WebSocketServer) {
    if (server !== current) return;
    server = null;
    clearPending();
    const previous = [...clients.values()];
    clients.clear(); activeClient = null;
    for (const client of previous) { try { client.socket.terminate(); } catch {} }
    try { current.close(() => {}); } catch {}
    synchronize();
    scheduleServerRetry();
}

function startServer() {
    if (stopped || server) return;
    try {
        const current = new WebSocketServer({ host: "127.0.0.1", port: PORT, maxPayload: 4096 });
        server = current;
        current.on("listening", () => streamDeck.logger.info(`[Discord Shortcuts] Connexion prête sur 127.0.0.1:${PORT}`));
        current.on("error", error => {
            streamDeck.logger.error(`[Discord Shortcuts] Serveur indisponible : ${String(error)}`);
            retireServer(current);
        });
        current.on("close", () => retireServer(current));
        current.on("connection", socket => {
            if (server !== current || stopped) { socket.terminate(); return; }
            const client: Client = { socket, role: "legacy", ready: false, disabled: false,
                alive: true, order: ++order, lastStateAt: Date.now(), waitingAt: null };
            clients.set(socket, client);
            socket.on("error", () => drop(client));
            socket.on("close", () => drop(client));
            socket.on("pong", () => { client.alive = true; });
            socket.on("message", raw => {
                if (clients.get(socket) !== client) return;
                try {
                    const message = JSON.parse(raw.toString());
                    if (message?.type === "hello" && message.protocolVersion === 1
                        && (message.role === "control" || message.role === "diagnostic")) {
                        client.role = message.role;
                        client.alive = true;
                        if (client.role === "diagnostic") { client.ready = false; client.waitingAt = null; }
                        synchronize();
                    } else if (message?.type === "state" && typeof message.disabled === "boolean" && client.role !== "diagnostic") {
                        client.disabled = message.disabled; client.ready = true; client.alive = true;
                        client.lastStateAt = Date.now(); client.waitingAt = null;
                        if (pending?.client === client && message.disabled === pending.expected) clearPending();
                        synchronize();
                    }
                } catch { streamDeck.logger.warn("[Discord Shortcuts] Message invalide ignoré"); }
            });
            requestState(client);
        });
    } catch (error) {
        streamDeck.logger.error(`[Discord Shortcuts] Démarrage impossible : ${String(error)}`);
        scheduleServerRetry();
    }
}

const heartbeat = setInterval(() => {
    for (const client of [...clients.values()]) {
        if (!client.alive || (client.waitingAt !== null && Date.now() - client.waitingAt >= STATE_TIMEOUT)) { drop(client); continue; }
        client.alive = false;
        try { client.socket.ping(undefined, undefined, error => { if (error) drop(client); }); }
        catch { drop(client); continue; }
        if (client.role !== "diagnostic" && Date.now() - client.lastStateAt >= 2000) requestState(client);
    }
    synchronize();
}, 2000);

export function subscribe(listener: (state: BridgeState) => void) {
    listeners.add(listener);
    listener(getState());
    return () => { listeners.delete(listener); };
}

export function getState(): BridgeState { return { ...state }; }

export function toggle(): boolean {
    synchronize();
    if (!activeClient || pending) return false;
    const client = activeClient;
    const command = { client, expected: !client.disabled, timer: setTimeout(() => {
        if (pending !== command) return;
        pending = null;
        if (clients.get(client.socket) === client) {
            client.ready = false; client.waitingAt = null;
            requestState(client);
        }
        synchronize();
    }, 1500) };
    pending = command;
    if (!send(client, { type: "toggle" })) { clearPending(); synchronize(); return false; }
    synchronize();
    return true;
}

export function stopBridge() {
    stopped = true;
    clearInterval(heartbeat);
    if (serverRetry !== null) clearTimeout(serverRetry);
    serverRetry = null;
    if (server) retireServer(server);
    clearPending();
}

process.once("exit", stopBridge);
startServer();
