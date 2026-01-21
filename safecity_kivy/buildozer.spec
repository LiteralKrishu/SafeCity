[app]

# (str) Title of your application
title = SafeCity

# (str) Package name
package.name = safecity

# (str) Package domain (needed for android/ios packaging)
package.domain = org.safecity

# (str) Source code where the main.py live
source.dir = .

# (str) Source code filename (let's use that one)
source.include_exts = py,png,jpg,kv,atlas,tflite

# (list) Application requirements
# Comma separated e.g. requirements = sqlite3,kivy
requirements = python3,kivy,plyer,opencv,numpy,android,jnius

# (str) Custom source folders for requirements
# Sets custom source for any requirements with recipes
# requirements.source.kivy = ../../kivy

# (list) Garden requirements
#garden_requirements =

# (str) Presplash of the application
#presplash.filename = %(source.dir)s/data/presplash.png

# (str) Icon of the application
#icon.filename = %(source.dir)s/data/icon.png

# (str) Supported orientation (one of landscape, sensorLandscape, portrait or all)
orientation = portrait

# (list) List of service to declare
# services = NAME:ENTRYPOINT_TO_PY,NAME2:ENTRYPOINT2_TO_PY
# android.services = audio_service:service/main.py

# (bool) Indicate if the application should be fullscreen or not
fullscreen = 0

# (string) Presplash background color (for new android toolchain)
android.presplash_color = #1a2133

# (list) Permissions
android.permissions = INTERNET,CAMERA,RECORD_AUDIO,ACCESS_FINE_LOCATION,ACCESS_COARSE_LOCATION,WRITE_EXTERNAL_STORAGE,FOREGROUND_SERVICE

# (int) Target Android API, should be as high as possible.
android.api = 33

# (int) Minimum API your APK will support.
android.minapi = 21

[buildozer]

# (int) Log level (0 = error only, 1 = info, 2 = debug (with command output))
log_level = 2

# (int) Display warning if buildozer is run as root (0 = False, 1 = True)
warn_on_root = 1
