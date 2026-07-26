package com.safecity.voicetrigger

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.ActivityOptions
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.Process
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.KeywordSpotter
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineStream
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

private class OutdoorNoiseConditioner(sampleRate: Int) {
  private val highPassAlpha: Float
  private var previousInput = 0f
  private var previousOutput = 0f
  private var noiseFloorRms = 0.008f
  private var smoothedGain = 1f

  init {
    val timeStep = 1.0 / sampleRate
    val rc = 1.0 / (2.0 * Math.PI * 90.0)
    highPassAlpha = (rc / (rc + timeStep)).toFloat()
  }

  fun reset() {
    previousInput = 0f
    previousOutput = 0f
    noiseFloorRms = 0.008f
    smoothedGain = 1f
  }

  fun process(input: FloatArray): FloatArray {
    if (input.isEmpty()) return input
    val filtered = FloatArray(input.size)
    var sumSquares = 0.0
    input.forEachIndexed { index, sample ->
      val output = highPassAlpha * (previousOutput + sample - previousInput)
      previousInput = sample
      previousOutput = output
      filtered[index] = output
      sumSquares += output * output
    }

    val rms = sqrt(sumSquares / input.size).toFloat()
    noiseFloorRms =
      if (rms <= noiseFloorRms * 1.45f) {
        noiseFloorRms * 0.90f + rms * 0.10f
      } else {
        noiseFloorRms * 0.995f + rms * 0.005f
      }
    val excessRatio =
      ((rms - noiseFloorRms * 1.2f) / max(noiseFloorRms * 2.2f, 0.012f))
        .coerceIn(0f, 1f)
    val targetGain = OUTDOOR_MINIMUM_GAIN + (1f - OUTDOOR_MINIMUM_GAIN) * excessRatio
    val blend = if (targetGain >= smoothedGain) 0.78f else 0.18f
    smoothedGain += (targetGain - smoothedGain) * blend
    filtered.indices.forEach { index -> filtered[index] *= smoothedGain }
    return filtered
  }

  companion object {
    private const val OUTDOOR_MINIMUM_GAIN = 0.52f
  }
}

class SafeCityVoiceTriggerService : Service(), SensorEventListener {
  private val lifecycleExecutor = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val modelLock = Any()

  @Volatile private var enabled = false
  @Volatile private var protectionEnabled = false
  @Volatile private var listenRequested = true
  @Volatile private var detectionPending = false
  @Volatile private var audioThread: Thread? = null
  @Volatile private var audioRecord: AudioRecord? = null
  private var powerStateReceiverRegistered = false
  private var initializationRetryDelayMs = INITIALIZATION_RETRY_MIN_MS
  private var countdownExpiryRunnable: Runnable? = null

  private var modelDirectory: File? = null
  private var spotter: KeywordSpotter? = null
  private var stream: OnlineStream? = null
  private var initializedDirectory: String? = null
  private lateinit var sensorManager: SensorManager
  private var accelerometer: Sensor? = null
  private var gyroscope: Sensor? = null
  private var lastGyroscopeMagnitude = 0f
  private var lastGyroscopeAtElapsed = 0L
  private var lastGyroscopeTimestampNs = 0L
  private var freeFallStartedAtElapsed = 0L
  private var confirmedFreeFallAtElapsed = 0L
  private var confirmedFreeFallDurationMs = 0L
  private var accumulatedRotationRad = 0f
  private var peakFallRotationRadPerSecond = 0f
  private var lastAccelerationMagnitudeG = 1f
  private var lastAccelerationTimestampNs = 0L
  private var abruptMotionAtElapsed = 0L
  private var lastAbruptSampleAtElapsed = 0L
  private var abruptMotionCount = 0
  private var distressAudioWindows = 0
  private var lastDistressCandidateAtElapsed = 0L
  private var lastThreatMatchAtElapsed = 0L
  private var threatMatchCount = 0
  private var recentEmergencyRms = 0.0
  private var recentEmergencyRmsAtElapsed = 0L
  private val outdoorNoiseConditioner = OutdoorNoiseConditioner(SAMPLE_RATE)

  private val retryInitialization = Runnable {
    val state = readPersistentState(this)
    if (
      (!state.enabled && !state.protectionEnabled) ||
      state.voiceResumeRequired ||
      detectionPending ||
      (state.enabled && state.modelDirectoryUri.isNullOrBlank())
    ) {
      return@Runnable
    }
    enabled = state.enabled
    protectionEnabled = state.protectionEnabled
    listenRequested = true
    startForegroundImmediately(
      if (state.enabled) {
        "Retrying offline distress and emergency-word listening…"
      } else {
        "Retrying offline distress-sound monitoring…"
      },
    )
    if (state.enabled) {
      state.modelDirectoryUri?.let(::initializeModel)
    } else {
      startAudioLoopIfReady()
    }
  }

  private fun schedulePersistentRetry() {
    val state = readPersistentState(this)
    if (
      (!state.enabled && !state.protectionEnabled) ||
      state.voiceResumeRequired
    ) {
      return
    }
    mainHandler.removeCallbacks(retryInitialization)
    mainHandler.postDelayed(retryInitialization, initializationRetryDelayMs)
    initializationRetryDelayMs =
      (initializationRetryDelayMs * 2).coerceAtMost(INITIALIZATION_RETRY_MAX_MS)
  }

