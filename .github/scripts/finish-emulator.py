#!/usr/bin/env python3
"""Bound shutdown of this CI shard's emulator after reports have been copied."""
from pathlib import Path
import os
import signal
import sys
import time


def matches(args, avd):
    if not args or '/emulator/qemu/' not in args[0] or Path(args[0]).name != 'qemu-system-x86_64':
        return False
    return any(args[i] == '-avd' and args[i+1] == avd for i in range(len(args)-1))


def identity(path, avd):
    try:
        args = path.joinpath('cmdline').read_bytes().decode().split('\0')
        if not matches(args, avd):
            return None
        # PID and kernel start time together prevent a recycled PID from matching.
        return (int(path.name), path.joinpath('stat').read_text().rsplit(')', 1)[1].split()[19])
    except (OSError, ValueError, IndexError):
        return None


def main():
    if sys.argv[1:] == ['--self-test']:
        command = ['/sdk/emulator/qemu/linux-x86_64/qemu-system-x86_64', '-avd', 'dagongren-ci-6']
        assert matches(command, 'dagongren-ci-6')
        assert not matches(command, 'dagongren-ci-5')
        assert not matches(command, 'dagongren-ci')
        assert not matches(['/usr/bin/python3', '-avd', 'dagongren-ci-6'], 'dagongren-ci-6')
        assert not matches(command[:2], 'dagongren-ci-6')
        print('Emulator shutdown scope checks passed')
        return
    if os.environ.get('GITHUB_ACTIONS') != 'true' or not Path('/proc').is_dir():
        return
    avd = sys.argv[1]
    if avd not in [f'dagongren-ci-{i}' for i in range(8)]:
        raise SystemExit('Unexpected CI emulator name')
    targets = [value for path in Path('/proc').iterdir() if path.name.isdigit() and (value := identity(path, avd))]
    # Let android-emulator-runner issue its normal adb shutdown first. Some
    # SwiftShader processes acknowledge it but remain alive, holding log pipes.
    time.sleep(8)
    for sig in [signal.SIGTERM, signal.SIGKILL]:
        for target in targets:
            if identity(Path('/proc')/str(target[0]), avd) == target:
                print('Finishing CI emulator', avd, target[0], sig, flush=True)
                try:
                    os.kill(target[0], sig)
                except ProcessLookupError:
                    pass
        if sig == signal.SIGTERM:
            time.sleep(3)


if __name__ == '__main__':
    main()
