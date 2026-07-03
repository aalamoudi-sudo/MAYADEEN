# ربط لوحة KAG مع Slack عبر Google Apps Script

## أفضل بنية

الربط يكون:

`Dashboard` -> `Google Apps Script` -> `Google Sheet` -> `Slack`

ولا يتم وضع Slack Webhook أو Token داخل `index.html`.

## ما الذي تم تجهيزه؟

تمت إضافة ملف:

`apps-script/Code.gs`

هذا الملف يعمل كطبقة آمنة بين لوحة KAG والشيت وسلاك، ويدعم:

- قراءة بيانات Google Sheet للداشبورد.
- إرسال طلب تحديث منتصف اليوم إلى منذر، موجه إلى بندر، مع نسخة للـ PMO.
- إرسال طلب تحديث نهاية اليوم إلى منذر، موجه إلى بندر، مع نسخة للـ PMO.
- إرسال ملخص نهاية اليوم إلى عبدالعزيز مع نسخة للـ PMO.
- تسجيل أي تحديث مستقبلي في صفحة `Audit Log`.
- إنشاء شيت مستقل للاعتمادات باسم `Approvals Register`.
- إرسال إشعار Slack عند إضافة طلب اعتماد أو تحديث حالته.
- إنشاء شيت مستقل لتوزيع المهام باسم `PMO Task Distribution`.
- إرسال إيميل لصاحب المهمة عند التكليف من PMO.
- إنشاء شيتات غرفة القيادة: `Meetings Register`, `Commitments Log`, `File Control Register`.
- إنشاء شيت المستخدمين والصلاحيات باسم `User Access Matrix`.
- إرسال اختبار ربط Slack.

## بيانات المشروع المستخدمة

- قناة Slack: `#kaga-project-management`
- Channel ID: `C0BET2R762W`
- Google Sheet:
  `https://docs.google.com/spreadsheets/d/1hymTfPLDR7QX1Rq9e3I4OyZJBpmnHNp4SxEUfjXnBGU/edit`
- Dashboard:
  `https://mayadeen-x049.onrender.com`

## Script Properties المطلوبة

افتح Apps Script ثم:

`Project Settings` -> `Script properties`

أضف القيم التالية:

| Key | Value |
| --- | --- |
| `SLACK_WEBHOOK_URL` | رابط Incoming Webhook الخاص بقناة المشروع |
| `SLACK_CHANNEL_ID` | `C0BET2R762W` |
| `SESSION_SECRET` | قيمة طويلة عشوائية لتوقيع جلسات الدخول |
| `PMO_USER_ID` | `U0BE7LGEA7M` |
| `MUNTHER_USER_ID` | `U0BEBUAC3V5` |
| `BANDAR_USER_ID` | `U0BEWUMQSVA` |
| `ABDULAZIZ_USER_ID` | `U0BEPPZ88NR` |
| `PMO_EMAIL` | بريد PMO لاستلام نسخة من إيميلات التكليف |

## خطوات التركيب

1. افتح Google Sheet الخاص بالمشروع.
2. اختر `Extensions` ثم `Apps Script`.
3. الصق محتوى `apps-script/Code.gs` في ملف `Code.gs`.
4. أضف Script Properties الموضحة أعلاه.
5. من Apps Script شغل الدالة `installKagTriggers` مرة واحدة.
6. وافق على صلاحيات Google المطلوبة.
7. سيتم إنشاء شيت `Approvals Register` تلقائياً إذا لم يكن موجوداً.
8. سيتم إنشاء شيت `PMO Task Distribution` تلقائياً إذا لم يكن موجوداً.
9. سيتم إنشاء شيتات غرفة القيادة تلقائياً إذا لم تكن موجودة.
10. سيتم إنشاء شيت `User Access Matrix` تلقائياً إذا لم يكن موجوداً.
11. انسخ كلمات المرور المؤقتة من ملف `outputs/user_access_credentials_temp_20260703.csv` إلى عمود `temporary_password`.
12. شغل `doPost` اختبارياً أو أرسل طلب اختبار من Postman/Terminal إذا رغبت.

## الجدولة

السكربت يرسل فقط من الأحد إلى الخميس بتوقيت الرياض:

- 12:00 ظهرًا: طلب تحديث منتصف اليوم.
- 7:00 مساءً: طلب تحديث نهاية اليوم.
- 7:45 مساءً تقريبًا: ملخص نهاية اليوم للإدارة.

ملاحظة: Google Apps Script قد ينفذ التريغر بفارق دقائق بسيط عن الوقت المحدد.

## اختبار Slack

بعد نشر Apps Script كـ Web App، يمكن إرسال اختبار:

```bash
curl -X POST "WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{"action":"slack_test"}'
```

يجب أن تظهر رسالة اختبار في قناة المشروع.

## نشر Web App

من Apps Script:

1. اضغط `Deploy`.
2. اختر `New deployment`.
3. النوع: `Web app`.
4. Execute as: `Me`.
5. Who has access: حسب سياسة الشركة. كبداية داخلية يمكن اختيار مستخدمي المؤسسة فقط إن كان متاحاً.
6. انسخ رابط `/exec`.
7. ضعه في إعدادات الداشبورد في خانة `Google Apps Script`.

## ملاحظات أمنية

- لا تضع `SLACK_WEBHOOK_URL` داخل `index.html`.
- لا تنشر رابط Apps Script أو Webhook في GitHub عام.
- لا تقبل أي قراءة أو كتابة من Apps Script بدون `session_token`.
- بعد مشاركة بيانات دخول الداشبورد في المحادثة، يفضل تغيير كلمة المرور.
- إذا تم نشر المشروع علناً، انقل تسجيل الدخول إلى Google Workspace أو نظام Auth حقيقي.
