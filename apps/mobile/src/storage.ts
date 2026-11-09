import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface StoredConnection {
  baseUrl: string;
  apiKey: string;
}

const CONNECTION_KEY = "magnet.mobile.connection.v1";
const LEGACY_CONNECTION_KEY = "lnkz.mobile.connection.v1";

function webStorage(): Storage | undefined {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export async function loadConnection(): Promise<StoredConnection | null> {
  const current = Platform.OS === "web"
    ? webStorage()?.getItem(CONNECTION_KEY) ?? null
    : await SecureStore.getItemAsync(CONNECTION_KEY);
  const raw = current ?? (Platform.OS === "web"
    ? webStorage()?.getItem(LEGACY_CONNECTION_KEY) ?? null
    : await SecureStore.getItemAsync(LEGACY_CONNECTION_KEY));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredConnection>;
    if (typeof value.baseUrl !== "string" || typeof value.apiKey !== "string") return null;
    const connection = { baseUrl: value.baseUrl, apiKey: value.apiKey };
    if (current === null) {
      // A storage write failure must not discard a readable legacy connection.
      try { await saveConnection(connection); } catch {}
    }
    return connection;
  } catch {
    return null;
  }
}

export async function saveConnection(value: StoredConnection): Promise<void> {
  const raw = JSON.stringify(value);
  if (Platform.OS === "web") {
    webStorage()?.setItem(CONNECTION_KEY, raw);
    webStorage()?.removeItem(LEGACY_CONNECTION_KEY);
    return;
  }
  await SecureStore.setItemAsync(CONNECTION_KEY, raw, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.deleteItemAsync(LEGACY_CONNECTION_KEY);
}

export async function clearConnection(): Promise<void> {
  if (Platform.OS === "web") {
    webStorage()?.removeItem(CONNECTION_KEY);
    webStorage()?.removeItem(LEGACY_CONNECTION_KEY);
    return;
  }
  await Promise.all([SecureStore.deleteItemAsync(CONNECTION_KEY), SecureStore.deleteItemAsync(LEGACY_CONNECTION_KEY)]);
}
