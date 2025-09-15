import { Alert } from 'react-native';

export interface AppError {
  message: string;
  type: 'network' | 'server' | 'client' | 'validation' | 'auth' | 'unknown';
  code?: string;
  status?: number;
  isRetryable?: boolean;
  originalError?: any;
}

export class ErrorHandler {
  static createError(
    message: string, 
    type: AppError['type'], 
    options: Partial<AppError> = {}
  ): AppError {
    return {
      message,
      type,
      isRetryable: type === 'network' || type === 'server',
      ...options
    };
  }

  static fromApiError(error: any): AppError {
    // Network errors
    if (!error.response) {
      return this.createError(
        'Network connection failed. Please check your internet connection.',
        'network',
        { originalError: error, isRetryable: true }
      );
    }

    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    // Server errors (5xx)
    if (status >= 500) {
      return this.createError(
        'Server is temporarily unavailable. Please try again later.',
        'server',
        { status, originalError: error, isRetryable: true }
      );
    }

    // Authentication errors (401)
    if (status === 401) {
      return this.createError(
        'Your session has expired. Please login again.',
        'auth',
        { status, originalError: error, isRetryable: false }
      );
    }

    // Validation errors (400)
    if (status === 400) {
      return this.createError(
        message || 'Invalid request. Please check your input.',
        'validation',
        { status, originalError: error, isRetryable: false }
      );
    }

    // Not found errors (404)
    if (status === 404) {
      return this.createError(
        message || 'The requested resource was not found.',
        'client',
        { status, originalError: error, isRetryable: false }
      );
    }

    // Other client errors (4xx)
    if (status >= 400 && status < 500) {
      return this.createError(
        message || 'Request failed. Please try again.',
        'client',
        { status, originalError: error, isRetryable: false }
      );
    }

    // Unknown errors
    return this.createError(
      message || 'An unexpected error occurred.',
      'unknown',
      { status, originalError: error, isRetryable: true }
    );
  }

  static showUserFriendlyAlert(error: AppError, onRetry?: () => void): void {
    const buttons: any[] = [{ text: 'OK', style: 'default' }];

    if (error.isRetryable && onRetry) {
      buttons.unshift({ text: 'Retry', onPress: onRetry });
    }

    Alert.alert(
      this.getErrorTitle(error.type),
      error.message,
      buttons
    );
  }

  static getErrorTitle(type: AppError['type']): string {
    switch (type) {
      case 'network':
        return 'Connection Error';
      case 'server':
        return 'Server Error';
      case 'auth':
        return 'Authentication Required';
      case 'validation':
        return 'Invalid Input';
      case 'client':
        return 'Request Error';
      default:
        return 'Error';
    }
  }

  static logError(error: AppError, context?: string): void {
    const logData = {
      timestamp: new Date().toISOString(),
      context,
      type: error.type,
      message: error.message,
      status: error.status,
      code: error.code,
    };

    console.error('🚨 App Error:', logData);

    // In production, send to crash reporting service
    if (__DEV__) {
      console.error('🚨 Original Error:', error.originalError);
    }
  }

  static async handleAsyncError<T>(
    operation: () => Promise<T>,
    context?: string,
    showAlert: boolean = true
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (rawError) {
      const error = this.fromApiError(rawError);
      this.logError(error, context);

      if (showAlert) {
        this.showUserFriendlyAlert(error, () => {
          // Retry logic can be implemented here
          console.log('User requested retry for:', context);
        });
      }

      return null;
    }
  }

  static handleSyncError(
    operation: () => any,
    context?: string,
    showAlert: boolean = true
  ): any {
    try {
      return operation();
    } catch (rawError) {
      const error = this.fromApiError(rawError);
      this.logError(error, context);

      if (showAlert) {
        this.showUserFriendlyAlert(error);
      }

      return null;
    }
  }
}

// Utility functions for common error scenarios
export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T => {
  return (async (...args: any[]) => {
    return ErrorHandler.handleAsyncError(
      () => fn(...args),
      context || fn.name
    );
  }) as T;
};

export const isFirstTimeUserError = (error: any): boolean => {
  return error?.isFirstTimeUser === true || 
         (error?.status === 404 && (
           error?.message?.includes('No active order') ||
           error?.message?.includes('No active order found')
         ));
};

export const isExpectedError = (error: any): boolean => {
  // Errors that are expected and shouldn't be shown to users
  return isFirstTimeUserError(error) ||
         error?.message?.includes('No active order found') ||
         (global.logoutInProgress && (error?.type === 'auth' || error?.type === 'network'));
};

export const getFirstTimeUserMessage = (error: any): string => {
  if (error?.message?.includes('order')) {
    return "You don't have any active orders yet. Explore products and place your first order!";
  }
  return "Welcome! Explore our products and start your first order!";
};