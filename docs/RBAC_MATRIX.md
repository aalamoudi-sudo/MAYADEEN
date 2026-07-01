# RBAC Matrix

## الأدوار

- `executive`
- `project_director`
- `project_manager`
- `pmo`
- `workstream_owner`
- `supplier`
- `viewer`

## مصفوفة الصلاحيات

| Module | Executive | Project Director | Project Manager | PMO | Workstream Owner | Supplier | Viewer |
|---|---|---|---|---|---|---|---|
| Executive Dashboard | Read | Read | Read | Read | Limited | No | Limited |
| Tasks | Read | Read | CRUD | CRUD | Read/Update Own | Read/Update Assigned | Read |
| Daily Updates | No | Read | CRUD | CRUD | Create Own | Create Assigned | No |
| Risks | Read Summary | CRUD/Approve | CRUD | CRUD | Create Linked | Create Linked | Read Summary |
| Decisions | Read Summary | CRUD/Approve | CRUD | CRUD | Create Request | Create Request | Read Summary |
| Approvals | Read Summary | Approve | CRUD/Approve | CRUD | Create Request | Create Request | Read Summary |
| Change Requests | Read | Approve | Create/Update | Create/Update | Create Request | No | Read |
| Documents | Read | CRUD | CRUD | CRUD | Upload Linked | Upload Assigned | Read |
| Audit Log | No | Read | Read | Read | No | No | No |
| Settings | No | Limited | Limited | CRUD | No | No | No |
| Imports | No | Read | Execute | Execute | No | No | No |
| Reports | Read | Export | Export | Export | Limited | No | Read |

## قواعد تفصيلية

### Tasks

Project Manager وPMO:

- يقرؤون ويعدلون كل المهام في المشروع.

Workstream Owner:

- يقرأ كل مهام مساره.
- يعدل المهام المسندة إليه فقط.

Supplier:

- يرى المهام المسندة إليه أو المرتبطة بعقده فقط.

### Daily Updates

Workstream Owner:

- ينشئ تحديثاً لمهامه فقط.

PMO وProject Manager:

- ينشئون أو يعدلون تحديثات لأغراض التصحيح والمتابعة.

### Risks

Workstream Owner:

- ينشئ خطر مرتبط بمهمة يملكها.

Project Manager وPMO:

- يديرون كل المخاطر.

Project Director:

- يعتمد أو يغلق المخاطر عالية الأثر.

### Decisions

Workstream Owner:

- يطلب قراراً.

Project Manager:

- يدير القرار ويصعده.

Project Director:

- يعتمد القرارات عالية الأثر.

### Approvals

أي مستخدم تشغيلي يمكنه إنشاء طلب اعتماد ضمن نطاقه.

الاعتماد النهائي:

- Project Director.
- Project Manager.
- approver المحدد.

### Audit Log

قراءة فقط:

- Project Director.
- Project Manager.
- PMO.

لا يسمح بحذف Audit Log من الواجهة.

### Delete Policy

الحذف الحقيقي ممنوع في MVP.

بدلاً منه:

- `status = cancelled`
- أو `archived = true` لاحقاً.

## Permission Helpers

داخل التطبيق يفضل بناء helpers:

- `canReadProject(user, project)`
- `canUpdateTask(user, task)`
- `canCreateTaskUpdate(user, task)`
- `canApproveDecision(user, decision)`
- `canReadAuditLog(user)`
- `canImportWbs(user, project)`

## اختبارات الصلاحيات المطلوبة

1. Workstream Owner لا يعدل مهمة شخص آخر.
2. Supplier لا يرى dashboard التنفيذي الكامل.
3. Executive لا ينشئ تحديث يومي.
4. Viewer لا يعدل أي شيء.
5. PMO يستطيع استيراد WBS.
6. Project Manager يستطيع إنشاء مخاطر وقرارات.
7. Project Director يستطيع اعتماد Change Request.
8. Audit Log لا يظهر إلا للأدوار المصرح لها.

