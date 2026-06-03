/**
 * Unified Data Fetching Hook & Database Connectivity
 * Standardized way to fetch data across all ERP modules
 * 
 * Features:
 * - Automatic error handling
 * - Loading states
 * - Retry logic
 * - Caching support
 * - Database validation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../services/apiClient';

interface FetchOptions {
  skipCache?: boolean;
  retryCount?: number;
  cacheTime?: number; // in ms
}

interface UseFetchResult<T> {
  data: T | null;
  fullResponse: any | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isOnline: boolean;
  cacheHit: boolean;
}

// Global cache store
const dataCache = new Map<string, { data: any; fullResponse: any; timestamp: number }>();

/**
 * Universal Data Fetching Hook
 * Usage: const { data, loading, error, refetch } = useDataFetch('/api/endpoint');
 */
export const useDataFetch = <T = any>(
  endpoint: string,
  options: FetchOptions = {},
  deps: any[] = []
): UseFetchResult<T> => {
  const [data, setData] = useState<T | null>(null);
  const [fullResponse, setFullResponse] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [cacheHit, setCacheHit] = useState(false);

  const cacheTimeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    skipCache = false,
    retryCount = 3,
    cacheTime = 5 * 60 * 1000 // 5 minutes default
  } = options;

  // Check cache
  const getFromCache = useCallback((): { data: T; fullResponse: any } | null => {
    if (skipCache) return null;

    const cached = dataCache.get(endpoint);
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      return { data: cached.data as T, fullResponse: cached.fullResponse };
    }

    dataCache.delete(endpoint);
    return null;
  }, [endpoint, skipCache, cacheTime]);

  // Set cache
  const setInCache = useCallback((value: T, full: any) => {
    dataCache.set(endpoint, { data: value, fullResponse: full, timestamp: Date.now() });
  }, [endpoint]);

  // Fetch with retry
  const fetchData = useCallback(
    async (attemptNumber = 0): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        // Check cache first
        const cached = getFromCache();
        if (cached) {
          setData(cached.data);
          setFullResponse(cached.fullResponse);
          setCacheHit(true);
          setLoading(false);
          return;
        }

        setCacheHit(false);

        // Cancel previous request if still pending
        abortControllerRef.current?.abort('New request started');
        abortControllerRef.current = new AbortController();

        // Fetch from API
        const response = await apiClient.get<any>(endpoint, {
          signal: abortControllerRef.current.signal
        });

        // Extract data if wrapped in standard { success, data } object
        const isStandardWrapper = response && typeof response === 'object' && 'success' in response && 'data' in response;
        
        const finalData = isStandardWrapper ? response.data : response;

        setData(finalData);
        setFullResponse(response);
        setInCache(finalData, response);
        setIsOnline(true);
        setLoading(false);
      } catch (err: any) {
        // Check for abort signals
        const isAbort = 
          err?.name === 'AbortError' || 
          err?.message?.includes('AbortError') || 
          err?.message?.includes('unmounted') || 
          err?.message?.includes('New request') ||
          (typeof err === 'string' && (err.includes('unmounted') || err.includes('New request')));

        // Skip if request was intentionally aborted
        if (isAbort) {
          return;
        }

        // Check if offline
        if (!navigator.onLine) {
          setIsOnline(false);
          setError('No internet connection');
          setLoading(false);
          return;
        }

        // Retry logic
        if (attemptNumber < retryCount - 1) {
          console.warn(`Retry attempt ${attemptNumber + 1} for ${endpoint}`);
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attemptNumber) * 1000)
          );
          return fetchData(attemptNumber + 1);
        }

        // Final error
        const errorMessage = err.message || `Failed to fetch from ${endpoint}`;
        setError(errorMessage);
        setLoading(false);
      }
    },
    [endpoint, getFromCache, setInCache, retryCount]
  );

  // Initial fetch
  useEffect(() => {
    fetchData();

    return () => {
      abortControllerRef.current?.abort('Component unmounted');
      if (cacheTimeoutRef.current) {
        clearTimeout(cacheTimeoutRef.current);
      }
    };
  }, [fetchData, ...deps]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    data,
    fullResponse,
    loading,
    error,
    refetch: () => fetchData(),
    isOnline,
    cacheHit
  };
};

