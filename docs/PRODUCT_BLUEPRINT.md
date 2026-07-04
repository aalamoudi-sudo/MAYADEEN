# KAG Command Center Product Blueprint

## الرؤية

منصة KAG Command Center يجب أن تتحول من لوحة مؤشرات إلى نظام تحكم تشغيلي لإدارة مشروع فعلي: يلتقط التحديثات اليومية، يدير الاعتمادات والقرارات، يراقب المخاطر، يثبت سجل التغييرات، ويقدم للإدارة صورة تنفيذية موثوقة في أي لحظة.

## مبادئ التصميم

- كل رقم تنفيذي يجب أن يكون قابلاً للتتبع إلى سجل بيانات واضح.
- لا توجد مهمة مكتملة بدون تحديث فعلي أو اعتماد.
- لا توجد صلاحيات تعديل عامة؛ كل مستخدم يرى ويعدل ما يخص دوره.
- كل تغيير مهم يجب أن يترك أثراً في Audit Log.
- الواجهة التنفيذية يجب أن تكون مختصرة، أما التفاصيل التشغيلية فتكون في تبويبات متخصصة.
- Google Sheet يصلح كبداية أو مصدر استيراد، لا كمحرك دائم لمنصة تشغيلية كبيرة.

## التبويبات النهائية المقترحة

### 1. القيادة التنفيذية

الهدف: شاشة افتتاحية للإدارة العليا.

المحتوى:
- نسبة الإنجاز الفعلية.
- الانحراف عن الخطة.
- مؤشر المخاطر.
- القرارات المطلوبة من الإدارة.
- جاهزية الافتتاح.
- آخر تحديث بيانات.
- أهم 5 عناصر تحتاج تدخل.

الأزرار المهمة:
- تصدير تقرير PDF.
- فتح مركز القرارات.
- فتح المهام الحرجة.
- فتح تقرير الجاهزية.

### 2. مركز التحديث اليومي

الهدف: جعل المنصة نظاماً حياً، لا مجرد قراءة بيانات.

المحتوى:
- مهامي اليوم.
- مهام متأخرة.
- مهام تبدأ قريباً.
- نموذج تحديث سريع لكل مهمة:
  - الحالة.
  - نسبة الإنجاز.
  - ما تم إنجازه.
  - العائق.
  - الإجراء القادم.
  - تاريخ التحديث القادم.
- تنبيه للمهام التي لم تحدث خلال 3 أيام.

المستخدم الأساسي:
- Workstream Owner.
- Project Manager.

### 3. المهام والـ WBS

الهدف: إدارة هيكل العمل الكامل.

المحتوى:
- قائمة المهام.
- فلاتر حسب المرحلة، المسؤول، الحالة، المسار، التاريخ.
- تفاصيل المهمة.
- الاعتماديات.
- baseline مقابل actual.
- سجل تحديثات المهمة.
- الملفات المرتبطة.
- المخاطر والقرارات المرتبطة.

إضافات مهمة:
- bulk import من Excel/Google Sheet.
- task IDs ثابتة لا تعتمد على الاسم.

### 4. الجدول الزمني والمسار الحرج

الهدف: مراقبة الزمن لا كتواريخ فقط، بل كأثر على الافتتاح.

المحتوى:
- Gantt chart.
- Critical path.
- Baseline vs current plan.
- المهام التي تؤثر على تاريخ الافتتاح.
- الانحراف بالأيام لكل مرحلة.
- الاعتماديات المكسورة.

التقنية المقترحة:
- DHTMLX Gantt أو Bryntum أو vis-timeline كبداية.

### 5. مركز الاعتمادات

الهدف: إدارة كل ما يحتاج موافقة.

المحتوى:
- طلبات اعتماد جديدة.
- بانتظار المالك.
- معتمد.
- مرفوض.
- يحتاج تعديل.
- تاريخ الإرسال.
- تاريخ الاستحقاق.
- المرفقات.
- التعليقات.

أنواع الاعتماد:
- تصميم.
- خطة تشغيل.
- مورد.
- ميزانية.
- تغيير نطاق.
- قرار تنفيذي.

### 6. القرارات والتصعيد

الهدف: منع توقف المشروع بسبب قرارات معلقة.

