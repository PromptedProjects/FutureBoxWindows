/** Standard API response envelope */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Timestamps in ISO-8601 */
export type ISOTimestamp = string;
