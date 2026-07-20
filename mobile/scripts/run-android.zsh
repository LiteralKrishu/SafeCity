#!/bin/zsh
set -euo pipefail

if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
  safecity_java_home="${JAVA_HOME}"
elif [[ -x "/opt/homebrew/opt/openjdk@17/bin/java" ]]; then
  safecity_java_home="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
elif [[ -x "/usr/local/opt/openjdk@17/bin/java" ]]; then
  safecity_java_home="/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
else
  print -u2 "JDK 17 was not found. Install it with: brew install openjdk@17"
  exit 1
fi

safecity_android_home="${ANDROID_HOME:-${HOME}/Library/Android/sdk}"
if [[ ! -d "${safecity_android_home}" ]]; then
  print -u2 "Android SDK was not found at ${safecity_android_home}."
  exit 1
fi

export JAVA_HOME="${safecity_java_home}"
export ANDROID_HOME="${safecity_android_home}"
export PATH="${JAVA_HOME}/bin:${ANDROID_HOME}/emulator:${ANDROID_HOME}/platform-tools:${PATH}"

exec npx expo run:android "$@"
