# CrickX Mobile APK

CrickX Mobile is a native Expo/React Native Android and iOS client that uses the same production API as the CrickX website.

## Shared live system

- Web: https://crickx-3d806.web.app
- API: https://crickx-api.onrender.com/api/v1
- Mobile: this Expo app
- Contest and wallet data stay in the same backend, so web and APK can be used at the same time without creating separate contest pools.

## Android APK

From `apps/mobile`:

```bash
npm install
npx expo start
```

For an installable APK, use Expo EAS Build:

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

The `preview` profile is configured to produce an APK for direct Android installation.

For a production APK:

```bash
eas build --platform android --profile production-apk
```

For Google Play distribution, use an Android App Bundle with the `production` profile.

## Mobile flow

Matches -> open a match -> Contest / Leaderboard / My Team.

Fantasy -> saved teams and the existing CrickX team builder.

Wallet -> CRX wallet and weekly subscription pages.

Profile -> account, subscription and sign out.

The mobile app intentionally reuses the existing CrickX backend and website URLs for advanced flows such as MetaMask wallet confirmation and the full team builder, while the primary navigation and match/contest/leaderboard experience are native.
