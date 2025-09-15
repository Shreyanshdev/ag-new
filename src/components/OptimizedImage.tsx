import React, { memo, useState, useCallback } from 'react';
import { Image, ImageProps, View, ActivityIndicator, StyleSheet } from 'react-native';

interface OptimizedImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  uri: string;
  placeholder?: string;
  showLoader?: boolean;
  loaderColor?: string;
  onLoadComplete?: () => void;
  onError?: (error: any) => void;
}

const OptimizedImage: React.FC<OptimizedImageProps> = memo(({
  uri,
  placeholder = process.env.EXPO_PUBLIC_PLACEHOLDER_IMAGE || 'https://via.placeholder.com/150x150/f0f0f0/cccccc?text=Loading',
  showLoader = true,
  loaderColor = '#22c55e',
  onLoadComplete,
  onError,
  style,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoadComplete?.();
  }, [onLoadComplete]);

  const handleError = useCallback((error: any) => {
    setIsLoading(false);
    setHasError(true);
    onError?.(error);
  }, [onError]);

  const imageSource = hasError ? { uri: placeholder } : { uri };

  return (
    <View style={[styles.container, style]}>
      <Image
        {...props}
        source={imageSource}
        style={[styles.image, style]}
        onLoad={handleLoad}
        onError={handleError}
        resizeMode="cover"
      />
      
      {isLoading && showLoader && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color={loaderColor} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;