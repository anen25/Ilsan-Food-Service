
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from "./supabase";

// Firebase Cloud Messaging Configuration
// Environment variables injected via vite.config.ts define
declare const __FIREBASE_API_KEY__: string;
declare const __FIREBASE_AUTH_DOMAIN__: string;
declare const __FIREBASE_PROJECT_ID__: string;
declare const __FIREBASE_STORAGE_BUCKET__: string;
declare const __FIREBASE_MESSAGING_SENDER_ID__: string;
declare const __FIREBASE_APP_ID__: string;
declare const __FIREBASE_VAPID_KEY__: string;

const firebaseConfig = {
    apiKey: __FIREBASE_API_KEY__,
    authDomain: __FIREBASE_AUTH_DOMAIN__,
    projectId: __FIREBASE_PROJECT_ID__,
    storageBucket: __FIREBASE_STORAGE_BUCKET__,
    messagingSenderId: __FIREBASE_MESSAGING_SENDER_ID__,
    appId: __FIREBASE_APP_ID__
};

// Initialize Firebase only if config is present to avoid errors during dev
const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// Request User Permission & Get FCM Token
export const requestNotificationPermission = async (userId: string) => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await getToken(messaging, {
                vapidKey: __FIREBASE_VAPID_KEY__
            });

            if (token && userId) {
                // Save token to Supabase users table
                const { error } = await supabase
                    .from('users')
                    .update({ fcm_token: token })
                    .eq('id', userId);

                if (error) console.error('Error saving FCM token:', error);
                return token;
            }
        }
    } catch (error) {
        console.error('An error occurred while retrieving token. ', error);
    }
    return null;
};

// Listen for foreground messages
export const onMessageListener = () =>
    new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
