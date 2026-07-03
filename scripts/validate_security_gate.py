#!/usr/bin/env python3
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
CODE = (ROOT / "apps-script" / "Code.gs").read_text(encoding="utf-8")
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def body_of_function(source, name):
    marker = f"function {name}"
    start = source.find(marker)
    require(start != -1, f"missing function {name}")
    brace = source.find("{", start)
    depth = 0
    for pos in range(brace, len(source)):
        char = source[pos]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[brace + 1 : pos]
    raise AssertionError(f"unterminated function {name}")


def main():
    do_get = body_of_function(CODE, "doGet")
    do_post = body_of_function(CODE, "doPost")
    require("requireSession_" in do_get, "doGet must require a signed session")
    require("buildDashboardData_" in do_get, "doGet must use the protected data builder")
    require("payload.action === 'auth_login'" in do_post, "login route missing")
    require("const session = requireSession_(payload)" in do_post, "doPost mutations must require a session")
    require(do_post.find("payload.action === 'auth_login'") < do_post.find("const session = requireSession_(payload)"), "login must be the only route before session enforcement")

    expected_permissions = {
        "slack_test": "requireCanManageUsers_(session)",
        "approval_request": "requireCanApprove_(session)",
        "approval_update": "requireCanApprove_(session)",
        "task_assignment": "requireCanManageUsers_(session)",
        "meeting_record": "requireCanEscalate_(session)",
    }
    for action, guard in expected_permissions.items():
        action_pos = do_post.find(f"payload.action === '{action}'")
        guard_pos = do_post.find(guard, max(0, action_pos))
        require(action_pos != -1, f"missing action route: {action}")
        require(guard_pos != -1, f"missing guard for {action}: {guard}")

    require("session_token:sessionToken" in HTML, "frontend must attach session_token")
    require("postApi(baseUrl,{action:'data_sync'})" in HTML, "data sync must use authenticated POST")
    require("fetch(url" not in HTML, "frontend must not use unauthenticated GET sync")
    require("delete next.session_token" in CODE, "server must strip tokens before audit logging")
    require("SESSION_SECRET" in CODE, "session signing secret must be configured")
    print("security-gate: ok")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"security-gate: failed: {exc}", file=sys.stderr)
        sys.exit(1)
