export type ReceiptUploadState = 'pick' | 'reading' | 'readError' | 'empty' | 'review' | 'confirming' | 'done';

// Lo que el guard necesita del pop-up.
export interface ReceiptLeaveTarget {
  busy(): boolean; // reading o confirming
  hasUnsavedChanges(): boolean; // review
}
