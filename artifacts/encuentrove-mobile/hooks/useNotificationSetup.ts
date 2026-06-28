import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PUSH_TOKEN_KEY = "@encuentrove/push_token";

export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function storePushToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  } catch {}
}

export async function acquireExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (finalStatus !== "granted") {
      const { status: requested } = await Notifications.requestPermissionsAsync();
      finalStatus = requested;
    }
    if (finalStatus !== "granted") return null;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    await storePushToken(token);
    return token;
  } catch {
    return null;
  }
}

export function useNotificationSetup() {
  const didInit = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web" || didInit.current) return;
    didInit.current = true;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    acquireExpoPushToken().catch(() => {});
  }, []);
}
