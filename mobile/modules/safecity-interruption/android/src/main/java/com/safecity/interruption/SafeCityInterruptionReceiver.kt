package com.safecity.interruption

import android.app.ActivityOptions
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat

class SafeCityInterruptionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != ACTION_TRIGGER) return
    val kind = intent.getStringExtra(EXTRA_KIND).normalizeKind()
    val callerId = intent.getStringExtra(EXTRA_CALLER).normalizeCaller()
    showInterruption(context.applicationContext, kind, callerId)
  }

  companion object {
    private const val ACTION_TRIGGER = "com.safecity.interruption.TRIGGER"
    private const val EXTRA_KIND = "kind"
    private const val EXTRA_CALLER = "caller"
    private const val ALARM_REQUEST_CODE = 7242
    private const val LAUNCH_REQUEST_CODE = 7243
    private const val NOTIFICATION_ID = 7244
    private const val CALL_CHANNEL_ID = "escape-call"
    private const val RIDE_CHANNEL_ID = "escape-ride"

    fun schedule(
      context: Context,
      kind: String,
      delaySeconds: Int,
      callerId: String,
    ): Map<String, Any> {
      val safeKind = kind.normalizeKind()
      val safeCaller = callerId.normalizeCaller()
      val safeDelay = delaySeconds.coerceIn(5, 3_600)
      val deadline = System.currentTimeMillis() + safeDelay * 1_000L
      val alarmManager = context.getSystemService(AlarmManager::class.java)
      val alarmIntent = PendingIntent.getBroadcast(
        context,
        ALARM_REQUEST_CODE,
        Intent(context, SafeCityInterruptionReceiver::class.java).apply {
          action = ACTION_TRIGGER
          putExtra(EXTRA_KIND, safeKind)
          putExtra(EXTRA_CALLER, safeCaller)
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

      val exact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        alarmManager.canScheduleExactAlarms()
      } else {
        true
      }
      when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && exact ->
          alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            deadline,
            alarmIntent,
          )
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ->
          alarmManager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            deadline,
            alarmIntent,
          )
        else ->
          alarmManager.setExact(AlarmManager.RTC_WAKEUP, deadline, alarmIntent)
      }

      return mapOf("deadline" to deadline, "exact" to exact)
    }

    fun cancel(context: Context) {
      val pendingIntent = PendingIntent.getBroadcast(
        context,
        ALARM_REQUEST_CODE,
        Intent(context, SafeCityInterruptionReceiver::class.java).apply {
          action = ACTION_TRIGGER
        },
        PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
      )
      if (pendingIntent != null) {
        context.getSystemService(AlarmManager::class.java).cancel(pendingIntent)
        pendingIntent.cancel()
      }
      dismiss(context)
    }

    fun dismiss(context: Context) {
      context.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    }

    private fun showInterruption(
      context: Context,
      kind: String,
      callerId: String,
    ) {
      createChannels(context)
      val callerName = when (callerId) {
        "office" -> "Office"
        "driver" -> "Driver"
        else -> "Maa"
      }
      val isCall = kind == "call"
      val deepLink = if (isCall) {
        Uri.parse(
          "safecity://fake-call?autoStart=1&caller=${Uri.encode(callerId)}",
        )
      } else {
        Uri.parse("safecity://cover-story?interruption=1")
      }
      val launchIntent = context.packageManager
        .getLaunchIntentForPackage(context.packageName)
        ?.apply {
          data = deepLink
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_CLEAR_TOP or
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        ?: Intent(Intent.ACTION_VIEW, deepLink).apply {
          setPackage(context.packageName)
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
      val fullScreenIntent = PendingIntent.getActivity(
        context,
        LAUNCH_REQUEST_CODE,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      val icon = context.resources.getIdentifier(
        "notification_icon",
        "drawable",
        context.packageName,
      ).takeIf { it != 0 } ?: context.applicationInfo.icon
      val notification = NotificationCompat.Builder(
        context,
        if (isCall) CALL_CHANNEL_ID else RIDE_CHANNEL_ID,
      )
        .setSmallIcon(icon)
        .setContentTitle(if (isCall) "Incoming call" else "Your ride is here")
        .setContentText(
          if (isCall) {
            "$callerName is calling"
          } else {
            "Arjun is waiting at your pickup point"
          },
        )
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(
          if (isCall) NotificationCompat.CATEGORY_CALL
          else NotificationCompat.CATEGORY_REMINDER,
        )
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setAutoCancel(!isCall)
        .setOngoing(isCall)
        .setContentIntent(fullScreenIntent)
        .setFullScreenIntent(fullScreenIntent, true)
        .setVibrate(if (isCall) longArrayOf(0, 550, 650, 550) else longArrayOf(0, 300, 150, 300))
        .build()
        .also { built ->
          if (isCall) {
            built.flags = built.flags or Notification.FLAG_INSISTENT
          }
        }

      try {
        context.getSystemService(NotificationManager::class.java)
          .notify(NOTIFICATION_ID, notification)
      } catch (_: SecurityException) {
        // If notifications are blocked, still request the selected app screen.
      }
      attemptLaunch(context, fullScreenIntent)
    }

    private fun createChannels(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(NotificationManager::class.java)
      val callAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      val callChannel = NotificationChannel(
        CALL_CHANNEL_ID,
        "Timed fake calls",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Full-screen fake calls scheduled by you"
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 550, 650, 550)
        setSound(Settings.System.DEFAULT_RINGTONE_URI, callAttributes)
      }
      val rideAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      val rideChannel = NotificationChannel(
        RIDE_CHANNEL_ID,
        "Timed ride arrivals",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Ride-arrival screens scheduled by you"
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        enableVibration(true)
        setSound(Settings.System.DEFAULT_NOTIFICATION_URI, rideAttributes)
      }
      manager.createNotificationChannels(listOf(callChannel, rideChannel))
    }

    private fun attemptLaunch(context: Context, pendingIntent: PendingIntent) {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          val options = ActivityOptions.makeBasic().apply {
            pendingIntentBackgroundActivityStartMode =
              ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
              pendingIntentCreatorBackgroundActivityStartMode =
                ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
            }
          }
          pendingIntent.send(
            context,
            0,
            null,
            null,
            null,
            null,
            options.toBundle(),
          )
        } else {
          pendingIntent.send()
        }
      } catch (_: Throwable) {
        // Full-screen notification remains available if Android blocks launch.
      }
    }

    private fun String?.normalizeKind(): String =
      if (this == "ride") "ride" else "call"

    private fun String?.normalizeCaller(): String =
      when (this) {
        "office", "driver" -> this
        else -> "family"
      }
  }
}
