import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { HeaderActions } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../lib/theme';

import CenterLoginScreen from '../screens/auth/CenterLoginScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';

import InvigilatorScanScreen from '../screens/invigilator/InvigilatorScanScreen';

import MyQuestionsScreen from '../screens/teacher/MyQuestionsScreen';
import TeacherDashboard from '../screens/teacher/TeacherDashboard';
import UploadQuestionScreen from '../screens/teacher/UploadQuestionScreen';

import ComposePaperScreen from '../screens/setter/ComposePaperScreen';
import MyPapersScreen from '../screens/setter/MyPapersScreen';
import QuestionPoolScreen from '../screens/setter/QuestionPoolScreen';
import SetterDashboard from '../screens/setter/SetterDashboard';

import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminPapersScreen from '../screens/admin/AdminPapersScreen';
import AuditLogScreen from '../screens/admin/AuditLogScreen';
import CentersScreen from '../screens/admin/CentersScreen';
import CustodyScreen from '../screens/admin/CustodyScreen';
import ExamsScreen from '../screens/admin/ExamsScreen';
import PrintPreviewScreen from '../screens/admin/PrintPreviewScreen';

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  CenterLogin: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator();

function icon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}

function useTabScreenOptions() {
  const { colors } = useTheme();
  return useMemo(
    () => ({
      headerStyle: { backgroundColor: colors.bg },
      headerTitleStyle: { color: colors.text, fontWeight: '800' as const, fontSize: 17 },
      headerTintColor: colors.text,
      headerShadowVisible: false,
      headerRight: () => <HeaderActions />,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        paddingTop: 4,
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textDim,
      tabBarLabelStyle: { fontWeight: '600' as const },
    }),
    [colors]
  );
}

function TeacherTabs() {
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs.Navigator screenOptions={screenOptions}>
      <Tabs.Screen
        name="TeacherDashboard"
        component={TeacherDashboard}
        options={{ title: 'Dashboard', tabBarIcon: icon('speedometer-outline') }}
      />
      <Tabs.Screen
        name="Upload"
        component={UploadQuestionScreen}
        options={{ title: 'Upload Questions', tabBarLabel: 'Upload', tabBarIcon: icon('cloud-upload-outline') }}
      />
      <Tabs.Screen
        name="MyQuestions"
        component={MyQuestionsScreen}
        options={{ title: 'My Questions', tabBarIcon: icon('list-outline') }}
      />
    </Tabs.Navigator>
  );
}

function SetterTabs() {
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs.Navigator screenOptions={screenOptions}>
      <Tabs.Screen
        name="SetterDashboard"
        component={SetterDashboard}
        options={{ title: 'Dashboard', tabBarIcon: icon('speedometer-outline') }}
      />
      <Tabs.Screen
        name="QuestionPool"
        component={QuestionPoolScreen}
        options={{ title: 'Question Pool', tabBarLabel: 'Pool', tabBarIcon: icon('library-outline') }}
      />
      <Tabs.Screen
        name="Compose"
        component={ComposePaperScreen}
        options={{ title: 'Compose Paper', tabBarLabel: 'Compose', tabBarIcon: icon('create-outline') }}
      />
      <Tabs.Screen
        name="MyPapers"
        component={MyPapersScreen}
        options={{ title: 'My Papers', tabBarIcon: icon('documents-outline') }}
      />
    </Tabs.Navigator>
  );
}

function AdminTabs() {
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs.Navigator screenOptions={screenOptions}>
      <Tabs.Screen
        name="AdminDashboard"
        component={AdminDashboard}
        options={{ title: 'Command Center', tabBarLabel: 'Dashboard', tabBarIcon: icon('speedometer-outline') }}
      />
      <Tabs.Screen
        name="Papers"
        component={AdminPapersScreen}
        options={{ title: 'Papers', tabBarIcon: icon('documents-outline') }}
      />
      <Tabs.Screen
        name="PrintPreview"
        component={PrintPreviewScreen}
        options={{ title: 'Print Preview', tabBarLabel: 'Print', tabBarIcon: icon('print-outline') }}
      />
      <Tabs.Screen
        name="Exams"
        component={ExamsScreen}
        options={{ title: 'Exams', tabBarIcon: icon('calendar-outline') }}
      />
      <Tabs.Screen
        name="Centers"
        component={CentersScreen}
        options={{ title: 'Exam Centers', tabBarLabel: 'Centers', tabBarIcon: icon('business-outline') }}
      />
      <Tabs.Screen
        name="Custody"
        component={CustodyScreen}
        options={{ title: 'Chain of Custody', tabBarLabel: 'Custody', tabBarIcon: icon('location-outline') }}
      />
      <Tabs.Screen
        name="Audit"
        component={AuditLogScreen}
        options={{ title: 'Audit Log', tabBarLabel: 'Audit', tabBarIcon: icon('reader-outline') }}
      />
    </Tabs.Navigator>
  );
}

function InvigilatorTabs() {
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs.Navigator screenOptions={screenOptions}>
      <Tabs.Screen
        name="Scan"
        component={InvigilatorScanScreen}
        options={{ title: 'Scan-in', tabBarIcon: icon('qr-code-outline') }}
      />
    </Tabs.Navigator>
  );
}

function navThemeFor(colors: ThemeColors, isDark: boolean): Theme {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };
}

export default function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const navTheme = useMemo(() => navThemeFor(colors, isDark), [colors, isDark]);

  if (loading) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {!session || !profile ? (
        <AuthStack.Navigator
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
        >
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="SignUp" component={SignUpScreen} />
          <AuthStack.Screen name="CenterLogin" component={CenterLoginScreen} />
        </AuthStack.Navigator>
      ) : profile.role === 'teacher' ? (
        <TeacherTabs />
      ) : profile.role === 'paper_setter' ? (
        <SetterTabs />
      ) : profile.role === 'invigilator' ? (
        <InvigilatorTabs />
      ) : (
        <AdminTabs />
      )}
    </NavigationContainer>
  );
}
