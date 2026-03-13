import { errorResponseSchema, ErrorResponse } from './schema/api';

/**
 * Checks if the given response object is an error response.
 * An error response is an object with `code` (number) and `message` (string) properties.
 */
export function isError(response: unknown): response is ErrorResponse {
  return errorResponseSchema.safeParse(response).success;
}
