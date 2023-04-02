import TonConnect, { isWalletInfoRemote, WalletInfoRemote } from '@tonconnect/sdk';

export async function getWallets(): Promise<WalletInfoRemote[]> {
    const wallets = await TonConnect.getWallets(); // TODO add force refresh param
    return wallets.filter(isWalletInfoRemote);
}
