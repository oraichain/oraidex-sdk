export class RouteNotFoundError extends Error {
  constructor(route: string) {
    super(`Route not found: ${route}`);
  }
}

export class RouteNoLiquidity extends Error {
  constructor() {
    super(`Route has no liquidity`);
  }
}

export class SpamTooManyRequestsError extends Error {
  constructor() {
    super(`Too many requests`);
  }
}