/**
 * Generic API response types
 */

// Generic API success response
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

// Generic API error response
export interface ApiErrorResponse {
  success: false;
  message: string;
  error?: string;
  errors?: Record<string, string[]>;
}

// Pagination metadata
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

// Paginated response
export interface PaginatedResponse<T> extends ApiResponse<T> {
  meta: PaginationMeta;
}
