export interface SafeErrorType extends Error {
  name: string;
  safeMessage: string;
  safeProps: { name: string; message: string; safeError: true };
  unsafeMessage?: string;
}
