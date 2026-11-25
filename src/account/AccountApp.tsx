import React, { useEffect, useRef, useState } from 'react';
import {
  IconCamera,
  IconCheck,
  IconCloud,
  IconEye,
  IconEyeOff,
  IconKey,
  IconLogOut,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconUser,
} from '../shared/Icons';
import {
  DEFAULT_KANBANS,
  DEFAULT_NOTES,
  DEFAULT_TIMERS,
  DEFAULT_TODO_LISTS,
  DEFAULT_ZENBASE_CONFIG,
  DEFAULT_ZENBASE_SYNC_SETTINGS,
  DEFAULT_ZENBASE_SYNC_STATE,
  KanbanBoard,
  NoteItem,
  StoredAuthSession,
  TODOS_KANBAN_BOARD_ID,
  TimerItem,
  TodoList,
  ZenbaseSyncSettings,
  ZenbaseSyncState,
} from '../shared/types';
import { useChromeStorage } from '../shared/useChromeStorage';
import { useTheme } from '../shared/useTheme';
import { usePersistWindowBounds } from '../shared/windowUtils';
import {
  SYNC_SETTINGS_KEY,
  SYNC_STATE_KEY,
  runBidirectionalSync,
} from '../shared/zenbaseSyncEngine';
import {
  getUserInitials,
  refreshZenbaseSession,
  sendZenbaseOtp,
  signInWithZenbasePassword,
  signOutFromZenbase,
  signUpWithZenbase,
  updateZenbasePassword,
  updateZenbaseProfile,
  validateAvatarFile,
  verifyZenbaseOtp,
} from '../shared/zenbaseClient';

type AuthTab = 'signin' | 'signup';
type SignInMethod = 'password' | 'otp';
type AccountTab = 'profile' | 'sync' | 'security';

