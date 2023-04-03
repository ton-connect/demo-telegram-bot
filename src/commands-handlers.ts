import {
    CHAIN,
    isWalletInfoRemote,
    toUserFriendlyAddress,
    UserRejectsError
} from '@tonconnect/sdk';
import { bot } from './bot';
import { getWallets } from './ton-connect/wallets';
import QRCode from 'qrcode';
import TelegramBot from 'node-telegram-bot-api';
import { getConnector } from './ton-connect/connector';
import { pTimeout, pTimeoutException } from './utils';

let newConnectRequestListeners: (() => void)[] = [];

export async function handleConnectCommand(msg: TelegramBot.Message): Promise<void> {
    newConnectRequestListeners.forEach(callback => callback());
    let wasMessageDeleted = false;

    const chatId = msg.chat.id;
    const wallets = await getWallets();

    const connector = getConnector(chatId, () => {
        unsubscribe();
        if (!wasMessageDeleted) {
            markQRAsExpired(botMessage);
        }
    });

    await connector.restoreConnection();
    if (connector.connected) {
        await bot.sendMessage(
            chatId,
            `You have already connect a ${
                connector.wallet!.device.appName
            } wallet\nYour address: ${toUserFriendlyAddress(
                connector.wallet!.account.address,
                connector.wallet!.account.chain === CHAIN.TESTNET
            )}\n\n Disconnect wallet firstly to connect a new one`
        );

        return;
    }

    const unsubscribe = connector.onStatusChange(wallet => {
        if (wallet) {
            bot.sendMessage(chatId, `${wallet.device.appName} wallet connected successfully`);
            unsubscribe();
        }
    });

    const link = connector.connect(wallets);
    const image = await QRCode.toBuffer(link);

    const botMessage = await bot.sendPhoto(chatId, image, {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'Open Wallet',
                        url: `https://ton-connect.github.io/open-tc?connect=${encodeURIComponent(
                            link
                        )}`
                    },
                    {
                        text: 'Choose a Wallet',
                        callback_data: JSON.stringify({ method: 'chose_wallet' })
                    }
                ]
            ]
        }
    });

    const callback = async (): Promise<void> => {
        unsubscribe();
        await bot.deleteMessage(chatId, botMessage.message_id);
        wasMessageDeleted = true;
        newConnectRequestListeners = newConnectRequestListeners.filter(item => item !== callback);
    };

    newConnectRequestListeners.push(callback);
}

export async function handleSendTXCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    const connector = getConnector(chatId);

    await connector.restoreConnection();
    if (!connector.connected) {
        await bot.sendMessage(chatId, 'Connect wallet to send transaction');
        return;
    }

    const wallets = await connector.getWallets();

    pTimeout(
        connector.sendTransaction({
            validUntil: Math.round(
                (Date.now() + Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS)) / 1000
            ),
            messages: [
                {
                    amount: '1000000',
                    address: '0:E69F10CC84877ABF539F83F879291E5CA169451BA7BCE91A37A5CED3AB8080D3'
                }
            ]
        }),
        Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS)
    )
        .then(() => {
            bot.sendMessage(chatId, `Transaction sent successfully`);
        })
        .catch(e => {
            if (e === pTimeoutException) {
                bot.sendMessage(chatId, `Transaction was not confirmed`);
                return;
            }

            if (e instanceof UserRejectsError) {
                bot.sendMessage(chatId, `You rejected the transaction`);
                return;
            }

            bot.sendMessage(chatId, `Unknown error happened`);
        })
        .finally(() => connector.pauseConnection());

    let deeplink = '';
    const walletInfo = wallets.find(wallet => wallet.name === connector.wallet!.device.appName);
    if (walletInfo && isWalletInfoRemote(walletInfo)) {
        deeplink = walletInfo.universalLink;
    }

    await bot.sendMessage(
        chatId,
        `Open ${connector.wallet!.device.appName} and confirm transaction`,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Open Wallet',
                            url: deeplink
                        }
                    ]
                ]
            }
        }
    );
}

export async function handleDisconnectCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    const connector = getConnector(chatId);

    await connector.restoreConnection();
    if (!connector.connected) {
        await bot.sendMessage(chatId, "You didn't connect a wallet");
        return;
    }

    connector
        .disconnect()
        .then(() => {
            bot.sendMessage(chatId, `Wallet has been disconnected`);
        })
        .catch(() => {
            bot.sendMessage(chatId, `Unknown error happened`);
        });
}

export async function handleShowMyWalletCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    const connector = getConnector(chatId);

    await connector.restoreConnection();
    if (!connector.connected) {
        await bot.sendMessage(chatId, "You didn't connect a wallet");
        return;
    }

    await bot.sendMessage(
        chatId,
        `Connected wallet: ${
            connector.wallet!.device.appName
        }\nYour address: ${toUserFriendlyAddress(
            connector.wallet!.account.address,
            connector.wallet!.account.chain === CHAIN.TESTNET
        )}`
    );
}

async function markQRAsExpired(message: TelegramBot.Message): Promise<void> {
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
}
