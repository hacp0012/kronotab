import { Zenbase } from '@zenbase/sdk';
import type { ZenbaseUser } from '@zenbase/sdk';
import {
  StoredAuthSession,
  ZenbaseConnectionConfig,
  ZenbaseUserProfile,
} from './types';

const PROFILES_COLLECTION = 'user_profiles';
const AVATAR_FOLDER = '/avatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 Mo
const MAX_AVATAR_DIMENSION = 512;

export function isZenbaseConfigured(config: ZenbaseConnectionConfig): boolean {
  return Boolean(config.endpoint.trim() && config.apiKey.trim());
}

export function createZenbaseClient(
  config: ZenbaseConnectionConfig,
  token?: string | null
): Zenbase {
  const endpoint = config.endpoint.trim();
  const apiKey = config.apiKey.trim();

  if (!endpoint || !apiKey) {
    throw new Error(
      'Configuration Zenbase incomplète : renseignez l’URL du serveur et la clé API Zenbase.'
    );
  }

  const client = new Zenbase({
    endpoint,
    apiKey,
    timeoutMs: 15_000,
  });

  if (token) {
    client.auth.setToken(token);
  }

  return client;
}

export function getUserInitials(
  displayName?: string | null,
  email?: string | null
): string {
  const source = (displayName || '').trim() || (email || '').trim();
  if (!source) return '?';

  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }

  const localPart = source.split('@')[0] || source;
  return localPart.slice(0, 2).toUpperCase();
}

export function validateAvatarFile(file: File): string | null {
  if (!file.type || !file.type.startsWith('image/')) {
    return 'Veuillez sélectionner un fichier image valide (PNG, JPG, WebP ou GIF).';
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return 'L’image est trop volumineuse (maximum 5 Mo).';
  }
  return null;
}

async function prepareAvatarFile(file: File): Promise<{
  blob: Blob;
  filename: string;
  mimeType: string;
  ext: string;
}> {
  const fallbackExt =
    file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    'png';

  // Conserve les GIF animés tels quels
  if (file.type === 'image/gif') {
    return {
      blob: file,
      filename: `avatar.${fallbackExt}`,
      mimeType: file.type,
      ext: fallbackExt,
    };
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image illisible'));
        el.src = objectUrl;
      });

      const scale = Math.min(
        1,
        MAX_AVATAR_DIMENSION / Math.max(img.naturalWidth || 1, img.naturalHeight || 1)
      );
      const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
      const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Contexte canvas indisponible');
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const outputMime =
        file.type === 'image/png' || file.type === 'image/webp'
          ? 'image/webp'
          : 'image/jpeg';
      const outputExt = outputMime === 'image/webp' ? 'webp' : 'jpg';

      const compressed = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outputMime, 0.86)
      );

      if (compressed && compressed.size > 0) {
        return {
          blob: compressed,
          filename: `avatar.${outputExt}`,
          mimeType: outputMime,
          ext: outputExt,
        };
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    // Repli sur le fichier original si le redimensionnement échoue
  }

  return {
    blob: file,
    filename: file.name || `avatar.${fallbackExt}`,
    mimeType: file.type || 'image/png',
    ext: fallbackExt,
  };
}

function normalizeProfileDoc(
  raw: unknown,
  fallbackUser?: ZenbaseUser
): ZenbaseUserProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const nested =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : record;

  const userId =
    (typeof nested.user_id === 'string' && nested.user_id) ||
    (typeof record.id === 'string' && record.id) ||
    fallbackUser?.id ||
    '';

  if (!userId) return null;

  return {
    user_id: userId,
    email:
      (typeof nested.email === 'string' && nested.email) ||
      fallbackUser?.email ||
      '',
    display_name:
      typeof nested.display_name === 'string' ? nested.display_name : '',
    avatar_url:
      typeof nested.avatar_url === 'string' && nested.avatar_url
        ? nested.avatar_url
        : null,
    avatar_file_id:
      typeof nested.avatar_file_id === 'string' && nested.avatar_file_id
        ? nested.avatar_file_id
        : null,
    updated_at:
      typeof nested.updated_at === 'string'
        ? nested.updated_at
        : new Date().toISOString(),
  };
}

export async function fetchUserProfile(
  client: Zenbase,
  user: ZenbaseUser
): Promise<ZenbaseUserProfile | null> {
  const byId = await client
    .collection<ZenbaseUserProfile>(PROFILES_COLLECTION)
    .find(user.id);

  if (byId.data) {
    return normalizeProfileDoc(byId.data, user);
  }

  const byField = await client
    .collection<ZenbaseUserProfile>(PROFILES_COLLECTION)
    .where('user_id', '==', user.id)
    .first();

  if (byField.data) {
    return normalizeProfileDoc(byField.data, user);
  }

  return null;
}

