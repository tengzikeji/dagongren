#!/usr/bin/env bash
set +e
adb shell settings put secure show_ime_with_hard_keyboard 1
mkdir -p android/app/build/reports/screenshots
adb logcat -v time TestRunner:I DagongrenMotion:I AndroidRuntime:E chromium:E '*:S' > android/app/build/reports/device-progress.log 2>&1 &
device_log_pid=$!
timeout --signal=TERM --kill-after=30s 18m gradle -p android --no-daemon connectedReleaseAndroidTest
result=$?
kill "$device_log_pid" 2>/dev/null
tail -n 160 android/app/build/reports/device-progress.log
if [ "$result" -ne 0 ]; then
  adb shell dumpsys activity top > android/app/build/reports/device-activity.txt
  adb shell dumpsys window windows > android/app/build/reports/device-windows.txt
fi
adb pull /sdcard/Download/dagongren-test/. android/app/build/reports/screenshots/
exit "$result"
