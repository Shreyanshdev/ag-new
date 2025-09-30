export default {
  expo: {
    name: "agstore",
    slug: "agstore-v2",
    version: "1.0.0",
    owner: "vasuji",
    orientation: "portrait",
    icon: "./assets/images/agstore-logo-transparent.png",
    scheme: "agstore",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.anonymous.agstore",
      icon: "./assets/images/agstore-logo-transparent.png",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      }
    },
    android: {
      icon: "./assets/images/agstore-logo-transparent.png",
      adaptiveIcon: {
        foregroundImage: "./assets/images/agstore-logo-transparent.png",
        backgroundColor: "#ffffff"
      },
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      edgeToEdgeEnabled: true,
      package: "com.anonymous.agstore"
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/agstore-logo-transparent.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow AgStore to use your location to provide real-time delivery tracking."
        }
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/agstore-story.png",
          imageWidth: 300,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {},
      eas: {
        projectId: "55b933c8-2485-4ae0-9f26-99a8614f2f9a",
      },
    }
  }
};