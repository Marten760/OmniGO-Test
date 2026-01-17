import { useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// You need to generate these keys once and store them securely.
// Use `npx web-push generate-vapid-keys` in your terminal.
const VAPID_PUBLIC_KEY = 'BJgiD8hBFmhpApEvY8YNZRGtzEA71z6TLzqWT7rgu21DusPMu8r_AC4xO7Tv0V4nA912vfjwnU1nKraqGQJPf0k'; // Replace with your actual public key

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { sessionToken } = useAuth();
  const registerPushToken = useMutation(api.chat.registerPushToken);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window && sessionToken) {
      navigator.serviceWorker.register('/sw.js')
        .then(swReg => {
          console.log('Service Worker is registered', swReg);
          // Ask for permission and subscribe
          return swReg.pushManager.getSubscription().then(subscription => {
            if (subscription === null) {
              // Not subscribed, so ask for permission
              return swReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
              });
            } else {
              // Already subscribed
              return subscription;
            }
          });
        })
        .then(subscription => {
          if (subscription) {
            console.log('User is subscribed:', subscription);
            // Send the subscription to your Convex backend
            registerPushToken({
              tokenIdentifier: sessionToken,
              subscription: JSON.parse(JSON.stringify(subscription)), // Ensure it's a plain object
            });
          }
        })
        .catch(error => {
          console.error('Service Worker Error', error);
          if (Notification.permission === 'denied') {
            toast.warning('Push notifications are blocked. Please enable them in your browser settings.');
          }
        });
    }
  }, [sessionToken, registerPushToken]);
}
