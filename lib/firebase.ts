
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from "./supabase";

// Firebase Cloud Messaging Configuration
// Environment variables are set in Cloudflare Pages
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
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
                vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || 'YOUR_VAPID_KEY'
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
