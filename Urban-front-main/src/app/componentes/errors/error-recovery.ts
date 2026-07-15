export interface RecoveryKeyboardEvent {
  key: string;
  repeat?: boolean;
  preventDefault: () => void;
}

export function recoverFromKeyboard(
  event: RecoveryKeyboardEvent,
  reset: () => void,
): boolean {
  if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return false;
  event.preventDefault();
  reset();
  return true;
}
