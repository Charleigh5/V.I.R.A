
export const MAX_TEXT_FILE_SIZE_MB = 20;
export const MAX_IMAGE_FILE_SIZE_MB = 10;
export const MAX_CSV_FILE_SIZE_MB = 100;

export const MAX_TEXT_FILE_SIZE_BYTES = MAX_TEXT_FILE_SIZE_MB * 1024 * 1024;
export const MAX_IMAGE_FILE_SIZE_BYTES = MAX_IMAGE_FILE_SIZE_MB * 1024 * 1024;
export const MAX_CSV_FILE_SIZE_BYTES = MAX_CSV_FILE_SIZE_MB * 1024 * 1024;

export const MAX_MD_FILES = 1;
export const MAX_EMAIL_FILES = 1;
export const MAX_IMAGE_FILES = 10;

export const isMdFile = (file: File): boolean => file.name.endsWith('.md');
export const isEmailFile = (file: File): boolean => /\.(txt|eml|csv)$/i.test(file.name);
export const isImageFile = (file: File): boolean => file.type.startsWith('image/');