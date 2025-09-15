import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserState {
  isSubscription: boolean;
  setSubscription: (isSubscription: boolean) => void;
  checkSubscription: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  isSubscription: false,
  setSubscription: (isSubscription) => set({ isSubscription }),
  checkSubscription: async () => {
    const isSubscription = await AsyncStorage.getItem('isSubscription');
    set({ isSubscription: isSubscription === 'true' });
  },
}));
