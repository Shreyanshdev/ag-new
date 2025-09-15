import { InteractionManager } from 'react-native';
import React from 'react';

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: Map<string, number> = new Map();
    private timers: Map<string, number> = new Map();

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    // Start timing an operation
    startTimer(key: string): void {
        this.timers.set(key, Date.now());
    }

    // End timing and record the duration
    endTimer(key: string): number {
        const startTime = this.timers.get(key);
        if (!startTime) {
            console.warn(`⚠️ Timer '${key}' was not started`);
            return 0;
        }

        const duration = Date.now() - startTime;
        this.metrics.set(key, duration);
        this.timers.delete(key);

        if (__DEV__) {
            console.log(`⏱️ ${key}: ${duration}ms`);
        }

        return duration;
    }

    // Record a custom metric
    recordMetric(key: string, value: number): void {
        this.metrics.set(key, value);

        if (__DEV__) {
            console.log(`📊 ${key}: ${value}`);
        }
    }

    // Get all metrics
    getMetrics(): Record<string, number> {
        return Object.fromEntries(this.metrics);
    }

    // Clear all metrics
    clearMetrics(): void {
        this.metrics.clear();
        this.timers.clear();
    }

    // Log performance summary
    logSummary(): void {
        if (__DEV__) {
            console.log('📈 Performance Summary:', this.getMetrics());
        }
    }
}

// Utility functions for common performance monitoring
export const perf = PerformanceMonitor.getInstance();

// HOC for measuring component render time
export function withPerformanceMonitoring<T extends object>(
    Component: React.ComponentType<T>,
    componentName: string
): React.ComponentType<T> {
    return (props: T) => {
        React.useEffect(() => {
            perf.startTimer(`${componentName}_mount`);
            return () => {
                perf.endTimer(`${componentName}_mount`);
            };
        }, []);

        return React.createElement(Component, props);
    };
}

// Hook for measuring async operations
export function useAsyncPerformance() {
    const measureAsync = React.useCallback(async <T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T> => {
        perf.startTimer(operationName);
        try {
            const result = await operation();
            return result;
        } finally {
            perf.endTimer(operationName);
        }
    }, []);

    return { measureAsync };
}

// Utility for measuring API call performance
export async function measureApiCall<T>(
    apiCall: () => Promise<T>,
    endpoint: string
): Promise<T> {
    const key = `api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
    perf.startTimer(key);

    try {
        const result = await apiCall();
        return result;
    } finally {
        perf.endTimer(key);
    }
}

// Utility for measuring component render performance
export function measureRender(componentName: string) {
    return function <T extends object>(Component: React.ComponentType<T>) {
        return React.memo((props: T) => {
            const renderStart = React.useRef<number>(0);

            // Measure render start
            renderStart.current = Date.now();

            React.useLayoutEffect(() => {
                if (renderStart.current) {
                    const renderTime = Date.now() - renderStart.current;
                    perf.recordMetric(`${componentName}_render`, renderTime);
                }
            });

            return React.createElement(Component, props);
        });
    };
}

// Utility for deferring non-critical operations
export function deferToNextFrame(callback: () => void): void {
    InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(callback);
    });
}

// Utility for batching state updates
export function batchUpdates(updates: (() => void)[]): void {
    InteractionManager.runAfterInteractions(() => {
        updates.forEach(update => update());
    });
}

// Memory usage monitoring (basic)
export function logMemoryUsage(context: string): void {
    if (__DEV__ && (global as any).performance?.memory) {
        const memory = (global as any).performance.memory;
        console.log(`🧠 Memory Usage (${context}):`, {
            used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
            total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
            limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`
        });
    }
}

// FPS monitoring utility
export class FPSMonitor {
    private frameCount = 0;
    private lastTime = Date.now();
    private fps = 60;
    private isRunning = false;

    start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.frameCount = 0;
        this.lastTime = Date.now();
        this.measureFPS();
    }

    stop(): void {
        this.isRunning = false;
    }

    getCurrentFPS(): number {
        return this.fps;
    }

    private measureFPS(): void {
        if (!this.isRunning) return;

        requestAnimationFrame(() => {
            this.frameCount++;
            const currentTime = Date.now();

            if (currentTime - this.lastTime >= 1000) {
                this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));

                if (__DEV__ && this.fps < 50) {
                    console.warn(`⚠️ Low FPS detected: ${this.fps}`);
                }

                perf.recordMetric('fps', this.fps);
                this.frameCount = 0;
                this.lastTime = currentTime;
            }

            this.measureFPS();
        });
    }
}

export const fpsMonitor = new FPSMonitor();