function formatSyncTime(ts: number | null): string {
  if (!ts) return 'Jamais';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 15) return 'À l’instant';
  if (diffSec < 60) return `Il y a ${diffSec} s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AccountApp: React.FC = () => {
  // Thème synchronisé Material You + persistance des dimensions de la fenêtre flottante
  useTheme();
  usePersistWindowBounds('account', true);

  const [session, setSession, sessionLoaded] =
    useChromeStorage<StoredAuthSession | null>('zenbaseAuthSession', null);
  const [syncSettings, setSyncSettings] =
    useChromeStorage<ZenbaseSyncSettings>(
      SYNC_SETTINGS_KEY,
      DEFAULT_ZENBASE_SYNC_SETTINGS
    );
  const [syncState, setSyncState] = useChromeStorage<ZenbaseSyncState>(
    SYNC_STATE_KEY,
    DEFAULT_ZENBASE_SYNC_STATE
  );
  const [notes] = useChromeStorage<NoteItem[]>('notes', DEFAULT_NOTES);
  const [todoLists] = useChromeStorage<TodoList[]>(
    'todoLists',
    DEFAULT_TODO_LISTS
  );
  const [kanbans] = useChromeStorage<KanbanBoard[]>('kanbans', DEFAULT_KANBANS);
  const [timers] = useChromeStorage<TimerItem[]>('timers', DEFAULT_TIMERS);
  const [manualSyncing, setManualSyncing] = useState(false);

  // Onglets
  const [authTab, setAuthTab] = useState<AuthTab>('signin');
  const [signInMethod, setSignInMethod] = useState<SignInMethod>('password');
  const [accountTab, setAccountTab] = useState<AccountTab>('profile');

  // Champs Connexion
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Champs OTP
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Champs Inscription (+ photo de profil)
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [signUpAvatarFile, setSignUpAvatarFile] = useState<File | null>(null);
  const [signUpAvatarPreview, setSignUpAvatarPreview] = useState<string | null>(
    null
  );
  const signUpAvatarInputRef = useRef<HTMLInputElement | null>(null);

  // Champs Profil (connecté)
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const profileAvatarInputRef = useRef<HTMLInputElement | null>(null);

  // Sécurité / Mot de passe
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // États d'interaction
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const verifiedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setProfileDisplayName(session?.profile?.display_name || '');
  }, [session?.profile?.display_name]);

  useEffect(() => {
    setAvatarImgFailed(false);
  }, [session?.profile?.avatar_url]);

  // Vérifie silencieusement la session au lancement de la fenêtre
  useEffect(() => {
    if (!sessionLoaded || !session?.token) return;
    if (verifiedTokenRef.current === session.token) return;
    verifiedTokenRef.current = session.token;

    let cancelled = false;
    void refreshZenbaseSession(DEFAULT_ZENBASE_CONFIG, session).then((res) => {
      if (cancelled) return;
      if (res.unauthorized) {
        setSession(null);
      } else if (res.session && !res.unreachable) {
        setSession(res.session);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionLoaded, session, setSession]);

  // Libère l'URL blob d'aperçu
  useEffect(() => {
    return () => {
      if (signUpAvatarPreview) {
        URL.revokeObjectURL(signUpAvatarPreview);
      }
    };
  }, [signUpAvatarPreview]);

  // Efface automatiquement les messages de succès
  useEffect(() => {
    if (!statusMessage) return;
    const t = window.setTimeout(() => setStatusMessage(null), 3500);
    return () => window.clearTimeout(t);
  }, [statusMessage]);

  const clearFeedback = () => {
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const handleSelectSignUpAvatar = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validationErr = validateAvatarFile(file);
    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    setErrorMessage(null);
    if (signUpAvatarPreview) {
      URL.revokeObjectURL(signUpAvatarPreview);
    }
    setSignUpAvatarFile(file);
    setSignUpAvatarPreview(URL.createObjectURL(file));
  };

  const handleClearSignUpAvatar = () => {
    if (signUpAvatarPreview) {
      URL.revokeObjectURL(signUpAvatarPreview);
    }
    setSignUpAvatarFile(null);
    setSignUpAvatarPreview(null);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setBusy(true);
    try {
      const res = await signInWithZenbasePassword(DEFAULT_ZENBASE_CONFIG, {
        email: signInEmail,
        password: signInPassword,
      });
      if (res.error || !res.session) {
        setErrorMessage(res.error || 'Connexion impossible.');
        return;
      }
      verifiedTokenRef.current = res.session.token;
      setSession(res.session);
      setSignInPassword('');
      setAccountTab('profile');
      setStatusMessage('Connexion réussie.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setBusy(true);
    try {
      const res = await sendZenbaseOtp(DEFAULT_ZENBASE_CONFIG, otpEmail);
      if (res.error) {
        setErrorMessage(res.error);
        return;
      }
      setOtpSent(true);
      setStatusMessage(`Code envoyé à ${otpEmail.trim()}.`);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setBusy(true);
    try {
      const res = await verifyZenbaseOtp(
        DEFAULT_ZENBASE_CONFIG,
        otpEmail,
        otpCode
      );
      if (res.error || !res.session) {
        setErrorMessage(res.error || 'Code OTP invalide ou expiré.');
        return;
      }
      verifiedTokenRef.current = res.session.token;
      setSession(res.session);
      setOtpCode('');
      setOtpSent(false);
      setAccountTab('profile');
      setStatusMessage('Connexion réussie.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setBusy(true);
    try {
      const res = await signUpWithZenbase(DEFAULT_ZENBASE_CONFIG, {
        email: signUpEmail,
        password: signUpPassword,
        displayName: signUpName,
        avatarFile: signUpAvatarFile,
      });
      if (res.error || !res.session) {
        setErrorMessage(res.error || 'Impossible de créer le compte.');
        return;
      }
      verifiedTokenRef.current = res.session.token;
      setSession(res.session);
      setSignUpPassword('');
      handleClearSignUpAvatar();
      setAccountTab('profile');
      setStatusMessage(res.warning || 'Compte créé avec succès.');
    } finally {
      setBusy(false);
    }
  };

  const handleProfileAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !session) return;

    const validationErr = validateAvatarFile(file);
    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    clearFeedback();
    setAvatarUploading(true);
    try {
      const res = await updateZenbaseProfile(DEFAULT_ZENBASE_CONFIG, session, {
        avatarFile: file,
      });
      if (res.error || !res.session) {
        setErrorMessage(
          res.error || 'Impossible de téléverser la photo de profil.'
        );
        return;
      }
      setSession(res.session);
      setStatusMessage('Photo de profil mise à jour.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveProfileAvatar = async () => {
    if (!session || !session.profile?.avatar_url) return;
    clearFeedback();
    setAvatarUploading(true);
    try {
      const res = await updateZenbaseProfile(DEFAULT_ZENBASE_CONFIG, session, {
        removeAvatar: true,
      });
      if (res.error || !res.session) {
        setErrorMessage(res.error || 'Impossible de supprimer la photo.');
        return;
      }
      setSession(res.session);
      setStatusMessage('Photo de profil retirée.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    clearFeedback();
    setBusy(true);
    try {
      const res = await updateZenbaseProfile(DEFAULT_ZENBASE_CONFIG, session, {
        displayName: profileDisplayName,
      });
      if (res.error || !res.session) {
        setErrorMessage(res.error || 'Impossible d’enregistrer le profil.');
        return;
      }
      setSession(res.session);
      setStatusMessage('Profil mis à jour.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    clearFeedback();
    setBusy(true);
    try {
      const res = await updateZenbasePassword(
        DEFAULT_ZENBASE_CONFIG,
        session.token,
        currentPassword.trim() ? currentPassword : null,
        newPassword
      );
      if (res.error) {
        setErrorMessage(res.error);
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setStatusMessage('Mot de passe mis à jour.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!session) return;
    clearFeedback();
    setBusy(true);
    try {
      await signOutFromZenbase(DEFAULT_ZENBASE_CONFIG, session.token);
      verifiedTokenRef.current = null;
      setSession(null);
      setAuthTab('signin');
      setSignInMethod('password');
      setStatusMessage('Déconnecté — vos données restent en local.');
    } finally {
      setBusy(false);
    }
  };

  const handleManualSyncNow = async () => {
    if (!session || manualSyncing) return;
    clearFeedback();
    setManualSyncing(true);
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const resp = (await chrome.runtime.sendMessage({
          type: 'ZENBASE_SYNC_NOW',
          manual: true,
        })) as
          | {
              ok: boolean;
              error: string | null;
              pulledDomains?: string[];
              pushedDomains?: string[];
            }
          | undefined;

        if (resp && !resp.ok && resp.error) {
          setErrorMessage(resp.error);
        } else {
          setStatusMessage('Synchronisation bidirectionnelle terminée.');
        }
      } else {
        setSyncState((prev) => ({ ...prev, status: 'syncing', lastError: null }));
        const outcome = await runBidirectionalSync({ session });
        if (!outcome.ok) {
          setSyncState((prev) => ({
            ...prev,
            status: outcome.offline ? 'offline' : 'error',
            lastError: outcome.error,
          }));
          setErrorMessage(outcome.error || 'Échec de la synchronisation.');
        } else {
          setSyncState((prev) => ({
            ...prev,
            status: syncSettings.autoSync ? 'synced' : 'paused',
            lastSyncedAt: Date.now(),
            lastError: null,
            pendingDomains: [],
            userId: session.user.id,
          }));
          setStatusMessage('Synchronisation bidirectionnelle terminée.');
        }
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erreur de synchronisation.'
      );
    } finally {
      setManualSyncing(false);
    }
  };

  const customKanbansCount = kanbans.filter(
    (b) => b.id !== TODOS_KANBAN_BOARD_ID && !b.isSystemTodosBoard
  ).length;
  const savedTimersCount = timers.filter((t) => !t.isTemporary).length;
  const isCurrentlySyncing = manualSyncing || syncState.status === 'syncing';

  const syncStatusLabel =
    isCurrentlySyncing
      ? 'Synchronisation…'
      : !syncSettings.autoSync || syncState.status === 'paused'
      ? 'En pause'
      : syncState.status === 'offline'
      ? 'Hors-ligne'
      : syncState.status === 'error'
      ? 'Erreur'
      : syncState.status === 'synced'
      ? 'Synchronisé'
      : 'Prêt';

  const syncDotClass = isCurrentlySyncing
    ? 'bg-amber-400 animate-pulse'
    : !syncSettings.autoSync || syncState.status === 'paused'
    ? 'bg-md-on-surface-variant/50'
    : syncState.status === 'offline'
    ? 'bg-amber-500'
    : syncState.status === 'error'
    ? 'bg-rose-500'
    : 'bg-emerald-500';

  const formattedCreatedAt = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-md-surface text-md-on-surface flex flex-col">
      {/* En-tête compact Material 3 sans bordure */}
      <header className="px-4 pt-3.5 pb-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/icons/icon48.png"
            alt="KronoTab"
            className="w-6 h-6 rounded-lg shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-[13px] font-bold tracking-tight leading-tight truncate">
              {session ? 'Compte & Profil' : 'Compte KronoTab'}
            </h1>
            <p className="text-[10px] text-md-on-surface-variant truncate">
              {session
                ? session.user.email
                : 'Connexion & gestion du profil'}
            </p>
          </div>
        </div>

        {session && (
          <button
            type="button"
            disabled={busy}
            onClick={handleSignOut}
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="h-7 w-7 rounded-full bg-md-surface-container hover:bg-rose-500/15 text-md-on-surface-variant hover:text-rose-500 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
          >
            <IconLogOut size={13} />
          </button>
        )}
      </header>

      <main className="flex-1 px-4 pb-4 pt-1 space-y-3 overflow-y-auto">
        {/* Retours d'état (sans bordure, surfaces tonales Material 3) */}
        {errorMessage && (
          <div
            role="alert"
            className="px-3 py-2 rounded-2xl bg-rose-500/12 text-rose-500 text-[11px] font-medium leading-snug"
          >
            {errorMessage}
          </div>
        )}
        {statusMessage && (
          <div
            role="status"
            className="px-3 py-2 rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium leading-snug"
          >
            {statusMessage}
          </div>
        )}

        {/* ================================================================
            VUE CONNECTÉE : PROFIL & PARAMÈTRES DU COMPTE
           ================================================================ */}
        {session ? (
          <div className="space-y-3">
            {/* Carte profil compacte sans bordure */}
            <section className="p-3 rounded-2xl bg-md-surface-container flex items-center gap-3">
              <div className="relative shrink-0">
                {session.profile?.avatar_url && !avatarImgFailed ? (
                  <img
                    src={session.profile.avatar_url}
                    alt={session.profile.display_name || session.user.email}
                    onError={() => setAvatarImgFailed(true)}
                    className="w-14 h-14 rounded-full object-cover bg-md-surface-high"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-md-primary-container text-md-on-primary-container flex items-center justify-center text-base font-bold">
                    {getUserInitials(
                      session.profile?.display_name,
                      session.user.email
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={avatarUploading}
                  onClick={() => profileAvatarInputRef.current?.click()}
                  title="Changer la photo de profil"
                  aria-label="Changer la photo de profil"
                  className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-md-primary text-md-on-primary flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  <IconCamera size={12} />
                </button>

                <input
                  ref={profileAvatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleProfileAvatarChange}
                  className="sr-only"
                  aria-label="Choisir une photo de profil"
                />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-bold text-md-on-surface truncate">
                  {session.profile?.display_name || 'Utilisateur KronoTab'}
                </p>
                <p className="text-[11px] text-md-on-surface-variant truncate">
                  {session.user.email}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    disabled={avatarUploading}
                    onClick={() => profileAvatarInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-md-surface-high hover:bg-md-primary-container hover:text-md-on-primary-container text-[10px] font-semibold text-md-on-surface transition-colors disabled:opacity-50"
                  >
                    <IconUpload size={10} />
                    <span>
                      {avatarUploading
                        ? 'Envoi…'
                        : session.profile?.avatar_url
                        ? 'Changer'
                        : 'Ajouter photo'}
                    </span>
                  </button>

                  {session.profile?.avatar_url && (
                    <button
                      type="button"
                      disabled={avatarUploading}
                      onClick={handleRemoveProfileAvatar}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-md-surface hover:bg-rose-500/15 text-[10px] font-medium text-md-on-surface-variant hover:text-rose-500 transition-colors disabled:opacity-50"
                    >
                      <IconTrash size={10} />
                      <span>Retirer</span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Sélecteur segmenté compact Material 3 sans bordure */}
            <div
              role="tablist"
              aria-label="Sections du compte"
              className="grid grid-cols-3 gap-1 p-1 rounded-full bg-md-surface-container"
            >
              <button
                type="button"
                role="tab"
                aria-selected={accountTab === 'profile'}
                onClick={() => {
                  setAccountTab('profile');
                  clearFeedback();
                }}
                className={`py-1.5 rounded-full text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                  accountTab === 'profile'
                    ? 'bg-md-primary text-md-on-primary'
                    : 'text-md-on-surface-variant hover:text-md-on-surface'
                }`}
              >
                <IconUser size={12} />
                <span>Profil</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={accountTab === 'sync'}
                onClick={() => {
                  setAccountTab('sync');
                  clearFeedback();
                }}
                className={`py-1.5 rounded-full text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                  accountTab === 'sync'
                    ? 'bg-md-primary text-md-on-primary'
                    : 'text-md-on-surface-variant hover:text-md-on-surface'
                }`}
              >
                <IconCloud size={12} />
                <span>Synchro</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={accountTab === 'security'}
                onClick={() => {
                  setAccountTab('security');
                  clearFeedback();
                }}
                className={`py-1.5 rounded-full text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                  accountTab === 'security'
                    ? 'bg-md-primary text-md-on-primary'
                    : 'text-md-on-surface-variant hover:text-md-on-surface'
                }`}
              >
                <IconKey size={12} />
                <span>Sécurité</span>
              </button>
            </div>

            {accountTab === 'profile' ? (
              <div className="space-y-2.5">
                <form
                  onSubmit={handleSaveProfileDetails}
                  className="p-3 rounded-2xl bg-md-surface-container space-y-2.5"
                >
                  <div className="space-y-1">
                    <label
                      htmlFor="profile-display-name"
                      className="block text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant px-0.5"
                    >
                      Nom d'affichage
                    </label>
                    <input
                      id="profile-display-name"
                      name="fullname"
                      type="text"
                      autoComplete="name"
                      enterKeyHint="done"
                      value={profileDisplayName}
                      onChange={(e) => setProfileDisplayName(e.target.value)}
                      placeholder="Votre nom ou pseudo"
                      className="w-full px-3 py-2 rounded-xl bg-md-surface-high text-xs text-md-on-surface placeholder:text-md-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-md-primary/45 transition-shadow"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2 px-3 rounded-full bg-md-primary text-md-on-primary text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
                  >
                    <IconCheck size={13} />
                    <span>
                      {busy ? 'Enregistrement…' : 'Enregistrer le profil'}
                    </span>
                  </button>
                </form>

                {/* Métadonnées compactes du compte */}
                <div className="p-3 rounded-2xl bg-md-surface-container space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-md-on-surface-variant">
                      Authentification
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-md-surface-high font-semibold text-md-on-surface text-[10px]">
                      {session.user.auth_method === 'otp'
                        ? 'Code OTP'
                        : 'Mot de passe'}
                    </span>
                  </div>
                  {formattedCreatedAt && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-md-on-surface-variant">
                        Membre depuis
                      </span>
                      <span className="font-medium text-md-on-surface">
                        {formattedCreatedAt}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-md-on-surface-variant">
                      Synchronisation
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-md-on-surface">
                      <span className={`w-1.5 h-1.5 rounded-full ${syncDotClass}`} />
                      {syncStatusLabel}
                    </span>
                  </div>
                </div>
              </div>
            ) : accountTab === 'sync' ? (
              <div className="space-y-2.5">
                {/* Carte statut + interrupteur synchro automatique */}
                <div className="p-3 rounded-2xl bg-md-surface-container space-y-2.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={syncSettings.autoSync}
                    onClick={() =>
                      setSyncSettings((prev) => ({
                        ...prev,
                        autoSync: !prev.autoSync,
                      }))
                    }
                    className="w-full flex items-center justify-between gap-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-md-on-surface leading-tight">
                        Synchronisation automatique
                      </p>
                      <p className="text-[10px] text-md-on-surface-variant mt-0.5">
                        Bidirectionnelle (Local ↔ Cloud) avec fusion intelligente
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        syncSettings.autoSync
                          ? 'bg-md-primary'
                          : 'bg-md-surface-high'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                          syncSettings.autoSync
                            ? 'translate-x-[18px] bg-md-on-primary'
                            : 'translate-x-1 bg-md-on-surface-variant'
                        }`}
                      />
                    </span>
                  </button>

                  <div className="p-2.5 rounded-xl bg-md-surface space-y-1 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-md-on-surface-variant">État</span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-md-on-surface">
                        <span
                          className={`w-2 h-2 rounded-full ${syncDotClass}`}
                        />
                        {syncStatusLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-md-on-surface-variant">
                        Dernière synchro
                      </span>
                      <span className="font-medium text-md-on-surface">
                        {formatSyncTime(syncState.lastSyncedAt)}
                      </span>
                    </div>
                    {syncState.pendingDomains.length > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-md-on-surface-variant">
                          En attente
                        </span>
                        <span className="font-medium text-amber-500">
                          {syncState.pendingDomains.length} groupe(s)
                        </span>
                      </div>
                    )}
                    {syncState.lastError && syncState.status === 'error' && (
                      <p className="pt-1 text-[10px] text-rose-500 leading-snug">
                        {syncState.lastError}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isCurrentlySyncing}
                    onClick={handleManualSyncNow}
                    className="w-full py-2 px-3 rounded-full bg-md-primary text-md-on-primary text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
                  >
                    <IconRefresh
                      size={13}
                      className={isCurrentlySyncing ? 'animate-spin' : ''}
                    />
                    <span>
                      {isCurrentlySyncing
                        ? 'Synchronisation…'
                        : 'Synchroniser maintenant'}
                    </span>
                  </button>
                </div>

                {/* Résumé compact des domaines synchronisés */}
                <div className="p-3 rounded-2xl bg-md-surface-container space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant">
                    Données synchronisées sur votre compte
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="px-2.5 py-1.5 rounded-xl bg-md-surface flex items-center justify-between">
                      <span className="text-md-on-surface-variant">Notes</span>
                      <span className="font-bold text-md-on-surface">
                        {notes.length}
                      </span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-md-surface flex items-center justify-between">
                      <span className="text-md-on-surface-variant">
                        Listes Todos
                      </span>
                      <span className="font-bold text-md-on-surface">
                        {todoLists.length}
                      </span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-md-surface flex items-center justify-between">
                      <span className="text-md-on-surface-variant">Kanban</span>
                      <span className="font-bold text-md-on-surface">
                        {customKanbansCount}
                      </span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-md-surface flex items-center justify-between">
                      <span className="text-md-on-surface-variant">Timers</span>
                      <span className="font-bold text-md-on-surface">
                        {savedTimersCount}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-md-on-surface-variant leading-snug">
                    Inclut les paramètres par note, modèles Kanban et préférences
                    d’apparence. À la déconnexion, vos données restent disponibles
                    en local.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <form
                  onSubmit={handleUpdatePasswordSubmit}
                  className="p-3 rounded-2xl bg-md-surface-container space-y-2.5"
                >
                  <p className="text-[11px] font-bold text-md-on-surface">
                    Modifier le mot de passe
                  </p>

                  <div className="space-y-1">
                    <label
                      htmlFor="profile-current-password"
                      className="block text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant px-0.5"
                    >
                      Mot de passe actuel
                    </label>
                    <div className="relative">
                      <input
                        id="profile-current-password"
                        name="current-password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        enterKeyHint="next"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Optionnel si connecté via OTP"
                        className="w-full pl-3 pr-9 py-2 rounded-xl bg-md-surface-high text-xs text-md-on-surface placeholder:text-md-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-md-primary/45 transition-shadow"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword((prev) => !prev)
                        }
                        aria-label={
                          showCurrentPassword
                            ? 'Masquer le mot de passe actuel'
                            : 'Afficher le mot de passe actuel'
                        }
                        aria-pressed={showCurrentPassword}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-md-on-surface-variant hover:text-md-on-surface"
                      >
                        {showCurrentPassword ? (
                          <IconEyeOff size={13} />
                        ) : (
                          <IconEye size={13} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="profile-new-password"
                      className="block text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant px-0.5"
                    >
                      Nouveau mot de passe
                    </label>
                    <div className="relative">
                      <input
                        id="profile-new-password"
                        name="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        enterKeyHint="done"
                        minLength={6}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="6 caractères minimum"
                        className="w-full pl-3 pr-9 py-2 rounded-xl bg-md-surface-high text-xs text-md-on-surface placeholder:text-md-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-md-primary/45 transition-shadow"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        aria-label={
                          showNewPassword
                            ? 'Masquer le nouveau mot de passe'
                            : 'Afficher le nouveau mot de passe'
                        }
                        aria-pressed={showNewPassword}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-md-on-surface-variant hover:text-md-on-surface"
                      >
                        {showNewPassword ? (
                          <IconEyeOff size={13} />
                        ) : (
                          <IconEye size={13} />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy || newPassword.length < 6}
                    className="w-full py-2 px-3 rounded-full bg-md-primary text-md-on-primary text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {busy ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
                  </button>
                </form>

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSignOut}
                  className="w-full py-2 px-3 rounded-full bg-rose-500/12 hover:bg-rose-500/20 text-rose-500 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <IconLogOut size={13} />
                  <span>Se déconnecter</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ================================================================
             VUE NON CONNECTÉE : CONNEXION / INSCRIPTION (MATERIAL 3 COMPACT)
             ================================================================ */
          <div className="space-y-3">
            {/* Sélecteur segmenté sans bordure */}
            <div
              role="tablist"
              aria-label="Authentification"
              className="grid grid-cols-2 gap-1 p-1 rounded-full bg-md-surface-container"
            >
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'signin'}
                onClick={() => {
                  setAuthTab('signin');
                  clearFeedback();
                }}
                className={`py-1.5 rounded-full text-xs font-bold transition-colors ${
                  authTab === 'signin'
                    ? 'bg-md-primary text-md-on-primary'
                    : 'text-md-on-surface-variant hover:text-md-on-surface'
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'signup'}
                onClick={() => {
                  setAuthTab('signup');
                  clearFeedback();
                }}
                className={`py-1.5 rounded-full text-xs font-bold transition-colors ${
                  authTab === 'signup'
                    ? 'bg-md-primary text-md-on-primary'
                    : 'text-md-on-surface-variant hover:text-md-on-surface'
                }`}
              >
                Inscription
              </button>
            </div>

            {/* --- CONNEXION --- */}
            {authTab === 'signin' && (
              <div className="p-3.5 rounded-2xl bg-md-surface-container space-y-3">
                {signInMethod === 'password' ? (
                  <form onSubmit={handleSignInSubmit} className="space-y-2.5">
                    <div className="space-y-1">
                      <label
                        htmlFor="auth-signin-email"
                        className="block text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant px-0.5"
                      >
                        Adresse e-mail
                      </label>
                      <input
                        id="auth-signin-email"
                        name="email"
                        type="email"
                        autoComplete="username"
                        spellCheck={false}
                        enterKeyHint="next"
                        required
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        className="w-full px-3 py-2 rounded-xl bg-md-surface-high text-xs text-md-on-surface placeholder:text-md-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-md-primary/45 transition-shadow"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="auth-signin-password"
                        className="block text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant px-0.5"
                      >
                        Mot de passe
                      </label>
                      <div className="relative">
                        <input
                          id="auth-signin-password"
                          name="password"
                          type={showSignInPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          enterKeyHint="done"
                          required
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          placeholder="Votre mot de passe"
                          className="w-full pl-3 pr-9 py-2 rounded-xl bg-md-surface-high text-xs text-md-on-surface placeholder:text-md-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-md-primary/45 transition-shadow"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowSignInPassword((prev) => !prev)
                          }
                          aria-label={
                            showSignInPassword
                              ? 'Masquer le mot de passe'
                              : 'Afficher le mot de passe'
                          }
                          aria-pressed={showSignInPassword}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-md-on-surface-variant hover:text-md-on-surface"
                        >
                          {showSignInPassword ? (
                            <IconEyeOff size={13} />
                          ) : (
                            <IconEye size={13} />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full mt-1 py-2 px-4 rounded-full bg-md-primary text-md-on-primary text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {busy ? 'Connexion…' : 'Se connecter'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSignInMethod('otp');
                        setOtpEmail(signInEmail);
                        setOtpSent(false);
                        clearFeedback();
                      }}
                      className="w-full pt-0.5 text-center text-[11px] font-medium text-md-primary hover:underline"
                    >
                      Se connecter avec un code OTP par e-mail
                    </button>
                  </form>
                ) : (
                  <form
                    onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}
                    className="space-y-2.5"
                  >
                    <div className="space-y-1">
                      <label
                        htmlFor="auth-otp-email"
                        className="block text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant px-0.5"
                      >
                        Adresse e-mail
                      </label>
                      <input
                        id="auth-otp-email"
                        name="email"
                        type="email"
                        autoComplete="username"
                        spellCheck={false}
                        enterKeyHint={otpSent ? 'next' : 'done'}
                        required
                        disabled={otpSent}
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        className="w-full px-3 py-2 rounded-xl bg-md-surface-high text-xs text-md-on-surface placeholder:text-md-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-md-primary/45 disabled:opacity-60 transition-shadow"
                      />
                    </div>

                    {otpSent && (
                      <div className="space-y-1">
                        <label
                          htmlFor="auth-otp-code"
                          className="block text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant px-0.5"
                        >
                          Code OTP (6 chiffres)
                        </label>
                        <input
                          id="auth-otp-code"
                          name="otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          enterKeyHint="done"
                          maxLength={6}
                          required
                          value={otpCode}
                          onChange={(e) =>
                            setOtpCode(e.target.value.replace(/\D/g, ''))
                          }
                          placeholder="123456"
                          className="w-full px-3 py-2 rounded-xl bg-md-surface-high text-center font-mono text-sm tracking-[0.3em] text-md-on-surface focus:outline-none focus:ring-2 focus:ring-md-primary/45 transition-shadow"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full mt-1 py-2 px-4 rounded-full bg-md-primary text-md-on-primary text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {busy
                        ? otpSent
                          ? 'Vérification…'
                          : 'Envoi du code…'
                        : otpSent
                        ? 'Vérifier et se connecter'
                        : 'Recevoir un code OTP'}
                    </button>

                    <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setSignInMethod('password');
                          setOtpSent(false);
                          setOtpCode('');
                          clearFeedback();
                        }}
                        className="font-medium text-md-primary hover:underline"
                      >
                        ← Mot de passe
                      </button>
                      {otpSent && (
                        <button
                          type="button"
                          onClick={() => {
                            setOtpSent(false);
                            setOtpCode('');
                          }}
                          className="font-medium text-md-on-surface-variant hover:text-md-on-surface"
                        >
                          Changer d’e-mail
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* --- INSCRIPTION (+ UPLOAD PHOTO DE PROFIL) --- */}
            {authTab === 'signup' && (
              <form
                onSubmit={handleSignUpSubmit}
                className="p-3.5 rounded-2xl bg-md-surface-container space-y-2.5"
              >
                {/* Sélecteur photo de profil compact sans bordure */}
                <div className="p-2.5 rounded-xl bg-md-surface flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => signUpAvatarInputRef.current?.click()}
                    title="Ajouter une photo de profil"
                    className="w-12 h-12 rounded-full bg-md-surface-high hover:bg-md-primary-container hover:text-md-on-primary-container flex items-center justify-center overflow-hidden shrink-0 transition-colors"
                  >
                    {signUpAvatarPreview ? (
                      <img
                        src={signUpAvatarPreview}
                        alt="Aperçu de la photo de profil"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <IconCamera
                        size={16}
                        className="text-md-on-surface-variant"
                      />
                    )}
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[11px] font-semibold text-md-on-surface leading-tight">
                      Photo de profil{' '}
                      <span className="font-normal text-md-on-surface-variant">
                        (optionnelle)
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => signUpAvatarInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-md-surface-high hover:bg-md-primary-container hover:text-md-on-primary-container text-[10px] font-semibold text-md-on-surface transition-colors"
                      >
                        <IconUpload size={10} />
                        <span>{signUpAvatarFile ? 'Changer' : 'Choisir'}</span>
                      </button>
                      {signUpAvatarFile && (
                        <button
                          type="button"
                          onClick={handleClearSignUpAvatar}
                          className="px-2 py-1 rounded-full text-[10px] font-medium text-md-on-surface-variant hover:text-rose-500 transition-colors"
                        >
                          Retirer
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    ref={signUpAvatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleSelectSignUpAvatar}
                    className="sr-only"
                    aria-label="Téléverser une photo de profil"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="auth-signup-name"
                    className="block text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant px-0.5"
                  >
                    Nom d'affichage
                  </label>
                  <input
                    id="auth-signup-name"
                    name="fullname"
                    type="text"
                    autoComplete="name"
                    enterKeyHint="next"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    placeholder="Optionnel (ex. Alice Martin)"
                    className="w-full px-3 py-2 rounded-xl bg-md-surface-high text-xs text-md-on-surface placeholder:text-md-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-md-primary/45 transition-shadow"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="auth-signup-email"
                    className="block text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant px-0.5"
                  >
                    Adresse e-mail
                  </label>
                  <input
                    id="auth-signup-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    spellCheck={false}
                    enterKeyHint="next"
                    required
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="w-full px-3 py-2 rounded-xl bg-md-surface-high text-xs text-md-on-surface placeholder:text-md-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-md-primary/45 transition-shadow"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="auth-signup-password"
                    className="block text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant px-0.5"
                  >
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="auth-signup-password"
                      name="new-password"
                      type={showSignUpPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      enterKeyHint="done"
                      minLength={6}
                      required
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder="6 caractères minimum"
                      className="w-full pl-3 pr-9 py-2 rounded-xl bg-md-surface-high text-xs text-md-on-surface placeholder:text-md-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-md-primary/45 transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpPassword((prev) => !prev)}
                      aria-label={
                        showSignUpPassword
                          ? 'Masquer le mot de passe'
                          : 'Afficher le mot de passe'
                      }
                      aria-pressed={showSignUpPassword}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-md-on-surface-variant hover:text-md-on-surface"
                    >
                      {showSignUpPassword ? (
                        <IconEyeOff size={13} />
                      ) : (
                        <IconEye size={13} />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full mt-1 py-2 px-4 rounded-full bg-md-primary text-md-on-primary text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {busy ? 'Création du compte…' : 'Créer un compte'}
                </button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AccountApp;
