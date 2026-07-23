# Bundled YAMNet model

- Artifact: `yamnet.tflite`
- Publisher: Google / TensorFlow Hub
- Official source: <https://tfhub.dev/google/lite-model/yamnet/classification/tflite/1>
- Upstream project: <https://github.com/tensorflow/models/tree/master/research/audioset/yamnet>
- SHA-256: `10c95ea3eb9a7bb4cb8bddf6feb023250381008177ac162ce169694d05c317de`
- Input: float32 waveform, shape `[15600]`, mono 16 kHz
- Output: float32 AudioSet scores, shape `[1, 521]`
- Upstream licence: Apache License 2.0; preserve upstream notices and review model/dataset terms before distribution.

SafeCity uses only a small reviewed subset of output classes for distress and media-suppression evidence. YAMNet is a broad environmental-sound classifier; it is not calibrated as an emergency probability and must be validated on representative, consented device recordings before any production accuracy claim.

The optional Help / Bachao detector is documented separately in [`voice-trigger/README.md`](voice-trigger/README.md). It uses the Apache-licensed Sherpa-ONNX `zh-en-3M` keyword model and is not part of YAMNet inference.
