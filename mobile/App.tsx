import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { PrintPreviewProvider } from './src/context/PrintPreviewContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <PrintPreviewProvider>
            <RootNavigator />
            <ThemedStatusBar />
          </PrintPreviewProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
