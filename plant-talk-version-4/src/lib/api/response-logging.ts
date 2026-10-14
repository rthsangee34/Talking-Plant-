export function logServerEvent(category: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${category.toUpperCase()}] ${message}`, data ? JSON.stringify(data) : '');
}

export function logServerError(category: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[${timestamp}] [${category.toUpperCase()} ERROR]`, errorMessage);
}
