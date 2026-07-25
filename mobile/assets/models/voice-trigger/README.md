# Bundled emergency-word and threat-phrase model

- Model: `sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20`
- Publisher: k2-fsa / sherpa-onnx
- Official source: <https://github.com/k2-fsa/sherpa-onnx/releases/tag/kws-models>
- Documentation: <https://k2-fsa.github.io/sherpa/onnx/kws/pretrained_models/index.html>
- Downloaded archive SHA-256: `68447f4fbc67e70eee3a93961f36e81e98f47aef73ce7e7ca00885c6cd3616a6`
- Runtime files: int8 encoder, fp32 decoder, int8 joiner, token table, and SafeCity keyword list
- Input: float32 waveform normalized to `[-1, 1]`, mono 16 kHz
- Upstream license: Apache License 2.0

Runtime file SHA-256 values:

- Encoder: `408bbd740838c42d5bf6d1c5b80b3c88b616c7860b92d980328b5b068c76ae48`
- Decoder: `63a22dd60f40fff082ac3e09afa507f6787da36df76ded2fbe145fa233e22c21`
- Joiner: `190d4067b4cc20b72a42a1916e69d92052000fb7051a427ebb1bc72a69207dc1`
- Tokens: `2d3f32311f9b692b964da3c90e830258d3e78e013cb0c992dbfb15cd5a1a71b0`
- SafeCity phrase definitions: `bead80597a999ed58a530d273218c3ed10d1b033d2e74f0df20282bd9777ae22`

SafeCity uses the 320 ms `chunk-16` model for the higher-accuracy mobile tradeoff. Direct emergency words use the permissive `2.0` score and `0.20` threshold because they open a cancelable countdown immediately. The threat catalog contains 13 phonetic phrases across English, transliterated Hindi and transliterated Bengali. Those definitions use phrase-specific thresholds from `0.30` to `0.40`; a match does not start SOS by itself.

Threat matches are de-duplicated for 3 seconds and remain eligible for 20 seconds. SOS requires at least two matches plus independent recent distress-audio or motion evidence. Likely media playback suppresses confirmation in the in-app fusion path. Android background monitoring uses the same repetition rule and requires a recent distress-sound candidate or abrupt-motion sample. This is open-vocabulary acoustic matching, not transcription or language understanding.

The current Hindi and Bengali paths are phonetic pilot definitions on the upstream `zh-en` acoustic model, not native-language accuracy claims. The bundled model removes any dependency on an installed operating-system language pack, but it still requires representative physical-device testing across accents, dialects, microphones, noise levels, playback audio and low-end CPUs before production accuracy or battery claims can be made.
