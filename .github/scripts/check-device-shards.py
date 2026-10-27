#!/usr/bin/env python3
"""Reject incomplete, failed, repeated, or missing Android instrumentation tests."""
from collections import Counter
from pathlib import Path
import re
import sys


def completed(path):
    text = path.read_text(encoding='utf-8', errors='replace').replace('\r', '')
    if not re.search(r'^INSTRUMENTATION_CODE: -1\s*$', text, re.M):
        raise ValueError(f'{path}: instrumentation did not finish')
    if re.search(r'^INSTRUMENTATION_(?:FAILED|RESULT: shortMsg=)', text, re.M):
        raise ValueError(f'{path}: instrumentation reported an error')
    started, passed, bundle = [], [], {}
    for line in text.splitlines():
        if line.startswith('INSTRUMENTATION_STATUS: ') and '=' in line:
            key, value = line[len('INSTRUMENTATION_STATUS: '):].split('=', 1)
            bundle[key] = value
        elif line.startswith('INSTRUMENTATION_STATUS_CODE: '):
            code = int(line.split(':', 1)[1].strip())
            if code in (-1, -2, -3, -4):
                raise ValueError(f'{path}: failed or skipped test {bundle.get("test", "unknown")} ({code})')
            if code in (0, 1):
                if bundle.get('class') != 'com.tengzikeji.dagongren.AppSmokeTest' or not bundle.get('test'):
                    raise ValueError(f'{path}: incomplete test status: {bundle}')
                (started if code == 1 else passed).append(bundle['test'])
            bundle = {}
    if not started or Counter(started) != Counter(passed):
        raise ValueError(f'{path}: started and completed test sets differ')
    if any(count != 1 for count in Counter(passed).values()):
        raise ValueError(f'{path}: a test ran more than once')
    return passed


def main():
    if len(sys.argv) == 3 and sys.argv[1] == '--single':
        tests = completed(Path(sys.argv[2]))
        print(f'Device shard passed: {len(tests)} tests')
        return
    if len(sys.argv) != 2:
        raise ValueError('Supply a shard report directory or --single and a report file')
    root = Path(sys.argv[1])
    reports = sorted(root.glob('device-test-*/instrumentation.txt'))
    if len(reports) != 8:
        raise ValueError(f'Expected 8 device shard reports, found {len(reports)}')
    passed = [name for path in reports for name in completed(path)]
    source = Path('android/app/src/androidTest/java/com/tengzikeji/dagongren/AppSmokeTest.java').read_text(encoding='utf-8')
    expected = re.findall(r'@Test\s+public\s+void\s+(\w+)\s*\(', source)
    if Counter(passed) != Counter(expected):
        raise ValueError(f'Device coverage mismatch: missing={list((Counter(expected)-Counter(passed)).elements())}, extra={list((Counter(passed)-Counter(expected)).elements())}')
    print(f'All {len(passed)} Android instrumentation tests passed exactly once across {len(reports)} fresh emulators')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as exc:
        raise SystemExit(str(exc))
