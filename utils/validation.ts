

export const MAX_SALESFORCE_FILE_SIZE_MB = 20;
export const MAX_EMAIL_FILE_SIZE_MB = 25;
export const MAX_IMAGE_FILE_SIZE_MB = 10;

export const MAX_SALESFORCE_FILE_SIZE_BYTES = MAX_SALESFORCE_FILE_SIZE_MB * 1024 * 1024;
export const MAX_EMAIL_FILE_SIZE_BYTES = MAX_EMAIL_FILE_SIZE_MB * 1024 * 1024;
export const MAX_IMAGE_FILE_SIZE_BYTES = MAX_IMAGE_FILE_SIZE_MB * 1024 * 1024;

export const MAX_TOTAL_FILES = 10;
export const MAX_SALESFORCE_FILES = 5;
export const MAX_EMAIL_FILES = 5;
export const MAX_IMAGE_FILES = 10;

export const isImageFile = (file: File): boolean => file.type.startsWith('image/') || /\.(jpg|jpeg|png|tiff)$/i.test(file.name);
export const isSalesforceFile = (file: File): boolean => file.name.endsWith('.md') || isImageFile(file);
export const isEmailFile = (file: File): boolean => /\.(pdf|txt|md|csv|xls|html|doc|ppt|json|eml)$/i.test(file.name) || isImageFile(file);