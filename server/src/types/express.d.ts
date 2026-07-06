// Every /api request past the session middleware carries the resolved tenant id.
declare global {
  namespace Express {
    interface Request {
      sessionId: string;
    }
  }
}

export {};
