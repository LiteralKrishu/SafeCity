package com.safecity.interruption

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SafeCityInterruptionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SafeCityInterruption")

    AsyncFunction("scheduleAsync") {
        kind: String,
        delaySeconds: Int,
        callerId: String ->
      SafeCityInterruptionReceiver.schedule(
        context = context.applicationContext,
        kind = kind,
        delaySeconds = delaySeconds,
        callerId = callerId,
      )
    }

    AsyncFunction("cancelAsync") {
      SafeCityInterruptionReceiver.cancel(context.applicationContext)
    }

    AsyncFunction("dismissAsync") {
      SafeCityInterruptionReceiver.dismiss(context.applicationContext)
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()
}
