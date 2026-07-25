package com.safecity.mms

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.provider.Telephony
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SafeCityMmsModule : Module() {
  private var pendingPromise: Promise? = null
  private var composerOpened = false

  override fun definition() = ModuleDefinition {
    Name("SafeCityMms")

    AsyncFunction("sendMmsAsync") {
        addresses: List<String>,
        message: String,
        attachmentUris: List<String>,
        promise: Promise ->
      if (pendingPromise != null) {
        throw IllegalStateException("An SOS message composer is already open.")
      }
      if (attachmentUris.isEmpty()) {
        throw IllegalArgumentException("At least one attachment is required.")
      }

      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val defaultSmsPackage = Telephony.Sms.getDefaultSmsPackage(context)
        ?: throw IllegalStateException("No default messaging app is available.")
      val uris = ArrayList(attachmentUris.map(Uri::parse))

      val intent = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
        type = "*/*"
        setPackage(defaultSmsPackage)
        putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
        putExtra(Intent.EXTRA_TEXT, message)
        putExtra("sms_body", message)
        putExtra("address", addresses.joinToString(separator = ";"))
        putExtra("exit_on_sent", true)
        putExtra("compose_mode", true)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

        clipData = ClipData.newUri(context.contentResolver, "SafeCity SOS evidence", uris.first())
          .also { clips ->
            uris.drop(1).forEach { uri ->
              clips.addItem(ClipData.Item(uri))
            }
          }
      }

      pendingPromise = promise
      composerOpened = true
      try {
        appContext.throwingActivity.startActivity(intent)
      } catch (error: Throwable) {
        pendingPromise = null
        composerOpened = false
        throw error
      }
    }

    OnActivityEntersForeground {
      if (composerOpened) {
        composerOpened = false
        pendingPromise?.resolve(null)
        pendingPromise = null
      }
    }
  }
}
