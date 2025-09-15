import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, usePathname } from 'expo-router';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  'screens/customer/main/HomeScreen': undefined;
  'screens/customer/products/CategoryScreen': { categoryName: string; categoryId: string };
  
  'screens/customer/orders/OrderHistoryScreen': undefined;
};
type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

const Footer: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', icon: 'home', route: 'screens/customer/main/HomeScreen' },
    { name: 'Categories', icon: 'grid', route: 'screens/customer/products/CategoryScreen' },
    
    { name: 'Orders', icon: 'clipboard', route: 'screens/customer/orders/OrderHistoryScreen' },
  ];

  // Determine current active route name from navigation state, fallback to pathname
  const getCurrentRouteName = (): string | undefined => {
    try {
      const state = navigation.getState?.();
      if (!state) return undefined;
      let navState = state;
      while (navState?.routes && typeof navState.index === 'number') {
        const route = navState.routes[navState.index];
        // @ts-ignore nested state
        if (route.state) {
          // @ts-ignore nested state
          navState = route.state;
        } else {
          return route.name as string;
        }
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  const currentRouteName = getCurrentRouteName();

  const isActive = (targetRoute: string): boolean => {
    if (currentRouteName && currentRouteName === targetRoute) return true;
    if (pathname) {
      if (pathname === '/' && (targetRoute.endsWith('HomeScreen') || targetRoute === 'index')) return true;
      if (pathname === '/index' && (targetRoute.endsWith('HomeScreen') || targetRoute === 'index')) return true;
      if (pathname.endsWith(targetRoute)) return true;
      if (pathname.includes(targetRoute)) return true;
    }
    return false;
  };

  return (
    <View style={styles.container}>
      {navItems.map((item) => {
        const active = isActive(item.route);
        return (
          <TouchableOpacity
            key={item.name}
            onPress={() => {
              if (item.route === 'screens/customer/products/CategoryScreen') {
                navigation.navigate(item.route, { categoryName: '', categoryId: '' });
              } else {
                navigation.navigate(item.route as any);
              }
            }}
            style={[styles.navItem, active && styles.navItemActive]}
            activeOpacity={0.9}
          >
            <View style={[styles.iconPill, active && styles.iconPillActive]}> 
              <Feather
                name={item.icon as any}
                size={22}
                color={active ? '#059669' : '#6b7280'}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 10,
    ...Platform.select({
      ios: {
        paddingBottom: 34,
      },
      android: {
        paddingBottom: 18,
      },
      default: {
        paddingBottom: 18,
      },
    }),
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navItemActive: {},
  iconPill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  iconPillActive: {
    backgroundColor: '#ecfdf5',
  },
  label: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  labelActive: {
    color: '#059669',
  },
});

export default Footer;