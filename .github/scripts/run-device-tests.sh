#!/usr/bin/env bash
set +e
gradle -p android --no-daemon connectedDebugAndroidTest
result=$?
mkdir -p android/app/build/reports/screenshots
adb pull /sdcard/Android/data/com.tengzikeji.dagongren.upgrade/files/. android/app/build/reports/screenshots/
exit "$result"
