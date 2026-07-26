package com.safecity.mms

import android.Manifest
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.Telephony
import androidx.core.content.ContextCompat
import com.klinker.android.send_message.Message
import com.klinker.android.send_message.Settings
import com.klinker.android.send_message.Transaction
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SafeCityMmsModule : Module() {
  private var pendingPromise: Promise? = null
  private var composerOpened = false

  override fun definition() = ModuleDefinition {
    Name("SafeCityMms")

    AsyncFunction("canAutoSendAsync") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.SEND_SMS,
      ) == PackageManager.PERMISSION_GRANTED &&
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY_MESSAGING)
    }

    AsyncFunction("sendEmergencyMmsAsync") {
        addresses: List<String>,
        message: String,
        attachmentUris: List<String>,
        attachmentMimeTypes: List<String>,
        attachmentFileNames: List<String> ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (
        ContextCompat.checkSelfPermission(
          context,
          Manifest.permission.SEND_SMS,
        ) != PackageManager.PERMISSION_GRANTED
      ) {
        throw SecurityException("Automatic SOS messaging permission is not granted.")
      }
      if (!context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY_MESSAGING)) {
        throw UnsupportedOperationException("This device cannot send SMS or MMS messages.")
      }
      if (addresses.isEmpty()) {
        throw IllegalArgumentException("At least one SOS recipient is required.")
      }
      if (
        attachmentUris.size != attachmentMimeTypes.size ||
        attachmentUris.size != attachmentFileNames.size
      ) {
        throw IllegalArgumentException("Evidence attachment details do not match.")
      }

      val settings = Settings().apply {
        setUseSystemSending(true)
        setGroup(false)
        setDeliveryReports(false)
      }
      var preparedEvidenceCount = 0

      addresses.distinct().forEach { address ->
        val transaction = Transaction(context, Settings(settings))
        val emergencyMessage = Message(message, address).apply {
          // A non-default SMS app may send with SmsManager but cannot write to
          // the system SMS/MMS provider. Build and dispatch the PDU without
          // attempting to persist an outbox row.
          setSave(false)
          setMessageUri(Uri.EMPTY)
        }
        var messageEvidenceCount = 0

        attachmentUris.indices.forEach { index ->
          val uri = Uri.parse(attachmentUris[index])
          val mimeType = attachmentMimeTypes[index]
          val filename = attachmentFileNames[index]
          try {
            if (mimeType.startsWith("image/")) {
              context.contentResolver.openInputStream(uri)?.use { stream ->
                BitmapFactory.decodeStream(stream)?.let { bitmap ->
                  emergencyMessage.addImage(bitmap)
                  messageEvidenceCount += 1
                }
              }
            } else {
              context.contentResolver.openInputStream(uri)?.use { stream ->
                emergencyMessage.addMedia(stream.readBytes(), mimeType, filename)
                messageEvidenceCount += 1
              }
            }
          } catch (_: Throwable) {
            // Keep the SOS text and any evidence that could be prepared.
          }
        }

        transaction.sendNewMessage(emergencyMessage, Transaction.NO_THREAD_ID)
        preparedEvidenceCount = maxOf(preparedEvidenceCount, messageEvidenceCount)
      }

      mapOf(
        "requested" to addresses.distinct().size,
        "evidenceAttachments" to preparedEvidenceCount,
      )
    }

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