export async function saveUserProfile(
  client: Zenbase,
  profile: ZenbaseUserProfile
): Promise<{ profile: ZenbaseUserProfile | null; error: string | null }> {
  const res = await client
    .collection<ZenbaseUserProfile>(PROFILES_COLLECTION)
    .upsert(profile.user_id, profile);

  if (res.error) {
    return { profile: null, error: res.error };
  }

  return {
    profile: normalizeProfileDoc(res.data) ?? profile,
    error: null,
  };
}

export async function uploadUserAvatar(
  client: Zenbase,
  userId: string,
  file: File,
  previousFileId?: string | null
): Promise<{
  url: string | null;
  fileId: string | null;
  error: string | null;
}> {
  const validationError = validateAvatarFile(file);
  if (validationError) {
    return { url: null, fileId: null, error: validationError };
  }

  const prepared = await prepareAvatarFile(file);
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const storagePath = `avatars/${safeId}_${Date.now()}.${prepared.ext}`;

  const uploadRes = await client.storage.upload(storagePath, prepared.blob, {
    folder: AVATAR_FOLDER,
    filename: prepared.filename,
    mimeType: prepared.mimeType,
  });

  if (uploadRes.error) {
    return { url: null, fileId: null, error: uploadRes.error };
  }

  const fileId = uploadRes.data?.id ?? null;
  const resolvedUrl =
    uploadRes.fileUrl ||
    uploadRes.url ||
    (uploadRes.data?.url
      ? client.storage.getPublicUrl(uploadRes.data.url)
      : null) ||
    (fileId ? client.storage.getPublicUrl(fileId) : null);

  if (!resolvedUrl) {
    return {
      url: null,
      fileId,
      error: 'Téléversement réussi mais URL de la photo introuvable.',
    };
  }

  if (previousFileId && previousFileId !== fileId) {
    void client.storage.delete(previousFileId).catch(() => {});
  }

  return {
    url: resolvedUrl,
    fileId,
    error: null,
  };
}

export async function signUpWithZenbase(
  config: ZenbaseConnectionConfig,
  params: {
    email: string;
    password: string;
    displayName?: string;
    avatarFile?: File | null;
  }
): Promise<{
  session: StoredAuthSession | null;
  error: string | null;
  warning?: string | null;
}> {
  let client: Zenbase;
  try {
    client = createZenbaseClient(config);
  } catch (err) {
    return {
      session: null,
      error: err instanceof Error ? err.message : 'Configuration invalide.',
    };
  }

  const email = params.email.trim();
  const signUpRes = await client.auth.signUp(email, params.password);
  if (signUpRes.error || !signUpRes.user || !signUpRes.token) {
    return {
      session: null,
      error: signUpRes.error || 'Impossible de créer le compte.',
    };
  }

  const user = signUpRes.user;
  const token = signUpRes.token;
  let avatarUrl: string | null = null;
  let avatarFileId: string | null = null;
  let warning: string | null = null;

  if (params.avatarFile) {
    const uploadRes = await uploadUserAvatar(client, user.id, params.avatarFile);
    if (uploadRes.error) {
      warning = `Compte créé, mais l’envoi de la photo a échoué : ${uploadRes.error}`;
    } else {
      avatarUrl = uploadRes.url;
      avatarFileId = uploadRes.fileId;
    }
  }

  const profilePayload: ZenbaseUserProfile = {
    user_id: user.id,
    email: user.email,
    display_name: (params.displayName || '').trim(),
    avatar_url: avatarUrl,
    avatar_file_id: avatarFileId,
    updated_at: new Date().toISOString(),
  };

  const savedProfile = await saveUserProfile(client, profilePayload);
  if (savedProfile.error && !warning) {
    warning = `Compte créé, mais le profil n’a pas pu être synchronisé : ${savedProfile.error}`;
  }

  return {
    session: {
      token,
      user,
      profile: savedProfile.profile ?? profilePayload,
    },
    error: null,
    warning,
  };
}

export async function signInWithZenbasePassword(
  config: ZenbaseConnectionConfig,
  params: { email: string; password: string }
): Promise<{ session: StoredAuthSession | null; error: string | null }> {
  let client: Zenbase;
  try {
    client = createZenbaseClient(config);
  } catch (err) {
    return {
      session: null,
      error: err instanceof Error ? err.message : 'Configuration invalide.',
    };
  }

  const signInRes = await client.auth.signInWithPassword(
    params.email.trim(),
    params.password
  );
  if (signInRes.error || !signInRes.user || !signInRes.token) {
    return {
      session: null,
      error: signInRes.error || 'Identifiants incorrects.',
    };
  }

  const profile = await fetchUserProfile(client, signInRes.user).catch(
    () => null
  );

  return {
    session: {
      token: signInRes.token,
      user: signInRes.user,
      profile,
    },
    error: null,
  };
}

export async function sendZenbaseOtp(
  config: ZenbaseConnectionConfig,
  email: string
): Promise<{ expiresAt: string | null; error: string | null }> {
  let client: Zenbase;
  try {
    client = createZenbaseClient(config);
  } catch (err) {
    return {
      expiresAt: null,
      error: err instanceof Error ? err.message : 'Configuration invalide.',
    };
  }

  const res = await client.auth.sendOtp(email.trim());
  return {
    expiresAt: res.expires_at,
    error: res.error,
  };
}