المحتوى:
- قرارات عاجلة.
- جهة القرار.
- تاريخ الطلب.
- تاريخ الاستحقاق.
- أثر التأخير.
- الارتباط بالمخاطر أو المهام.
- مستوى التصعيد.

Workflow:
- Draft.
- Submitted.
- Under Review.
- Approved.
- Rejected.
- Escalated.

### 7. المخاطر

الهدف: سجل مخاطر حقيقي منفصل عن المهام.

المحتوى:
- Risk register.
- Risk matrix.
- probability / impact.
- owner.
- treatment plan.
- due date.
- residual risk.
- linked task.
- linked decision.
- status.

أنواع المخاطر:
- زمني.
- مالي.
- تشغيلي.
- تقني.
- سلامة.
- موردون.
- أصحاب مصلحة.

### 8. طلبات التغيير

الهدف: ضبط تغييرات النطاق والزمن والميزانية.

المحتوى:
- طلب تغيير جديد.
- سبب التغيير.
- الأثر على الوقت.
- الأثر على التكلفة.
- الأثر على الجودة.
- المسارات المتأثرة.
- حالة الاعتماد.

قاعدة مهمة:
- لا يعدل baseline إلا عبر Change Request معتمد.

### 9. الموارد والفرق

الهدف: فهم الحمل التشغيلي ونقاط الاختناق.

المحتوى:
- عبء العمل حسب المسؤول.
- مهام كل فريق.
- المهام المتأخرة حسب الفريق.
- فرق بلا تحديثات.
- الفرق ذات المخاطر العالية.

مؤشرات:
- workload score.
- overdue count.
- update compliance.
- risk exposure.

### 10. الموردون والعقود

الهدف: ربط التوريد والتنفيذ بالمشروع.

المحتوى:
- الموردون.
- العقود.
- تواريخ التسليم.
- الحالة.
- الدفعات.
- الاعتمادات.
- المخاطر المرتبطة بالمورد.

تكاملات محتملة:
- ERP لاحقاً.
- Google Drive/SharePoint للعقود.

### 11. الميزانية والتكاليف

الهدف: مراقبة المال بجانب الزمن.

المحتوى:
- الميزانية المعتمدة.
- المصروف الفعلي.
- الالتزامات.
- المتبقي.
- الانحراف المالي.
- التكلفة حسب المسار.
- تكلفة التغييرات.

ملاحظة:
- يمكن تأجيل هذه المرحلة إذا لم تكن بيانات الميزانية جاهزة.

### 12. المستندات والمخرجات

الهدف: مصدر واحد للنسخ المعتمدة.

المحتوى:
- ملفات حسب المسار.
- حالة الاعتماد.
- رقم النسخة.
- تاريخ الرفع.
- المالك.
- روابط Drive/SharePoint.

قواعد:
- لا تعرض روابط خاصة في GitHub.
- تخزين الملفات يكون خارج المستودع.

### 13. الجودة والجاهزية

الهدف: قياس الاستعداد للحدث أو الافتتاح.

المحتوى:
- Checklists.
- readiness score.
- نتائج الاختبارات.
- البروفات.
- Go/No-Go.
- عناصر غير جاهزة.
- مسؤول الإغلاق.

مؤشرات:
- operational readiness.
- technical readiness.
- safety readiness.
- protocol readiness.
- visitor experience readiness.

### 14. غرفة العمليات

الهدف: وضع يوم الحدث.

المحتوى:
- الحوادث والبلاغات.
- قرارات لحظية.
- حالة الفرق.
- نقاط الدخول.
- السلامة.
- الضيافة.
- كبار الشخصيات.
- سجل زمني مباشر.

يستخدم في:
- يوم التشغيل.
- البروفات.
- الأيام الحرجة قبل الافتتاح.

### 15. التقارير

الهدف: إخراج تقارير قابلة للإرسال.

المحتوى:
- تقرير يومي.
- تقرير أسبوعي.
- تقرير تنفيذي.
- تقرير مخاطر.
- تقرير قرارات معلقة.
- تقرير جاهزية.

الصيغ:
- PDF.
- Excel.
- رابط قراءة فقط.

### 16. الإعدادات والصلاحيات

الهدف: التحكم في النظام.

