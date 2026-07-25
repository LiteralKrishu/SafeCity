package com.safecity.voicetrigger

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference
import java.util.concurrent.CopyOnWriteArraySet

class SafeCityVoiceTriggerModule : Module() {
  private var keywordObserver: ((String) -> Unit)? = null
  private var safetyObserver: ((String, String) -> Unit)? = null

  override fun definition() = ModuleDefinition {
    Name("SafeCityVoiceTrigger")

    Events(KEYWORD_EVENT, SAFETY_EVENT)

    OnStartObserving(KEYWORD_EVENT) {
      val weakModule = WeakReference(this@SafeCityVoiceTriggerModule)
      val observer: (String) -> Unit = { keyword ->
        try {
          weakModule.get()?.sendEvent(KEYWORD_EVENT, mapOf("keyword" to keyword))
        } catch (_: Throwable) {
          // The full-screen notification remains the fallback when React is unavailable.
        }
      }
      observers.add(observer)
      keywordObserver = observer
    }

    OnStopObserving(KEYWORD_EVENT) {
      keywordObserver?.let(observers::remove)
      keywordObserver = null
    }

    OnStartObserving(SAFETY_EVENT) {
      val weakModule = WeakReference(this@SafeCityVoiceTriggerModule)
      val observer: (String, String) -> Unit = { source, label ->
        try {
          weakModule.get()?.sendEvent(
            SAFETY_EVENT,
            mapOf("source" to source, "label" to label),
          )
        } catch (_: Throwable) {
          // The full-screen notification remains the fallback when React is unavailable.
        }
      }
      safetyObservers.add(observer)
      safetyObserver = observer
    }

    OnStopObserving(SAFETY_EVENT) {
      safetyObserver?.let(safetyObservers::remove)
      safetyObserver = null
    }

    OnDestroy {
      keywordObserver?.let(observers::remove)
      keywordObserver = null
      safetyObserver?.let(safetyObservers::remove)
      safetyObserver = null
    }

    AsyncFunction("startAsync") {
        modelDirectoryUri: String,
        listenNow: Boolean,
        promise: Promise ->
      val context = context.applicationContext
      SafeCityVoiceTriggerService.start(
        context = context,
        modelDirectoryUri = modelDirectoryUri,
        listenNow = listenNow,
      ) { result ->
        result.fold(
          onSuccess = {
            promise.resolve(
              mapOf(
                "ready" to true,
                "message" to "Offline emergency-word and threat-phrase listening is ready.",
                "fullScreenAllowed" to canUseFullScreenIntent(context),
              ),
            )
          },
          onFailure = { error ->
            promise.resolve(
              mapOf(
                "ready" to false,
                "message" to (
                  error.message
                    ?: "SafeCity could not prepare its offline voice-safety listener."
                  ),
                "fullScreenAllowed" to canUseFullScreenIntent(context),
              ),
            )
          },
        )
      }
    }

    AsyncFunction("stopAsync") {
      SafeCityVoiceTriggerService.stop(context.applicationContext)
    }

    AsyncFunction("startProtectionAsync") {
      SafeCityVoiceTriggerService.startProtection(context.applicationContext)
    }

    AsyncFunction("stopProtectionAsync") {
      SafeCityVoiceTriggerService.stopProtection(context.applicationContext)
    }

    AsyncFunction("setProtectionActiveAsync") { active: Boolean ->
      SafeCityVoiceTriggerService.setProtectionActive(context.applicationContext, active)
    }

    AsyncFunction("setListeningAsync") { listenNow: Boolean ->
      SafeCityVoiceTriggerService.setListening(context.applicationContext, listenNow)
    }

    AsyncFunction("rearmAsync") {
      SafeCityVoiceTriggerService.rearm(context.applicationContext)
    }

    AsyncFunction("getStateAsync") {
      val appContext = context.applicationContext
      val state = SafeCityVoiceTriggerService.readPersistentState(appContext)
      mapOf(
        "configured" to state.configured,
        "enabled" to state.enabled,
        "protectionEnabled" to state.protectionEnabled,
        "listening" to SafeCityVoiceTriggerService.isActivelyListening,
        "motionMonitoring" to SafeCityVoiceTriggerService.isMotionMonitoring,
        "detectionPending" to SafeCityVoiceTriggerService.isDetectionPending,
        "voiceResumeRequired" to state.voiceResumeRequired,
        "fullScreenAllowed" to canUseFullScreenIntent(appContext),
      )
    }

    AsyncFunction("openFullScreenIntentSettingsAsync") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        return@AsyncFunction null
      }
      val appContext = context.applicationContext
      val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
        data = Uri.parse("package:${appContext.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      appContext.startActivity(intent)
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  companion object {
    private const val KEYWORD_EVENT = "onKeywordDetected"
    private const val SAFETY_EVENT = "onSafetyDetected"
    private val observers = CopyOnWriteArraySet<(String) -> Unit>()
    private val safetyObservers = CopyOnWriteArraySet<(String, String) -> Unit>()

    internal fun emitKeywordDetected(keyword: String) {
      observers.forEach { observer ->
        try {
          observer(keyword)
        } catch (_: Throwable) {
          // A full-screen notification is also posted for every detection.
        }
      }
    }

    internal fun emitSafetyDetected(source: String, label: String) {
      safetyObservers.forEach { observer ->
        try {
          observer(source, label)
        } catch (_: Throwable) {
          // A full-screen notification is also posted for every detection.
        }
      }
    }

    internal fun canUseFullScreenIntent(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      return manager.canUseFullScreenIntent()
    }
  }
}
