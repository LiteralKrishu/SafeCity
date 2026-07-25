package com.safecity.devicecapabilities

import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SafeCityDeviceCapabilitiesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SafeCityDeviceCapabilities")

    Function("getCapabilities") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val activityManager =
        context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val memoryInfo = ActivityManager.MemoryInfo()
      activityManager.getMemoryInfo(memoryInfo)

      mapOf(
        "androidApi" to Build.VERSION.SDK_INT,
        "cpuCores" to Runtime.getRuntime().availableProcessors(),
        "glEsVersion" to activityManager.deviceConfigurationInfo.glEsVersion,
        "hasLowLatencyAudio" to context.packageManager.hasSystemFeature(
          PackageManager.FEATURE_AUDIO_LOW_LATENCY,
        ),
        "isLowRamDevice" to activityManager.isLowRamDevice,
        "largeMemoryClassMb" to activityManager.largeMemoryClass,
        "memoryClassMb" to activityManager.memoryClass,
        "supportedAbis" to Build.SUPPORTED_ABIS.toList(),
        "totalMemoryMb" to memoryInfo.totalMem / (1024L * 1024L),
      )
    }
  }
}