المحتوى:
- المستخدمون.
- الأدوار.
- المسارات.
- صلاحيات القراءة والتعديل.
- مصادر البيانات.
- قوالب التقارير.
- إعدادات التنبيهات.

## الأدوار والصلاحيات

### Executive

- قراءة القيادة التنفيذية.
- قراءة التقارير.
- قراءة القرارات والمخاطر.
- لا يعدل المهام.

### Project Director

- كل صلاحيات القراءة.
- اعتماد قرارات كبرى.
- اعتماد Change Requests.
- رؤية Audit Log.

### Project Manager

- إدارة المهام.
- إدارة المخاطر.
- إدارة القرارات.
- إنشاء طلبات اعتماد.
- تصعيد العناصر.

### PMO

- ضبط WBS.
- مراجعة جودة البيانات.
- إعداد التقارير.
- إدارة baseline.
- متابعة الالتزام بالتحديث.

### Workstream Owner

- تحديث مهامه.
- رفع عوائق.
- طلب قرارات.
- إضافة مرفقات لمساره.

### Supplier / External

- تحديث نطاق محدد فقط.
- رفع مستندات.
- لا يرى كامل المشروع.

### Viewer

- قراءة فقط حسب المسار المصرح.

## نموذج البيانات المقترح

### projects

- id
- name
- owner
- start_date
- target_date
- status
- created_at

### workstreams

- id
- project_id
- name
- owner_id
- color
- status

### tasks

- id
- project_id
- workstream_id
- wbs_code
- title
- description
- phase
- owner_id
- baseline_start
- baseline_finish
- planned_start
- planned_finish
- actual_start
- actual_finish
- percent_complete
- progress_status
- schedule_status
- priority
- last_update_at
- created_at

### task_dependencies

- id
- predecessor_task_id
- successor_task_id
- dependency_type

### task_updates

- id
- task_id
- user_id
- percent_complete
- status
- update_summary
- blocker
- next_action
- next_update_due
- created_at

### approvals

- id
- project_id
- type
- title
- description
- requester_id
- approver_id
- status
- due_date
- approved_at
- linked_task_id
- linked_document_id

### decisions

- id
- project_id
- title
- description
- requester_id
- decision_owner_id
- priority
- status
- due_date
- impact_if_delayed
- linked_task_id
- linked_risk_id

### risks

- id
- project_id
- title
- description
- category
- probability
- impact
- severity
- owner_id
- treatment_plan
- treatment_status
- due_date
- residual_probability
- residual_impact
- linked_task_id
- linked_decision_id

### change_requests

- id
- project_id
- title
- reason
- scope_impact
- schedule_impact_days
- cost_impact
- quality_impact
- requester_id
- approver_id
- status
- created_at
- approved_at

### documents

- id
- project_id
- title
- type
- version
- status
- owner_id
- storage_url
- linked_task_id
- created_at

### audit_logs

- id
- actor_id
- entity_type
- entity_id
- action
- before_json
- after_json
- reason
- ip_address
- created_at

### notifications

- id
- user_id
- type
- title
- body
- channel
- status
- created_at

## التقنيات المقترحة

### الخيار السريع والمنظم

- Frontend: Next.js أو React.
- Backend: Supabase.
- Database: PostgreSQL.
- Auth: Supabase Auth مع Google Workspace.
- Storage: Supabase Storage أو Google Drive.
- Hosting: Vercel.
- Charts: ECharts.
- Gantt: DHTMLX Gantt أو vis-timeline.
- Automation: n8n.

مناسب إذا نريد سرعة في البناء مع قاعدة بيانات وصلاحيات جيدة.

### الخيار المؤسسي

- Frontend: Next.js.
- Backend: NestJS أو FastAPI.
- Database: PostgreSQL.
- Auth: Microsoft Entra ID أو Google Workspace SSO.
- Storage: SharePoint أو Google Drive.
- Hosting: Azure / AWS / GCP.
- Observability: Sentry + audit logs.

مناسب إذا المنصة ستكبر وتخدم أكثر من مشروع وجهات متعددة.

## التكاملات المطلوبة

### Google Sheets

الاستخدام:
- استيراد WBS أولي.
- مزامنة مؤقتة في مرحلة الانتقال.

لا يستخدم كقاعدة بيانات نهائية.

### Google Drive / SharePoint

