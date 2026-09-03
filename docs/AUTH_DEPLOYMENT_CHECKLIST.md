# Auth and permissions deployment checklist

The dashboard and Apps Script are deployed independently. Use this order to
avoid a frontend/backend version gap:

1. Publish `apps-script/Code.gs` as a **new version** of the existing Apps Script
   web app (`Execute as: Me`; access must remain the same as the current deployment).
2. Send an authenticated `auth_session` request and verify an `ok: true` response
   with `api_version: 2026-07-auth-session-v1` and a `user` object.
3. Deploy the repository root to Render. The publish directory must contain both
   `index.html` and `auth-state.js`; no build step is required.
4. Verify `GET /auth-state.js` returns JavaScript with HTTP 200 rather than the
   HTML fallback page.
5. Verify anonymous, login, refresh, revoked/expired session, and permission-error
   flows in the deployed origin.

## Production compatibility

- Authentication uses a signed bearer token in JSON, not cookies. Cookie domain,
  `SameSite`, and Render proxy cookie settings do not affect this flow.
- The token is kept in per-tab `sessionStorage`; it survives refresh, but not tab
  closure. If browser policy blocks storage, login still works for the current
  page and does not fail solely because persistence is unavailable.
- Requests use `Content-Type: text/plain;charset=utf-8`, which is a CORS-safelisted
  request shape used by the existing Apps Script integration. The CSP explicitly
  permits `script.google.com` and `script.googleusercontent.com` connections.
- During a rolling deployment, if the published Apps Script still returns
  `Unsupported action` for `auth_session`, the client validates through the
  existing authenticated `data_sync` action. It still requires a returned `user`
  and never reveals the dashboard before validation succeeds.

Do not remove the compatibility path until production confirms the versioned
`auth_session` endpoint is deployed.

## صلاحية دليل الإنجاز

- شغّل `installKagTriggers` مرة واحدة بعد نشر هذا الإصدار لإضافة عمود `can_view_completion_evidence` إلى `User Access Matrix` ومزامنة قيمته للحسابات الموثقة فقط.
- أنشئ إصدارًا جديدًا من Web App في Apps Script؛ تعديل الملف دون تحديث الـ deployment لا يحدّث نقطة API المنشورة.
- هذا التقييد يمنع إرسال دليل إنجاز المهمة وعرضه داخل المنصة، ولا يحذف بيانات Google Sheets ولا يغيّر مشاركة Google Drive. إذا كان ملف Drive عامًا، فمن يعرف رابطه يستطيع فتحه خارج المنصة؛ يجب معالجة ذلك بسياسة مشاركة Drive منفصلة عند الحاجة.
