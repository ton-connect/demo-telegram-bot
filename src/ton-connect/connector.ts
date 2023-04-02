import TonConnect from '@tonconnect/sdk';
import { TonConnectStorage } from './storage';
import * as process from 'process';

let connectorGeneratedListeners = new Map<number, (() => void)[]>();
export function onNewConnectorGenerated(chatId: number, callback: () => void): () => void {
    const listeners = connectorGeneratedListeners.get(chatId) || [];
    listeners.push(callback);
    connectorGeneratedListeners.set(chatId, listeners);

    return () => {
        const listeners = connectorGeneratedListeners.get(chatId) || [];
        connectorGeneratedListeners.set(
            chatId,
            listeners.filter(item => item !== callback)
        );
    };
}

export function getConnector(chatId: number): TonConnect {
    const connector = new TonConnect({
        manifestUrl: process.env.MANIFEST_URL,
        storage: new TonConnectStorage(chatId)
    });

    connectorGeneratedListeners.get(chatId)?.forEach(item => item());

    return connector;
}