الاستخدام:
- حفظ المستندات.
- النسخ المعتمدة.
- المرفقات.

### Email

الاستخدام:
- تنبيهات الاعتمادات.
- ملخص أسبوعي.
- تنبيهات المهام المتأخرة.

### Microsoft Teams / Slack

الاستخدام:
- تنبيهات مباشرة.
- تصعيد القرارات.
- إشعارات التحديث اليومي.

### WhatsApp Business

الاستخدام:
- تنبيهات عالية الأهمية فقط.
- لا يستخدم للتفاصيل الحساسة.

### Calendar

الاستخدام:
- مواعيد الاعتمادات.
- اجتماعات أسبوعية.
- تواريخ تحديث إلزامية.

## رحلة العمل اليومية

1. يدخل المسؤول إلى مركز التحديث اليومي.
2. يرى المهام المطلوبة منه.
3. يحدث النسبة والحالة والعائق.
4. إذا يوجد عائق، ينشئ تصعيد أو قرار.
5. PMO يراجع جودة التحديثات.
6. Project Manager يرى العناصر الحرجة.
7. Executive يرى ملخصاً بدون تفاصيل مزعجة.

## مؤشرات الأداء الأساسية

- Overall Completion.
- Schedule Variance.
- Tasks Updated This Week.
- Stale Tasks.
- Overdue Tasks.
- Open Critical Risks.
- Pending Decisions.
- Pending Approvals.
- Readiness Score.
- Change Request Impact.
- Workstream Health.
- Data Quality Score.

## خطة التنفيذ المقترحة

### Sprint 0: تثبيت النموذج

- اعتماد التبويبات.
- اعتماد نموذج البيانات.
- تحديد الأدوار.
- تحديد مصدر البيانات الحالي.

النتيجة:
- وثيقة متفق عليها.
- backlog أولي.

### Sprint 1: Data Foundation

- تحويل WBS إلى schema ثابت.
- إضافة IDs.
- إضافة status وpercent_complete.
- بناء data quality checks.

النتيجة:
- بيانات قابلة للثقة.

### Sprint 2: Daily Updates

- شاشة تحديث يومي.
- task_updates.
- stale task detection.
- audit logs.

النتيجة:
- النظام يبدأ يلتقط العمل اليومي.

### Sprint 3: Decisions / Risks / Approvals

- جداول مستقلة.
- شاشات إدارة.
- روابط مع المهام.
- تنبيهات أساسية.

النتيجة:
- تحكم حقيقي في العوائق.

### Sprint 4: Executive Reporting

- تقارير PDF.
- لوحة تنفيذية مطورة.
- snapshot يومي للمؤشرات.

النتيجة:
- جاهزية للإدارة العليا.

### Sprint 5: Authentication / Permissions

- SSO.
- RBAC.
- صلاحيات حسب الدور والمسار.

النتيجة:
- منصة قابلة للاستخدام الآمن.

### Sprint 6: Operations Room

- سجل أحداث.
- بلاغات.
- جاهزية.
- Go/No-Go.

النتيجة:
- منصة تشغيل يوم الحدث.

## قرارات مطلوبة قبل بدء البناء

1. هل المنصة لمشروع واحد فقط أم عدة مشاريع؟
2. هل المستخدمون من داخل شركة واحدة أم جهات خارجية أيضاً؟
3. هل نستخدم Google Workspace أم Microsoft 365؟
4. هل الميزانية جزء من المرحلة الأولى؟
5. هل المستودع GitHub عام أم خاص؟
6. هل البيانات الحالية مسموح نشرها أم يجب فصلها تماماً؟
7. هل نبدأ بـ Supabase السريع أم backend مؤسسي مخصص؟

## توصية Codex

ابدأ بالمسار السريع:

- Next.js + Supabase + PostgreSQL + Google Workspace Auth.
- إبقاء ملف HTML الحالي كمرجع تصميمي.
- نقل أول ثلاث وحدات فقط في البداية:
  - المهام.
  - التحديث اليومي.
  - القرارات والمخاطر.

بعدها نبني التقارير والصلاحيات المتقدمة. هذا يعطي قيمة تشغيلية بسرعة دون أن نغرق في بناء ضخم قبل أن نثبت دورة العمل.

