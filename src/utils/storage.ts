import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from '../firebase';

export interface UploadResult {
  url: string;
  path: string;
  name: string;
}

/**
 * Upload a file to Firebase Storage
 * @param file - The file to upload
 * @param path - The path in storage (e.g., 'menu-images/', 'user-uploads/')
 * @returns Promise<UploadResult>
 */
export const uploadFile = async (file: File, path: string = 'uploads/'): Promise<UploadResult> => {
  try {
    // Create a unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const fullPath = `${path}${fileName}`;

    // Create a reference to the file location
    const storageRef = ref(storage, fullPath);

    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);

    // Get the download URL
    const url = await getDownloadURL(snapshot.ref);

    return {
      url,
      path: fullPath,
      name: fileName
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
  }
};

/**
 * Upload multiple files to Firebase Storage
 * @param files - Array of files to upload
 * @param path - The path in storage
 * @returns Promise<UploadResult[]>
 */
export const uploadFiles = async (files: File[], path: string = 'uploads/'): Promise<UploadResult[]> => {
  try {
    const uploadPromises = files.map(file => uploadFile(file, path));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading files:', error);
    throw new Error('Failed to upload files');
  }
};

/**
 * Delete a file from Firebase Storage
 * @param path - The full path of the file to delete
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
};

/**
 * Get download URL for a file
 * @param path - The full path of the file
 * @returns Promise<string>
 */
export const getFileUrl = async (path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw new Error('Failed to get file URL');
  }
};

/**
 * List all files in a directory
 * @param path - The directory path
 * @returns Promise<any[]>
 */
export const listFiles = async (path: string): Promise<any[]> => {
  try {
    const storageRef = ref(storage, path);
    const result = await listAll(storageRef);
    return result.items;
  } catch (error) {
    console.error('Error listing files:', error);
    throw new Error('Failed to list files');
  }
};

/**
 * Validate file type and size
 * @param file - The file to validate
 * @param allowedTypes - Array of allowed MIME types
 * @param maxSizeMB - Maximum file size in MB
 * @returns boolean
 */
export const validateFile = (file: File, allowedTypes: string[] = [], maxSizeMB: number = 5): boolean => {
  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return false;
  }

  // Check file type if specified
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return false;
  }

  return true;
};

/**
 * Get file extension from filename
 * @param filename - The filename
 * @returns string
 */
export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || '';
};

/**
 * Generate a unique filename
 * @param originalName - Original filename
 * @param prefix - Optional prefix
 * @returns string
 */
export const generateUniqueFilename = (originalName: string, prefix: string = ''): string => {
  const timestamp = Date.now();
  const extension = getFileExtension(originalName);
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  return `${prefix}${timestamp}_${baseName}.${extension}`;
};