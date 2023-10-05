import TelegramBot, { CallbackQuery } from 'node-telegram-bot-api';
import { getWalletInfo, getWallets } from './ton-connect/wallets';
import { bot } from './bot';
import { getConnector } from './ton-connect/connector';
import QRCode from 'qrcode';
import * as fs from 'fs';
import { isTelegramUrl, isWalletInfoRemote } from '@tonconnect/sdk';
import { addTGReturnStrategy, buildUniversalKeyboard } from './utils';

export const walletMenuCallbacks = {
    chose_wallet: onChooseWalletClick,
    select_wallet: onWalletClick,
    universal_qr: onOpenUniversalQRClick
};
async function onChooseWalletClick(query: CallbackQuery, _: string): Promise<void> {
    const wallets = await getWallets();

    await bot.editMessageReplyMarkup(
        {
            inline_keyboard: [
                wallets.map(wallet => ({
                    text: wallet.name,
                    callback_data: JSON.stringify({ method: 'select_wallet', data: wallet.appName })
                })),
                [
                    {
                        text: '« Back',
                        callback_data: JSON.stringify({
                            method: 'universal_qr'
                        })
                    }
                ]
            ]
        },
        {
            message_id: query.message?.message_id,
            chat_id: query.message?.chat.id
        }
    );
}

async function onOpenUniversalQRClick(query: CallbackQuery, _: string): Promise<void> {
    const chatId = query.message!.chat.id;
    const wallets = await getWallets();

    const connector = getConnector(chatId);

    const link = connector.connect(wallets);

    await editQR(query.message!, link);

    const keyboard = await buildUniversalKeyboard(link, wallets);

    await bot.editMessageReplyMarkup(
        {
            inline_keyboard: [keyboard]
        },
        {
            message_id: query.message?.message_id,
            chat_id: query.message?.chat.id
        }
    );
}

async function onWalletClick(query: CallbackQuery, data: string): Promise<void> {
    const chatId = query.message!.chat.id;
    const connector = getConnector(chatId);

    const selectedWallet = await getWalletInfo(data);
    if (!selectedWallet) {
        return;
    }

    let buttonLink = connector.connect({
        bridgeUrl: selectedWallet.bridgeUrl,
        universalLink: selectedWallet.universalLink
    });

    let qrLink = buttonLink;

    if (isTelegramUrl(selectedWallet.universalLink)) {
        buttonLink = addTGReturnStrategy(buttonLink, process.env.TELEGRAM_BOT_LINK!);
        qrLink = addTGReturnStrategy(qrLink, 'none');
    }

    await editQR(query.message!, qrLink);

    await bot.editMessageReplyMarkup(
        {
            inline_keyboard: [
                [
                    {
                        text: '« Back',
                        callback_data: JSON.stringify({ method: 'chose_wallet' })
                    },
                    {
                        text: `Open ${selectedWallet.name}`,
                        url: buttonLink
                    }
                ]
            ]
        },
        {
            message_id: query.message?.message_id,
            chat_id: chatId
        }
    );
}

async function editQR(message: TelegramBot.Message, link: string): Promise<void> {
    const fileName = 'QR-code-' + Math.round(Math.random() * 10000000000);

    await QRCode.toFile(`./${fileName}`, link);

    await bot.editMessageMedia(
        {
            type: 'photo',
            media: `attach://${fileName}`
        },
        {
            message_id: message?.message_id,
            chat_id: message?.chat.id
        }
    );

    await new Promise(r => fs.rm(`./${fileName}`, r));
}
