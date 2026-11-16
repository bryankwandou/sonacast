import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction
} from '@solana/web3.js';
import type {
  ArtistWalletStatus,
  ProofOfStreamRecord,
  SolanaCluster,
  TipRecord,
  WalletAdapterName,
  Web3TipsConfig
} from '../types';

export const PLATFORM_FEE_BPS = 1500; // 15% platform treasury fee
export const ARTIST_SHARE_BPS = 8500; // 85% creator / escrow share
export const BPS_DENOMINATOR = 10000;
export const MIN_TIP_SOL = 0.001;
export const ESTIMATED_TX_FEE_LAMPORTS = 5000;

const DEVNET_PUBLIC_RPC = 'https://api.devnet.solana.com';
const STORAGE_KEY = 'sonacast_solana_devnet_wallet_v1';
const CLUSTER_STORAGE_KEY = 'sonacast_solana_cluster_v1';

interface InjectedSolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  publicKey?: { toBase58(): string; toString(): string } | null;
  isConnected?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toBase58(): string } }>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signMessage?: (
    message: Uint8Array,
    display?: string
  ) => Promise<{ signature: Uint8Array } | Uint8Array>;
}

declare global {
  interface Window {
    phantom?: { solana?: InjectedSolanaProvider };
    solflare?: InjectedSolanaProvider;
    backpack?: InjectedSolanaProvider;
    solana?: InjectedSolanaProvider;
  }
}

export interface DetectedWalletInfo {
  id: WalletAdapterName;
  name: string;
  installed: boolean;
}

export interface SplitPreview {
  grossLamports: number;
  artistLamports: number;
  feeLamports: number;
  grossSol: number;
  artistSol: number;
  feeSol: number;
  estimatedGasSol: number;
  totalRequiredSol: number;
  feePct: number;
  artistPct: number;
}

export interface SendArtistTipParams {
  artistName: string;
  trackTitle: string;
  amountSol: number;
  explicitArtistAddress?: string;
  allowTrackDirect?: boolean;
}

export interface TipLedgerResponse {
  platformFeeBps: number;
  artistShareBps: number;
  summary: {
    totalTipsCount: number;
    totalGrossSol: number;
    totalArtistSol: number;
    totalPlatformFeeSol: number;
    unclaimedEscrowSol: number;
    verifiedArtistsCount: number;
  };
  tips: TipRecord[];
  verifiedArtists: {
    artistKey: string;
    artistName: string;
    walletAddress: string;
    verifiedAt: string | null;
  }[];
  escrowPools: {
    artistKey: string;
    artistName: string;
    tipCount: number;
    unclaimedSol: number;
  }[];
  proofOfStream: {
    totalSessions: number;
    totalSeconds: number;
    totalEstimatedSol: number;
    logs: ProofOfStreamRecord[];
  };
}

export function isValidSolanaAddress(address: string | undefined | null): boolean {
  const trimmed = String(address || '').trim();
  if (trimmed.length < 32 || trimmed.length > 48) return false;
  try {
    const pk = new PublicKey(trimmed);
    return pk.toBase58() === trimmed;
  } catch {
    return false;
  }
}

