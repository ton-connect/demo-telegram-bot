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

export async function handleConnectCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const wallets = await getWallets();

    const connector = getConnector(chatId, { stopAfterConnection: true });

    connector.onStatusChange(wallet => {
        if (wallet) {
            bot.sendMessage(chatId, `${wallet.device.appName} wallet connected successfully`);
        }
    });

    const link = connector.connect(wallets);
    const image = await QRCode.toBuffer(link);

    await bot.sendPhoto(chatId, image, {
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

    connector
        .sendTransaction({
            validUntil: Date.now(),
            messages: [
                {
                    amount: '1000000',
                    address: '0:E69F10CC84877ABF539F83F879291E5CA169451BA7BCE91A37A5CED3AB8080D3'
                }
            ]
        })
        .then(() => {
            bot.sendMessage(chatId, `Transaction sent successfully`);
        })
        .catch(e => {
            if (e instanceof UserRejectsError) {
                bot.sendMessage(chatId, `You rejected the transaction`);
            } else {
                bot.sendMessage(chatId, `Unknown error happened`);
            }
        });

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
