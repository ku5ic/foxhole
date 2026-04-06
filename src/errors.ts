class FoxholeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "FoxholeError";
  }
}

class ConfigError extends FoxholeError {
  constructor(message: string, cause?: unknown) {
    super(message, "CONFIG_ERROR", cause);
    this.name = "ConfigError";
  }
}

class RunnerError extends FoxholeError {
  constructor(message: string, cause?: unknown) {
    super(message, "RUNNER_ERROR", cause);
    this.name = "RunnerError";
  }
}

class NetworkError extends FoxholeError {
  constructor(message: string, cause?: unknown) {
    super(message, "NETWORK_ERROR", cause);
    this.name = "NetworkError";
  }
}

class ReportError extends FoxholeError {
  constructor(message: string, cause?: unknown) {
    super(message, "REPORT_ERROR", cause);
    this.name = "ReportError";
  }
}

type Result<T, E extends FoxholeError = FoxholeError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function err<E extends FoxholeError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export { FoxholeError, ConfigError, RunnerError, NetworkError, ReportError, ok, err };
export type { Result };