export function computeSplitPreview(amountSol: number): SplitPreview {
  const safeSol = Number.isFinite(amountSol) && amountSol > 0 ? amountSol : 0;
  const grossLamports = Math.max(0, Math.round(safeSol * LAMPORTS_PER_SOL));
  const feeLamports = Math.round((grossLamports * PLATFORM_FEE_BPS) / BPS_DENOMINATOR);
  const artistLamports = grossLamports - feeLamports;
  const estimatedGasSol = ESTIMATED_TX_FEE_LAMPORTS / LAMPORTS_PER_SOL;
  return {
    grossLamports,
    artistLamports,
    feeLamports,
    grossSol: grossLamports / LAMPORTS_PER_SOL,
    artistSol: artistLamports / LAMPORTS_PER_SOL,
    feeSol: feeLamports / LAMPORTS_PER_SOL,
    estimatedGasSol,
    totalRequiredSol: grossLamports / LAMPORTS_PER_SOL + estimatedGasSol,
    feePct: PLATFORM_FEE_BPS / 100,
    artistPct: ARTIST_SHARE_BPS / 100
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

class SolanaService {
  private devnetKeypair: Keypair;
  private cluster: SolanaCluster = 'devnet';
  private activeWalletId: WalletAdapterName | null = null;
  private browserProvider: InjectedSolanaProvider | null = null;
  private browserPublicKey: PublicKey | null = null;
  private cachedBalanceSol = 0;
  private cachedConfig: Web3TipsConfig | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    this.devnetKeypair = this.loadOrCreateDevnetWallet();
    if (typeof window !== 'undefined') {
      try {
        const storedCluster = window.localStorage.getItem(CLUSTER_STORAGE_KEY);
        if (storedCluster === 'mainnet-beta' || storedCluster === 'devnet') {
          this.cluster = storedCluster;
        }
      } catch {
        // ignore storage restrictions
      }
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        // ignore listener failure
      }
    }
  }

  private loadOrCreateDevnetWallet(): Keypair {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 64) {
          return Keypair.fromSecretKey(Uint8Array.from(parsed));
        }
      }
    } catch {
      // regenerate clean devnet test keypair
    }
    const fresh = Keypair.generate();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(fresh.secretKey)));
    } catch {
      // ignore quota failure
    }
    return fresh;
  }

  public getCluster(): SolanaCluster {
    return this.cluster;
  }

  public setCluster(nextCluster: SolanaCluster): void {
    if (this.cluster === nextCluster) return;
    this.cluster = nextCluster;
    this.cachedBalanceSol = 0;
    try {
      localStorage.setItem(CLUSTER_STORAGE_KEY, nextCluster);
    } catch {
      // ignore storage errors
    }
    this.notify();
  }

  public getDetectedWallets(): DetectedWalletInfo[] {
    if (typeof window === 'undefined') return [];
    const list: DetectedWalletInfo[] = [
      {
        id: 'phantom',
        name: 'Phantom',
        installed: Boolean(window.phantom?.solana?.isPhantom || window.solana?.isPhantom)
      },
      {
        id: 'solflare',
        name: 'Solflare',
        installed: Boolean(window.solflare?.isSolflare || window.solana?.isSolflare)
      },
      {
        id: 'backpack',
        name: 'Backpack',
        installed: Boolean(window.backpack?.isBackpack || window.solana?.isBackpack)
      }
    ];
    if (window.solana && !window.solana.isPhantom && !window.solana.isSolflare && !window.solana.isBackpack) {
      list.push({ id: 'browser', name: 'Solana Wallet', installed: true });
    }
    return list;
  }

  private getProviderById(walletId?: WalletAdapterName): InjectedSolanaProvider | null {
    if (typeof window === 'undefined') return null;
    if (walletId === 'phantom') {
      return window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null);
    }
    if (walletId === 'solflare') {
      return window.solflare || (window.solana?.isSolflare ? window.solana : null);
    }
    if (walletId === 'backpack') {
      return window.backpack || (window.solana?.isBackpack ? window.solana : null);
    }
    if (walletId === 'browser') {
      return window.solana || null;
    }
    return window.phantom?.solana || window.solflare || window.backpack || window.solana || null;
  }

  public async connectBrowserWallet(walletId?: WalletAdapterName): Promise<string> {
    const provider = this.getProviderById(walletId);
    if (!provider) {
      throw new Error(
        walletId
          ? `${walletId.charAt(0).toUpperCase() + walletId.slice(1)} browser extension was not detected.`
          : 'No Solana browser wallet extension (Phantom, Solflare, Backpack) detected.'
      );
    }
    const resp = await provider.connect();
    const pubBase58 = resp?.publicKey?.toBase58?.() || provider.publicKey?.toBase58?.() || '';
    if (!isValidSolanaAddress(pubBase58)) {
      throw new Error('Wallet extension did not return a valid Solana public key.');
    }
    this.browserProvider = provider;
    this.browserPublicKey = new PublicKey(pubBase58);
    this.activeWalletId = walletId || (provider.isPhantom ? 'phantom' : provider.isSolflare ? 'solflare' : provider.isBackpack ? 'backpack' : 'browser');
    await this.fetchBalance();
    this.notify();
    return pubBase58;
  }

  public async disconnectWallet(): Promise<void> {
    if (this.browserProvider) {
      try {
        await this.browserProvider.disconnect();
      } catch {
        // ignore provider disconnect error
      }
    }
    this.browserProvider = null;
    this.browserPublicKey = null;
    this.activeWalletId = null;
    this.cachedBalanceSol = 0;
    await this.fetchBalance();
    this.notify();
  }

  public isUsingBrowserWallet(): boolean {
    return Boolean(this.browserProvider && this.browserPublicKey);
  }

  public getActiveWalletLabel(): string {
    if (this.isUsingBrowserWallet()) {
      switch (this.activeWalletId) {
        case 'phantom':
          return 'Phantom';
        case 'solflare':
          return 'Solflare';
        case 'backpack':
          return 'Backpack';
        default:
          return 'Browser Wallet';
      }
    }
    if (this.cluster === 'devnet') {
      return 'Devnet Test Keypair';
    }
    return 'Wallet Not Connected';
  }

  public isReadyToSign(): boolean {
    if (this.cluster === 'mainnet-beta') {
      return this.isUsingBrowserWallet();
    }
    return true;
  }

  public getPublicKey(): string {
    if (this.browserPublicKey) {
      return this.browserPublicKey.toBase58();
    }
    if (this.cluster === 'devnet') {
      return this.devnetKeypair.publicKey.toBase58();
    }
    return '';
  }

  public getCachedBalance(): number {
    return this.cachedBalanceSol;
  }

  public getExplorerTxUrl(signature: string, targetCluster: SolanaCluster = this.cluster): string {
    const base = `https://explorer.solana.com/tx/${encodeURIComponent(signature)}`;
    return targetCluster === 'mainnet-beta' ? base : `${base}?cluster=devnet`;
  }

  public getExplorerAddressUrl(address: string, targetCluster: SolanaCluster = this.cluster): string {
    const base = `https://explorer.solana.com/address/${encodeURIComponent(address)}`;
    return targetCluster === 'mainnet-beta' ? base : `${base}?cluster=devnet`;
  }

  private async rpcCall<T = unknown>(
    targetCluster: SolanaCluster,
    method: string,
    params: unknown[] = []
  ): Promise<T> {
    const proxyRes = await fetch('/api/tips?action=rpc_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rpc_proxy', cluster: targetCluster, method, params })
    }).catch(() => null);

    if (proxyRes && proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && data.result !== undefined) {
        return data.result as T;
      }
    }

    if (targetCluster === 'devnet') {
      const directRes = await fetch(DEVNET_PUBLIC_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
      });
      const json = await directRes.json();
      if (json.error) {
        throw new Error(json.error.message || 'Solana Devnet RPC error');
      }
      return json.result as T;
    }

    const errPayload = proxyRes ? await proxyRes.json().catch(() => null) : null;
    throw new Error(errPayload?.error || `Solana RPC proxy unavailable for ${targetCluster}`);
  }

  public async fetchBalanceLamports(): Promise<number> {
    const addr = this.getPublicKey();
    if (!isValidSolanaAddress(addr)) {
      this.cachedBalanceSol = 0;
      return 0;
    }
    try {
      const res = await this.rpcCall<{ value?: number }>(this.cluster, 'getBalance', [
        addr,
        { commitment: 'confirmed' }
      ]);
      const lamports = Math.max(0, Number(res?.value) || 0);
      this.cachedBalanceSol = lamports / LAMPORTS_PER_SOL;
      return lamports;
    } catch {
      return Math.round(this.cachedBalanceSol * LAMPORTS_PER_SOL);
    }
  }

  public async fetchBalance(): Promise<number> {
    const lamports = await this.fetchBalanceLamports();
    return lamports / LAMPORTS_PER_SOL;
  }

  public async fetchWeb3Config(force = false): Promise<Web3TipsConfig> {
    if (this.cachedConfig && !force) return this.cachedConfig;
    const res = await fetch('/api/tips?action=config');
    if (!res.ok) {
      throw new Error('Failed to load Sonacast Web3 treasury configuration.');
    }
    const data = (await res.json()) as Web3TipsConfig;
    this.cachedConfig = data;
    return data;
  }

  public async fetchArtistStatus(
    artistName: string,
    targetCluster: SolanaCluster = this.cluster
  ): Promise<ArtistWalletStatus> {
    const q = new URLSearchParams({
      action: 'artist_status',
      artist: artistName,
      cluster: targetCluster
    });
    const res = await fetch(`/api/tips?${q.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || 'Failed to inspect artist wallet status.');
    }
    return (await res.json()) as ArtistWalletStatus;
  }

  public async fetchLedger(
    targetCluster?: SolanaCluster,
    listenerId?: string
  ): Promise<TipLedgerResponse> {
    const q = new URLSearchParams({ action: 'ledger' });
    if (targetCluster) q.set('cluster', targetCluster);
    if (listenerId) q.set('listenerId', listenerId);
    const res = await fetch(`/api/tips?${q.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || 'Failed to load Neon tipping ledger.');
    }
    return (await res.json()) as TipLedgerResponse;
  }

  private async signMessageBytes(messageBytes: Uint8Array): Promise<string> {
    if (this.browserProvider && this.browserPublicKey) {
      if (typeof this.browserProvider.signMessage !== 'function') {
        throw new Error('Connected browser wallet does not support Ed25519 signMessage.');
      }
      const signed = await this.browserProvider.signMessage(messageBytes, 'utf8');
      const sigUint8 = signed instanceof Uint8Array ? signed : signed?.signature;
      if (!(sigUint8 instanceof Uint8Array) || sigUint8.length !== 64) {
        throw new Error('Browser wallet returned an invalid Ed25519 signature.');
      }
      return uint8ToBase64(sigUint8);
    }

    if (this.cluster !== 'devnet') {
      throw new Error('Connect a browser wallet on Mainnet-Beta to sign ownership proofs.');
    }

    // Native Web Crypto Ed25519 signing using 32-byte seed wrapped in RFC 8410 PKCS8 DER header
    const seed = this.devnetKeypair.secretKey.slice(0, 32);
    const pkcs8Header = new Uint8Array([
      0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20
    ]);
    const pkcs8 = new Uint8Array(pkcs8Header.length + seed.length);
    pkcs8.set(pkcs8Header, 0);
    pkcs8.set(seed, pkcs8Header.length);

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'pkcs8',
      pkcs8,
      { name: 'Ed25519' },
      false,
      ['sign']
    );
    const msgCopy = new Uint8Array(messageBytes);
    const sigBuf = await globalThis.crypto.subtle.sign('Ed25519', cryptoKey, msgCopy);
    return uint8ToBase64(new Uint8Array(sigBuf));
  }

  public async signAndVerifyArtistWallet(artistName: string): Promise<{
    verified: boolean;
    artistName: string;
    walletAddress: string;
    unclaimedEscrowSol: number;
  }> {
    const cleanArtist = artistName.trim();
    if (!cleanArtist) {
      throw new Error('Artist name is required to verify wallet ownership.');
    }
    const walletAddress = this.getPublicKey();
    if (!isValidSolanaAddress(walletAddress)) {
      throw new Error('Connect a valid Solana wallet before verifying ownership.');
    }

    const message = [
      'Sonacast Artist Wallet Verification',
      `Artist: ${cleanArtist}`,
      `Wallet: ${walletAddress}`,
      `Issued: ${new Date().toISOString()}`
    ].join('\n');

    const signatureBase64 = await this.signMessageBytes(new TextEncoder().encode(message));
    const res = await fetch('/api/tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify_artist_wallet',
        artistName: cleanArtist,
        walletAddress,
        message,
        signatureBase64
      })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.verified) {
      throw new Error(data?.error || 'Server Ed25519 signature verification rejected.');
    }
    this.notify();
    return data;
  }

  public async requestAirdrop(): Promise<{ success: boolean; balance: number; error?: string }> {
    if (this.cluster !== 'devnet') {
      return {
        success: false,
        balance: this.cachedBalanceSol,
        error: 'Airdrop is only available on Solana Devnet.'
      };
    }
    const addr = this.getPublicKey();
    if (!isValidSolanaAddress(addr)) {
      return { success: false, balance: 0, error: 'Wallet address unavailable.' };
    }
    try {
      // Try server proxy first if a Devnet faucet secret/RPC is provisioned
      const serverRes = await fetch('/api/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'faucet_devnet', recipient: addr })
      }).catch(() => null);
      if (serverRes && serverRes.ok) {
        const serverData = await serverRes.json().catch(() => null);
        if (serverData?.signature) {
          await this.waitForSignatureConfirmation('devnet', String(serverData.signature), 22000);
          const balance = await this.fetchBalance();
          this.notify();
          return { success: true, balance };
        }
      } else if (serverRes && serverRes.status === 429) {
        const errData = await serverRes.json().catch(() => null);
        return {
          success: false,
          balance: this.cachedBalanceSol,
          error:
            errData?.error ||
            'Devnet test wallet already has enough SOL to send tips.'
        };
      }

      const resp = await fetch(DEVNET_PUBLIC_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'requestAirdrop',
          params: [addr, LAMPORTS_PER_SOL]
        })
      });
      if (resp.status === 410 || resp.status === 429) {
        return {
          success: false,
          balance: this.cachedBalanceSol,
          error:
            resp.status === 410
              ? `Solana Devnet RPC faucet is closed (HTTP 410). Copy your Devnet address (${addr.slice(0, 6)}...${addr.slice(-4)}) and request Devnet SOL at https://spigot-devnet.vercel.app or https://faucet.solana.com.`
              : 'Devnet faucet rate-limited. Open https://spigot-devnet.vercel.app or https://faucet.solana.com with your copied Devnet wallet address.'
        };
      }
      const data = await resp.json();
      if (data.error || !data.result) {
        return {
          success: false,
          balance: this.cachedBalanceSol,
          error:
            data.error?.message ||
            'Devnet faucet rate-limited this IP. Use https://faucet.solana.com with your wallet address.'
        };
      }
      await this.waitForSignatureConfirmation('devnet', String(data.result), 22000);
      const balance = await this.fetchBalance();
      this.notify();
      return { success: true, balance };
    } catch (err) {
      return {
        success: false,
        balance: this.cachedBalanceSol,
        error:
          err instanceof Error
            ? err.message
            : 'Devnet faucet rate-limited. Visit https://faucet.solana.com to fund Devnet SOL.'
      };
    }
  }

  private async waitForSignatureConfirmation(
    targetCluster: SolanaCluster,
    signature: string,
    timeoutMs = 30000
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await this.rpcCall<{
          value?: Array<{ err: unknown; confirmationStatus?: string } | null>;
        }>(targetCluster, 'getSignatureStatuses', [[signature], { searchTransactionHistory: true }]);
        const status = res?.value?.[0];
        if (status) {
          if (status.err) {
            throw new Error(`On-chain transaction reverted: ${JSON.stringify(status.err)}`);
          }
          if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
            return;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('On-chain transaction reverted')) {
          throw err;
        }
      }
      await new Promise((r) => setTimeout(r, 1400));
    }
    throw new Error('Timed out waiting for Solana confirmation. Check Explorer with your signature.');
  }

  public async sendArtistTip({
    artistName,
    trackTitle,
    amountSol,
    explicitArtistAddress,
    allowTrackDirect = false
  }: SendArtistTipParams): Promise<TipRecord> {
    const cluster = this.cluster;
    if (cluster === 'mainnet-beta' && !this.isUsingBrowserWallet()) {
      throw new Error(
        'Connect Phantom, Solflare, or Backpack before sending tips on Solana Mainnet-Beta. Test keypairs are disabled on Mainnet.'
      );
    }

    const senderAddress = this.getPublicKey();
    if (!isValidSolanaAddress(senderAddress)) {
      throw new Error('Sender Solana wallet address is invalid or disconnected.');
    }

    if (!Number.isFinite(amountSol) || amountSol < MIN_TIP_SOL) {
      throw new Error(`Minimum tip is ${MIN_TIP_SOL} SOL.`);
    }

    const [cfg, artistStatus] = await Promise.all([
      this.fetchWeb3Config(true),
      this.fetchArtistStatus(artistName, cluster)
    ]);

    const clusterCfg = cfg.clusters[cluster];
    if (!clusterCfg?.treasuryAddress || !isValidSolanaAddress(clusterCfg.treasuryAddress)) {
      throw new Error(
        cluster === 'mainnet-beta'
          ? 'Mainnet Treasury wallet is not configured on the server (SOLANA_MAINNET_TREASURY_ADDRESS).'
          : 'Devnet Treasury wallet is not configured.'
      );
    }

    let recipientAddress = '';
    let routeType: 'direct_artist' | 'escrow_vault' = 'escrow_vault';

    if (artistStatus.verified && isValidSolanaAddress(artistStatus.verifiedWallet)) {
      recipientAddress = artistStatus.verifiedWallet!;
      routeType = 'direct_artist';
    } else if (allowTrackDirect && isValidSolanaAddress(explicitArtistAddress)) {
      recipientAddress = explicitArtistAddress!.trim();
      routeType = 'direct_artist';
    } else if (isValidSolanaAddress(clusterCfg.escrowAddress)) {
      recipientAddress = clusterCfg.escrowAddress;
      routeType = 'escrow_vault';
    } else {
      throw new Error(
        `Artist "${artistName}" has not verified a Mainnet payout wallet yet and no Mainnet Escrow Vault is configured.`
      );
    }

    const split = computeSplitPreview(amountSol);
    const balanceLamports = await this.fetchBalanceLamports();
    const requiredLamports = split.grossLamports + ESTIMATED_TX_FEE_LAMPORTS;
    if (balanceLamports < requiredLamports) {
      const availSol = (balanceLamports / LAMPORTS_PER_SOL).toFixed(4);
      const reqSol = (requiredLamports / LAMPORTS_PER_SOL).toFixed(4);
      throw new Error(
        `Insufficient SOL balance (${availSol} SOL available, ${reqSol} SOL required including 0.000005 SOL gas).`
      );
    }

    const bhResult = await this.rpcCall<{
      value?: { blockhash?: string; lastValidBlockHeight?: number };
    }>(cluster, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
    const blockhash = bhResult?.value?.blockhash;
    const lastValidBlockHeight = bhResult?.value?.lastValidBlockHeight;
    if (!blockhash) {
      throw new Error(`Unable to fetch recent blockhash from Solana ${cluster} RPC.`);
    }

    const fromPubkey = new PublicKey(senderAddress);
    const recipientPubkey = new PublicKey(recipientAddress);
    const treasuryPubkey = new PublicKey(clusterCfg.treasuryAddress);

    const tx = new Transaction({
      feePayer: fromPubkey,
      blockhash,
      lastValidBlockHeight: typeof lastValidBlockHeight === 'number' ? lastValidBlockHeight : 0
    });

    if (recipientPubkey.equals(treasuryPubkey)) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: treasuryPubkey,
          lamports: split.grossLamports
        })
      );
    } else {
      tx.add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: recipientPubkey,
          lamports: split.artistLamports
        }),
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: treasuryPubkey,
          lamports: split.feeLamports
        })
      );
    }

    let signedTx: Transaction;
    if (this.isUsingBrowserWallet() && this.browserProvider) {
      signedTx = await this.browserProvider.signTransaction(tx);
    } else {
      if (cluster !== 'devnet') {
        throw new Error('Local test keypair signing is strictly blocked on Mainnet-Beta.');
      }
      tx.partialSign(this.devnetKeypair);
      signedTx = tx;
    }

    const rawBytes = signedTx.serialize();
    const rawBase64 = uint8ToBase64(new Uint8Array(rawBytes));
    const txSignature = await this.rpcCall<string>(cluster, 'sendTransaction', [
      rawBase64,
      { encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 3 }
    ]);

    if (!txSignature) {
      throw new Error('Solana RPC did not return a transaction signature.');
    }

    await this.waitForSignatureConfirmation(cluster, txSignature, 32000);
    await this.fetchBalance();
    this.notify();

    // Verify split deltas & record transaction authoritatively in Neon Postgres
    const verifyRes = await fetch('/api/tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'record_verified_tip',
        cluster,
        txSignature,
        senderWallet: senderAddress,
        recipientWallet: recipientAddress,
        treasuryWallet: clusterCfg.treasuryAddress,
        artistName,
        trackTitle,
        routeType,
        grossLamports: split.grossLamports,
        artistLamports: split.artistLamports,
        feeLamports: split.feeLamports,
        feeBps: PLATFORM_FEE_BPS,
        allowTrackDirect
      })
    });

    const verifiedJson = await verifyRes.json().catch(() => null);
    if (!verifyRes.ok || !verifiedJson?.tip) {
      throw new Error(
        verifiedJson?.error ||
        `On-chain transfer succeeded (${txSignature.slice(0, 12)}...), but Neon verification failed.`
      );
    }

    return verifiedJson.tip as TipRecord;
  }

  public async recordProofOfStream(
    listenerId: string,
    trackId: string,
    trackTitle: string,
    artistName: string,
    secondsListened: number,
    displayName = 'Listener'
  ): Promise<ProofOfStreamRecord> {
    const res = await fetch('/api/tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'log_proof_of_stream',
        listenerId,
        displayName,
        trackId,
        trackTitle,
        artistName,
        secondsListened
      })
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.record) {
      return data.record as ProofOfStreamRecord;
    }

    const units = Math.max(1, Math.round(secondsListened / 10));
    return {
      id: `pos-${Date.now().toString(36)}`,
      trackId,
      trackTitle,
      artist: artistName,
      secondsListened,
      earnedRewardSol: Number((units * 0.0001).toFixed(6)),
      verifiedOnChain: false,
      settlementStatus: 'pending_batch'
    };
  }
}

export const solanaService = new SolanaService();