  private val powerStateReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (
        intent?.action == PowerManager.ACTION_POWER_SAVE_MODE_CHANGED ||
        intent?.action == Intent.ACTION_SCREEN_ON ||
        intent?.action == Intent.ACTION_SCREEN_OFF
      ) {
        refreshMotionSampling()
      }
    }
  }

  private val rearmAfterDetection = Runnable {
    if ((enabled || protectionEnabled) && detectionPending) {
      rearmInternal()
    }
  }

  override fun onCreate() {
    super.onCreate()
    instance = this
    sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
    accelerometer =
      sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER, true)
        ?: sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    gyroscope =
      sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE, true)
        ?: sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
    createNotificationChannels()
    ContextCompat.registerReceiver(
      this,
      powerStateReceiver,
      IntentFilter().apply {
        addAction(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED)
        addAction(Intent.ACTION_SCREEN_ON)
        addAction(Intent.ACTION_SCREEN_OFF)
      },
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )
    powerStateReceiverRegistered = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action ?: ACTION_RESTORE) {
      ACTION_START -> {
        val storedState = readPersistentState(this)
        val directoryUri = intent?.getStringExtra(EXTRA_MODEL_DIRECTORY)
          ?: storedState.modelDirectoryUri
        val shouldListen = intent?.getBooleanExtra(EXTRA_LISTEN_NOW, true) ?: true
        protectionEnabled = storedState.protectionEnabled
        enabled = true
        setVoiceResumeRequired(false)
        mainHandler.removeCallbacks(retryInitialization)
        initializationRetryDelayMs = INITIALIZATION_RETRY_MIN_MS
        startForegroundImmediately("Preparing persistent SafeCity protection…")
        if (directoryUri.isNullOrBlank()) {
          failInitialization(IllegalStateException("The bundled voice model directory is missing."))
          return START_NOT_STICKY
        }
        persistState(
          configured = true,
          enabled = true,
          protectionEnabled = protectionEnabled,
          modelDirectoryUri = directoryUri,
        )
        val restoredDetection = restorePendingDetectionIfNeeded()
        if (!restoredDetection) {
          detectionPending = false
          isDetectionPending = false
          listenRequested = shouldListen
        }
        if (protectionEnabled) startMotionMonitoring()
        if (protectionEnabled && shouldListen && !restoredDetection) startAudioLoopIfReady()
        initializeModel(directoryUri)
      }

      ACTION_START_PROTECTION -> {
        val state = readPersistentState(this)
        val voiceServiceWasRunning = enabled
        val protectionServiceWasRunning = protectionEnabled
        protectionEnabled = true
        enabled = state.enabled && !state.voiceResumeRequired
        if (!voiceServiceWasRunning) listenRequested = state.enabled
        if (!protectionServiceWasRunning) {
          detectionPending = false
          isDetectionPending = false
        }
        persistState(
          configured = state.configured,
          enabled = state.enabled,
          protectionEnabled = true,
          modelDirectoryUri = state.modelDirectoryUri,
        )
        startForegroundImmediately("Starting fall, motion and distress monitoring…")
        val restoredDetection = restorePendingDetectionIfNeeded()
        startMotionMonitoring()
        if (!restoredDetection) startAudioLoopIfReady()
        if (enabled && !state.modelDirectoryUri.isNullOrBlank()) {
          initializeModel(state.modelDirectoryUri)
        } else {
          updateForegroundNotification()
        }
      }

      ACTION_SET_LISTENING -> {
        val shouldListen = intent?.getBooleanExtra(EXTRA_LISTEN_NOW, true) ?: true
        if (shouldListen) {
          val state = readPersistentState(this)
          if (!state.enabled && !state.protectionEnabled) {
            updateForegroundNotification()
            return START_STICKY
          }
          enabled = state.enabled
          protectionEnabled = state.protectionEnabled
          setVoiceResumeRequired(false)
          startForegroundImmediately("Resuming background audio protection…")
          if (!detectionPending) {
            listenRequested = true
            startAudioLoopIfReady()
            if (enabled && (spotter == null || stream == null)) {
              state.modelDirectoryUri?.let(::initializeModel)
            }
          }
        } else {
          pauseListening()
        }
        updateForegroundNotification()
      }

      ACTION_SET_PROTECTION_ACTIVE -> {
        val shouldMonitor = intent?.getBooleanExtra(EXTRA_PROTECTION_ACTIVE, true) ?: true
        val state = readPersistentState(this)
        enabled = state.enabled
        protectionEnabled = state.protectionEnabled
        setVoiceResumeRequired(false)
        startForegroundImmediately(
          if (shouldMonitor) {
            "Resuming native background protection…"
          } else {
            "SafeCity is monitoring while the app is visible"
          },
        )
        if (protectionEnabled && shouldMonitor) {
          listenRequested = true
          startMotionMonitoring()
          startAudioLoopIfReady()
          if (enabled && (spotter == null || stream == null)) {
            state.modelDirectoryUri?.let(::initializeModel)
          }
        } else {
          stopMotionMonitoring()
          pauseListening()
        }
        updateForegroundNotification()
      }

      ACTION_REARM -> rearmInternal()

      ACTION_ACKNOWLEDGE_DETECTION -> acknowledgeDetectionInternal()

      ACTION_STOP -> {
        val state = readPersistentState(this)
        persistState(
          configured = true,
          enabled = false,
          protectionEnabled = state.protectionEnabled,
          modelDirectoryUri = state.modelDirectoryUri,
        )
        enabled = false
        setVoiceResumeRequired(false)
        mainHandler.removeCallbacks(retryInitialization)
        detectionPending = false
        isDetectionPending = false
        getSystemService(NotificationManager::class.java).cancel(DETECTION_NOTIFICATION_ID)
        getSystemService(NotificationManager::class.java).cancel(THREAT_NOTIFICATION_ID)
        if (protectionEnabled) {
          listenRequested = true
          startMotionMonitoring()
          startAudioLoopIfReady()
          updateForegroundNotification()
        } else {
          stopAudioLoop()
          stopForeground(STOP_FOREGROUND_REMOVE)
          stopSelf()
        }
      }

      ACTION_STOP_PROTECTION -> {
        val state = readPersistentState(this)
        protectionEnabled = false
        persistState(
          configured = state.configured,
          enabled = state.enabled,
          protectionEnabled = false,
          modelDirectoryUri = state.modelDirectoryUri,
        )
        stopMotionMonitoring()
        if (enabled) {
          updateForegroundNotification()
        } else {
          stopAudioLoop()
          stopForeground(STOP_FOREGROUND_REMOVE)
          stopSelf()
        }
      }

      ACTION_RESTORE -> {
        val state = readPersistentState(this)
        if (!state.enabled && !state.protectionEnabled) {
          stopSelf()
          return START_NOT_STICKY
        }
        enabled = state.enabled && !state.voiceResumeRequired
        protectionEnabled = state.protectionEnabled
        listenRequested = !state.voiceResumeRequired
        startForegroundImmediately("Restoring persistent SafeCity protection…")
        if (restorePendingDetectionIfNeeded()) {
          if (protectionEnabled) startMotionMonitoring()
          if (enabled && !state.modelDirectoryUri.isNullOrBlank()) {
            initializeModel(state.modelDirectoryUri)
          }
          return START_STICKY
        }
        detectionPending = false
        isDetectionPending = false
        if (protectionEnabled) startMotionMonitoring()
        if (
          state.voiceResumeRequired &&
          (state.enabled || state.protectionEnabled)
        ) {
          updateForegroundNotification(
            if (state.enabled) {
              "Motion protection restored · tap to resume background audio and keywords"
            } else {
              "Motion protection restored · tap to resume distress-sound monitoring"
            },
          )
        } else {
          startAudioLoopIfReady()
          if (enabled && !state.modelDirectoryUri.isNullOrBlank()) {
            initializeModel(state.modelDirectoryUri)
          }
          updateForegroundNotification()
        }
      }

      ACTION_RESTORE_MOTION_ONLY -> {
        val state = readPersistentState(this)
        enabled = false
        protectionEnabled = state.protectionEnabled
        listenRequested = false
        detectionPending = false
        isDetectionPending = false
        if (!protectionEnabled) {
          postVoiceResumeNotification(this, state)
          stopSelf()
          return START_NOT_STICKY
        }
        startForegroundImmediately(
          if (state.enabled) {
            "Motion protection restored · tap to resume background audio and keywords"
          } else {
            "Motion protection restored · tap to resume distress-sound monitoring"
          },
        )
        startMotionMonitoring()
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    if (instance === this) instance = null
    mainHandler.removeCallbacksAndMessages(null)
    if (powerStateReceiverRegistered) {
      try {
        unregisterReceiver(powerStateReceiver)
      } catch (_: Throwable) {
      }
      powerStateReceiverRegistered = false
    }
    enabled = false
    protectionEnabled = false
    stopAudioLoop()
    stopMotionMonitoring()
    lifecycleExecutor.execute { releaseModel() }
    lifecycleExecutor.shutdown()
    isActivelyListening = false
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    if ((enabled || protectionEnabled) && !detectionPending) {
      listenRequested = true
      startAudioLoopIfReady()
    }
    if (protectionEnabled) startMotionMonitoring()
    updateForegroundNotification()
    super.onTaskRemoved(rootIntent)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun initializeModel(directoryUri: String) {
    lifecycleExecutor.execute {
      try {
        val directory = modelDirectoryFromUri(directoryUri)
        validateModelFiles(directory)
        synchronized(modelLock) {
          if (initializedDirectory != directory.absolutePath) {
            releaseModelLocked()
            val transducer = OnlineTransducerModelConfig(
              encoder = File(directory, ENCODER_FILE).absolutePath,
              decoder = File(directory, DECODER_FILE).absolutePath,
              joiner = File(directory, JOINER_FILE).absolutePath,
            )
            val model = OnlineModelConfig(
              transducer = transducer,
              tokens = File(directory, TOKENS_FILE).absolutePath,
              numThreads = 1,
              debug = false,
              provider = "cpu",
              modelType = "zipformer2",
            )
            val config = KeywordSpotterConfig(
              featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80),
              modelConfig = model,
              maxActivePaths = 4,
              keywordsFile = File(directory, KEYWORDS_FILE).absolutePath,
              keywordsScore = 2.0f,
              keywordsThreshold = 0.20f,
              numTrailingBlanks = 1,
            )
            spotter = KeywordSpotter(null, config)
            stream = spotter?.createStream()
              ?: throw IllegalStateException("The offline keyword stream could not be created.")
            modelDirectory = directory
            initializedDirectory = directory.absolutePath
          }
        }
        if (!enabled) {
          completeStartCallbacks(Result.failure(IllegalStateException("Voice listening was turned off.")))
          return@execute
        }
        startAudioLoopIfReady()
        initializationRetryDelayMs = INITIALIZATION_RETRY_MIN_MS
        mainHandler.removeCallbacks(retryInitialization)
        updateForegroundNotification()
        completeStartCallbacks(Result.success(Unit))
      } catch (error: Throwable) {
        failInitialization(error)
      }
    }
  }

  private fun startAudioLoopIfReady() {
    if (
      (!enabled && !protectionEnabled) ||
      !listenRequested ||
      detectionPending
    ) {
      return
    }
    // Distress-sound detection belongs to background protection and does not
    // require the keyword model. Keyword decoding joins the same stream once
    // its model is ready.
    if (audioThread?.isAlive == true) return
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      failInitialization(SecurityException("Microphone permission is required for voice SOS."))
      return
    }

    val minimumBuffer = AudioRecord.getMinBufferSize(
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
    )
    if (minimumBuffer <= 0) {
      failInitialization(IllegalStateException("This phone could not open a 16 kHz microphone stream."))
      return
    }
    val bufferBytes = max(minimumBuffer, SAMPLE_RATE / 5 * 2)
    val recorder = AudioRecord(
      MediaRecorder.AudioSource.VOICE_RECOGNITION,
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
      bufferBytes,
    )
    if (recorder.state != AudioRecord.STATE_INITIALIZED) {
      recorder.release()
      failInitialization(IllegalStateException("The microphone is unavailable to the voice SOS listener."))
      return
    }

    audioRecord = recorder
    distressAudioWindows = 0
    lastDistressCandidateAtElapsed = 0L
    resetThreatEvidence()
    resetEmergencyLoudness()
    outdoorNoiseConditioner.reset()
    val thread = Thread({
      Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
      val samples = ShortArray(bufferBytes / 2)
      try {
        recorder.startRecording()
        isActivelyListening = true
        updateForegroundNotification()
        while (
          (enabled || protectionEnabled) &&
          listenRequested &&
          !detectionPending &&
          audioRecord === recorder
        ) {
          val read = recorder.read(samples, 0, samples.size, AudioRecord.READ_BLOCKING)
          if (read < 0) {
            throw IllegalStateException("The background microphone stream stopped unexpectedly.")
          }
          if (read == 0) continue
          val normalized = FloatArray(read) { index -> samples[index] / 32768.0f }
          val conditioned = outdoorNoiseConditioner.process(normalized)
          rememberEmergencyLoudness(conditioned)
          if (protectionEnabled && detectDistressAudio(conditioned)) {
            onSafetyDetected(
              source = "audio",
              label = "Possible distress scream or shout",
            )
            break
          }
          val detected = if (enabled) decodeSamples(conditioned) else null
          if (!detected.isNullOrBlank()) {
            if (isThreatKeyword(detected)) {
              onThreatPhraseDetected(detected)
              resetEmergencyLoudness()
              if (!detectionPending) continue
            } else if (!emergencyKeywordPassesLoudnessGate(detected)) {
              resetEmergencyLoudness()
              continue
            } else {
              onEmergencyKeywordDetected(detected)
            }
            break
          }
        }
      } catch (error: Throwable) {
        if ((enabled || protectionEnabled) && listenRequested && !detectionPending) {
          updateForegroundNotification(
            "Background audio paused unexpectedly · retrying automatically",
          )
          schedulePersistentRetry()
        }
      } finally {
        isActivelyListening = false
        try {
          if (recorder.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
            recorder.stop()
          }
        } catch (_: Throwable) {
        }
        recorder.release()
        if (audioRecord === recorder) audioRecord = null
        if (audioThread === Thread.currentThread()) audioThread = null
        updateForegroundNotification()
      }
    }, "SafeCityVoiceTrigger")
    audioThread = thread
    thread.start()
  }

  private fun decodeSamples(samples: FloatArray): String? = synchronized(modelLock) {
    val activeSpotter = spotter ?: return@synchronized null
    val activeStream = stream ?: return@synchronized null
    activeStream.acceptWaveform(samples, SAMPLE_RATE)
    while (activeSpotter.isReady(activeStream)) {
      activeSpotter.decode(activeStream)
    }
    val keyword = activeSpotter.getResult(activeStream).keyword.trim()
    if (keyword.isNotEmpty()) {
      activeSpotter.reset(activeStream)
      normalizeKeyword(keyword)
    } else {
      null
    }
  }

  private fun detectDistressAudio(samples: FloatArray): Boolean {
    if (samples.size < 64) return false
    var sumSquares = 0.0
    var zeroCrossings = 0
    var peak = 0f
    var previous = samples.first()
    for (sample in samples) {
      sumSquares += sample * sample
      peak = max(peak, abs(sample))
      if ((sample >= 0f) != (previous >= 0f)) zeroCrossings += 1
      previous = sample
    }
    val rms = sqrt(sumSquares / samples.size)
    val zeroCrossingRate = zeroCrossings.toDouble() / samples.size
    val crestFactor = peak / max(rms.toFloat(), 0.0001f)
    distressAudioWindows =
      if (
        rms >= DISTRESS_RMS_THRESHOLD &&
        zeroCrossingRate >= DISTRESS_ZCR_THRESHOLD &&
        crestFactor >= DISTRESS_MINIMUM_CREST_FACTOR
      ) {
        lastDistressCandidateAtElapsed = SystemClock.elapsedRealtime()
        distressAudioWindows + 1
      } else {
        max(0, distressAudioWindows - 1)
      }
    return distressAudioWindows >= DISTRESS_REQUIRED_WINDOWS
  }

  private fun rememberEmergencyLoudness(samples: FloatArray) {
    if (samples.isEmpty()) return
    var sumSquares = 0.0
    samples.forEach { sample -> sumSquares += sample * sample }
    val rms = sqrt(sumSquares / samples.size)
    val now = SystemClock.elapsedRealtime()
    if (
      recentEmergencyRmsAtElapsed == 0L ||
      now - recentEmergencyRmsAtElapsed > EMERGENCY_LOUDNESS_WINDOW_MS ||
      rms >= recentEmergencyRms
    ) {
      recentEmergencyRms = rms
      recentEmergencyRmsAtElapsed = now
    }
  }

  private fun emergencyKeywordPassesLoudnessGate(keyword: String): Boolean {
    if (keyword !in LOUDNESS_GATED_KEYWORDS) return true
    val now = SystemClock.elapsedRealtime()
    return (
      recentEmergencyRmsAtElapsed > 0L &&
      now - recentEmergencyRmsAtElapsed <= EMERGENCY_LOUDNESS_WINDOW_MS &&
      recentEmergencyRms >= HELP_BACHAO_MIN_RMS
    )
  }

  private fun resetEmergencyLoudness() {
    recentEmergencyRms = 0.0
    recentEmergencyRmsAtElapsed = 0L
  }

  private fun onEmergencyKeywordDetected(keyword: String) {
    val startedAt = beginSafetyDetection("voice", keyword)
    SafeCityVoiceTriggerModule.emitKeywordDetected(keyword, startedAt)
    showDetectionNotification(
      source = "voice",
      label = keyword,
      title = "Emergency word detected",
      startedAtEpochMs = startedAt,
    )
    updateForegroundNotification("Emergency word detected · SOS countdown opened")
  }

  private fun onThreatPhraseDetected(keyword: String) {
    val now = SystemClock.elapsedRealtime()
    SafeCityVoiceTriggerModule.emitKeywordDetected(keyword)
    if (
      lastThreatMatchAtElapsed > 0L &&
      now - lastThreatMatchAtElapsed < THREAT_DUPLICATE_COOLDOWN_MS
    ) {
      return
    }
    threatMatchCount =
      if (
        lastThreatMatchAtElapsed > 0L &&
        now - lastThreatMatchAtElapsed <= THREAT_MATCH_WINDOW_MS
      ) {
        threatMatchCount + 1
      } else {
        1
      }
    lastThreatMatchAtElapsed = now

    val motionAgreement =
      abruptMotionAtElapsed > 0L &&
        now - abruptMotionAtElapsed <= THREAT_MOTION_AGREEMENT_WINDOW_MS
    val audioAgreement =
      lastDistressCandidateAtElapsed > 0L &&
        now - lastDistressCandidateAtElapsed <= THREAT_AUDIO_AGREEMENT_WINDOW_MS
    val label = threatDisplayLabel(keyword)
    if (threatMatchCount >= THREAT_REQUIRED_MATCHES && (motionAgreement || audioAgreement)) {
      val startedAt = beginSafetyDetection("threat", label)
      SafeCityVoiceTriggerModule.emitSafetyDetected("threat", label, startedAt)
      showDetectionNotification(
        source = "threat",
        label = label,
        title = "Possible threat confirmed",
        startedAtEpochMs = startedAt,
      )
      updateForegroundNotification("$label confirmed with another signal · SOS countdown opened")
      return
    }

    showThreatLanguageNotification(label, threatMatchCount)
    updateForegroundNotification(
      "$label heard · listening for repetition and an independent danger signal",
    )
  }

  private fun resetThreatEvidence() {
    lastThreatMatchAtElapsed = 0L
    threatMatchCount = 0
  }

  private fun onSafetyDetected(source: String, label: String) {
    if (!protectionEnabled || detectionPending) return
    val startedAt = beginSafetyDetection(source, label)
    SafeCityVoiceTriggerModule.emitSafetyDetected(source, label, startedAt)
    showDetectionNotification(
      source = source,
      label = label,
      title = if (source == "motion") "Possible fall detected" else "Possible distress sound",
      startedAtEpochMs = startedAt,
    )
    updateForegroundNotification("$label · SOS countdown opened")
  }

  private fun beginSafetyDetection(source: String, label: String): Long {
    val startedAtEpochMs = System.currentTimeMillis()
    detectionPending = true
    isDetectionPending = true
    listenRequested = false
    persistPendingDetection(source, label, startedAtEpochMs)
    scheduleCountdownExpiry(source, label, startedAtEpochMs)
    mainHandler.removeCallbacks(rearmAfterDetection)
    mainHandler.postDelayed(rearmAfterDetection, DETECTION_AUTO_REARM_MS)
    return startedAtEpochMs
  }

  private fun persistPendingDetection(
    source: String,
    label: String,
    startedAtEpochMs: Long,
  ) {
    preferences(this).edit()
      .putString(PREF_PENDING_DETECTION_SOURCE, source)
      .putString(PREF_PENDING_DETECTION_LABEL, label)
      .putLong(PREF_PENDING_DETECTION_STARTED_AT, startedAtEpochMs)
      .apply()
  }

  private fun clearPendingDetection() {
    countdownExpiryRunnable?.let(mainHandler::removeCallbacks)
    countdownExpiryRunnable = null
    preferences(this).edit()
      .remove(PREF_PENDING_DETECTION_SOURCE)
      .remove(PREF_PENDING_DETECTION_LABEL)
      .remove(PREF_PENDING_DETECTION_STARTED_AT)
      .apply()
  }

  private fun scheduleCountdownExpiry(
    source: String,
    label: String,
    startedAtEpochMs: Long,
  ) {
    countdownExpiryRunnable?.let(mainHandler::removeCallbacks)
    val runnable = Runnable {
      if (!detectionPending) return@Runnable
      showDetectionNotification(
        source = source,
        label = label,
        title = "SOS countdown finished",
        startedAtEpochMs = startedAtEpochMs,
        countdownFinished = true,
      )
      updateForegroundNotification("SOS countdown finished · opening SafeCity")
    }
    countdownExpiryRunnable = runnable
    val delayMs = (
      startedAtEpochMs + SOS_COUNTDOWN_MS - System.currentTimeMillis()
    ).coerceAtLeast(0L)
    mainHandler.postDelayed(runnable, delayMs)
  }

  private fun pauseListening() {
    listenRequested = false
    stopAudioLoop()
  }

  private fun restorePendingDetectionIfNeeded(): Boolean {
    val pending = readPendingDetectionState(this) ?: return false
    val ageMs = System.currentTimeMillis() - pending.startedAtEpochMs
    if (ageMs < 0L || ageMs >= DETECTION_AUTO_REARM_MS) {
      clearPendingDetection()
      return false
    }
    detectionPending = true
    isDetectionPending = true
    listenRequested = false
    startForegroundImmediately("Safety event detected · restoring SOS countdown")
    showDetectionNotification(
      source = pending.source,
      label = pending.label,
      title = if (ageMs >= SOS_COUNTDOWN_MS) {
        "SOS countdown finished"
      } else {
        "Safety event detected"
      },
      startedAtEpochMs = pending.startedAtEpochMs,
      countdownFinished = ageMs >= SOS_COUNTDOWN_MS,
    )
    scheduleCountdownExpiry(
      pending.source,
      pending.label,
      pending.startedAtEpochMs,
    )
    mainHandler.removeCallbacks(rearmAfterDetection)
    mainHandler.postDelayed(
      rearmAfterDetection,
      (DETECTION_AUTO_REARM_MS - ageMs).coerceAtLeast(0L),
    )
    return true
  }

  private fun rearmInternal() {
    detectionPending = false
    isDetectionPending = false
    mainHandler.removeCallbacks(rearmAfterDetection)
    clearPendingDetection()
    getSystemService(NotificationManager::class.java).cancel(DETECTION_NOTIFICATION_ID)
    getSystemService(NotificationManager::class.java).cancel(THREAT_NOTIFICATION_ID)
    if (!enabled && !protectionEnabled) return
    listenRequested = true
    resetThreatEvidence()
    resetEmergencyLoudness()
    synchronized(modelLock) {
      val activeSpotter = spotter
      val activeStream = stream
      if (activeSpotter != null && activeStream != null) {
        try {
          activeSpotter.reset(activeStream)
        } catch (_: Throwable) {
        }
      }
    }
    if (enabled || protectionEnabled) startAudioLoopIfReady()
    if (protectionEnabled) startMotionMonitoring()
    updateForegroundNotification()
  }

  private fun acknowledgeDetectionInternal() {
    detectionPending = false
    isDetectionPending = false
    listenRequested = false
    mainHandler.removeCallbacks(rearmAfterDetection)
    clearPendingDetection()
    getSystemService(NotificationManager::class.java).cancel(DETECTION_NOTIFICATION_ID)
    updateForegroundNotification("SOS activated · protection paused for evidence capture")
  }

  private fun stopAudioLoop() {
    val recorder = audioRecord
    audioRecord = null
    try {
      recorder?.stop()
    } catch (_: Throwable) {
    }
    audioThread?.interrupt()
  }

  private fun startMotionMonitoring() {
    if (!protectionEnabled || isMotionMonitoring) return
    val powerManager = getSystemService(POWER_SERVICE) as PowerManager
    // Keep the calibrated 50/40 Hz rates while the phone is interactive.
    // When the screen is off or battery saver is on, 25/20 Hz still captures
    // the ordered fall transient while allowing the sensor hub to batch work.
    val lowPower = powerManager.isPowerSaveMode || !powerManager.isInteractive
    val accelerationIntervalUs =
      if (lowPower) MOTION_LOW_POWER_ACCEL_INTERVAL_US else MOTION_ACCEL_INTERVAL_US
    val gyroscopeIntervalUs =
      if (lowPower) MOTION_LOW_POWER_GYRO_INTERVAL_US else MOTION_GYRO_INTERVAL_US
    val batchLatencyUs =
      if (lowPower) MOTION_LOW_POWER_BATCH_LATENCY_US else MOTION_BATCH_LATENCY_US
    val accelerometerRegistered = accelerometer?.let {
      sensorManager.registerListener(
        this,
        it,
        accelerationIntervalUs,
        batchLatencyUs,
      )
    } ?: false
    val gyroscopeRegistered = gyroscope?.let {
      sensorManager.registerListener(
        this,
        it,
        gyroscopeIntervalUs,
        batchLatencyUs,
      )
    } ?: false
    isMotionMonitoring = accelerometerRegistered || gyroscopeRegistered
    updateForegroundNotification()
  }

  private fun refreshMotionSampling() {
    if (!protectionEnabled || !isMotionMonitoring) return
    stopMotionMonitoring()
    startMotionMonitoring()
  }

  private fun stopMotionMonitoring() {
    if (::sensorManager.isInitialized) sensorManager.unregisterListener(this)
    isMotionMonitoring = false
    resetFallCandidate()
    lastGyroscopeAtElapsed = 0L
    lastGyroscopeTimestampNs = 0L
    lastAccelerationMagnitudeG = 1f
    lastAccelerationTimestampNs = 0L
    abruptMotionAtElapsed = 0L
    lastAbruptSampleAtElapsed = 0L
    abruptMotionCount = 0
    lastGyroscopeMagnitude = 0f
  }

  private fun resetFallCandidate() {
    freeFallStartedAtElapsed = 0L
    confirmedFreeFallAtElapsed = 0L
    confirmedFreeFallDurationMs = 0L
    accumulatedRotationRad = 0f
    peakFallRotationRadPerSecond = 0f
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (!protectionEnabled || detectionPending || event == null) return
    // SensorEvent timestamps preserve the real sample spacing even when Android
    // delivers a battery-saving batch of events together.
    val now = event.timestamp / 1_000_000L
    when (event.sensor.type) {
      Sensor.TYPE_GYROSCOPE -> {
        val x = event.values.getOrElse(0) { 0f }
        val y = event.values.getOrElse(1) { 0f }
        val z = event.values.getOrElse(2) { 0f }
        lastGyroscopeMagnitude = sqrt(x * x + y * y + z * z)
        lastGyroscopeAtElapsed = now
        if (
          lastGyroscopeTimestampNs > 0L &&
          (freeFallStartedAtElapsed > 0L || confirmedFreeFallAtElapsed > 0L)
        ) {
          val elapsedSeconds =
            (event.timestamp - lastGyroscopeTimestampNs).toDouble() / 1_000_000_000.0
          if (elapsedSeconds in 0.0..MAXIMUM_SENSOR_SAMPLE_GAP_SECONDS) {
            accumulatedRotationRad += (lastGyroscopeMagnitude * elapsedSeconds).toFloat()
          }
        }
        lastGyroscopeTimestampNs = event.timestamp
        if (freeFallStartedAtElapsed > 0L || confirmedFreeFallAtElapsed > 0L) {
          peakFallRotationRadPerSecond =
            max(peakFallRotationRadPerSecond, lastGyroscopeMagnitude)
        }
      }

      Sensor.TYPE_ACCELEROMETER -> {
        val x = event.values.getOrElse(0) { 0f }
        val y = event.values.getOrElse(1) { 0f }
        val z = event.values.getOrElse(2) { 0f }
        val magnitudeG = sqrt(x * x + y * y + z * z) / SensorManager.GRAVITY_EARTH
        val elapsedSeconds =
          if (lastAccelerationTimestampNs > 0L) {
            (event.timestamp - lastAccelerationTimestampNs).toDouble() / 1_000_000_000.0
          } else {
            0.0
          }
        val jerkGPerSecond =
          if (elapsedSeconds in MINIMUM_SENSOR_SAMPLE_SECONDS..MAXIMUM_SENSOR_SAMPLE_GAP_SECONDS) {
            (abs(magnitudeG - lastAccelerationMagnitudeG) / elapsedSeconds).toFloat()
          } else {
            0f
          }
        lastAccelerationMagnitudeG = magnitudeG
        lastAccelerationTimestampNs = event.timestamp

        if (magnitudeG <= FREE_FALL_G_THRESHOLD) {
          if (freeFallStartedAtElapsed == 0L) {
            resetFallCandidate()
            freeFallStartedAtElapsed = now
          }
        } else if (freeFallStartedAtElapsed > 0L) {
          val duration = now - freeFallStartedAtElapsed
          if (duration in MIN_FALL_DURATION_MS..MAX_FALL_DURATION_MS) {
            confirmedFreeFallAtElapsed = now
            confirmedFreeFallDurationMs = duration
          } else {
            resetFallCandidate()
          }
          freeFallStartedAtElapsed = 0L
        }

        if (confirmedFreeFallAtElapsed > 0L) {
          val impactDelay = now - confirmedFreeFallAtElapsed
          val rotationCorroborated =
            accumulatedRotationRad >= FALL_ROTATION_DELTA_THRESHOLD_RAD ||
              peakFallRotationRadPerSecond >= FALL_ROTATION_RATE_THRESHOLD_RAD_PER_SECOND ||
              magnitudeG >= FALL_STRONG_IMPACT_THRESHOLD_G ||
              (gyroscope == null && magnitudeG >= FALL_NO_GYROSCOPE_IMPACT_THRESHOLD_G)
          if (
            impactDelay <= MAX_FALL_IMPACT_DELAY_MS &&
            magnitudeG >= FALL_IMPACT_G_THRESHOLD &&
            rotationCorroborated
          ) {
            val label =
              "Free-fall ${confirmedFreeFallDurationMs} ms followed by ${"%.1f".format(magnitudeG)}g impact"
            resetFallCandidate()
            onSafetyDetected("motion", label)
            return
          }
          if (impactDelay > MAX_FALL_IMPACT_DELAY_MS) resetFallCandidate()
        }

        val recentGyroscope =
          now - lastGyroscopeAtElapsed <= MAXIMUM_GYROSCOPE_CORRELATION_DELAY_MS
        if (
          magnitudeG >= VIOLENT_MOTION_G_THRESHOLD &&
          jerkGPerSecond >= VIOLENT_JERK_THRESHOLD_G_PER_SECOND &&
          recentGyroscope &&
          lastGyroscopeMagnitude >= VIOLENT_ROTATION_THRESHOLD &&
          now - lastAbruptSampleAtElapsed >= MINIMUM_VIOLENT_SAMPLE_SPACING_MS
        ) {
          abruptMotionCount =
            if (now - abruptMotionAtElapsed <= VIOLENT_MOTION_WINDOW_MS) {
              abruptMotionCount + 1
            } else {
              1
            }
          abruptMotionAtElapsed = now
          lastAbruptSampleAtElapsed = now
          if (abruptMotionCount >= VIOLENT_MOTION_REQUIRED_SAMPLES) {
            abruptMotionCount = 0
            onSafetyDetected("motion", "Repeated violent movement detected")
          }
        } else if (now - abruptMotionAtElapsed > VIOLENT_MOTION_WINDOW_MS) {
          abruptMotionCount = 0
        }
      }
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  private fun releaseModel() = synchronized(modelLock) {
    releaseModelLocked()
  }

  private fun releaseModelLocked() {
    try {
      stream?.release()
    } catch (_: Throwable) {
    }
    stream = null
    try {
      spotter?.release()
    } catch (_: Throwable) {
    }
    spotter = null
    initializedDirectory = null
  }

  private fun failInitialization(error: Throwable) {
    val state = readPersistentState(this)
    // A temporary model, microphone, or audio-device failure must not silently
    // change the switch the user explicitly enabled. Keep the persisted intent
    // and retry with a capped backoff until the user turns voice protection off.
    persistState(
      configured = true,
      enabled = state.enabled,
      protectionEnabled = state.protectionEnabled,
      modelDirectoryUri = state.modelDirectoryUri,
    )
    enabled = state.enabled
    protectionEnabled = state.protectionEnabled
    val distressAudioContinues =
      state.protectionEnabled &&
        audioThread?.isAlive == true &&
        audioRecord != null
    listenRequested = distressAudioContinues
    detectionPending = false
    isDetectionPending = false
    if (!distressAudioContinues) stopAudioLoop()
    updateForegroundNotification(
      "${error.message ?: "Voice listening needs attention."} Retrying automatically.",
    )
    completeStartCallbacks(Result.failure(error))
    schedulePersistentRetry()
  }

  private fun validateModelFiles(directory: File) {
    if (!directory.isDirectory) {
      throw IllegalStateException("The bundled voice model folder is unavailable.")
    }
    listOf(ENCODER_FILE, DECODER_FILE, JOINER_FILE, TOKENS_FILE, KEYWORDS_FILE).forEach { name ->
      val file = File(directory, name)
      if (!file.isFile || file.length() == 0L) {
        throw IllegalStateException("The bundled voice model is incomplete ($name).")
      }
    }
  }

  private fun modelDirectoryFromUri(uri: String): File {
    val parsed = Uri.parse(uri)
    return if (parsed.scheme == "file") {
      File(parsed.path ?: throw IllegalStateException("The voice model path is invalid."))
    } else {
      File(uri)
    }
  }

  private fun normalizeKeyword(keyword: String): String? {
    val normalized = keyword
      .uppercase()
      .replace(Regex("[^A-Z]+"), "_")
      .trim('_')
    return when {
      normalized in THREAT_KEYWORDS -> normalized
      normalized.contains("BACHAO") || normalized.contains("BATCHAO") -> "BACHAO"
      normalized.contains("SAVE") -> "SAVE_ME"
      normalized.contains("EMERGENCY") -> "EMERGENCY"
      normalized.contains("POLICE") -> "POLICE"
      normalized.contains("SOS") -> "SOS"
      normalized.contains("HELP") -> "HELP"
      else -> null
    }
  }

  private fun isThreatKeyword(keyword: String): Boolean = keyword in THREAT_KEYWORDS

  private fun threatDisplayLabel(keyword: String): String = when (keyword) {
    "THREAT_DONT_SHOUT" -> "“Don’t shout”"
    "THREAT_GIVE_PHONE" -> "“Give me your phone”"
    "THREAT_SHUT_UP" -> "“Shut up”"
    "THREAT_DONT_MOVE" -> "“Don’t move”"
    "THREAT_KILL_YOU" -> "“I will kill you”"
    "THREAT_CHILLAO_MAT" -> "“Chillao mat”"
    "THREAT_PHONE_DE_DO" -> "“Phone de do”"
    "THREAT_CHUP_RAHO" -> "“Chup raho”"
    "THREAT_MAAR_DUNGA" -> "“Maar dunga”"
    "THREAT_CHITKAR_KORO_NA" -> "“Chitkar koro na”"
    "THREAT_PHONE_DAO" -> "“Phone dao”"
    "THREAT_CHUP_KORO" -> "“Chup koro”"
    "THREAT_MERE_FELBO" -> "“Mere felbo”"
    else -> "Possible threatening phrase"
  }

  private fun createNotificationChannels() {
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(
        LISTENER_CHANNEL_ID,
        "Persistent safety monitoring",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Visible while SafeCity monitors emergency words, motion and falls."
        setSound(null, null)
      },
    )
    manager.createNotificationChannel(
      NotificationChannel(
        DETECTION_CHANNEL_ID,
        "Safety SOS detections",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Opens the SOS countdown when an emergency word is detected."
        enableVibration(true)
        setSound(null, null)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      },
    )
    manager.createNotificationChannel(
      NotificationChannel(
        THREAT_CHANNEL_ID,
        "Threat-language checks",
        NotificationManager.IMPORTANCE_DEFAULT,
      ).apply {
        description =
          "Discreetly reports a possible threatening phrase while SafeCity checks for independent confirmation."
        enableVibration(true)
        setSound(null, null)
        lockscreenVisibility = Notification.VISIBILITY_PRIVATE
      },
    )
  }

  private fun startForegroundImmediately(text: String) {
    val notification = buildListenerNotification(text)
    var foregroundTypes = 0
    val persistentState = readPersistentState(this)
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
      (enabled || protectionEnabled) &&
      !persistentState.voiceResumeRequired
    ) {
      foregroundTypes = foregroundTypes or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE && protectionEnabled) {
      foregroundTypes = foregroundTypes or ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
    }
    ServiceCompat.startForeground(
      this,
      LISTENER_NOTIFICATION_ID,
      notification,
      foregroundTypes,
    )
  }

  private fun updateForegroundNotification(
    overrideText: String? = null,
  ) {
    if (!enabled && !protectionEnabled) return
    val text = overrideText ?: when {
      detectionPending -> "Safety event detected · SOS countdown opened"
      isActivelyListening && isMotionMonitoring && enabled ->
        "Listening for emergency words, threat phrases, distress sounds, falls and violent motion"
      isActivelyListening && isMotionMonitoring ->
        "Monitoring distress sounds, falls and violent motion"
      isActivelyListening && enabled ->
        "Listening offline for emergency words and threat phrases"
      isActivelyListening -> "Monitoring offline for possible distress sounds"
      isMotionMonitoring && enabled ->
        "Fall and motion monitoring active · voice listening resumes automatically"
      isMotionMonitoring -> "Battery-aware fall and violent-motion monitoring is active"
      else -> "Persistent SafeCity protection is enabled"
    }
    getSystemService(NotificationManager::class.java).notify(
      LISTENER_NOTIFICATION_ID,
      buildListenerNotification(text),
    )
  }

  private fun buildListenerNotification(text: String): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        7101,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
    val stopIntent = Intent(this, SafeCityVoiceTriggerService::class.java).apply {
      action = ACTION_STOP
    }
    val stopPendingIntent = PendingIntent.getService(
      this,
      7102,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val resumeVoicePendingIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        7103,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
    val persistentState = readPersistentState(this)
    val builder = NotificationCompat.Builder(this, LISTENER_CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(
        if (
          persistentState.voiceResumeRequired &&
          (persistentState.enabled || persistentState.protectionEnabled)
        ) {
          "SafeCity motion protection is on"
        } else {
          "SafeCity protection is on"
        },
      )
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setContentIntent(contentIntent)
    if (enabled) builder.addAction(0, "Turn off voice SOS", stopPendingIntent)
    if (
      persistentState.voiceResumeRequired &&
      (persistentState.enabled || persistentState.protectionEnabled) &&
      resumeVoicePendingIntent != null
    ) {
      builder.addAction(
        0,
        if (persistentState.enabled) "Resume audio + voice SOS" else "Resume audio protection",
        resumeVoicePendingIntent,
      )
    }
    return builder.build()
  }

  private fun showDetectionNotification(
    source: String,
    label: String,
    title: String,
    startedAtEpochMs: Long,
    countdownFinished: Boolean = false,
  ) {
    val deepLink = Uri.parse(
      "safecity://sos-countdown" +
        "?source=${Uri.encode(source)}" +
        "&keyword=${Uri.encode(label)}" +
        "&startedAt=$startedAtEpochMs",
    )
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      data = deepLink
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_CLEAR_TOP or
        Intent.FLAG_ACTIVITY_SINGLE_TOP
    } ?: Intent(Intent.ACTION_VIEW, deepLink).apply {
      setPackage(packageName)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val fullScreenIntent = PendingIntent.getActivity(
      this,
      7110,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(this, DETECTION_CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(
        if (countdownFinished) {
          "$label · Opening SafeCity for SOS now"
        } else {
          "$label · SOS starts in 10 seconds"
        },
      )
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setOngoing(true)
      .setContentIntent(fullScreenIntent)
      .setFullScreenIntent(fullScreenIntent, true)
      .build()
    getSystemService(NotificationManager::class.java).notify(
      DETECTION_NOTIFICATION_ID,
      notification,
    )
    attemptCountdownLaunch(fullScreenIntent)
  }

  private fun attemptCountdownLaunch(pendingIntent: PendingIntent) {
    mainHandler.post {
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
            this,
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
        // Android may still restrict background launches. The high-priority
        // full-screen notification remains visible and opens the same route.
      }
    }
  }

  private fun showThreatLanguageNotification(label: String, matchCount: Int) {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        7111,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
    val detail =
      if (matchCount >= THREAT_REQUIRED_MATCHES) {
        "Repeated phrase heard. No SOS started without an independent danger signal."
      } else {
        "No SOS started. Listening for repetition and an independent danger signal."
      }
    val notification = NotificationCompat.Builder(this, THREAT_CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Possible threatening language")
      .setContentText("$label · $detail")
      .setStyle(NotificationCompat.BigTextStyle().bigText("$label · $detail"))
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setAutoCancel(true)
      .setOnlyAlertOnce(false)
      .setContentIntent(contentIntent)
      .build()
    getSystemService(NotificationManager::class.java).notify(
      THREAT_NOTIFICATION_ID,
      notification,
    )
  }

  private fun persistState(
    configured: Boolean,
    enabled: Boolean,
    protectionEnabled: Boolean,
    modelDirectoryUri: String?,
  ) {
    preferences(this).edit()
      .putBoolean(PREF_CONFIGURED, configured)
      .putBoolean(PREF_ENABLED, enabled)
      .putBoolean(PREF_PROTECTION_ENABLED, protectionEnabled)
      .putString(PREF_MODEL_DIRECTORY, modelDirectoryUri)
      .apply()
  }

  private fun setVoiceResumeRequired(required: Boolean) {
    preferences(this).edit()
      .putBoolean(PREF_VOICE_RESUME_REQUIRED, required)
      .apply()
  }

  data class PersistentState(
    val configured: Boolean,
    val enabled: Boolean,
    val protectionEnabled: Boolean,
    val modelDirectoryUri: String?,
    val voiceResumeRequired: Boolean,
  )

  data class PendingDetectionState(
    val source: String,
    val label: String,
    val startedAtEpochMs: Long,
  )

  companion object {
    private const val ACTION_START = "com.safecity.voicetrigger.START"
    private const val ACTION_STOP = "com.safecity.voicetrigger.STOP"
    private const val ACTION_START_PROTECTION = "com.safecity.voicetrigger.START_PROTECTION"
    private const val ACTION_STOP_PROTECTION = "com.safecity.voicetrigger.STOP_PROTECTION"
    private const val ACTION_SET_LISTENING = "com.safecity.voicetrigger.SET_LISTENING"
    private const val ACTION_SET_PROTECTION_ACTIVE =
      "com.safecity.voicetrigger.SET_PROTECTION_ACTIVE"
    private const val ACTION_REARM = "com.safecity.voicetrigger.REARM"
    private const val ACTION_ACKNOWLEDGE_DETECTION =
      "com.safecity.voicetrigger.ACKNOWLEDGE_DETECTION"
    private const val ACTION_RESTORE = "com.safecity.voicetrigger.RESTORE"
    private const val ACTION_RESTORE_MOTION_ONLY =
      "com.safecity.voicetrigger.RESTORE_MOTION_ONLY"
    private const val EXTRA_MODEL_DIRECTORY = "modelDirectory"
    private const val EXTRA_LISTEN_NOW = "listenNow"
    private const val EXTRA_PROTECTION_ACTIVE = "protectionActive"

    private const val PREFERENCES = "safecity-voice-trigger"
    private const val PREF_CONFIGURED = "configured"
    private const val PREF_ENABLED = "enabled"
    private const val PREF_PROTECTION_ENABLED = "protectionEnabled"
    private const val PREF_MODEL_DIRECTORY = "modelDirectory"
    private const val PREF_VOICE_RESUME_REQUIRED = "voiceResumeRequired"
    private const val PREF_PENDING_DETECTION_SOURCE = "pendingDetectionSource"
    private const val PREF_PENDING_DETECTION_LABEL = "pendingDetectionLabel"
    private const val PREF_PENDING_DETECTION_STARTED_AT = "pendingDetectionStartedAt"

    private const val LISTENER_CHANNEL_ID = "safecity-voice-listener"
    private const val DETECTION_CHANNEL_ID = "safecity-voice-detection"
    private const val THREAT_CHANNEL_ID = "safecity-threat-language-v1"
    private const val LISTENER_NOTIFICATION_ID = 4_601
    private const val DETECTION_NOTIFICATION_ID = 4_602
    private const val THREAT_NOTIFICATION_ID = 4_603

    private const val SAMPLE_RATE = 16_000
    // Keep foreground and background voice gating aligned at about -25 dBFS.
    private const val HELP_BACHAO_MIN_RMS = 0.055
    private const val EMERGENCY_LOUDNESS_WINDOW_MS = 1_500L
    private const val DISTRESS_RMS_THRESHOLD = 0.075
    private const val DISTRESS_ZCR_THRESHOLD = 0.045
    private const val DISTRESS_MINIMUM_CREST_FACTOR = 1.45f
    private const val DISTRESS_REQUIRED_WINDOWS = 3
    private const val THREAT_MATCH_WINDOW_MS = 20_000L
    private const val THREAT_DUPLICATE_COOLDOWN_MS = 3_000L
    private const val THREAT_AUDIO_AGREEMENT_WINDOW_MS = 6_000L
    private const val THREAT_MOTION_AGREEMENT_WINDOW_MS = 10_000L
    private const val THREAT_REQUIRED_MATCHES = 2

    private const val MOTION_ACCEL_INTERVAL_US = 20_000
    private const val MOTION_GYRO_INTERVAL_US = 25_000
    private const val MOTION_LOW_POWER_ACCEL_INTERVAL_US = 40_000
    private const val MOTION_LOW_POWER_GYRO_INTERVAL_US = 50_000
    private const val MOTION_BATCH_LATENCY_US = 250_000
    private const val MOTION_LOW_POWER_BATCH_LATENCY_US = 750_000
    private const val FREE_FALL_G_THRESHOLD = 0.45f
    private const val FALL_IMPACT_G_THRESHOLD = 2.4f
    private const val FALL_STRONG_IMPACT_THRESHOLD_G = 3.4f
    private const val FALL_NO_GYROSCOPE_IMPACT_THRESHOLD_G = 3.0f
    private const val FALL_ROTATION_DELTA_THRESHOLD_RAD = 0.52f
    private const val FALL_ROTATION_RATE_THRESHOLD_RAD_PER_SECOND = 2.6f
    private const val MIN_FALL_DURATION_MS = 60L
    private const val MAX_FALL_DURATION_MS = 1_000L
    private const val MAX_FALL_IMPACT_DELAY_MS = 1_200L
    private const val VIOLENT_MOTION_G_THRESHOLD = 2.8f
    private const val VIOLENT_JERK_THRESHOLD_G_PER_SECOND = 18f
    private const val VIOLENT_ROTATION_THRESHOLD = 4.0f
    private const val VIOLENT_MOTION_WINDOW_MS = 900L
    private const val VIOLENT_MOTION_REQUIRED_SAMPLES = 2
    private const val MINIMUM_VIOLENT_SAMPLE_SPACING_MS = 120L
    private const val MAXIMUM_GYROSCOPE_CORRELATION_DELAY_MS = 150L
    private const val MINIMUM_SENSOR_SAMPLE_SECONDS = 0.005
    private const val MAXIMUM_SENSOR_SAMPLE_GAP_SECONDS = 0.25
    private const val ENCODER_FILE = "encoder-epoch-13-avg-2-chunk-16-left-64.int8.onnx"
    private const val DECODER_FILE = "decoder-epoch-13-avg-2-chunk-16-left-64.onnx"
    private const val JOINER_FILE = "joiner-epoch-13-avg-2-chunk-16-left-64.int8.onnx"
    private const val TOKENS_FILE = "tokens.txt"
    private const val KEYWORDS_FILE = "keywords.txt"

    private const val SOS_COUNTDOWN_MS = 10_000L
    private const val DETECTION_AUTO_REARM_MS = 120_000L
    private const val INITIALIZATION_RETRY_MIN_MS = 30_000L
    private const val INITIALIZATION_RETRY_MAX_MS = 15 * 60_000L

    private val THREAT_KEYWORDS = setOf(
      "THREAT_DONT_SHOUT",
      "THREAT_GIVE_PHONE",
      "THREAT_SHUT_UP",
      "THREAT_DONT_MOVE",
      "THREAT_KILL_YOU",
      "THREAT_CHILLAO_MAT",
      "THREAT_PHONE_DE_DO",
      "THREAT_CHUP_RAHO",
      "THREAT_MAAR_DUNGA",
      "THREAT_CHITKAR_KORO_NA",
      "THREAT_PHONE_DAO",
      "THREAT_CHUP_KORO",
      "THREAT_MERE_FELBO",
    )
    private val LOUDNESS_GATED_KEYWORDS = setOf("HELP", "BACHAO")

    private val startCallbacks = CopyOnWriteArrayList<(Result<Unit>) -> Unit>()
    @Volatile private var instance: SafeCityVoiceTriggerService? = null
    @Volatile internal var isActivelyListening = false
      private set
    @Volatile internal var isDetectionPending = false
      private set
    @Volatile internal var isMotionMonitoring = false
      private set

    fun start(
      context: Context,
      modelDirectoryUri: String,
      listenNow: Boolean,
      callback: (Result<Unit>) -> Unit,
    ) {
      startCallbacks.add(callback)
      val intent = Intent(context, SafeCityVoiceTriggerService::class.java).apply {
        action = ACTION_START
        putExtra(EXTRA_MODEL_DIRECTORY, modelDirectoryUri)
        putExtra(EXTRA_LISTEN_NOW, listenNow)
      }
      try {
        ContextCompat.startForegroundService(context, intent)
      } catch (error: Throwable) {
        startCallbacks.remove(callback)
        callback(Result.failure(error))
      }
    }

    fun stop(context: Context) {
      val running = instance
      if (running != null) {
        context.startService(
          Intent(context, SafeCityVoiceTriggerService::class.java).apply {
            action = ACTION_STOP
          },
        )
      } else {
        val state = readPersistentState(context)
        preferences(context).edit()
          .putBoolean(PREF_CONFIGURED, true)
          .putBoolean(PREF_ENABLED, false)
          .putBoolean(PREF_PROTECTION_ENABLED, state.protectionEnabled)
          .putString(PREF_MODEL_DIRECTORY, state.modelDirectoryUri)
          .putBoolean(PREF_VOICE_RESUME_REQUIRED, false)
          .apply()
      }
    }

    fun startProtection(context: Context) {
      val intent = Intent(context, SafeCityVoiceTriggerService::class.java).apply {
        action = ACTION_START_PROTECTION
      }
      ContextCompat.startForegroundService(context, intent)
    }

    fun stopProtection(context: Context) {
      val running = instance
      if (running != null) {
        context.startService(
          Intent(context, SafeCityVoiceTriggerService::class.java).apply {
            action = ACTION_STOP_PROTECTION
          },
        )
      } else {
        preferences(context).edit()
          .putBoolean(PREF_PROTECTION_ENABLED, false)
          .apply()
      }
    }

    fun setProtectionActive(context: Context, active: Boolean) {
      val state = readPersistentState(context)
      if (!state.protectionEnabled) return
      val intent = Intent(context, SafeCityVoiceTriggerService::class.java).apply {
        action = ACTION_SET_PROTECTION_ACTIVE
        putExtra(EXTRA_PROTECTION_ACTIVE, active)
      }
      if (instance == null) {
        if (active) {
          ContextCompat.startForegroundService(
            context,
            Intent(context, SafeCityVoiceTriggerService::class.java).apply {
              action = ACTION_RESTORE
            },
          )
        }
      } else {
        context.startService(intent)
      }
    }

    fun setListening(context: Context, listenNow: Boolean) {
      val persistentState = readPersistentState(context)
      if (!persistentState.enabled && !persistentState.protectionEnabled) return
      val intent = Intent(context, SafeCityVoiceTriggerService::class.java).apply {
        action = ACTION_SET_LISTENING
        putExtra(EXTRA_LISTEN_NOW, listenNow)
      }
      if (instance == null) {
        if (listenNow) {
          val state = readPersistentState(context)
          if (state.enabled) {
            val directory = state.modelDirectoryUri ?: return
            ContextCompat.startForegroundService(
              context,
              Intent(context, SafeCityVoiceTriggerService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_MODEL_DIRECTORY, directory)
                putExtra(EXTRA_LISTEN_NOW, true)
              },
            )
          } else if (state.protectionEnabled) {
            ContextCompat.startForegroundService(
              context,
              Intent(context, SafeCityVoiceTriggerService::class.java).apply {
                action = ACTION_RESTORE
              },
            )
          }
        }
      } else {
        context.startService(intent)
      }
    }

    fun rearm(context: Context) {
      val state = readPersistentState(context)
      if (!state.enabled && !state.protectionEnabled) return
      if (instance == null) {
        ContextCompat.startForegroundService(
          context,
          Intent(context, SafeCityVoiceTriggerService::class.java).apply {
            action = ACTION_RESTORE
          },
        )
      } else {
        context.startService(
          Intent(context, SafeCityVoiceTriggerService::class.java).apply {
            action = ACTION_REARM
          },
        )
      }
    }

    fun acknowledgeDetection(context: Context) {
      val running = instance
      if (running == null) {
        preferences(context).edit()
          .remove(PREF_PENDING_DETECTION_SOURCE)
          .remove(PREF_PENDING_DETECTION_LABEL)
          .remove(PREF_PENDING_DETECTION_STARTED_AT)
          .apply()
        isDetectionPending = false
        return
      }
      context.startService(
        Intent(context, SafeCityVoiceTriggerService::class.java).apply {
          action = ACTION_ACKNOWLEDGE_DETECTION
        },
      )
    }

    fun readPersistentState(context: Context): PersistentState {
      val prefs = preferences(context)
      return PersistentState(
        configured = prefs.getBoolean(PREF_CONFIGURED, false),
        enabled = prefs.getBoolean(PREF_ENABLED, false),
        protectionEnabled = prefs.getBoolean(PREF_PROTECTION_ENABLED, false),
        modelDirectoryUri = prefs.getString(PREF_MODEL_DIRECTORY, null),
        voiceResumeRequired = prefs.getBoolean(PREF_VOICE_RESUME_REQUIRED, false),
      )
    }

    fun readPendingDetectionState(context: Context): PendingDetectionState? {
      val prefs = preferences(context)
      val source = prefs.getString(PREF_PENDING_DETECTION_SOURCE, null)
        ?.takeIf(String::isNotBlank)
        ?: return null
      val label = prefs.getString(PREF_PENDING_DETECTION_LABEL, null)
        ?.takeIf(String::isNotBlank)
        ?: return null
      val startedAtEpochMs = prefs.getLong(PREF_PENDING_DETECTION_STARTED_AT, 0L)
      if (startedAtEpochMs <= 0L) return null
      return PendingDetectionState(source, label, startedAtEpochMs)
    }

    internal fun restoreAfterSystemRestart(context: Context) {
      val state = readPersistentState(context)
      if (!state.enabled && !state.protectionEnabled) return
      preferences(context).edit()
        .putBoolean(
          PREF_VOICE_RESUME_REQUIRED,
          state.enabled || state.protectionEnabled,
        )
        .apply()
      if (state.protectionEnabled) {
        try {
          ContextCompat.startForegroundService(
            context,
            Intent(context, SafeCityVoiceTriggerService::class.java).apply {
              action = ACTION_RESTORE_MOTION_ONLY
            },
          )
        } catch (_: Throwable) {
          postVoiceResumeNotification(context, state)
        }
      } else {
        postVoiceResumeNotification(context, state)
      }
    }

    private fun postVoiceResumeNotification(context: Context, state: PersistentState) {
      if (!state.enabled && !state.protectionEnabled) return
      val manager = context.getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(
        NotificationChannel(
          LISTENER_CHANNEL_ID,
          "Persistent safety monitoring",
          NotificationManager.IMPORTANCE_LOW,
        ).apply {
          description = "Visible while SafeCity monitors emergency words, motion and falls."
          setSound(null, null)
        },
      )
      val launchIntent = context.packageManager
        .getLaunchIntentForPackage(context.packageName)
        ?.apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        ?: return
      val pendingIntent = PendingIntent.getActivity(
        context,
        7104,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      manager.notify(
        LISTENER_NOTIFICATION_ID,
        NotificationCompat.Builder(context, LISTENER_CHANNEL_ID)
          .setSmallIcon(context.applicationInfo.icon)
          .setContentTitle("Resume SafeCity audio protection")
          .setContentText(
            if (state.enabled) {
              "Android restarted. Tap once to resume distress and emergency-word listening."
            } else {
              "Android restarted. Tap once to resume distress-sound monitoring."
            },
          )
          .setCategory(NotificationCompat.CATEGORY_STATUS)
          .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
          .setContentIntent(pendingIntent)
          .setAutoCancel(true)
          .build(),
      )
    }

    private fun preferences(context: Context) =
      context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    private fun completeStartCallbacks(result: Result<Unit>) {
      val callbacks = startCallbacks.toList()
      startCallbacks.clear()
      callbacks.forEach { callback ->
        try {
          callback(result)
        } catch (_: Throwable) {
        }
      }
    }
  }
}
