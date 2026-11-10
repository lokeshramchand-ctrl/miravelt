jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Pulls in a native push-token listener and an Expo Go warning; these tests never fire notifications.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Icon glyphs load asynchronously and would trigger act() warnings; the tests never assert on them.
jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));
