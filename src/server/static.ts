import http from "node:http";
import path from "node:path";

import serveHandler from "serve-handler";

import { RunnerError } from "../errors.js";

interface StaticServer {
  url: string;
  close: () => Promise<void>;
}

async function serveStaticBuild(buildPath: string): Promise<StaticServer> {
  const absolutePath = path.resolve(buildPath);

  const server = http.createServer((request, response) => {
    void serveHandler(request, response, {
      public: absolutePath,
    });
  });

  return new Promise((resolve, reject) => {
    server.on("error", (cause) => {
      reject(new RunnerError(`Failed to start static server for ${absolutePath}`, cause));
    });

    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new RunnerError("Static server bound to unexpected address type"));
        return;
      }

      const url = `http://localhost:${String(address.port)}`;

      const close = (): Promise<void> =>
        new Promise((resolveClose, rejectClose) => {
          server.close((error) => {
            if (error) {
              rejectClose(new RunnerError("Failed to close static server", error));
            } else {
              resolveClose();
            }
          });
        });

      resolve({ url, close });
    });
  });
}

export { serveStaticBuild };
export type { StaticServer };
