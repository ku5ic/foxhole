export interface RunOptions {
  url?: string;
  urls?: string;
  build?: string;
  checks?: string;
  output?: "json" | "markdown";
  out?: string;
  config?: string;
  threshold?: number;
  throttling?: string;
  concurrency?: number;
  quiet?: boolean;
}