export async function verifyZenbaseOtp(
  config: ZenbaseConnectionConfig,
  email: string,
  code: string
): Promise<{ session: StoredAuthSession | null; error: string | null }> {
  let client: Zenbase;
  try {
    client = createZenbaseClient(config);
  } catch (err) {
    return {
      session: null,
      error: err instanceof Error ? err.message : 'Configuration invalide.',
    };
  }

  const res = await client.auth.verifyOtp(email.trim(), code.trim());
  if (res.error || !res.user || !res.token) {
    return {
      session: null,
      error: res.error || 'Code OTP invalide ou expiré.',
    };
  }

  const profile = await fetchUserProfile(client, res.user).catch(() => null);

  return {
    session: {
      token: res.token,
      user: res.user,
      profile,
    },
    error: null,
  };
}

export async function refreshZenbaseSession(
  config: ZenbaseConnectionConfig,
  currentSession: StoredAuthSession
): Promise<{
  session: StoredAuthSession | null;
  unauthorized: boolean;
  unreachable: boolean;
}> {
  if (!isZenbaseConfigured(config)) {
    return { session: currentSession, unauthorized: false, unreachable: true };
  }

  const client = createZenbaseClient(config, currentSession.token);
  const userRes = await client.auth.getUser();

  if (userRes.error || !userRes.data?.user) {
    const errText = (userRes.error || '').toLowerCase();
    const isAuthError =
      errText.includes('401') ||
      errText.includes('403') ||
      errText.includes('unauthenticated') ||
      errText.includes('invalide') ||
      errText.includes('expir') ||
      errText.includes('token');

    if (isAuthError) {
      return { session: null, unauthorized: true, unreachable: false };
    }
    return { session: currentSession, unauthorized: false, unreachable: true };
  }

  const freshUser = userRes.data.user;
  const freshProfile =
    (await fetchUserProfile(client, freshUser).catch(() => null)) ??
    currentSession.profile;

  return {
    session: {
      token: currentSession.token,
      user: freshUser,
      profile: freshProfile,
    },
    unauthorized: false,
    unreachable: false,
  };
}

export async function updateZenbaseProfile(
  config: ZenbaseConnectionConfig,
  currentSession: StoredAuthSession,
  updates: {
    displayName?: string;
    avatarFile?: File | null;
    removeAvatar?: boolean;
  }
): Promise<{ session: StoredAuthSession | null; error: string | null }> {
  let client: Zenbase;
  try {
    client = createZenbaseClient(config, currentSession.token);
  } catch (err) {
    return {
      session: null,
      error: err instanceof Error ? err.message : 'Configuration invalide.',
    };
  }

  const existingProfile = currentSession.profile;
  let avatarUrl = existingProfile?.avatar_url ?? null;
  let avatarFileId = existingProfile?.avatar_file_id ?? null;

  if (updates.removeAvatar) {
    if (avatarFileId) {
      void client.storage.delete(avatarFileId).catch(() => {});
    }
    avatarUrl = null;
    avatarFileId = null;
  } else if (updates.avatarFile) {
    const uploadRes = await uploadUserAvatar(
      client,
      currentSession.user.id,
      updates.avatarFile,
      avatarFileId
    );
    if (uploadRes.error) {
      return { session: null, error: uploadRes.error };
    }
    avatarUrl = uploadRes.url;
    avatarFileId = uploadRes.fileId;
  }

  const nextProfile: ZenbaseUserProfile = {
    user_id: currentSession.user.id,
    email: currentSession.user.email,
    display_name:
      updates.displayName !== undefined
        ? updates.displayName.trim()
        : existingProfile?.display_name ?? '',
    avatar_url: avatarUrl,
    avatar_file_id: avatarFileId,
    updated_at: new Date().toISOString(),
  };

  const saved = await saveUserProfile(client, nextProfile);
  if (saved.error) {
    return { session: null, error: saved.error };
  }

  return {
    session: {
      ...currentSession,
      profile: saved.profile ?? nextProfile,
    },
    error: null,
  };
}

export async function updateZenbasePassword(
  config: ZenbaseConnectionConfig,
  token: string,
  currentPassword: string | null,
  newPassword: string
): Promise<{ error: string | null }> {
  let client: Zenbase;
  try {
    client = createZenbaseClient(config, token);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Configuration invalide.',
    };
  }

  const res = await client.auth.updatePassword(currentPassword, newPassword);
  return { error: res.error };
}

export async function signOutFromZenbase(
  config: ZenbaseConnectionConfig,
  token: string
): Promise<void> {
  if (!isZenbaseConfigured(config)) return;
  try {
    const client = createZenbaseClient(config, token);
    await client.auth.signOut();
  } catch {
    // La déconnexion locale est toujours appliquée même hors-ligne
  }
}
