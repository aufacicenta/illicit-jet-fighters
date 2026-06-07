import { InsufficientBalanceError } from "./preflight";

export const isInsufficientBalanceError = (error: unknown): error is InsufficientBalanceError =>
  error instanceof InsufficientBalanceError;
