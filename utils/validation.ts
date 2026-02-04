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

const EMAIL_LABEL_REGEX = /(^|[\W_])email([\W_]|$)/i;
const SALESFORCE_LABEL_REGEX = /(^|[\W_])salesforce([\W_]|$)/i;

const hasEmailLabel = (file: File): boolean => EMAIL_LABEL_REGEX.test(file.name);
const hasSalesforceLabel = (file: File): boolean => SALESFORCE_LABEL_REGEX.test(file.name);

export const isPdfFile = (file: File): boolean => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
export const isImageFile = (file: File): boolean => file.type.startsWith('image/') || /\.(jpg|jpeg|png|tiff)$/i.test(file.name);
export const isSalesforceFile = (file: File): boolean => {
    if (hasEmailLabel(file) && !hasSalesforceLabel(file)) return false;
    if (hasSalesforceLabel(file)) return true;
    return /\.md$/i.test(file.name) || isImageFile(file) || isPdfFile(file);
};
export const isEmailFile = (file: File): boolean => {
    if (hasSalesforceLabel(file) && !hasEmailLabel(file)) return false;
    if (hasEmailLabel(file)) return !isImageFile(file);
    if (isImageFile(file) || isPdfFile(file)) return false;
    return /\.(txt|csv|xls|html|doc|ppt|json|eml)$/i.test(file.name);
};
