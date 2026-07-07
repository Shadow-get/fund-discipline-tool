from __future__ import annotations

import json
import sys
from typing import Any

from .mainline_scan import scan_mainlines
from .rules import dispatch_rule
from .valuation_scan import scan_low_valuation


def run(request: dict[str, Any]) -> Any:
    action = request.get("action")
    payload = request.get("payload") if isinstance(request.get("payload"), dict) else {}
    if action == "mainline_scan":
        return scan_mainlines(payload)
    if action == "low_valuation_scan":
        return scan_low_valuation(payload)
    if not isinstance(action, str):
        raise ValueError("Missing action")
    return dispatch_rule(action, payload)


def main() -> int:
    try:
        raw = sys.stdin.buffer.read().decode("utf-8")
        request = json.loads(raw or "{}")
        data = run(request)
        response = {"ok": True, "data": data}
    except Exception as error:  # noqa: BLE001 - CLI boundary must serialize failures.
        response = {"ok": False, "error": str(error)}

    sys.stdout.write(json.dumps(response, ensure_ascii=False))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
