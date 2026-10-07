import streamDeck from "@elgato/streamdeck";
import {
    WebSocket,
    WebSocketServer
} from "ws";

type State = {
    connected: boolean;
    disabled: boolean;
};

type Listener =
    (state: State) => void;

const PORT = 45873;

let disabled = false;
let connected = false;

const listeners =
    new Set<Listener>();

streamDeck.logger.info(
    `[Discord Shortcuts] Démarrage du bridge sur 127.0.0.1:${PORT}`
);

const wss =
    new WebSocketServer({
        host: "127.0.0.1",
        port: PORT
    });

wss.on("listening", () => {
    streamDeck.logger.info(
        `[Discord Shortcuts] WebSocket prêt sur 127.0.0.1:${PORT}`
    );
});

wss.on("error", error => {
    streamDeck.logger.error(
        `[Discord Shortcuts] Erreur WebSocket: ${String(error)}`
    );
});

function emit() {
    const state = {
        connected,
        disabled
    };

    for (const listener of listeners) {
        listener(state);
    }
}

wss.on("connection", socket => {
    connected = true;

    streamDeck.logger.info(
        "[Discord Shortcuts] Vencord connecté"
    );

    emit();

    socket.send(
        JSON.stringify({
            type: "getState"
        })
    );

    socket.on(
        "message",
        raw => {
            try {
                const msg =
                    JSON.parse(
                        raw.toString()
                    );

                if (
                    msg.type === "state"
                ) {
                    disabled =
                        Boolean(
                            msg.disabled
                        );

                    connected = true;

                    emit();

                    streamDeck.logger.info(
                        `[Discord Shortcuts] État reçu : ${
                            disabled
                                ? "OFF"
                                : "ON"
                        }`
                    );
                }

            } catch (error) {
                streamDeck.logger.error(
                    `[Discord Shortcuts] Message invalide: ${String(error)}`
                );
            }
        }
    );

    socket.on("close", () => {
        if (
            wss.clients.size === 0
        ) {
            connected = false;

            streamDeck.logger.info(
                "[Discord Shortcuts] Vencord déconnecté"
            );

            emit();
        }
    });
});

export function subscribe(
    listener: Listener
) {
    listeners.add(listener);

    listener({
        connected,
        disabled
    });

    return () => {
        listeners.delete(listener);
    };
}

export function toggle() {
    let sent = false;

    for (
        const client
        of wss.clients
    ) {
        if (
            client.readyState
            === WebSocket.OPEN
        ) {
            client.send(
                JSON.stringify({
                    type: "toggle"
                })
            );

            sent = true;
        }
    }

    return sent;
}

export function getState():
    State {
    return {
        connected,
        disabled
    };
}