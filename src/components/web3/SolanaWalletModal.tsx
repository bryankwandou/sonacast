import React, { useState, useEffect, useCallback } from 'react';
import {
  solanaService,
  computeSplitPreview,
  PLATFORM_FEE_BPS,
  ARTIST_SHARE_BPS,
  MIN_TIP_SOL,
  type DetectedWalletInfo,
  type TipLedgerResponse
} from '../../services/solanaService';
import type { ArtistWalletStatus, SolanaCluster, TipRecord, Web3TipsConfig } from '../../types';
import {
  Wallet,
  Coins,
  ArrowUpRight,
  Copy,
  Check,
  RefreshCw,
  X,
  ShieldCheck,
  Lock,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  BarChart3,
  Plug
} from 'lucide-react';

interface SolanaWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeArtistName?: string;
  activeArtistAddress?: string;
  activeTrackTitle?: string;
}

type ModalTab = 'tip' | 'claim' | 'ledger';

export const SolanaWalletModal: React.FC<SolanaWalletModalProps> = ({
  isOpen,
  onClose,
  activeArtistName = 'Queen',
  activeArtistAddress = '',
  activeTrackTitle = 'Bohemian Rhapsody'
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('tip');
  const [cluster, setCluster] = useState<SolanaCluster>(solanaService.getCluster());
  const [publicKey, setPublicKey] = useState<string>(solanaService.getPublicKey());
  const [walletLabel, setWalletLabel] = useState<string>(solanaService.getActiveWalletLabel());
  const [usingBrowserWallet, setUsingBrowserWallet] = useState<boolean>(
    solanaService.isUsingBrowserWallet()
  );
  const [detectedWallets, setDetectedWallets] = useState<DetectedWalletInfo[]>([]);
  const [balance, setBalance] = useState<number>(solanaService.getCachedBalance());

  const [web3Config, setWeb3Config] = useState<Web3TipsConfig | null>(null);
  const [artistStatus, setArtistStatus] = useState<ArtistWalletStatus | null>(null);
  const [ledger, setLedger] = useState<TipLedgerResponse | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);

  const [copied, setCopied] = useState(false);
  const [isAirdropping, setIsAirdropping] = useState(false);
  const [tipAmountInput, setTipAmountInput] = useState<string>('0.1');
  const [isTipping, setIsTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState<TipRecord | null>(null);

  const [claimArtistName, setClaimArtistName] = useState<string>(activeArtistName);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResultMsg, setClaimResultMsg] = useState<string>('');

  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const syncWalletState = useCallback(() => {
    setCluster(solanaService.getCluster());
    setPublicKey(solanaService.getPublicKey());
    setWalletLabel(solanaService.getActiveWalletLabel());
    setUsingBrowserWallet(solanaService.isUsingBrowserWallet());
    setDetectedWallets(solanaService.getDetectedWallets());
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoadingMeta(true);
    syncWalletState();
    const curCluster = solanaService.getCluster();
    try {
      const [bal, cfg, status, led] = await Promise.all([
        solanaService.fetchBalance().catch(() => solanaService.getCachedBalance()),
        solanaService.fetchWeb3Config(true).catch(() => null),
        activeArtistName
          ? solanaService.fetchArtistStatus(activeArtistName, curCluster).catch(() => null)
          : Promise.resolve(null),
        solanaService.fetchLedger(curCluster).catch(() => null)
      ]);
      setBalance(bal);
      if (cfg) setWeb3Config(cfg);
      if (status) setArtistStatus(status);
      if (led) setLedger(led);
    } finally {
      setIsLoadingMeta(false);
    }
  }, [activeArtistName, syncWalletState]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setClaimArtistName(activeArtistName);
      setErrorMessage('');
      setStatusMessage('');
      setTipSuccess(null);
      setClaimResultMsg('');
      void refreshAll();
    });
    const unsub = solanaService.subscribe(() => {
      syncWalletState();
      setBalance(solanaService.getCachedBalance());
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [isOpen, activeArtistName, refreshAll, syncWalletState]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const parsedAmount = Number.parseFloat(tipAmountInput);
  const split = computeSplitPreview(Number.isFinite(parsedAmount) ? parsedAmount : 0);
  const currentClusterCfg = web3Config?.clusters?.[cluster];
  const treasuryConfigured = Boolean(currentClusterCfg?.treasuryAddress);
  const clusterLabel = cluster === 'mainnet-beta' ? 'Mainnet-Beta' : 'Devnet';
  const scopedArtistStatus = artistStatus?.cluster === cluster ? artistStatus : null;
  const signerReady = solanaService.isReadyToSign();
  const canRouteRecipient =
    Boolean(scopedArtistStatus?.verified) ||
    Boolean(currentClusterCfg?.escrowAddress) ||
    Boolean(activeArtistAddress);

  const handleSwitchCluster = async (nextCluster: SolanaCluster) => {
    setErrorMessage('');
    setStatusMessage('');
    setTipSuccess(null);
    solanaService.setCluster(nextCluster);
    syncWalletState();
    await refreshAll();
  };

  const handleConnectWallet = async (walletId: DetectedWalletInfo['id']) => {
    setErrorMessage('');
    setStatusMessage('');
    try {
      const addr = await solanaService.connectBrowserWallet(walletId);
      setStatusMessage(`Connected wallet ${addr.slice(0, 6)}...${addr.slice(-4)}`);
      await refreshAll();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to connect wallet.');
    }
  };

  const handleDisconnectWallet = async () => {
    setErrorMessage('');
    setStatusMessage('');
    await solanaService.disconnectWallet();
    await refreshAll();
  };

  const handleCopy = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleAirdrop = async () => {
    setIsAirdropping(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const result = await solanaService.requestAirdrop();
      setBalance(result.balance);
      if (result.success) {
        setStatusMessage('+1.0000 SOL Devnet airdrop confirmed on-chain.');
      } else {
        setErrorMessage(
          result.error ||
          'Devnet faucet rate-limited. Open faucet.solana.com and paste your wallet address.'
        );
      }
    } finally {
      setIsAirdropping(false);
    }
  };

  const handleSendTip = async () => {
    setIsTipping(true);
    setErrorMessage('');
    setStatusMessage('');
    setTipSuccess(null);
    try {
      if (!Number.isFinite(parsedAmount) || parsedAmount < MIN_TIP_SOL) {
        throw new Error(`Minimum tip amount is ${MIN_TIP_SOL} SOL.`);
      }
      const record = await solanaService.sendArtistTip({
        artistName: activeArtistName,
        trackTitle: activeTrackTitle,
        amountSol: parsedAmount,
        explicitArtistAddress: activeArtistAddress,
        allowTrackDirect: false
      });
      setTipSuccess(record);
      await refreshAll();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Solana split transaction failed.');
    } finally {
      setIsTipping(false);
    }
  };

  const handleVerifyArtistOwnership = async () => {
    setIsClaiming(true);
    setErrorMessage('');
    setClaimResultMsg('');
    try {
      const result = await solanaService.signAndVerifyArtistWallet(claimArtistName);
      setClaimResultMsg(
        `Verified Ed25519 ownership for ${result.artistName}. All future tips route 85% directly to ${result.walletAddress.slice(0, 6)}...${result.walletAddress.slice(-4)}.`
      );
      await refreshAll();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Artist ownership verification failed.');
    } finally {
      setIsClaiming(false);
    }
  };

  const truncateAddress = (addr?: string | null) => {
    if (!addr) return 'Not connected';
    return `${addr.slice(0, 5)}...${addr.slice(-5)}`;
  };

  const installedBrowserWallets = detectedWallets.filter((w) => w.installed);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Solana Web3 Wallet and Tipping Protocol"
    >
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded-2xl px-4 pb-4 pt-0 sm:px-6 sm:pb-6 shadow-2xl text-[var(--text-primary)] select-none">
        {/* Top Header */}
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 sm:pt-5 pb-3.5 mb-4 bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] shrink-0">
              <Wallet size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                Solana Tip &amp; Revenue Protocol
              </h3>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] flex items-center gap-1">
                <ShieldCheck size={12} className="text-[var(--accent-text)] shrink-0" />
                Atomic Split: {ARTIST_SHARE_BPS / 100}% Artist / {PLATFORM_FEE_BPS / 100}% Platform Fee
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close wallet dialog"
            className="p-2 text-[var(--text-dim)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Network Cluster Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] mb-4">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-1">
            Solana Cluster
          </span>
          <div className="flex items-center gap-1.5">
            {(['devnet', 'mainnet-beta'] as SolanaCluster[]).map((c) => {
              const active = cluster === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleSwitchCluster(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${active
                      ? c === 'mainnet-beta'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                >
                  {c === 'devnet' ? 'Devnet (Sandbox)' : 'Mainnet-Beta (Real SOL)'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Wallet Connection & Balance Card */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3.5 rounded-xl mb-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-dim)]">Signer Mode:</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${usingBrowserWallet
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : cluster === 'devnet'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                        : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}
                >
                  {walletLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono font-semibold text-[var(--accent-text)]">
                  {truncateAddress(publicKey)}
                </span>
                {publicKey && (
                  <>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {copied ? <Check size={11} className="text-[var(--accent-text)]" /> : <Copy size={11} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <a
                      href={solanaService.getExplorerAddressUrl(publicKey, cluster)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 text-[11px] text-[var(--text-dim)] hover:text-[var(--accent-text)]"
                    >
                      Explorer <ExternalLink size={10} />
                    </a>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-[10px] text-[var(--text-dim)] block uppercase">Balance</span>
                <span className="text-base font-bold text-[var(--text-primary)]">
                  {balance.toFixed(4)} <span className="text-xs text-[var(--accent-text)]">SOL</span>
                </span>
              </div>
              <button
                type="button"
                onClick={refreshAll}
                className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                title="Refresh Balance and Ledger"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Browser Wallet Buttons / Devnet Airdrop */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[var(--border-subtle)]">
            <div className="flex flex-wrap items-center gap-1.5">
              {usingBrowserWallet ? (
                <button
                  type="button"
                  onClick={handleDisconnectWallet}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-medium)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Disconnect {walletLabel}
                </button>
              ) : installedBrowserWallets.length > 0 ? (
                installedBrowserWallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleConnectWallet(w.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--accent-border)] text-xs font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-soft)] cursor-pointer"
                  >
                    <Plug size={12} />
                    Connect {w.name}
                  </button>
                ))
              ) : (
                <span className="text-[11px] text-[var(--text-dim)]">
                  No browser wallet extension detected (Phantom / Solflare / Backpack).
                </span>
              )}
            </div>

            {cluster === 'devnet' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAirdrop}
                  disabled={isAirdropping}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold hover:bg-[var(--accent-emerald-hover)] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isAirdropping ? 'Requesting...' : '+1 SOL Airdrop'}
                </button>
                <a
                  href="https://spigot-devnet.vercel.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[var(--accent-text)] underline"
                >
                  Web Faucet
                </a>
              </div>
            )}
          </div>

          {cluster === 'mainnet-beta' && !usingBrowserWallet && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
              <Lock size={14} className="shrink-0 mt-0.5" />
              <span>
                Mainnet security rule active: local browser test keypairs are disabled on Mainnet-Beta.
                Connect Phantom, Solflare, or Backpack to sign real SOL transfers.
              </span>
            </div>
          )}

          {!isLoadingMeta && !treasuryConfigured && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                {cluster === 'mainnet-beta'
                  ? 'Mainnet-Beta Treasury public key is not yet configured (VITE_SOLANA_MAINNET_TREASURY_ADDRESS). Switch to Devnet to run live split transactions.'
                  : 'Devnet Treasury address unavailable.'}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('tip')}
            className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${activeTab === 'tip'
                ? 'bg-[var(--bg-surface)] text-[var(--accent-text)] shadow-sm border border-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
          >
            <Coins size={13} />
            <span>Split Tip (85/15)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('claim')}
            className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${activeTab === 'claim'
                ? 'bg-[var(--bg-surface)] text-[var(--accent-text)] shadow-sm border border-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
          >
            <CheckCircle2 size={13} />
            <span>Claim Artist</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${activeTab === 'ledger'
                ? 'bg-[var(--bg-surface)] text-[var(--accent-text)] shadow-sm border border-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
          >
            <BarChart3 size={13} />
            <span>Ledger &amp; Escrow</span>
          </button>
        </div>

        {statusMessage && (
          <div className="p-2.5 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-text)] text-xs mb-3">
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs mb-3">
            {errorMessage}
          </div>
        )}

        {/* TAB 1: SPLIT TIP */}
        {activeTab === 'tip' && (
          <div className="space-y-4">
            {/* Destination Verification Card */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] text-[var(--text-dim)] block">Supporting Track</span>
                  <span className="text-xs font-bold text-[var(--text-primary)] truncate block">
                    {activeArtistName} &middot; &ldquo;{activeTrackTitle}&rdquo;
                  </span>
                </div>
                {scopedArtistStatus?.verified ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[11px] font-bold text-[var(--accent-text)]">
                    <CheckCircle2 size={12} /> Verified Direct Wallet
                  </span>
                ) : isLoadingMeta && !scopedArtistStatus ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-dim)]">
                    <RefreshCw size={11} className="animate-spin" /> Syncing {clusterLabel}...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-300">
                    <Lock size={12} /> Unclaimed &middot; Vault Escrow
                  </span>
                )}
              </div>

              <div className="text-[11px] text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-2 pt-1">
                <span>
                  {scopedArtistStatus?.verified && scopedArtistStatus.verifiedWallet
                    ? `85% goes directly to ${truncateAddress(scopedArtistStatus.verifiedWallet)}`
                    : isLoadingMeta && !scopedArtistStatus
                      ? `Checking verified artist routing on Solana ${clusterLabel}...`
                      : scopedArtistStatus?.escrowAddress
                        ? `No verified artist wallet yet — 85% held safely in Escrow Vault (${truncateAddress(scopedArtistStatus.escrowAddress)}) until artist claims.`
                        : 'Escrow Vault unavailable on this cluster until configured.'}
                </span>
                {!scopedArtistStatus?.verified && !isLoadingMeta && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('claim')}
                    className="text-[var(--accent-text)] font-semibold underline cursor-pointer"
                  >
                    Verify Artist Wallet
                  </button>
                )}
              </div>

              {scopedArtistStatus && scopedArtistStatus.stats.tipCount > 0 && (
                <div className="text-[11px] text-[var(--text-dim)] pt-1 border-t border-[var(--border-subtle)] flex flex-wrap gap-3">
                  <span>Tips: {scopedArtistStatus.stats.tipCount}</span>
                  <span>Artist Share: {scopedArtistStatus.stats.totalArtistSol.toFixed(4)} SOL</span>
                  {scopedArtistStatus.stats.unclaimedEscrowSol > 0 && (
                    <span className="text-amber-300">
                      Unclaimed Escrow: {scopedArtistStatus.stats.unclaimedEscrowSol.toFixed(4)} SOL
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Amount Selector + Custom Numeric Input */}
            <div>
              <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                {[0.01, 0.05, 0.1, 0.5, 1.0].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTipAmountInput(String(amt))}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${parsedAmount === amt
                        ? 'border-[var(--accent-emerald)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                  >
                    {amt} SOL
                  </button>
                ))}
              </div>
              <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                Custom Amount (SOL, min {MIN_TIP_SOL} SOL)
              </label>
              <input
                type="number"
                step="0.01"
                min={MIN_TIP_SOL}
                value={tipAmountInput}
                onChange={(e) => setTipAmountInput(e.target.value)}
                aria-label="Custom SOL tip amount"
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-medium)] text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-emerald)]"
              />
            </div>

            {/* Atomic 85% / 15% Split Preview */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Gross Fan Tip (100%)</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  {split.grossSol.toFixed(4)} SOL
                </span>
              </div>
              <div className="flex items-center justify-between text-[var(--accent-text)]">
                <span>
                  {artistStatus?.verified ? 'Artist Direct Payout (85%)' : 'Artist Escrow Share (85%)'}
                </span>
                <span className="font-mono font-bold">+{split.artistSol.toFixed(6)} SOL</span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>
                  Platform Protocol Fee (15%{' '}
                  {currentClusterCfg?.treasuryAddress
                    ? `-> ${truncateAddress(currentClusterCfg.treasuryAddress)}`
                    : ''}
                  )
                </span>
                <span className="font-mono font-semibold">+{split.feeSol.toFixed(6)} SOL</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)] pt-1.5 border-t border-[var(--border-subtle)]">
                <span>Estimated Solana Gas Fee</span>
                <span className="font-mono">~{split.estimatedGasSol.toFixed(6)} SOL</span>
              </div>
              <div className="flex items-center justify-between font-bold text-[var(--text-primary)] pt-1 border-t border-[var(--border-subtle)]">
                <span>Total Wallet Debit</span>
                <span className="font-mono">{split.totalRequiredSol.toFixed(6)} SOL</span>
              </div>
            </div>

            {tipSuccess && (
              <div className="p-3.5 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                  <CheckCircle2 size={15} className="text-[var(--accent-text)]" />
                  <span>
                    Verified On-Chain ({tipSuccess.cluster}): {tipSuccess.artistShareSol.toFixed(4)} SOL
                    to {tipSuccess.routeType === 'direct_artist' ? 'Artist' : 'Escrow'} +{' '}
                    {tipSuccess.feeSol.toFixed(4)} SOL Platform Fee
                  </span>
                </div>
                <a
                  href={solanaService.getExplorerTxUrl(tipSuccess.txSignature, tipSuccess.cluster)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-text)] underline"
                >
                  Inspect Confirmed Split Transaction on Solana Explorer <ArrowUpRight size={12} />
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={handleSendTip}
              disabled={
                isTipping ||
                !signerReady ||
                !treasuryConfigured ||
                !canRouteRecipient ||
                !Number.isFinite(parsedAmount) ||
                parsedAmount < MIN_TIP_SOL
              }
              className="w-full py-3 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] font-bold text-sm hover:bg-[var(--accent-emerald-hover)] transition-colors shadow-md disabled:opacity-45 cursor-pointer"
            >
              {isTipping
                ? 'Signing & Confirming Split Transaction...'
                : `Send ${split.grossSol.toFixed(3)} SOL (85% Creator / 15% Platform)`}
            </button>
          </div>
        )}

        {/* TAB 2: CLAIM & VERIFY ARTIST WALLET */}
        {activeTab === 'claim' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] space-y-1.5">
              <p className="font-bold text-[var(--text-primary)]">
                Cryptographic Ed25519 Artist Ownership Verification
              </p>
              <p className="leading-relaxed">
                Sign a domain-separated challenge message with your wallet to bind an artist identity to your
                Solana public key in Neon Postgres. Once verified, 85% of every future fan tip streams
                directly to your wallet in one atomic transaction.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                Artist or Host Name to Claim
              </label>
              <input
                type="text"
                value={claimArtistName}
                onChange={(e) => setClaimArtistName(e.target.value)}
                placeholder="Enter exact artist or creator name"
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-medium)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-emerald)]"
              />
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-dim)]">Payout Wallet to Bind:</span>
                <span className="font-mono text-[var(--accent-text)]">
                  {truncateAddress(publicKey)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-dim)]">Verification Standard:</span>
                <span className="font-mono text-[var(--text-secondary)]">Ed25519 SPKI DER + 24h Nonce</span>
              </div>
            </div>

            {claimResultMsg && (
              <div className="p-3 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] text-xs text-[var(--text-primary)]">
                {claimResultMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleVerifyArtistOwnership}
              disabled={isClaiming || !signerReady || !claimArtistName.trim()}
              className="w-full py-2.5 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] font-bold text-sm hover:bg-[var(--accent-emerald-hover)] transition-colors disabled:opacity-45 cursor-pointer"
            >
              {isClaiming ? 'Signing Ed25519 Ownership Proof...' : 'Sign & Verify Artist Wallet'}
            </button>
          </div>
        )}

      {/* TAB 3: LIVE LEDGER, BENCHMARKS & ESCROW */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            {/* Protocol Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-dim)] block uppercase">Gross Tips</span>
                <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                  {(ledger?.summary.totalGrossSol ?? 0).toFixed(4)} SOL
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-dim)] block uppercase">Artist 85%</span>
                <span className="text-sm font-bold text-[var(--accent-text)] font-mono">
                  {(ledger?.summary.totalArtistSol ?? 0).toFixed(4)} SOL
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-dim)] block uppercase">Platform 15%</span>
                <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                  {(ledger?.summary.totalPlatformFeeSol ?? 0).toFixed(4)} SOL
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-dim)] block uppercase">Vault Escrow</span>
                <span className="text-sm font-bold text-amber-300 font-mono">
                  {(ledger?.summary.unclaimedEscrowSol ?? 0).toFixed(4)} SOL
                </span>
              </div>
            </div>

            {/* Industry Fee Comparison */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
              <h4 className="text-xs font-bold text-[var(--text-primary)]">
                Industry Take-Rate Benchmark (15% Sonacast Fee vs Platforms)
              </h4>
              <div className="space-y-1.5 text-[11px]">
                {(web3Config?.feeBenchmarks || [
                  { platform: 'Twitch Standard Subs', creatorSharePct: 50, platformFeePct: 50 },
                  { platform: 'YouTube Super Chat', creatorSharePct: 70, platformFeePct: 30 },
                  { platform: 'Spotify Streaming Pool', creatorSharePct: 70, platformFeePct: 30 },
                  { platform: 'Sonacast Web3 Direct/Escrow', creatorSharePct: 85, platformFeePct: 15 }
                ]).map((b) => (
                  <div
                    key={b.platform}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${b.platform.includes('Sonacast')
                        ? 'bg-[var(--accent-soft)] border border-[var(--accent-border)] font-bold text-[var(--accent-text)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                      }`}
                  >
                    <span>{b.platform}</span>
                    <span className="font-mono">
                      Creator {b.creatorSharePct}% / Fee {b.platformFeePct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Verified On-Chain Tips History */}
            <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--bg-app)]">
              <div className="px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-secondary)] flex items-center justify-between">
                <span>On-Chain Verified Split Tips ({ledger?.tips.length ?? 0})</span>
                <span>{cluster}</span>
              </div>
              {!ledger || ledger.tips.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-dim)]">
                  No verified on-chain tips recorded on {cluster} yet.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                  {ledger.tips.map((tip) => (
                    <div key={tip.id} className="p-2.5 text-xs flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--text-primary)] truncate">
                          {tip.recipientName} &middot; {tip.trackTitle}
                        </div>
                        <div className="text-[11px] text-[var(--text-dim)] font-mono">
                          {tip.artistShareSol.toFixed(4)} artist + {tip.feeSol.toFixed(4)} fee &middot;{' '}
                          {tip.routeType === 'direct_artist' ? 'Direct' : 'Escrow'}
                        </div>
                      </div>
                      <a
                        href={solanaService.getExplorerTxUrl(tip.txSignature, tip.cluster)}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-[var(--accent-text)] underline"
                      >
                        {tip.txSignature.slice(0, 6)}...
                        <ArrowUpRight size={11} />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
