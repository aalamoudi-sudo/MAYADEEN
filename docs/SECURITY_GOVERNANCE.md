# Phase 6: Security, Governance, and Permissions

## الهدف

تحويل KAG Command Center من نموذج تشغيل إلى منصة قابلة للاستخدام الحقيقي عبر:

- صلاحيات واضحة.
- حوكمة تعديل واعتماد.
- سياسات وصول للبيانات.
- Audit Log إلزامي.
- فصل القراءة عن التعديل عن الاعتماد.

## المبادئ الأمنية

- لا توجد كلمة مرور داخل الواجهة.
- لا يوجد API secret داخل JavaScript.
- كل مستخدم له دور واضح.
- كل تعديل حساس يكتب في Audit Log.
- لا يمكن تعديل baseline إلا بصلاحية PMO أو Project Manager.
- لا يمكن اعتماد قرار أو تغيير من نفس الشخص الذي أنشأه إلا إذا كان لديه صلاحية خاصة.
- المورد الخارجي يرى نطاقه فقط.

## الأدوار

### Executive

يرى:

- Dashboard.
- Executive report.
- Risks summary.
- Decisions summary.

لا يعدل:

- Tasks.
- Daily updates.
- Risks.
- Approvals.

### Project Director

يرى كل شيء.

يستطيع:

- اعتماد Change Requests.
- اعتماد قرارات عالية الأثر.
- رؤية Audit Log.
- تصعيد العناصر.

### Project Manager

يستطيع:

- تعديل المهام.
- إدارة المخاطر.
- إدارة القرارات.
- إدارة الاعتمادات.
- رؤية Audit Log.
- تحديث حالة التعافي.

### PMO

يستطيع:

- استيراد WBS.
- ضبط جودة البيانات.
- تعديل baseline وفق آلية معتمدة.
- إدارة التقارير.
- رؤية Audit Log.

### Workstream Owner

يستطيع:

- رؤية مهامه.
- تحديث مهامه.
- إنشاء عائق.
- طلب قرار.
- رفع مرفقات لمساره.

لا يستطيع:

- تعديل مهام الآخرين.
- تعديل baseline.
- اعتماد قرارات.

### Supplier

يستطيع:

- رؤية المهام أو المستندات المسندة له فقط.
- رفع تحديث أو مرفق.

لا يستطيع:

- رؤية كامل المشروع.
- رؤية تقارير تنفيذية حساسة.
- تعديل مخاطر أو قرارات إلا ضمن نطاقه.

### Viewer

قراءة فقط حسب النطاق المصرح.

## الكيانات الحساسة

- tasks
- task_updates
- risks
- decisions
- approvals
- change_requests
- documents
- audit_logs
- dashboard_snapshots

## قواعد الحوكمة

### تعديل المهمة

يسمح به لـ:

- Project Manager.
- PMO.
- Workstream Owner إذا كان مالك المهمة.

### تحديث يومي

يسمح به لـ:

- مالك المهمة.
- Project Manager.
- PMO.

### اعتماد

يسمح به لـ:

- Project Director.
- Project Manager.
- approver المحدد.

### رؤية Audit Log

يسمح بها لـ:

- Project Director.
- Project Manager.
- PMO.

### تعديل baseline

يسمح به فقط لـ:

- PMO.
- Project Manager.

ويجب أن يرتبط بـ Change Request أو سبب مكتوب.

## نموذج Audit Log

كل عملية مهمة يجب أن تسجل:

- actor.
- entity type.
- entity id.
- action.
- before state.
- after state.
- reason.
- timestamp.
- IP address لاحقاً.

## الحد الأدنى للإنتاج

قبل استخدام النظام مع بيانات حقيقية:

1. تفعيل Supabase Auth.
2. تفعيل RLS على كل الجداول.
3. منع anonymous access.
4. تعريف profiles لكل مستخدم.
5. اختبار صلاحيات كل دور.
6. تفعيل Audit Log.
7. تدوير أي روابط Apps Script قديمة.
8. استخدام مستودع GitHub خاص إذا البيانات حساسة.

## مخرجات Phase 6

- `SECURITY_GOVERNANCE.md`
- `RBAC_MATRIX.md`
- `database/phase6_security_governance.sql`
- `SECURITY_READINESS_CHECKLIST.md`
- `PHASE6_SUMMARY.md`

