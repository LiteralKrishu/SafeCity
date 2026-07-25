package com.safecity.voicetrigger

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Restores the non-microphone part of protection after a reboot or app update.
 *
 * Android 14+ intentionally prevents a BOOT_COMPLETED receiver from starting a
 * microphone foreground service. Motion protection can restart immediately;
 * distress-audio and voice protection resume as soon as the user opens
 * SafeCity from the visible notification.
 */
class SafeCityProtectionBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    when (intent?.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      -> SafeCityVoiceTriggerService.restoreAfterSystemRestart(context.applicationContext)
    }
  }
}
