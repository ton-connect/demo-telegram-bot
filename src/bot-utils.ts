import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import TonConnect from '@tonconnect/sdk';

let latestTimeout: ReturnType<typeof setTimeout> | undefined;

export function markQRAsExpiredAfterTimeout(message: TelegramBot.Message): void {
    if (latestTimeout) {
        clearTimeout(latestTimeout);
    }

    latestTimeout = setTimeout(async () => {
        await bot.editMessageMedia(
            { type: 'photo', media: 'attach://expired.png' },
            {
                message_id: message.message_id,
                chat_id: message.chat.id
            }
        );

        bot.editMessageCaption('QR code expired. Generate a new one to connect wallet.', {
            message_id: message.message_id,
            chat_id: message.chat.id
        });
    }, Number(process.env.DELETE_QR_MESSAGE_TIMEOUT_MS));
}

export function deleteMessageAndStopConnectorAfterTimeout(
    message: TelegramBot.Message,
    connector: TonConnect
): void {
    setTimeout(() => {
        bot.deleteMessage(message.chat.id, message.message_id);
        connector.pauseConnection();
    }, Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS));
}

export function setQRExpiredTimeout(callback: () => void): void {
    setTimeout(callback, Number(process.env.DELETE_QR_MESSAGE_TIMEOUT_MS));
}
