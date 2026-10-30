export type ToastTone = 'success' | 'error';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}
