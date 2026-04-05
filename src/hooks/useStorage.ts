import { useState, useCallback } from 'react';
import { uploadFile, uploadFiles, deleteFile, validateFile, UploadResult } from '../utils/storage';

export interface UseStorageReturn {
  upload: (file: File, path?: string) => Promise<UploadResult>;
  uploadMultiple: (files: File[], path?: string) => Promise<UploadResult[]>;
  remove: (path: string) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  clearError: () => void;
}

/**
 * Custom hook for Firebase Storage operations
 * @param defaultPath - Default upload path
 * @returns UseStorageReturn
 */
export const useStorage = (defaultPath: string = 'uploads/'): UseStorageReturn => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const upload = useCallback(async (file: File, path: string = defaultPath): Promise<UploadResult> => {
    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      // Validate file
      if (!validateFile(file)) {
        throw new Error('Invalid file type or size');
      }

      setUploadProgress(50);

      const result = await uploadFile(file, path);

      setUploadProgress(100);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [defaultPath]);

  const uploadMultiple = useCallback(async (files: File[], path: string = defaultPath): Promise<UploadResult[]> => {
    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      // Validate all files
      const invalidFiles = files.filter(file => !validateFile(file));
      if (invalidFiles.length > 0) {
        throw new Error('Some files are invalid (type or size)');
      }

      setUploadProgress(25);

      const results = await uploadFiles(files, path);

      setUploadProgress(100);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [defaultPath]);

  const remove = useCallback(async (path: string): Promise<void> => {
    try {
      setError(null);
      await deleteFile(path);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  return {
    upload,
    uploadMultiple,
    remove,
    isUploading,
    uploadProgress,
    error,
    clearError
  };
};