import { createInterface } from "node:readline";
import { TrainingProtocolSession } from "../src/application/match/protocol/TrainingProtocolSession";
import { TRAINING_PROTOCOL_VERSION, type TrainingErrorResponse } from "../src/application/match/protocol/TrainingProtocol";

const session = new TrainingProtocolSession();
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });

lines.on("line", line => {
  let response;
  try {
    response = session.handle(JSON.parse(line));
  } catch (error) {
    const failure: TrainingErrorResponse = {
      protocolVersion: TRAINING_PROTOCOL_VERSION,
      requestId: "unparseable",
      ok: false,
      type: "ERROR",
      error: { code: "INVALID_JSON", message: error instanceof Error ? error.message : String(error), recoverable: true },
    };
    response = failure;
  }
  const serialized = `${JSON.stringify(response)}\n`;
  if (session.isShutdownRequested()) {
    process.stdout.write(serialized, () => {
      lines.close();
      process.stdin.pause();
      process.exit(0);
    });
  } else {
    process.stdout.write(serialized);
  }
});

lines.on("close", () => process.exitCode = 0);
process.on("uncaughtException", error => {
  process.stderr.write(`training-protocol fatal: ${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
