# 📱 AgStore Mobile App 

The React Native mobile application for AgStore - a comprehensive e-commerce and delivery platform built with Expo.

## 🚀 Features

### Customer App
- **Product Browsing**: Browse products with categories and search
- **Shopping Cart**: Real-time cart management with price calculations
- **User Authentication**: Secure login/registration
- **Address Management**: Multiple addresses with Google Maps integration
- **Order Tracking**: Real-time order status and delivery partner location
- **Payment Integration**: Razorpay payment gateway
- **Push Notifications**: Order updates and promotions

### Delivery Partner App
- **Order Management**: Accept/reject delivery requests
- **Navigation**: Google Maps integration for optimal routes
- **Real-time Updates**: Live location sharing during deliveries
- **Earnings Tracking**: Daily/weekly earnings reports

## 🛠️ Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand with AsyncStorage persistence
- **Maps**: React Native Maps with Google Maps
- **Payments**: Razorpay React Native SDK
- **Real-time**: Socket.IO client
- **Performance**: Image optimization and caching

## 📋 Prerequisites

- Node.js (v18 or higher)
- Expo CLI (`npm install -g @expo/eas-cli`)
- Android Studio (for Android development)
- Xcode (for iOS development)

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
# API Configuration
EXPO_PUBLIC_API_URL=https://your-backend-url.com
EXPO_PUBLIC_DEV_API_URL=http://192.168.1.100:3000
EXPO_PUBLIC_PROD_API_URL=https://your-production-api.com

# Payment Gateway
EXPO_PUBLIC_RAZORPAY_KEY_ID=your-razorpay-key-id

# Google Maps
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Assets
EXPO_PUBLIC_PLACEHOLDER_IMAGE=https://via.placeholder.com/150x150/f0f0f0/cccccc?text=Loading
```

### 3. Start Development Server
```bash
npx expo start
```

### 4. Run on Device/Simulator

#### iOS Simulator
```bash
npx expo start --ios
```

#### Android Emulator
```bash
npx expo start --android
```

#### Physical Device
1. Install Expo Go app from App Store/Play Store
2. Scan QR code from terminal
3. Or build development client for full features

## 📱 Development

### Project Structure
```
lush/
├── app/                    # File-based routing (Expo Router)
│   ├── screens/           # Screen components
│   ├── components/        # Reusable components
│   └── (tabs)/           # Tab navigation
├── src/
│   ├── components/        # Shared components
│   ├── config/           # Configuration files
│   ├── context/          # React contexts
│   ├── hooks/            # Custom hooks
│   ├── store/            # Zustand stores
│   └── utils/            # Utility functions
├── assets/               # Images, fonts, etc.
└── types/               # TypeScript type definitions
```

### Key Components

#### State Management (Zustand)
- `appStore.ts` - Global app state
- `cartStore.ts` - Shopping cart management
- `addressStore.ts` - Address management

#### API Configuration
- `api.ts` - Axios configuration with interceptors
- Environment-based URL switching
- Automatic token refresh

#### Real-time Features
- Socket.IO integration for live updates
- Order tracking with delivery partner location
- Push notifications

## 🏗️ Building for Production

### EAS Build Setup
```bash
# Configure build
eas build:configure

# Build for Android
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production
```

### App Store Submission
```bash
# Submit to Google Play Store
eas submit --platform android

# Submit to Apple App Store
eas submit --platform ios
```

## 🧪 Testing

### Run Tests
```bash
npm test
```

### E2E Testing
```bash
# Install Detox (if configured)
npm run test:e2e
```

## 🔧 Configuration

### App Configuration
The app uses `app.config.js` for dynamic configuration:
- Environment-based API URLs
- Google Maps API keys
- App metadata and permissions

### Build Profiles (eas.json)
- **development**: Development builds with debugging
- **preview**: Internal testing builds
- **production**: App store ready builds

## 📊 Performance

### Optimizations Implemented
- **Image Caching**: Optimized image loading with caching
- **Lazy Loading**: Components loaded on demand
- **State Persistence**: Zustand with AsyncStorage
- **API Caching**: Request deduplication and caching
- **Bundle Splitting**: Optimized bundle size

### Performance Monitoring
- Error boundary implementation
- Performance metrics tracking
- Crash reporting integration

## 🔐 Security

- **Secure Storage**: Sensitive data stored securely
- **API Security**: JWT tokens with automatic refresh
- **Input Validation**: Client-side validation
- **Environment Variables**: No hardcoded secrets

## 🐛 Troubleshooting

### Common Issues

#### Metro bundler issues
```bash
npx expo start --clear
```

#### iOS build issues
```bash
cd ios && pod install
```

#### Android build issues
```bash
cd android && ./gradlew clean
```

### Debug Mode
```bash
npx expo start --dev-client
```

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

## 🤝 Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Add tests for new features
4. Update documentation as needed

## 📄 License

This project is part of the AgStore platform and follows the same MIT License.

---

**Part of the AgStore E-commerce Platform** 🛒
