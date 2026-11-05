/** Erreur au format uniforme de l'API : { statusCode, code, message, details }. */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

/** Message lisible d'une erreur d'appel (FetchError d'ofetch ou autre). */
export function apiErrorMessage(err: unknown): string {
  const data = (err as { data?: Partial<ApiErrorBody> })?.data;
  if (data?.code === 'VALIDATION_ERROR' && Array.isArray(data.details)) {
    return (data.details as string[]).join(' · ');
  }
  if (data?.message) return data.message;
  if ((err as { statusCode?: number })?.statusCode === undefined) {
    return 'Serveur injoignable : vérifiez votre connexion.';
  }
  return 'Une erreur inattendue est survenue.';
}

export function apiErrorCode(err: unknown): string | undefined {
  return (err as { data?: Partial<ApiErrorBody> })?.data?.code;
}
