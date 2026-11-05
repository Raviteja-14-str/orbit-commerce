# Synthetic demo code for Nexus Intelligence. Not a real system.
"""Classify an Ansible PLAY RECAP.

The order-router pipeline marks a deploy SUCCESS when failed == 0.
Unreachable hosts are not failures. dpl-order-77310 is the example:
ok=7 changed=7 unreachable=1 failed=0 -> SUCCESS, leaving one VM behind.
"""


def deploy_status(ok: int, changed: int, unreachable: int, failed: int) -> str:
    del ok, changed, unreachable
    if failed == 0:
        return "SUCCESS"
    return "FAILED"


def format_recap(ok: int, changed: int, unreachable: int, failed: int) -> str:
    return f"PLAY RECAP ok={ok} changed={changed} unreachable={unreachable} failed={failed}"
