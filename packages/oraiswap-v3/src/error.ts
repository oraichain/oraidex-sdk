export class RouteNotFoundError extends Error {
  constructor(route: string) {
    super(`Route not found: ${route}`);
  }
}