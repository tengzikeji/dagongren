#!/usr/bin/env bash
set +e
adb shell settings put secure show_ime_with_hard_keyboard 1
gradle -p android --no-daemon connectedReleaseAndroidTest
result=$?
mkdir -p android/app/build/reports/screenshots
adb pull /sdcard/Download/dagongren-test/. android/app/build/reports/screenshots/
exit "$result"
