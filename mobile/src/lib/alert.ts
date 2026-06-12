import { Alert, AlertButton, Platform } from 'react-native';

/**
 * Drop-in replacement for Alert.alert. react-native-web ships Alert as a
 * no-op, so on web we fall back to window.alert / window.confirm.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  // confirm() OK maps to the action button, Cancel to the cancel button.
  const action = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
  const cancel = buttons.find((b) => b.style === 'cancel');
  if (window.confirm(text)) {
    action.onPress?.();
  } else {
    cancel?.onPress?.();
  }
}
