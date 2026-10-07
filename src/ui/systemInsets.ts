import { Platform, StatusBar } from 'react-native';

export const androidTopSystemInset =
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
