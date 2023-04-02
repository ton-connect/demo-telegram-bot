import TonConnect from '@tonconnect/sdk';
import { TonConnectStorage } from './storage';
import * as process from 'process';

export function getConnector(
    chatId: number,
    options?: { stopAfterConnection?: boolean }
): TonConnect {
    const connector = new TonConnect({
        manifestUrl: process.env.MANIFEST_URL,
        storage: new TonConnectStorage(chatId)
    });

    if (options?.stopAfterConnection) {
        connector.onStatusChange(wallet => {
            if (wallet) {
                connector.pauseConnection();
            }
        });
    }

    return connector;
}
