#!/usr/bin/env bash
set -uo pipefail

report="android/app/build/reports/device-shards/${DEVICE_SHARD}"
mkdir -p "$report/screenshots"
adb shell settings put secure show_ime_with_hard_keyboard 1
adb logcat -v time TestRunner:I DagongrenMotion:I DagongrenLaunchReview:I AndroidRuntime:E chromium:E '*:S' > "$report/device-progress.log" 2>&1 &
log_pid=$!

result=0
adb install -r device-artifacts/app-release.apk || result=$?
if [ "$result" -eq 0 ]; then
  adb install -r device-artifacts/app-release-androidTest.apk || result=$?
fi
if [ "$result" -eq 0 ]; then
  timeout --signal=TERM --kill-after=20s 12m adb shell am instrument -w -r \
    -e numShards "$DEVICE_SHARDS" -e shardIndex "$DEVICE_SHARD" \
    com.tengzikeji.dagongren.upgrade.test/androidx.test.runner.AndroidJUnitRunner \
    > "$report/instrumentation.txt" 2>&1 || result=$?
fi
kill "$log_pid" 2>/dev/null || true
adb pull /sdcard/Download/dagongren-test/. "$report/screenshots/" > "$report/pull.log" 2>&1 || true
if [ "$result" -eq 0 ]; then
  python3 .github/scripts/check-device-shards.py --single "$report/instrumentation.txt" || result=$?
fi
if [ "$result" -ne 0 ]; then
  echo "Device shard $DEVICE_SHARD did not complete successfully"
  tail -n 120 "$report/instrumentation.txt" 2>/dev/null || true
  tail -n 80 "$report/device-progress.log" 2>/dev/null || true
fi
exit "$result"
