/**
 * Google refuses to sign people in inside the browsers built into chat and social apps (WhatsApp, Instagram,
 * Facebook, Messenger, Snapchat, Line, WeChat...). Opening an invite link from one of them leads to a sign-in that
 * silently goes nowhere. The fix is to open the same link in Chrome or Safari.
 */
export function inAppBrowser(): string | null {
  const ua = navigator.userAgent
  const m = /(FBAN|FBAV|FB_IAB|Instagram|Messenger|Snapchat|Line\/|MicroMessenger|WhatsApp|Twitter|LinkedInApp|Pinterest|TikTok|musical_ly)/i.exec(ua)
  if (m) return m[1]
  // Android WebView (an app showing a web page inside itself)
  if (/; wv\)/.test(ua) && /Android/.test(ua)) return 'webview'
  return null
}
