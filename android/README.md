# DECK Android app (sideload APK)

A small WebView shell around [www.planyourdeck.com](https://www.planyourdeck.com).
The signed APK is published at **`/downloads/deck.apk`** so anyone can
install DECK from the website without the Play Store.

| | |
|---|---|
| Application id | `com.planyourdeck.app` |
| Version | `1.0.0` (versionCode `1`) |
| Min / target SDK | 24 / 34 |
| Signing key | `android/keystore/deck-release.p12` |

This is a **sideload** key. Replace it before shipping to Google Play,
or existing installs will not accept an update signed with a different key.

## Rebuild

Needs JDK 17+ and the Android SDK (`platforms;android-34`, `build-tools;34.0.0`).

```bash
cd android
echo "sdk.dir=$ANDROID_HOME" > local.properties
gradle assembleRelease     # or ./gradlew if you generate a wrapper
```

The release APK lands at `app/build/outputs/apk/release/app-release.apk`.
Copy it to `client/public/downloads/deck.apk` so the Next.js app can serve it
at `https://www.planyourdeck.com/downloads/deck.apk`.

A sample GitHub Actions workflow lives in `gha-build-android-apk.yml` — copy it
to `.github/workflows/` on a branch that allows workflow files if you want CI
to produce the APK automatically.

## Install (on a phone)

1. Download `DECK.apk` from https://www.planyourdeck.com/download
2. Allow install from this source if Android asks
3. Open the file — DECK appears on the home screen
