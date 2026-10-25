#!/usr/bin/env bash
set +e
gradle -p android --no-daemon connectedReleaseAndroidTest
result=$?
mkdir -p android/app/build/reports/screenshots
adb pull /sdcard/Download/dagongren-test/. android/app/build/reports/screenshots/
exit "$result"
