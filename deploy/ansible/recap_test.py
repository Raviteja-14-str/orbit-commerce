# Synthetic demo code for Nexus Intelligence. Not a real system.
from recap import deploy_status, format_recap


def main() -> None:
    line = format_recap(7, 7, 1, 0)
    if line != "PLAY RECAP ok=7 changed=7 unreachable=1 failed=0":
        raise SystemExit(line)
    if deploy_status(7, 7, 1, 0) != "SUCCESS":
        raise SystemExit("unreachable must be non-fatal")
    if deploy_status(7, 7, 0, 1) != "FAILED":
        raise SystemExit("failed must fail the pipeline")
    print("recap_test ok")


if __name__ == "__main__":
    main()
