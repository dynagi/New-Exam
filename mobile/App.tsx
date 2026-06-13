import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { PrintPreviewProvider } from './src/context/PrintPreviewContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

/** Web-only: smooth scrolling + slim premium scrollbars. */
function WebStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'saix-web-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = `
      html { scroll-behavior: smooth; }
      * { scrollbar-width: thin; scrollbar-color: rgba(120,140,180,0.45) transparent; }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb {
        background: rgba(120,140,180,0.45);
        border-radius: 8px;
        border: 2px solid transparent;
        background-clip: content-box;
      }
      ::-webkit-scrollbar-thumb:hover { background: rgba(120,140,180,0.7); background-clip: content-box; }
    `;
    document.head.appendChild(el);
  }, []);
  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <PrintPreviewProvider>
            <WebStyles />
            <RootNavigator />
            <ThemedStatusBar />
          </PrintPreviewProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
