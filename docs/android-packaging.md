# Lotto IQ Android packaging

**Developer:** Lum Tech Solutions

The current Lotto IQ product is a TanStack Start web application deployed as a Cloudflare Worker. This phase adds an installable PWA shell, which is the lowest-risk mobile distribution layer because it preserves the current web authentication, Supabase data access, and responsive UI.

A native Android package is **not yet generated or signed**. The current build environment has Java 21 but no verified Android SDK, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `adb`, or Gradle installation. Therefore this repository must not claim that an APK/AAB or Google Play submission is ready.

## Verified packaging path

1. Deploy the web application over HTTPS.
2. Verify the PWA manifest, icons, service worker, authentication, and account routes on the deployed domain.
3. Install Android Studio and the Android SDK on the release machine.
4. Choose and register the final Android application ID, for example `za.co.lumtechsolutions.lottoiqai`, after confirming it is available for the business.
5. Add a Capacitor or Trusted Web Activity wrapper only after the deployed HTTPS origin is final.
6. Configure the release signing key and keep it outside Git.
7. Test sign-in, deep links, back navigation, PWA cache behavior, external links, notification consent, and account deletion behavior on physical Android devices.
8. Generate a signed AAB, complete Play Console privacy/data-safety declarations, add the privacy-policy URL, and run internal testing before production release.

## Current boundary

The PWA files are part of this phase. Android native packaging remains a separate release step because the required SDK and signing credentials are not present in this environment. No APK, AAB, Play Store listing, or Android push provider should be described as existing until those steps are verified.
