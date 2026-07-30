from __future__ import annotations

import json
import queue
import subprocess
import threading
from collections import deque
from pathlib import Path
from typing import Any, Mapping, Sequence

PROTOCOL_VERSION = 1


class ProtocolError(RuntimeError):
    def __init__(self, code: str, message: str, recoverable: bool = False):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message
        self.recoverable = recoverable


class ProtocolTimeout(ProtocolError):
    pass


class ProtocolProcessDied(ProtocolError):
    pass


class TrainingProcessClient:
    """Synchronous request client backed by one persistent Node subprocess."""

    def __init__(
        self,
        command: Sequence[str],
        cwd: str | Path,
        timeout_seconds: float = 30.0,
        stderr_lines: int = 100,
    ) -> None:
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        self.command = list(command)
        self.cwd = str(cwd)
        self.timeout_seconds = timeout_seconds
        self._responses: queue.Queue[dict[str, Any] | BaseException] = queue.Queue()
        self._stderr = deque(maxlen=stderr_lines)
        self._request_sequence = 0
        self._process: subprocess.Popen[str] | None = None
        self._closed = False
        self.start()

    @property
    def stderr_tail(self) -> tuple[str, ...]:
        return tuple(self._stderr)

    @property
    def is_alive(self) -> bool:
        return self._process is not None and self._process.poll() is None

    def start(self) -> None:
        if self.is_alive:
            return
        self._closed = False
        self._responses = queue.Queue()
        self._process = subprocess.Popen(
            self.command,
            cwd=self.cwd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            bufsize=1,
        )
        threading.Thread(target=self._read_stdout, name="football-env-stdout", daemon=True).start()
        threading.Thread(target=self._read_stderr, name="football-env-stderr", daemon=True).start()

    def request(self, request_type: str, payload: Mapping[str, Any] | None = None) -> dict[str, Any]:
        if self._closed:
            raise ProtocolProcessDied("CLIENT_CLOSED", "Protocol client is closed")
        process = self._require_process()
        self._request_sequence += 1
        request_id = f"python-{self._request_sequence}"
        envelope = {
            "protocolVersion": PROTOCOL_VERSION,
            "requestId": request_id,
            "type": request_type,
            "payload": dict(payload or {}),
        }
        try:
            assert process.stdin is not None
            process.stdin.write(json.dumps(envelope, separators=(",", ":")) + "\n")
            process.stdin.flush()
        except (BrokenPipeError, OSError) as error:
            raise self._died(f"Unable to write request: {error}") from error

        try:
            response = self._responses.get(timeout=self.timeout_seconds)
        except queue.Empty as error:
            self._terminate()
            raise ProtocolTimeout("REQUEST_TIMEOUT", f"No response for {request_type} within {self.timeout_seconds}s") from error
        if isinstance(response, BaseException):
            raise response
        if response.get("protocolVersion") != PROTOCOL_VERSION:
            raise ProtocolError("VERSION_MISMATCH", f"Response uses protocol {response.get('protocolVersion')}")
        if response.get("requestId") != request_id:
            raise ProtocolError("REQUEST_ID_MISMATCH", f"Expected {request_id}, received {response.get('requestId')}")
        if not response.get("ok"):
            details = response.get("error") or {}
            raise ProtocolError(
                str(details.get("code", "UNKNOWN_ERROR")),
                str(details.get("message", "Protocol request failed")),
                bool(details.get("recoverable", False)),
            )
        return response["payload"]

    def close(self) -> None:
        if self._closed:
            return
        if self.is_alive:
            try:
                self.request("SHUTDOWN")
            except ProtocolError:
                pass
        self._closed = True
        self._terminate()

    def _read_stdout(self) -> None:
        process = self._process
        assert process is not None and process.stdout is not None
        try:
            for line in process.stdout:
                try:
                    self._responses.put(json.loads(line))
                except json.JSONDecodeError as error:
                    self._responses.put(ProtocolError("INVALID_RESPONSE_JSON", str(error)))
        finally:
            if not self._closed:
                self._responses.put(self._died("Node protocol process closed stdout"))

    def _read_stderr(self) -> None:
        process = self._process
        assert process is not None and process.stderr is not None
        for line in process.stderr:
            self._stderr.append(line.rstrip())

    def _require_process(self) -> subprocess.Popen[str]:
        if not self.is_alive:
            raise self._died("Node protocol process is not running")
        assert self._process is not None
        return self._process

    def _died(self, message: str) -> ProtocolProcessDied:
        suffix = "\n".join(self._stderr)
        return ProtocolProcessDied("PROCESS_DIED", f"{message}{': ' + suffix if suffix else ''}")

    def _terminate(self) -> None:
        process = self._process
        if process is None:
            return
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=2)
        for stream in (process.stdin, process.stdout, process.stderr):
            if stream is not None:
                stream.close()
        self._process = None

    def __enter__(self) -> "TrainingProcessClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