// ============================================
// DATABASE CONNECTIVITY CHECKER
// ============================================

interface DatabaseStatus {
  connected: boolean;
  uptime: number;
  environment: string;
  database: string;
  lastCheck: Date;
  error?: string;
}

export const useDatabaseStatus = (checkInterval = 30000) => {
  const [status, setStatus] = useState<DatabaseStatus>({
    connected: false,
    uptime: 0,
    environment: 'unknown',
    database: 'unknown',
    lastCheck: new Date()
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      abortControllerRef.current?.abort('Re-checking connection');
      abortControllerRef.current = new AbortController();

      const response = await apiClient.get('/api/health', {
        signal: abortControllerRef.current.signal
      });

      setStatus({
        connected: true,
        uptime: response.uptime || 0,
        environment: response.environment || 'unknown',
        database: response.database || 'unknown',
        lastCheck: new Date()
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;

      setStatus((prev) => ({
        ...prev,
        connected: false,
        lastCheck: new Date(),
        error: err.message
      }));
    }
  }, []);

  // Check on mount
  useEffect(() => {
    checkConnection();

    // Setup interval
    const interval = setInterval(checkConnection, checkInterval);

    return () => {
      clearInterval(interval);
      abortControllerRef.current?.abort('Hook unmounted');
    };
  }, [checkConnection, checkInterval]);

  return { status, recheck: checkConnection };
};

// ============================================
// MULTI-TABLE SEARCH HOOK
// ============================================

interface SearchableItem {
  id: string;
  [key: string]: any;
}

export const useSearch = <T extends SearchableItem>(
  data: T[],
  searchFields: (keyof T)[] = []
) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>(data);

  useEffect(() => {
    if (!query.trim()) {
      setResults(data);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = data.filter((item) =>
      searchFields.some((field) => {
        const value = item[field];
        return value?.toString().toLowerCase().includes(lowerQuery);
      })
    );

    setResults(filtered);
  }, [query, data, JSON.stringify(searchFields)]);

  return { query, setQuery, results };
};

// ============================================
// PAGINATION HOOK
// ============================================

interface PaginationState {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const usePagination = <T>(
  data: T[] = [],
  pageSize = 10
): PaginationState & { paginatedData: T[]; goToPage: (page: number) => void } => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = data.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    const pageNum = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNum);
  };

  return {
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    paginatedData,
    goToPage
  };
};

// ============================================
// FORM VALIDATION HOOK
// ============================================

interface ValidationRules {
  [field: string]: ((value: any) => string | null)[];
}

export const useFormValidation = <T extends Record<string, any>>(
  initialValues: T,
  rules: ValidationRules,
  onSubmit: (values: T) => Promise<void>
) => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = (name: string, value: any): string | null => {
    const fieldRules = rules[name] || [];
    for (const rule of fieldRules) {
      const error = rule(value);
      if (error) return error;
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<any>) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;

    setValues((prev) => ({ ...prev, [name]: fieldValue }));

    // Validate on change if field was touched
    if (touched[name]) {
      const error = validateField(name, fieldValue);
      setErrors((prev) => ({
        ...prev,
        [name]: error || ''
      }));
    }
  };

  const handleBlur = (e: React.FocusEvent<any>) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    const error = validateField(name, value);
    setErrors((prev) => ({
      ...prev,
      [name]: error || ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: Record<string, string> = {};
    Object.keys(rules).forEach((name) => {
      const error = validateField(name, values[name]);
      if (error) newErrors[name] = error;
    });

    setErrors(newErrors);

    // If no errors, submit
    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    setValues,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setErrors,
    setTouched
  };
};
