/*
 * KAG Command Center - Google Sheets + Slack Bridge
 *
 * نشر آمن:
 * 1. افتح Google Sheet الخاص بالمشروع.
 * 2. Extensions > Apps Script.
 * 3. الصق هذا الملف في Code.gs.
 * 4. Project Settings > Script properties:
 *    - SLACK_WEBHOOK_URL = رابط Incoming Webhook الخاص بقناة المشروع
 *    - SLACK_CHANNEL_ID = C0BET2R762W
 *    - PMO_USER_ID = U0BE7LGEA7M
 *    - MUNTHER_USER_ID = U0BEBUAC3V5
 *    - BANDAR_USER_ID = U0BEWUMQSVA
 *    - ABDULAZIZ_USER_ID = U0BEPPZ88NR
 *    - PMO_EMAIL = بريد PMO للنسخة في تكليفات المهام
 *    - SESSION_SECRET = قيمة طويلة عشوائية لتوقيع جلسات الدخول
 * 5. شغل installKagTriggers مرة واحدة من Apps Script.
 */


const SPREADSHEET_ID = '1e6Yw758p5cJYTERQpfmNLtRX_7HupiRfIkvrvNHY4BE';
const PRIMARY_WBS_SHEET_NAME = 'WBS';

const WBS_FIELD_ALIASES = {
  taskId:['كود المهمة','معرف المهمة','code','WBS Code','Code','الكود','رمز WBS','task_id','id','رقم المهمة'],
  taskName:['اسم المهمة','name','Milestone / Task','Milestone/Task','Task','المهمة','العنوان'],
  mainPath:['المسار الرسمي','المسار الرئيسي','main_path','path','المسار'],
  phase:['المرحلة','phase','PMBOK','مرحلة المهمة حسب PMBOK','مرحلة PMBOK'],
  owner:['الموظف المسؤول','اسم المسؤول','owner','Assigned To','AssignedTo','المسؤول','مسند إلى','responsible','المالك'],
  ownerEmail:['البريد الإلكتروني للمسؤول','owner_email','responsible_email','email','البريد الإلكتروني','بريد المسؤول'],
  plannedStart:['تاريخ البداية الأساسي','تاريخ البدء المخطط','planned_start','start_date','planned_start_date','baseline_start','baseline_start_date','start','Start Date','Planned Start Date','Baseline Start Date','تاريخ البدء','تاريخ البداية','تاريخ بدء المهمة','البداية'],
  plannedEnd:['تاريخ النهاية الأساسي','تاريخ النهاية المخطط','planned_end','planned_finish','end_date','planned_end_date','baseline_end','baseline_end_date','due_date','finish_date','deadline','end','End Date','Planned End Date','Baseline End Date','Due Date','Finish Date','Deadline','تاريخ النهاية','تاريخ الانتهاء','تاريخ الاستحقاق','تاريخ التسليم','النهاية'],
  actualStart:['تاريخ البداية الفعلي','تاريخ البدء الفعلي','actual_start_date','actual_start','started_at','Actual Start Date','Actual Start','بداية فعلية'],
  actualEnd:['تاريخ النهاية الفعلي','تاريخ الانتهاء الفعلي','actual_end_date','actual_finish_date','actual_end','actual_finish','completed_at','completion_date','Actual End Date','Actual Finish Date','تاريخ الإكمال','نهاية فعلية'],
  plannedDurationDays:['المدة بالأيام','مدة المهمة المخططة بالأيام','planned_duration_days','duration_days','duration','مدة المهمة','المدة المخططة'],
  predecessor:['المهمة السابقة','predecessor_task','predecessor','previous_task','dependency'],
  dependencyType:['نوع الاعتمادية','نوع الاعتماد','dependency_type','اعتمادية'],
  operationalDeliverable:['المخرج المطلوب','المخرج التشغيلي','operational_deliverable','deliverable','المخرج'],
  approvalEntity:['جهة الاعتماد','approval_entity','approver','approving_party','المعتمد'],
  progress:['نسبة الإنجاز','نسبة الانجاز','percent_complete','progress','completion_percent','actual_progress','Progress','% Complete','الإنجاز','الانجاز'],
  status:['الحالة','status','Status','progress_status','schedule_status'],
  delayDays:['عدد أيام التأخير','delay_days','delayed_days','days_late','أيام التأخير'],
  evidence:['رابط أو مرجع دليل الإنجاز','evidence_link','completion_evidence','evidence','proof_link','drive_link','deliverable_link','رابط دليل الإنجاز','رابط الإنجاز','مرجع الإنجاز','رابط الملف'],
  version:['رقم الإصدار','version','version_number','الإصدار'],
  notes:['الملاحظات','notes','ملاحظات / عدد المهام','Notes','ملاحظات'],
  lastUpdate:['last_update','updated','آخر تحديث','تاريخ التحديث'],
  priority:['priority','الأولوية'],
  risk:['risk','المخاطر','blocker','المعوقات'],
  executionOwner:['جهة التنفيذ أو المالك','جهة التنفيذ','execution_owner','implementing_party','owner_entity','المالك'],
  followUpOwner:['مسؤول المتابعة','follow_up_owner','متابعة بواسطة'],
  taskType:['نوع المهمة','task_type','نوع العمل'],
  originalStatus:['الحالة الأصلية','original_status','sheet_status'],
  computedStatus:['الحالة المحسوبة','computed_status'],
  lag:['Lag','lag','فترة التأخير','الفاصل'],
  dataSource:['مصدر البيانات','source','data_source','_source'],
  type:['type','Type','Row Type','نوع الصف','النوع','record_type','نوع السجل']
};

const KAG_CONFIG = {
  timezone: 'Asia/Riyadh',
  sheetId: SPREADSHEET_ID,
  taskSheetName: PRIMARY_WBS_SHEET_NAME,
  approvalsSheetName: 'Approvals Register',
  approvalChainSheetName: 'Approval Chain Register',
  approvalHistorySheetName: 'Digital Approval History',
  escalationChainSheetName: 'Escalation Chain Register',
  escalationRegisterSheetNames: ['Escalations Log', 'Escalation Register', 'Escalations Register'],
  riskGovernanceSheetName: 'Risk Governance Register',
  decisionLogSheetName: 'Decision Log',
  usersSheetName: 'User Access Matrix',
  assignmentsSheetName: 'PMO Task Distribution',
  meetingsSheetName: 'Meetings Register',
  commitmentsSheetName: 'Commitments Log',
  filesSheetName: 'File Control Register',
  urgentTasksSheetName: 'Urgent Task',
  auditSheetName: 'Audit Log',
  employeeMasterSheetName: 'Employee Master',
  baselineSheetName: 'Baseline Management',
  raciSheetName: 'RACI Matrix',
  workloadSheetName: 'Employee Workload',
  criticalPathSheetName: 'Critical Path Analysis',
  dataQualitySheetName: 'Data Quality Center',
  projectMasterSheetName: 'Project Master',
  projectSettingsSheetName: 'Project Settings',
  codeSequencesSheetName: 'Code Sequences',
  codeRegistrySheetName: 'Code Registry',
  codeMigrationReportSheetName: 'Code Migration Report',
  eventSitesSheetName: 'Event Sites',
  contentMatrixSheetName: 'Content Matrix',
  contentVersionsSheetName: 'Content Versions',
  guestJourneySheetName: 'Guest Journey',
  defaultProjectStatus: 'بانتظار اعتماد PMO',
  approvedPrefixStatus: 'معتمد',
  codeEntityTypes: ['path', 'task', 'deliverable', 'file', 'version', 'approval', 'decision', 'risk', 'assignment', 'escalation', 'meeting_minutes', 'change_order'],
  maxSlackItems: 8,
  sessionTtlSeconds: 6 * 60 * 60
};

function doGet(e) {
  try {
    const session = requireSession_((e && e.parameter) || {});
    return json_(buildDashboardData_(session));
  } catch (err) {
    return json_({ ok: false, error: publicError_(err) });
  }
}

function buildDashboardData_(session) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const taskRead = readOfficialWbsTasks_(ss);
  const rows = taskRead.rows;
  const taskHeaders = taskRead.headers;
  const approvals = getApprovalRows_(ss);
  const approvalChain = getExistingRegisterRows_(ss, KAG_CONFIG.approvalChainSheetName);
  const escalationChain = getExistingRegisterRows_(ss, KAG_CONFIG.escalationChainSheetName);
  const escalations = deduplicateEscalationsById_(getExistingEscalationRows_(ss));
  const riskGovernance = getExistingRegisterRows_(ss, KAG_CONFIG.riskGovernanceSheetName);
  const assignments = getAssignmentRows_(ss);
  const meetings = getExistingRegisterRows_(ss, KAG_CONFIG.meetingsSheetName);
  const commitments = getExistingRegisterRows_(ss, KAG_CONFIG.commitmentsSheetName);
  const files = getExistingRegisterRows_(ss, KAG_CONFIG.filesSheetName);
  const urgentTasks = getUrgentTaskRows_(ss);
  const decisions = getDecisionRows_(ss);
  const projectMaster = getProjectMasterRows_(ss);
  const projectSettings = getProjectSettingsRows_(ss);
  const employeeMaster = getEmployeeMasterRows_(ss);
  const baselineManagement = buildBaselineManagement_(ss, rows);
  const raci = buildRaciMatrix_(ss, rows, employeeMaster);
  const workload = buildEmployeeWorkload_(ss, rows, employeeMaster);
  const criticalPath = buildCriticalPathAnalysis_(ss, rows);
  const dataQuality = buildDataQualityCenter_(ss, rows, employeeMaster, criticalPath);
  const fieldExperience = buildFieldExperienceData_(ss);
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    user: session ? safeUser_(session) : null,
    rows: rows,
    task_headers: taskHeaders,
    approvals: approvals,
    approval_chain: approvalChain,
    escalation_chain: escalationChain,
    escalations: escalations,
    risk_governance: riskGovernance,
    assignments: assignments,
    meetings: meetings,
    commitments: commitments,
    files: files,
    urgent_tasks: urgentTasks,
    decision_log: decisions,
    project_master: projectMaster,
    project_settings: projectSettings,
    employee_master: employeeMaster,
    baseline_management: baselineManagement,
    raci_matrix: raci,
    employee_workload: workload,
    critical_path: criticalPath,
    data_quality: dataQuality,
    field_experience: fieldExperience,
    sync_meta: Object.assign({}, taskRead.diagnostics, {
      last_sync_at: Utilities.formatDate(new Date(), KAG_CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss'),
      rows_read: rows.length,
      risk_rows_read: riskGovernance.length,
      connection_status: 'connected'
    })
  };
}

function doPost(e) {
  try {
    const payload = parseBody_(e);
    if (payload.action === 'auth_login') {
      const user = authenticateUser_(payload);
      const session = createSession_(user);
      appendAuditLog_({ action: 'auth_login', status: 'success', updated_by: user.display_name || user.username });
      return json_({ ok: true, user: safeUser_(user), session_token: session.token, expires_at: session.expires_at });
    }

    const session = requireSession_(payload);

    if (payload.action === 'data_sync') {
      return json_(buildDashboardData_(session));
    }

    if (payload.action === 'supervisor_draft_preview') {
      requireSupervisorDashboardAccess_(session);
      return json_(buildSupervisorDraftPreview_(session));
    }


    if (payload.action === 'project_master_ensure') {
      requireCanManageProjectConfig_(session);
      const result = ensureProjectGovernanceSheets_(withActor_(payload, session));
      return json_({ ok: true, message: 'Project governance sheets ensured', result: result, project_master: getProjectMasterRows_() });
    }

    if (payload.action === 'project_master_create') {
      requireCanManageProjectConfig_(session);
      const project = upsertProjectMaster_(withActor_(payload, session));
      return json_({ ok: true, message: 'Project Master saved; prefix remains pending until PMO approval', project: project });
    }

    if (payload.action === 'project_prefix_approve') {
      requireCanManageProjectConfig_(session);
      const project = approveProjectPrefix_(withActor_(payload, session));
      return json_({ ok: true, message: 'Project prefix approved; code generation enabled for this project only', project: project });
    }

    if (payload.action === 'generate_project_code') {
      requireCanManageProjectConfig_(session);
      const code = generateProjectCode_(withActor_(payload, session));
      return json_({ ok: true, message: 'Code generated from approved Project Master prefix', code: code });
    }

    if (payload.action === 'code_migration_report') {
      requireCanManageProjectConfig_(session);
      const report = buildCodeMigrationReport_(withActor_(payload, session));
      return json_({ ok: true, message: 'Code migration compatibility report created; no existing codes changed', report: report });
    }

    if (payload.action === 'slack_test') {
      requireCanManageUsers_(session);
      sendSlack_('اختبار ربط Slack مع لوحة KAG تم بنجاح.');
      appendAuditLog_({ action: 'slack_test', status: 'sent', updated_by: session.display_name || session.username });
      return json_({ ok: true, message: 'Slack test sent' });
    }

    if (payload.action === 'daily_update') {
      requireCanWriteEntity_(session, 'task');
      const actorPayload = withActor_(payload, session);
      appendAuditLog_(Object.assign({}, actorPayload, { operation: 'write', record: actorPayload.task || actorPayload.title || actorPayload.wbs_code || '', reference: actorPayload.reference || actorPayload.record_ref || actorPayload.evidence_link || '', result: 'success' }));
      notifyDailyUpdate_(actorPayload);
      return json_({ ok: true, message: 'Update logged and notification sent' });
    }

    if (payload.action === 'approval_request') {
      requireCanWriteEntity_(session, 'approval');
      const item = appendApproval_(withActor_(payload, session));
      return json_({ ok: true, message: 'Approval request logged', approval: item, approvals: getApprovalRows_() });
    }

    if (payload.action === 'approval_update') {
      requireCanApprove_(session);
      requireCanWriteEntity_(session, 'approval');
      const item = updateApproval_(withActor_(payload, session));
      return json_({ ok: true, message: 'Approval updated', approval: item, approvals: getApprovalRows_() });
    }

    if (payload.action === 'task_assignment_preview') {
      requireCanManageUsers_(session);
      appendAuditLog_({ action: 'task_assignment_preview', operation: 'preview', status: 'success', result: 'preview_only_no_email', updated_by: session.display_name || session.username, record_ref: payload.wbs_code || payload.title || '' });
      return json_({ ok: true, message: 'Assignment preview only; no email sent' });
    }

    if (payload.action === 'task_assignment_confirm' || payload.action === 'task_assignment') {
      requireCanManageUsers_(session);
      requireCanWriteEntity_(session, 'assignment');
      if (payload.action === 'task_assignment') throw new Error('Preview and explicit confirmation required before sending assignment');
      const item = appendAssignment_(withActor_(payload, session));
      // Staging acceptance: no email or notification is sent from this action.
      return json_({ ok: true, message: 'Assignment logged; email not sent in staging', assignment: item });
    }

    if (payload.action === 'meeting_record') {
      requireCanEscalate_(session);
      requireCanWriteEntity_(session, 'escalation');
      const item = appendMeeting_(withActor_(payload, session));
      return json_({ ok: true, message: 'Meeting logged', meeting: item });
    }

    return json_({ ok: false, error: 'Unsupported action' });
  } catch (err) {
    return json_({ ok: false, error: publicError_(err) });
  }
}

function installKagTriggers() {
  removeKagTriggers_();
  ensureApprovalSheet_();
  ensureRegisterSheet_(KAG_CONFIG.approvalChainSheetName, getApprovalChainHeaders_());
  ensureRegisterSheet_(KAG_CONFIG.escalationChainSheetName, getEscalationChainHeaders_());
  ensureRegisterSheet_(KAG_CONFIG.riskGovernanceSheetName, getRiskGovernanceHeaders_());
  ensureUserAccessSheet_();
  ensureAssignmentSheet_();
  ensureRegisterSheet_(KAG_CONFIG.meetingsSheetName, getMeetingHeaders_());
  ensureRegisterSheet_(KAG_CONFIG.commitmentsSheetName, getCommitmentHeaders_());
  ensureRegisterSheet_(KAG_CONFIG.filesSheetName, getFileHeaders_());
  ensureP1Batch3Sheets_();

  ScriptApp.newTrigger('sendNoonUpdateRequest')
    .timeBased()
    .inTimezone(KAG_CONFIG.timezone)
    .everyDays(1)
    .atHour(12)
    .create();

  ScriptApp.newTrigger('sendEveningUpdateRequest')
    .timeBased()
    .inTimezone(KAG_CONFIG.timezone)
    .everyDays(1)
    .atHour(19)
    .create();

  ScriptApp.newTrigger('sendExecutiveEndOfDaySummary')
    .timeBased()
    .inTimezone(KAG_CONFIG.timezone)
    .everyDays(1)
    .atHour(19)
    .nearMinute(45)
    .create();

  ScriptApp.newTrigger('sendUrgentTaskNotifications')
    .timeBased()
    .inTimezone(KAG_CONFIG.timezone)
    .everyMinutes(5)
    .create();

  sendSlack_('تم تفعيل ربط لوحة KAG مع Slack وجدولة تذكيرات التحديث اليومية.');
}

function removeKagTriggers_() {
  const names = [
    'sendNoonUpdateRequest',
    'sendEveningUpdateRequest',
    'sendExecutiveEndOfDaySummary',
    'sendUrgentTaskNotifications'
  ];
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (names.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function sendNoonUpdateRequest() {
  if (!isWorkday_()) return;

  const mentions = getMentions_();
  const stale = getStaleTasks_();
  const text = [
    `تحديث منتصف اليوم مطلوب من ${mentions.munther} إلى ${mentions.bandar}`,
    `نسخة: ${mentions.pmo}`,
    '',
    'يرجى إرسال تحديث مختصر في هذه القناة على الصيغة التالية:',
    '- المسار / الملف:',
    '- تم إنجازه حتى الآن:',
    '- قيد التنفيذ:',
    '- المعوقات:',
    '- المطلوب دعمه أو اعتماده:',
    '- رابط الملف في الشيت أو Google Drive:',
    '',
    formatTaskList_('أبرز العناصر التي تحتاج متابعة اليوم', stale)
  ].join('\n');

  sendSlack_(text);
}

function sendEveningUpdateRequest() {
  if (!isWorkday_()) return;

  const mentions = getMentions_();
  const critical = getCriticalTasks_();
  const text = [
    `تحديث نهاية اليوم مطلوب من ${mentions.munther} إلى ${mentions.bandar}`,
    `نسخة: ${mentions.pmo}`,
    '',
    'يرجى إرسال ملخص نهاية اليوم:',
    '- المسار / الملف:',
    '- ما تم إنجازه اليوم:',
    '- ما لم يكتمل:',
    '- المعوقات المفتوحة:',
    '- المطلوب غدًا:',
    '- رابط آخر نسخة:',
    '',
    formatTaskList_('أبرز العناصر الحرجة في لوحة المتابعة', critical)
  ].join('\n');

  sendSlack_(text);
}

function sendExecutiveEndOfDaySummary() {
  if (!isWorkday_()) return;

  const mentions = getMentions_();
  const rows = getTaskRows_();
  const summary = buildExecutiveSummary_(rows);
  const text = [
    `ملخص نهاية اليوم للمدير العام للمشروع ${mentions.abdulaziz}`,
    `نسخة: ${mentions.pmo}`,
    '',
    summary,
    '',
    `رابط الشيت: https://docs.google.com/spreadsheets/d/${KAG_CONFIG.sheetId}/edit`
  ].join('\n');

  sendSlack_(text);
}

function notifyDailyUpdate_(payload) {
  const mentions = getMentions_();
  const text = [
    `تم تسجيل تحديث جديد في لوحة KAG`,
    `المهمة: ${payload.task || payload.title || '-'}`,
    `الحالة: ${payload.status || '-'}`,
    `نسبة الإنجاز: ${payload.percent_complete || payload.progress || '-'}`,
    `المعوقات: ${payload.blocker || payload.risk || '-'}`,
    `المحدث: ${payload.updated_by || '-'}`,
    `نسخة: ${mentions.pmo}`
  ].join('\n');

  sendSlack_(text);
}

function notifyApprovalRequest_(approval) {
  const mentions = getMentions_();
  const text = [
    `طلب اعتماد جديد في مركز الاعتمادات`,
    `رقم الاعتماد: ${approval.approval_id}`,
    `العنوان: ${approval.title || '-'}`,
    `النوع: ${approval.type || '-'}`,
    `الطالب: ${approval.requester || '-'}`,
    `المعتمد: ${approval.approver || '-'}`,
    `الاستحقاق: ${approval.due_date || '-'}`,
    `الحالة: ${approval.status || '-'}`,
    `نسخة: ${mentions.pmo}`
  ].join('\n');

  sendSlack_(text);
}

function notifyApprovalUpdate_(approval) {
  const mentions = getMentions_();
  const text = [
    `تم تحديث اعتماد في مركز الاعتمادات`,
    `رقم الاعتماد: ${approval.approval_id || '-'}`,
    `العنوان: ${approval.title || '-'}`,
    `الحالة الحالية: ${approval.status || '-'}`,
    `المعتمد: ${approval.approver || '-'}`,
    `نسخة: ${mentions.pmo}`
  ].join('\n');

  sendSlack_(text);
}

function notifyAssignment_(assignment) {
  const mentions = getMentions_();
  const text = [
    `تكليف جديد من PMO`,
    `رقم التكليف: ${assignment.assignment_id}`,
    `المهمة: ${assignment.title || '-'}`,
    `المسؤول: ${assignment.owner || '-'}`,
    `البريد: ${assignment.email || '-'}`,
    `الأولوية: ${assignment.priority || '-'}`,
    `الاستحقاق: ${assignment.due_date || '-'}`,
    `نسخة: ${mentions.pmo}`
  ].join('\n');

  sendSlack_(text);
}

function isTestOrSyntheticRecord_(row) {
  const source = String(row.source || '').trim().toLowerCase();
  const recordType = String(row.record_type || '').trim().toLowerCase();
  const isTestFlag = String(row.is_test || '').trim().toUpperCase();
  if (isTestFlag === 'TRUE') return true;
  if (['mock', 'sample', 'demo', 'fallback'].indexOf(source) !== -1) return true;
  if (recordType === 'test') return true;
  if (row._source && row._source !== 'google_sheets') return true;
  const title = String(row.title || row.name || row.task || row.approval_title || row.meeting_title || row.commitment || '').toLowerCase();
  const exact = title.indexOf('test atheer') !== -1 || title.indexOf('تيست اخسر') !== -1;
  const testToken = /(^|[^a-z0-9])test([^a-z0-9]|$)/i.test(title);
  return exact || testToken;
}

function getTaskHeaders_(ss) {
  return readOfficialWbsTasks_(ss || SpreadsheetApp.openById(SPREADSHEET_ID)).headers;
}

function getTaskRows_(ss) {
  return readOfficialWbsTasks_(ss || SpreadsheetApp.openById(SPREADSHEET_ID)).rows;
}

function readOfficialWbsTasks_(ss) {
  ss = ss || SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findTaskSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0].map(function(h) { return normalizeHeader_(h); }) : [];
  const diagnostics = {
    spreadsheet_id: SPREADSHEET_ID,
    sheet_name: sheet.getName(),
    raw_row_count: Math.max(values.length - 1, 0),
    non_empty_row_count: 0,
    valid_task_count: 0,
    excluded_row_count: 0,
    exclusion_reasons: {},
    first_10_task_codes: [],
    last_10_task_codes: [],
    payload_task_total: 0,
    home_task_total: 0
  };
  if (values.length < 2) {
    logDataSyncDiagnostics_(diagnostics);
    return { rows: [], headers: headers, diagnostics: diagnostics };
  }
  const rows = [];
  values.slice(1).forEach(function(row, index) {
    const rowNumber = index + 2;
    const nonEmpty = row.some(function(cell) { return String(cell || '').trim() !== ''; });
    if (!nonEmpty) return;
    diagnostics.non_empty_row_count++;
    const item = {};
    headers.forEach(function(header, col) {
      item[header || ('col_' + (col + 1))] = normalizeCell_(row[col]);
    });
    item.row_number = rowNumber;
    item._source = 'google_sheets';
    item._sheet_name = sheet.getName();
    const type = normalizeTaskType_(getField_(item, WBS_FIELD_ALIASES.type));
    const code = String(getField_(item, WBS_FIELD_ALIASES.taskId) || '').trim();
    const name = String(getField_(item, WBS_FIELD_ALIASES.taskName) || '').trim();
    let reason = '';
    if (isTestOrSyntheticRecord_(item)) reason = 'synthetic_or_test_record';
    else if (!name && !code) reason = 'missing_task_code_and_name';
    else if (type === 'Milestone') reason = 'milestone_not_task';
    if (reason) {
      diagnostics.excluded_row_count++;
      diagnostics.exclusion_reasons[reason] = (diagnostics.exclusion_reasons[reason] || 0) + 1;
      return;
    }
    rows.push(item);
  });
  diagnostics.valid_task_count = rows.length;
  diagnostics.payload_task_total = rows.length;
  diagnostics.home_task_total = rows.length;
  const codes = rows.map(function(item) { return String(getField_(item, WBS_FIELD_ALIASES.taskId) || item.row_number || '').trim(); });
  diagnostics.first_10_task_codes = codes.slice(0, 10);
  diagnostics.last_10_task_codes = codes.slice(Math.max(codes.length - 10, 0));
  validateUnifiedPipeline_(diagnostics, rows.length);
  logDataSyncDiagnostics_(diagnostics);
  return { rows: rows, headers: headers, diagnostics: diagnostics };
}

function normalizeTaskType_(value) {
  const raw = normalizeHeader_(value);
  if (!raw) return 'Task';
  if (['milestone', 'معلم', 'معلم_رئيسي'].indexOf(raw) !== -1) return 'Milestone';
  return 'Task';
}

function logDataSyncDiagnostics_(diagnostics) {
  Logger.log('[data_sync] Spreadsheet ID: ' + diagnostics.spreadsheet_id);
  Logger.log('[data_sync] Sheet: ' + diagnostics.sheet_name);
  Logger.log('[data_sync] Raw rows: ' + diagnostics.raw_row_count);
  Logger.log('[data_sync] Non-empty rows: ' + diagnostics.non_empty_row_count);
  Logger.log('[data_sync] Valid tasks: ' + diagnostics.valid_task_count);
  Logger.log('[data_sync] Excluded rows: ' + diagnostics.excluded_row_count);
  Logger.log('[data_sync] Exclusion reasons: ' + JSON.stringify(diagnostics.exclusion_reasons));
  Logger.log('[data_sync] First 10 task codes: ' + JSON.stringify(diagnostics.first_10_task_codes));
  Logger.log('[data_sync] Last 10 task codes: ' + JSON.stringify(diagnostics.last_10_task_codes));
  Logger.log('[data_sync] Payload task total: ' + diagnostics.payload_task_total);
  Logger.log('[data_sync] Home task total: ' + diagnostics.home_task_total);
}

function validateUnifiedPipeline_(diagnostics, payloadCount) {
  if (diagnostics.valid_task_count !== payloadCount || diagnostics.payload_task_total !== diagnostics.home_task_total) {
    throw new Error('Unified data pipeline mismatch: ' + JSON.stringify(diagnostics));
  }
}

function findTaskSheet_(ss) {
  const sheet = ss.getSheetByName(KAG_CONFIG.taskSheetName);
  if (!sheet) throw new Error('Required WBS sheet not found in Spreadsheet ID ' + SPREADSHEET_ID + ': ' + KAG_CONFIG.taskSheetName);
  return sheet;
}

function ensureApprovalSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(KAG_CONFIG.approvalsSheetName) || ss.insertSheet(KAG_CONFIG.approvalsSheetName);
  const headers = [
    'approval_id',
    'linked_wbs_code',
    'type',
    'title',
    'requester',
    'approver',
    'due_date',
    'status',
    'current_stage',
    'sla_hours',
    'escalation_level',
    'notes',
    'created_at',
    'updated_at',
    'reference_number',
    'owner',
    'follow_up_owner',
    'version',
    'comments_log',
    'sent_at',
    'resubmitted_at',
    'response_sla_hours',
    'response_due_at',
    'governance_stage',
    'client_final_approver',
    'evidence_link',
    'official_reference',
    'closed_at',
    'is_suggestion'
  ];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    ensureSheetColumns_(sheet, headers);
  }
  return sheet;
}

function ensureAssignmentSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(KAG_CONFIG.assignmentsSheetName) || ss.insertSheet(KAG_CONFIG.assignmentsSheetName);
  const headers = [
    'assignment_id','wbs_code','title','path','owner','email','deliverable','priority','due_date','drive_link','email_body','status','details','assigned_by','email_sent_at','created_at','updated_at'
  ];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    ensureSheetColumns_(sheet, headers);
  }
  return sheet;
}


function ensureP1Batch3Sheets_() {
  ensureRegisterSheet_(KAG_CONFIG.baselineSheetName, getBaselineHeaders_());
  ensureRegisterSheet_(KAG_CONFIG.raciSheetName, getRaciHeaders_());
  ensureRegisterSheet_(KAG_CONFIG.workloadSheetName, getWorkloadHeaders_());
  ensureRegisterSheet_(KAG_CONFIG.criticalPathSheetName, getCriticalPathHeaders_());
  ensureRegisterSheet_(KAG_CONFIG.dataQualitySheetName, getDataQualityHeaders_());
  appendAuditLog_({ action: 'p1_batch3_sheets_ensure', operation: 'verify', status: 'success', result: 'baseline_raci_workload_critical_path_data_quality_ready', updated_by: 'System' });
}

function getBaselineHeaders_() { return ['task_code','task_name','original_baseline_start','original_baseline_end','current_plan_start','current_plan_end','start_variance_days','end_variance_days','revision_number','modified_at','revision_reason','modified_by','approved_by','audit_status']; }
function getRaciHeaders_() { return ['task_code','task_name','responsible','accountable','consulted','informed','source','data_status']; }
function getWorkloadHeaders_() { return ['employee','email','task_count','overdue_task_count','critical_task_count','total_duration_days','workload_limit_days','alert','source']; }
function getCriticalPathHeaders_() { return ['task_code','task_name','early_start','early_finish','late_start','late_finish','total_float','free_float','is_critical','directly_impacts_opening','dependency_type','lag','data_status']; }
function getDataQualityHeaders_() { return ['issue_type','task_code','task_name','details','severity','excluded_from_kpi','detected_at']; }

function getEmployeeMasterRows_(ss) { return getExistingRegisterRows_(ss || SpreadsheetApp.openById(SPREADSHEET_ID), KAG_CONFIG.employeeMasterSheetName); }
function normKey_(value) { return String(value || '').trim().toLowerCase(); }
function taskField_(row, field) { return getField_(row, WBS_FIELD_ALIASES[field] || []); }
function taskCode_(row) { return String(taskField_(row, 'taskId') || '').trim(); }
function taskName_(row) { return String(taskField_(row, 'taskName') || '').trim(); }
function taskOwner_(row) { return String(taskField_(row, 'owner') || '').trim(); }
function taskEnd_(row) { return parseDateKey_(taskField_(row, 'plannedEnd')); }
function taskStart_(row) { return parseDateKey_(taskField_(row, 'plannedStart')); }
function taskProgress_(row) { const n = Number(String(taskField_(row, 'progress') || '0').replace('%','')); return isNaN(n) ? 0 : n; }
function isCompleteTask_(row) { return taskProgress_(row) >= 100 || /مكتمل|completed|done/i.test(String(taskField_(row, 'status') || '')); }
function parseDateKey_(value) { if (!value) return ''; const d = new Date(value); if (isNaN(d.getTime())) return ''; return Utilities.formatDate(d, KAG_CONFIG.timezone, 'yyyy-MM-dd'); }
function dayNumber_(key) { return key ? Math.floor(new Date(key + 'T00:00:00Z').getTime() / 86400000) : null; }
function durationDays_(row) { const explicit = Number(taskField_(row, 'plannedDurationDays')); if (!isNaN(explicit) && explicit > 0) return explicit; const s = dayNumber_(taskStart_(row)), e = dayNumber_(taskEnd_(row)); return s !== null && e !== null ? Math.max(1, e - s + 1) : 0; }
function employeeByNameOrEmail_(employees) { const m = {}; employees.forEach(function(e) { ['name','employee_name','display_name','الاسم','اسم الموظف'].forEach(function(k){ if(e[k]) m[normKey_(e[k])] = e; }); ['email','البريد الإلكتروني','employee_email'].forEach(function(k){ if(e[k]) m[normKey_(e[k])] = e; }); }); return m; }
function employeeField_(e, names) { return getField_(e || {}, names); }
function findEmployee_(index, name, email) { return index[normKey_(email)] || index[normKey_(name)] || null; }

function buildBaselineManagement_(ss, rows) {
  const existing = getExistingRegisterRows_(ss, KAG_CONFIG.baselineSheetName);
  const byCode = {}; existing.forEach(function(r){ if(r.task_code) byCode[normKey_(r.task_code)] = r; });
  return rows.map(function(r){ const code=taskCode_(r), prev=byCode[normKey_(code)]||{}; const cs=taskStart_(r), ce=taskEnd_(r); const bs=prev.original_baseline_start || cs, be=prev.original_baseline_end || ce; const sv=(dayNumber_(cs)!==null&&dayNumber_(bs)!==null)?dayNumber_(cs)-dayNumber_(bs):''; const ev=(dayNumber_(ce)!==null&&dayNumber_(be)!==null)?dayNumber_(ce)-dayNumber_(be):''; return { task_code:code, task_name:taskName_(r), original_baseline_start:bs, original_baseline_end:be, current_plan_start:cs, current_plan_end:ce, start_variance_days:sv, end_variance_days:ev, revision_number:prev.revision_number||'0', modified_at:prev.modified_at||'', revision_reason:prev.revision_reason||'', modified_by:prev.modified_by||'', approved_by:prev.approved_by||'', audit_status:'original_baseline_locked' }; });
}

function buildRaciMatrix_(ss, rows, employees) {
  const idx=employeeByNameOrEmail_(employees); return rows.map(function(r){ const emp=findEmployee_(idx, taskOwner_(r), taskField_(r,'ownerEmail')); if(!emp) return {task_code:taskCode_(r),task_name:taskName_(r),responsible:'لا توجد بيانات كافية',accountable:'لا توجد بيانات كافية',consulted:'لا توجد بيانات كافية',informed:'لا توجد بيانات كافية',source:'Employee Master',data_status:'لا توجد بيانات كافية'}; return {task_code:taskCode_(r),task_name:taskName_(r),responsible:employeeField_(emp,['responsible','Responsible','R','name','employee_name','اسم الموظف'])||'لا توجد بيانات كافية',accountable:employeeField_(emp,['accountable','Accountable','A','manager','line_manager','المدير المباشر'])||'لا توجد بيانات كافية',consulted:employeeField_(emp,['consulted','Consulted','C','consulted_group','استشاري'])||'لا توجد بيانات كافية',informed:employeeField_(emp,['informed','Informed','I','informed_group','للعلم'])||'لا توجد بيانات كافية',source:'Employee Master',data_status:'ok'}; });
}

function buildEmployeeWorkload_(ss, rows, employees) {
  const idx=employeeByNameOrEmail_(employees), today=dayNumber_(Utilities.formatDate(new Date(), KAG_CONFIG.timezone, 'yyyy-MM-dd')), critical=buildCriticalPathAnalysis_(ss, rows); const crit={}; (critical.tasks||[]).forEach(function(t){ if(t.is_critical) crit[normKey_(t.task_code)]=true; }); const agg={}; rows.forEach(function(r){ const emp=findEmployee_(idx, taskOwner_(r), taskField_(r,'ownerEmail')); if(!emp) return; const key=employeeField_(emp,['email','البريد الإلكتروني','employee_email'])||employeeField_(emp,['name','employee_name','اسم الموظف']); if(!agg[key]) agg[key]={employee:employeeField_(emp,['name','employee_name','اسم الموظف'])||taskOwner_(r),email:employeeField_(emp,['email','البريد الإلكتروني','employee_email'])||'',task_count:0,overdue_task_count:0,critical_task_count:0,total_duration_days:0,workload_limit_days:Number(employeeField_(emp,['workload_limit_days','capacity_days','حد العبء'])||0)}; agg[key].task_count++; agg[key].total_duration_days+=durationDays_(r); if(!isCompleteTask_(r)&&dayNumber_(taskEnd_(r))!==null&&dayNumber_(taskEnd_(r))<today) agg[key].overdue_task_count++; if(crit[normKey_(taskCode_(r))]) agg[key].critical_task_count++; }); return Object.keys(agg).map(function(k){ const a=agg[k]; a.alert=a.workload_limit_days&&a.total_duration_days>a.workload_limit_days?'تجاوز الحد':'ضمن الحد'; a.source='Employee Master + WBS'; return a; });
}

function buildCriticalPathAnalysis_(ss, rows) {
  const nodes={}, missing=[]; rows.forEach(function(r){ const c=taskCode_(r); if(c&&taskStart_(r)&&taskEnd_(r)) nodes[c]={row:r,code:c,dur:durationDays_(r),preds:[]}; }); rows.forEach(function(r){ const c=taskCode_(r); if(!nodes[c]) return; String(taskField_(r,'predecessor')||'').split(/[,;،]/).map(function(x){return x.trim();}).filter(Boolean).forEach(function(p){ if(!nodes[p]) missing.push(p+' -> '+c); else nodes[c].preds.push({code:p,type:String(taskField_(r,'dependencyType')||'FS').trim().toUpperCase(),lag:Number(taskField_(r,'lag')||0)||0}); }); }); if(!Object.keys(nodes).length || missing.length) return { ok:false, message:'لا توجد بيانات كافية لاحتساب المسار الحرج', missing_dependencies:missing, tasks:[] }; const order=[], temp={}, perm={}, cycle=false; function visit(c){ if(temp[c]){cycle=true;return;} if(perm[c])return; temp[c]=true; nodes[c].preds.forEach(function(p){visit(p.code);}); perm[c]=true; temp[c]=false; order.push(c);} Object.keys(nodes).forEach(visit); if(cycle) return { ok:false, message:'لا توجد بيانات كافية لاحتساب المسار الحرج', circular_dependencies:true, tasks:[] }; order.forEach(function(c){ const n=nodes[c]; n.es=0; n.preds.forEach(function(p){ const pn=nodes[p.code], rel=(p.type==='SS'?pn.es:pn.ef)+p.lag; n.es=Math.max(n.es,rel); }); n.ef=n.es+n.dur; }); const projectFinish=Math.max.apply(null, order.map(function(c){return nodes[c].ef;})); order.slice().reverse().forEach(function(c){ const n=nodes[c]; n.lf=projectFinish; Object.keys(nodes).forEach(function(s){ nodes[s].preds.forEach(function(p){ if(p.code===c){ const succ=nodes[s], rel=(p.type==='SS'?succ.ls:succ.es)-p.lag; n.lf=Math.min(n.lf, rel+(p.type==='SS'?n.dur:0)); } }); }); n.ls=n.lf-n.dur; n.total_float=n.ls-n.es; let minFree=projectFinish-n.ef; Object.keys(nodes).forEach(function(s){ nodes[s].preds.forEach(function(p){ if(p.code===c) minFree=Math.min(minFree,(p.type==='SS'?nodes[s].es:nodes[s].es)-p.lag-n.ef); }); }); n.free_float=Math.max(0,minFree); }); return { ok:true, message:'ok', project_duration_days:projectFinish, tasks:order.map(function(c){ const n=nodes[c]; return {task_code:c,task_name:taskName_(n.row),early_start:n.es,early_finish:n.ef,late_start:n.ls,late_finish:n.lf,total_float:n.total_float,free_float:n.free_float,is_critical:n.total_float===0,directly_impacts_opening:n.ef===projectFinish||n.total_float===0,dependency_type:String(taskField_(n.row,'dependencyType')||'FS'),lag:Number(taskField_(n.row,'lag')||0)||0,data_status:'ok'}; }) };
}

function buildDataQualityCenter_(ss, rows, employees, criticalPath) {
  const issues=[], codes={}, names={}, taskCodes={}; rows.forEach(function(r){ const c=taskCode_(r), n=taskName_(r); if(c){ (codes[c]=codes[c]||[]).push(r); taskCodes[c]=true; } if(n) (names[n]=names[n]||[]).push(r); }); const idx=employeeByNameOrEmail_(employees), now=new Date().toISOString(); function add(type,r,details,severity){ issues.push({issue_type:type,task_code:r?taskCode_(r):'',task_name:r?taskName_(r):'',details:details,severity:severity||'high',excluded_from_kpi:'TRUE',detected_at:now}); }
  Object.keys(codes).forEach(function(k){ if(codes[k].length>1) codes[k].forEach(function(r){add('الأكواد المكررة',r,k,'critical');}); }); Object.keys(names).forEach(function(k){ if(names[k].length>1) names[k].forEach(function(r){add('أسماء المهام المكررة',r,k,'medium');}); });
  rows.forEach(function(r){ if(!taskOwner_(r)) add('المهام بدون مسؤول',r,'owner missing'); if(!taskField_(r,'mainPath')) add('المهام بدون مسار',r,'path missing'); if(!taskField_(r,'approvalEntity')) add('المهام بدون معتمد',r,'approver missing'); if(!taskField_(r,'operationalDeliverable')) add('المهام بدون مخرج',r,'deliverable missing'); String(taskField_(r,'predecessor')||'').split(/[,;،]/).map(function(x){return x.trim();}).filter(Boolean).forEach(function(p){ if(!taskCodes[p]) add('الاعتماديات المفقودة',r,p,'critical'); }); if(taskStart_(r)&&taskEnd_(r)&&dayNumber_(taskStart_(r))>dayNumber_(taskEnd_(r))) add('البداية بعد النهاية',r,'start > end','critical'); if(/1900|1970|2099|placeholder|tbd|لاحق/i.test(String(taskField_(r,'plannedStart'))+String(taskField_(r,'plannedEnd')))) add('Placeholder Dates',r,'placeholder date'); if(isCompleteTask_(r)&&!taskField_(r,'evidence')) add('المهام المكتملة بدون دليل',r,'evidence missing'); if(taskProgress_(r)>=100&&!taskField_(r,'actualEnd')) add('المهام 100% بدون تاريخ نهاية فعلي',r,'actual end missing'); if(/قيد التنفيذ|in progress/i.test(String(taskField_(r,'status')))&&taskStart_(r)&&dayNumber_(taskStart_(r))>dayNumber_(Utilities.formatDate(new Date(),KAG_CONFIG.timezone,'yyyy-MM-dd'))) add('المهام قيد التنفيذ قبل تاريخ البداية',r,'status before start'); const email=taskField_(r,'ownerEmail'); if(email && !findEmployee_(idx, taskOwner_(r), email)) add('البريد غير المطابق لـ Employee Master',r,email); });
  if(criticalPath && criticalPath.circular_dependencies) add('الاعتماديات الدائرية',null,'cycle detected','critical');
  return { issues:issues, excluded_task_codes:[], summary:{issue_count:issues.length, excluded_from_kpi_count:0} };
}

function getMeetingHeaders_() {
  return ['meeting_id', 'title', 'date', 'attendees', 'decisions', 'actions', 'created_at', 'updated_at'];
}

function getApprovalChainHeaders_() {
  return ['step', 'stage', 'owner', 'role', 'sla', 'handoff_to', 'evidence_required'];
}

function getEscalationChainHeaders_() {
  return ['level', 'title', 'owner', 'trigger', 'sla', 'next_level', 'notification_channel'];
}


function getRiskGovernanceHeaders_() {
  return ['risk_id', 'title', 'category', 'probability', 'impact', 'severity', 'owner', 'treatment_plan', 'escalation_level', 'status', 'due_date', 'updated_at'];
}

function getUserAccessHeaders_() {
  return [
    'username',
    'temporary_password',
    'password_hash',
    'salt',
    'display_name',
    'email',
    'role',
    'access_level',
    'path_scope',
    'allowed_pages',
    'can_approve',
    'can_escalate',
    'can_manage_users',
    'status',
    'must_change_password',
    'created_at',
    'updated_at'
  ];
}

function ensureUserAccessSheet_() {
  const sheet = ensureRegisterSheet_(KAG_CONFIG.usersSheetName, getUserAccessHeaders_());
  if (sheet.getLastRow() > 1) return sheet;
  const now = new Date();
  getDefaultUsers_().forEach(function(user) {
    sheet.appendRow([
      user.username,
      '',
      '',
      '',
      user.display_name,
      user.email || '',
      user.role,
      user.access_level,
      user.path_scope || '',
      user.allowed_pages,
      user.can_approve,
      user.can_escalate,
      user.can_manage_users,
      'active',
      'TRUE',
      now,
      now
    ]);
  });
  return sheet;
}

function getDefaultUsers_() {
  const all = '*';
  const execPages = 'overview,executiveBoard,projectHealth,escalationHub,risksMgmt,approvals,decisions,analytics,fileControl';
  const pmPages = 'overview,tasks,phases,timeline,risksMgmt,decisions,approvals,assignments,actions,escalationHub,meetingsHub,pmoAssistant,projectHealth,executiveBoard,commitmentsHub,smartReminders,fileControl,analytics';
  const eventPages = 'overview,tasks,phases,timeline,assignments,actions,escalationHub,meetingsHub,projectHealth,commitmentsHub,fileControl';
  const coordinatorPages = 'overview,tasks,phases,timeline,decisions,approvals,assignments,actions,escalationHub,meetingsHub,pmoAssistant,commitmentsHub,smartReminders,fileControl';
  const workstreamPages = 'overview,tasks,phases,timeline,approvals,assignments,meetingsHub,commitmentsHub,fileControl,actions';
  return [
    { username: 'ahmad.amoudi', display_name: 'أحمد العامودي', email: 'a.alamoudi@mayadeen.sa', role: 'PMO', access_level: 'full', path_scope: 'all', allowed_pages: all, can_approve: 'TRUE', can_escalate: 'TRUE', can_manage_users: 'TRUE' },
    { username: 'abdulaziz.obaid', display_name: 'عبدالعزيز العبيد', email: 'A.alobed@mayadeen.sa', role: 'مشرف عام داخلي', access_level: 'executive', path_scope: 'executive', allowed_pages: execPages, can_approve: 'TRUE', can_escalate: 'TRUE', can_manage_users: 'FALSE' },
    { username: 'ahmad.muhaysin', display_name: 'أحمد المحيسن', email: '', role: 'مدير المشروع', access_level: 'manager', path_scope: 'all_delivery', allowed_pages: pmPages, can_approve: 'TRUE', can_escalate: 'TRUE', can_manage_users: 'FALSE' },
    { username: 'bandar.alhaydhah', display_name: 'بندر الهضيبة', email: 'b.alhaydhah@mayadeen.sa', role: 'مدير الجودة والمخاطر', access_level: 'control', path_scope: 'quality_risk', allowed_pages: 'overview,risksMgmt,approvals,actions,escalationHub,projectHealth,analytics,fileControl,smartReminders', can_approve: 'TRUE', can_escalate: 'TRUE', can_manage_users: 'FALSE' },
    { username: 'mohammed.shalabi', display_name: 'محمد شلبي', email: '', role: 'مدير الحدث', access_level: 'event_manager', path_scope: 'field_event', allowed_pages: eventPages, can_approve: 'TRUE', can_escalate: 'TRUE', can_manage_users: 'FALSE' },
    { username: 'munther.alansari', display_name: 'منذر الأنصاري', email: 'm.alansari@mayadeen.sa', role: 'منسق المشروع', access_level: 'coordinator', path_scope: 'coordination', allowed_pages: coordinatorPages, can_approve: 'FALSE', can_escalate: 'TRUE', can_manage_users: 'FALSE' },
    { username: 'sara.alshahri', display_name: 'سارة الشهري', email: '', role: 'مدير الحساب والعلاقات الحكومية', access_level: 'government_account', path_scope: 'government', allowed_pages: 'overview,tasks,approvals,escalationHub,meetingsHub,commitmentsHub,fileControl,smartReminders', can_approve: 'FALSE', can_escalate: 'TRUE', can_manage_users: 'FALSE' },
    { username: 'nora.afif', display_name: 'نورة العفيف', email: '', role: 'مسار الضيافة', access_level: 'workstream', path_scope: 'hospitality', allowed_pages: workstreamPages, can_approve: 'FALSE', can_escalate: 'FALSE', can_manage_users: 'FALSE' },
    { username: 'majed.qasim', display_name: 'ماجد قاسم', email: '', role: 'مسار التشغيل', access_level: 'workstream', path_scope: 'operations', allowed_pages: workstreamPages, can_approve: 'FALSE', can_escalate: 'FALSE', can_manage_users: 'FALSE' },
    { username: 'najla.qadi', display_name: 'نجلاء القاضي', email: '', role: 'مسار تجربة الضيوف', access_level: 'workstream', path_scope: 'guest_experience', allowed_pages: workstreamPages, can_approve: 'FALSE', can_escalate: 'FALSE', can_manage_users: 'FALSE' },
    { username: 'ibrahim.almaghrabi', display_name: 'إبراهيم المغربي', email: '', role: 'مسار المحتوى', access_level: 'workstream', path_scope: 'content', allowed_pages: workstreamPages, can_approve: 'FALSE', can_escalate: 'FALSE', can_manage_users: 'FALSE' },
    { username: 'mohammed.imad', display_name: 'محمد عماد', email: '', role: 'مسار النقل واللوجستيات', access_level: 'workstream', path_scope: 'transport_logistics', allowed_pages: workstreamPages, can_approve: 'FALSE', can_escalate: 'FALSE', can_manage_users: 'FALSE' },
    { username: 'joseph.haddad', display_name: 'جوزيف حداد', email: '', role: 'مسار التنفيذ', access_level: 'workstream', path_scope: 'delivery', allowed_pages: workstreamPages, can_approve: 'FALSE', can_escalate: 'FALSE', can_manage_users: 'FALSE' },
    { username: 'shahad.abdullah', display_name: 'شهد عبدالله', email: '', role: 'مسار التصميم', access_level: 'workstream', path_scope: 'design', allowed_pages: workstreamPages, can_approve: 'FALSE', can_escalate: 'FALSE', can_manage_users: 'FALSE' },
    { username: 'abdullah.almarhoon', display_name: 'عبدالله المرحون', email: '', role: 'مسار البروتوكول والحشود', access_level: 'workstream', path_scope: 'protocol_crowd', allowed_pages: workstreamPages, can_approve: 'FALSE', can_escalate: 'FALSE', can_manage_users: 'FALSE' }
  ];
}

function authenticateUser_(payload) {
  ensureUserAccessSheet_();
  const username = String(payload.username || '').trim().toLowerCase();
  const password = String(payload.password || '');
  if (!username || !password) throw new Error('Missing credentials');
  const user = findActiveUser_(username);
  if (!user) throw new Error('Invalid credentials');
  const hash = String(user.password_hash || '');
  const salt = String(user.salt || '');
  const temporary = String(user.temporary_password || '');
  const ok = hash ? hashPassword_(password, salt) === hash : temporary && temporary === password;
  if (!ok) throw new Error('Invalid credentials');
  return safeUser_(user);
}

function findActiveUser_(username) {
  const wanted = String(username || '').trim().toLowerCase();
  if (!wanted) return null;
  const users = getRegisterRows_(KAG_CONFIG.usersSheetName, getUserAccessHeaders_());
  return users.find(function(item) {
    return String(item.username || '').trim().toLowerCase() === wanted && String(item.status || 'active').toLowerCase() === 'active';
  }) || null;
}

function safeUser_(user) {
  return {
    username: user.username,
    display_name: user.display_name,
    email: user.email,
    role: user.role,
    access_level: user.access_level,
    path_scope: user.path_scope,
    allowed_pages: String(user.allowed_pages || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean),
    can_approve: parseBool_(user.can_approve),
    can_escalate: parseBool_(user.can_escalate),
    can_manage_users: parseBool_(user.can_manage_users),
    must_change_password: parseBool_(user.must_change_password)
  };
}

function createSession_(user) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = nowSeconds + KAG_CONFIG.sessionTtlSeconds;
  const payload = {
    sub: String(user.username || '').trim().toLowerCase(),
    iat: nowSeconds,
    exp: expiresAt,
    nonce: Utilities.getUuid()
  };
  const encodedPayload = base64EncodeJson_(payload);
  return {
    token: encodedPayload + '.' + signSession_(encodedPayload),
    expires_at: new Date(expiresAt * 1000).toISOString()
  };
}

function requireSession_(payload) {
  const token = String(payload.session_token || payload.token || payload.auth_token || '').trim();
  if (!token) throw new Error('Unauthorized');
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('Unauthorized');
  if (signSession_(parts[0]) !== parts[1]) throw new Error('Unauthorized');
  const session = base64DecodeJson_(parts[0]);
  if (!session.sub || !session.exp || Number(session.exp) < Math.floor(Date.now() / 1000)) throw new Error('Session expired');
  const user = findActiveUser_(session.sub);
  if (!user) throw new Error('Unauthorized');
  return safeUser_(user);
}

function requireCanApprove_(session) {
  if (hasFullAccess_(session) || session.can_approve) return;
  throw new Error('Forbidden: approval permission required');
}

function normalizeAllowedPages_(session) {
  const raw = Array.isArray(session.allowed_pages) ? session.allowed_pages.join(',') : String(session.allowed_pages || '');
  return raw.split(/[,،]/).map(function(page) { return String(page || '').trim(); }).filter(Boolean);
}

function requirePageAccess_(session, pageId) {
  const pages = normalizeAllowedPages_(session);
  if (hasFullAccess_(session) || pages.indexOf('*') !== -1 || pages.indexOf(pageId) !== -1) return;
  throw new Error('Forbidden: page permission required for ' + pageId);
}

function requireCanWriteEntity_(session, entity) {
  const entityPages = {
    task: ['tasks', 'actions'],
    decision: ['decisions'],
    approval: ['approvals'],
    risk: ['risksMgmt'],
    escalation: ['escalationHub', 'escalationsCenter'],
    evidence: ['evidenceCenter', 'fileControl'],
    report: ['reportsGenerator', 'analytics', 'executiveBoard'],
    backup: ['importExportCenter'],
    assignment: ['assignments', 'tasks'],
    meeting: ['meetingsHub']
  };
  if (hasFullAccess_(session)) return;
  const pages = normalizeAllowedPages_(session);
  const allowed = entityPages[entity] || [];
  if (allowed.some(function(page) { return pages.indexOf(page) !== -1; })) return;
  if ((entity === 'approval' || entity === 'decision') && session.can_approve) return;
  if ((entity === 'risk' || entity === 'escalation') && session.can_escalate) return;
  throw new Error('Forbidden: write permission required for ' + entity);
}

function requireCanEscalate_(session) {
  if (hasFullAccess_(session) || session.can_escalate) return;
  throw new Error('Forbidden: escalation permission required');
}

function requireCanManageUsers_(session) {
  if (hasFullAccess_(session) || session.can_manage_users) return;
  throw new Error('Forbidden: PMO permission required');
}

function hasFullAccess_(session) {
  return String(session.access_level || '').toLowerCase() === 'full';
}

function withActor_(payload, session) {
  const actor = session.display_name || session.username || 'Authenticated User';
  const next = Object.assign({}, payload);
  next.updated_by = actor;
  next.actor_username = session.username || '';
  next.username = session.username || '';
  next.email = session.email || '';
  next.display_name = session.display_name || '';
  if (!next.requester) next.requester = actor;
  if (!next.assigned_by) next.assigned_by = actor;
  if (!next.attendees && payload.action === 'meeting_record') next.attendees = actor;
  delete next.session_token;
  delete next.token;
  delete next.auth_token;
  return next;
}

function base64EncodeJson_(value) {
  const bytes = Utilities.newBlob(JSON.stringify(value), 'application/json').getBytes();
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function base64DecodeJson_(value) {
  var padded = String(value || '');
  while (padded.length % 4) padded += '=';
  const bytes = Utilities.base64DecodeWebSafe(padded);
  return JSON.parse(Utilities.newBlob(bytes).getDataAsString('UTF-8'));
}

function signSession_(encodedPayload) {
  const bytes = Utilities.computeHmacSha256Signature(encodedPayload, getSessionSecret_(), Utilities.Charset.UTF_8);
  return bytesToHex_(bytes);
}

function getSessionSecret_() {
  const props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SESSION_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + ':' + Utilities.getUuid() + ':' + Utilities.getUuid();
    props.setProperty('SESSION_SECRET', secret);
  }
  return secret;
}

function bytesToHex_(bytes) {
  return bytes.map(function(b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function publicError_(err) {
  const message = String((err && err.message) || err || 'Request failed');
  if (message.match(/Invalid credentials/i)) return 'Invalid credentials';
  if (message.match(/Unauthorized|Session expired|Forbidden/i)) return message;
  return message;
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '::' + password, Utilities.Charset.UTF_8);
  return bytes.map(function(b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function parseBool_(value) {
  return String(value || '').toLowerCase() === 'true' || String(value || '') === '1' || String(value || '').toLowerCase() === 'yes';
}

function getUrgentTaskSheet_(ss) {
  ss = ss || SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(KAG_CONFIG.urgentTasksSheetName);
}

function getUrgentTaskRows_(ss) {
  const sheet = getUrgentTaskSheet_(ss);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function(h) { return normalizeHeader_(h); });
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return String(cell || '').trim() !== ''; });
  }).map(function(row, index) {
    const item = {};
    headers.forEach(function(header, col) {
      item[header || ('col_' + (col + 1))] = normalizeCell_(row[col]);
    });
    item.row_number = index + 2;
    return item;
  });
}

function sendUrgentTaskNotifications() {
  const sheet = getUrgentTaskSheet_();
  if (!sheet) return;
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  const headers = values[0].map(function(h) { return normalizeHeader_(h); });
  const notifyCol = headers.indexOf(normalizeHeader_('إرسال الإشعار'));
  const emailCol = headers.indexOf(normalizeHeader_('البريد الإلكتروني'));
  if (notifyCol === -1 || emailCol === -1) return;

  requireSupportSender_();

  for (var r = 1; r < values.length; r++) {
    const notifyValue = String(values[r][notifyCol] || '').trim();
    if (notifyValue !== 'نعم') continue;
    const task = urgentTaskFromRow_(headers, values[r], r + 1);
    if (!task.email) continue;
    sendUrgentTaskEmail_(task);
    sheet.getRange(r + 1, notifyCol + 1).setValue('تم الإرسال');
  }
}

function urgentTaskFromRow_(headers, row, rowNumber) {
  const item = { row_number: rowNumber };
  headers.forEach(function(header, col) {
    item[header || ('col_' + (col + 1))] = normalizeCell_(row[col]);
  });
  return {
    id: item.id || '',
    task: item[normalizeHeader_('المهمة')] || '',
    description: item[normalizeHeader_('الوصف')] || '',
    owner: item[normalizeHeader_('المسؤول')] || '',
    email: item[normalizeHeader_('البريد الإلكتروني')] || '',
    assigned_date: item[normalizeHeader_('تاريخ الإسناد')] || '',
    due_date: item[normalizeHeader_('تاريخ الاستحقاق')] || '',
    status: item[normalizeHeader_('الحالة')] || '',
    notify: item[normalizeHeader_('إرسال الإشعار')] || ''
  };
}

function sendUrgentTaskEmail_(task) {
  const body = [
    'السلام عليكم،',
    '',
    'تم إسناد مهمة مستعجلة، يرجى الاطلاع على التفاصيل التالية واتخاذ اللازم:',
    '',
    `اسم المهمة: ${task.task || '-'}`,
    `الوصف: ${task.description || '-'}`,
    `المسؤول: ${task.owner || '-'}`,
    `تاريخ الإسناد: ${task.assigned_date || '-'}`,
    `تاريخ الاستحقاق: ${task.due_date || '-'}`,
    '',
    'مع التحية،',
    'فريق الدعم والخدمات'
  ].join('\n');

  GmailApp.sendEmail(task.email, 'تم إسناد مهمة مستعجلة', body, {
    from: 'support.services@mayadeen.sa'
  });
}

function requireSupportSender_() {
  const required = 'support.services@mayadeen.sa';
  const effective = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const aliases = GmailApp.getAliases().map(function(alias) { return String(alias || '').toLowerCase(); });
  if (effective === required || aliases.indexOf(required) !== -1) return;
  throw new Error('Urgent Task email sender must be support.services@mayadeen.sa or an approved Google Workspace alias.');
}


function getDecisionLogHeaders_() {
  return ['decision_id', 'title', 'description', 'decision_owner', 'decision_date', 'status', 'affected_tasks', 'affected_paths', 'official_reference', 'execution_date', 'follow_up_owner', 'created_at', 'updated_at'];
}

function getDecisionRows_(ss) {
  if (ss) return getExistingRegisterRows_(ss, KAG_CONFIG.decisionLogSheetName);
  return getRegisterRows_(KAG_CONFIG.decisionLogSheetName, getDecisionLogHeaders_());
}

function getCommitmentHeaders_() {
  return ['commitment_id', 'owner', 'commitment', 'due_date', 'status', 'source', 'created_at', 'updated_at'];
}

function getFileHeaders_() {
  return ['file_id', 'name', 'owner', 'version', 'link', 'approval_status', 'updated_at', 'notes'];
}


function getFieldExperienceSheetDefinitions_() {
  return [
    { key: 'event_sites', sheetName: KAG_CONFIG.eventSitesSheetName, headers: ['site_id','site_code','garden_name','zone_number','site_name','activation_name','track_id','latitude','longitude','exact_location','area_sqm','capacity','site_image_file_id','layout_file_id','model_3d_file_id','activation_content_summary','installation_method','dismantling_method','electricity_requirement','electrical_load','internet_requirement','lighting_requirement','guest_route','entry_points','exit_points','nearest_emergency_exit','site_owner','vendor_ref','bad_weather_alternative_plan','site_approval_status','content_approval_status','operational_status','criticality','created_at','created_by','updated_at','updated_by','audit_ref'] },
    { key: 'content_matrix', sheetName: KAG_CONFIG.contentMatrixSheetName, headers: ['content_id','content_code','site_id','activation_name','scenario_type','content_type','content_title','content_description','duration','writing_owner','design_owner','execution_owner','current_version_number','review_status','approval_status','usage_rights','content_source','final_presentation_file_id','operation_manual_file_id','notes','created_at','created_by','updated_at','updated_by'] },
    { key: 'content_versions', sheetName: KAG_CONFIG.contentVersionsSheetName, headers: ['version_id','content_id','version_number','scenario_type','content_type','duration','writing_owner','design_owner','execution_owner','review_status','approval_status','usage_rights','content_source','final_presentation_file_id','operation_manual_file_id','change_summary','submitted_at','reviewed_at','approved_at','approved_by','created_at','created_by','updated_at','updated_by'] },
    { key: 'guest_journey', sheetName: KAG_CONFIG.guestJourneySheetName, headers: ['journey_id','guest_category','invitation_status','attendance_confirmation','arrival_point','parking_plan','transportation_plan','reception_plan','movement_route','seating_area','hospitality_plan','entitled_gift','gift_handover_protocol','departure_plan','primary_owner','alternate_owner','privacy_requirements','protocol_requirements','alternative_plan','evidence_id','approval_id','status','created_at','created_by','updated_at','updated_by'] }
  ];
}

// Manual one-time setup only: run ensureFieldExperienceSheets_ from Apps Script editor when onboarding the Field Experience Center sheets. Do not call from doGet, doPost, or data_sync.
function ensureFieldExperienceSheets_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  getFieldExperienceSheetDefinitions_().forEach(function(def) {
    var created = false;
    var sheet = ss.getSheetByName(def.sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(def.sheetName);
      created = true;
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold');
      if (!sheet.getFilter()) sheet.getRange(1, 1, 1, def.headers.length).createFilter();
      def.headers.forEach(function(header, index) {
        if (['created_at','updated_at','submitted_at','reviewed_at','approved_at'].indexOf(header) !== -1) {
          sheet.getRange(2, index + 1, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('yyyy-mm-dd hh:mm');
        }
      });
    } else {
      addMissingFieldExperienceHeaders_(sheet, def.headers);
    }
    Logger.log((created ? 'Created' : 'Verified') + ' field experience sheet: ' + def.sheetName);
  });
}

function addMissingFieldExperienceHeaders_(sheet, requiredHeaders) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const existingRaw = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const existing = existingRaw.map(function(h) { return String(h || '').trim(); });
  requiredHeaders.forEach(function(header) {
    if (existing.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      existing.push(header);
    }
  });
}

function getEventSitesRows_(ss, warnings) { return readFieldExperienceRows_(ss, KAG_CONFIG.eventSitesSheetName, getFieldExperienceSheetDefinitions_()[0].headers, warnings); }
function getContentMatrixRows_(ss, warnings) { return readFieldExperienceRows_(ss, KAG_CONFIG.contentMatrixSheetName, getFieldExperienceSheetDefinitions_()[1].headers, warnings); }
function getContentVersionsRows_(ss, warnings) { return readFieldExperienceRows_(ss, KAG_CONFIG.contentVersionsSheetName, getFieldExperienceSheetDefinitions_()[2].headers, warnings); }
function getGuestJourneyRows_(ss, warnings) { return readFieldExperienceRows_(ss, KAG_CONFIG.guestJourneySheetName, getFieldExperienceSheetDefinitions_()[3].headers, warnings); }

function buildFieldExperienceData_(ss) {
  const warnings = [];
  return {
    event_sites: getEventSitesRows_(ss, warnings),
    content_matrix: getContentMatrixRows_(ss, warnings),
    content_versions: getContentVersionsRows_(ss, warnings),
    guest_journey: getGuestJourneyRows_(ss, warnings),
    warnings: warnings
  };
}

function readFieldExperienceRows_(ss, sheetName, expectedHeaders, warnings) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) { warnings.push(sheetName + ' sheet is missing.'); return []; }
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const seen = {};
  const headers = values[0].map(function(h, col) {
    const header = String(h || '').trim();
    if (header && seen[header]) { warnings.push(sheetName + ' has duplicate header: ' + header); return ''; }
    if (header) seen[header] = true;
    return header;
  });
  expectedHeaders.forEach(function(header) { if (headers.indexOf(header) === -1) warnings.push(sheetName + ' missing header: ' + header); });
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return String(cell || '').trim() !== ''; });
  }).map(function(row, index) {
    const item = {};
    headers.forEach(function(header, col) { if (header) item[header] = normalizeCell_(row[col]); });
    item.row_number = index + 2;
    item._source = 'google_sheets';
    item._sheet_name = sheetName;
    return item;
  });
}

function ensureRegisterSheet_(sheetName, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    ensureSheetColumns_(sheet, headers);
  }
  return sheet;
}

function ensureSheetColumns_(sheet, requiredHeaders) {
  const existing = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0]
    .map(function(h) { return normalizeHeader_(h); });
  requiredHeaders.forEach(function(header) {
    if (existing.indexOf(normalizeHeader_(header)) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      existing.push(normalizeHeader_(header));
    }
  });
}

function getExistingEscalationRows_(ss) {
  ss = ss || SpreadsheetApp.openById(SPREADSHEET_ID);
  for (var i = 0; i < KAG_CONFIG.escalationRegisterSheetNames.length; i++) {
    const name = KAG_CONFIG.escalationRegisterSheetNames[i];
    const sheet = ss.getSheetByName(name);
    if (sheet) return readRegisterRowsFromSheet_(sheet, name);
  }
  return [];
}

function readRegisterRowsFromSheet_(sheet, sheetName) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function(h) { return normalizeHeader_(h); });
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return String(cell || '').trim() !== ''; });
  }).map(function(row, index) {
    const item = {};
    headers.forEach(function(header, col) {
      item[header || ('col_' + (col + 1))] = normalizeCell_(row[col]);
    });
    item.row_number = index + 2;
    item._source = 'google_sheets';
    item._sheet_name = sheetName;
    return item;
  }).filter(function(item) { return !isTestOrSyntheticRecord_(item); });
}

function deduplicateEscalationsById_(records) {
  const byId = {};
  (records || []).forEach(function(record) {
    const id = String(record.escalation_id || record.esc_number || record.esc || record.id || '').trim();
    if (!id) return;
    const current = byId[id];
    if (!current || escalationSortValue_(record) >= escalationSortValue_(current)) byId[id] = record;
  });
  return Object.keys(byId).map(function(id) { return byId[id]; }).sort(function(a, b) {
    return escalationSortValue_(b) - escalationSortValue_(a);
  });
}

function escalationSortValue_(record) {
  const updated = new Date(record.updated_at || record.updated || record.last_update || record.created_at || record.created || '');
  if (!isNaN(updated.getTime())) return updated.getTime();
  return Number(record.row_number || 0);
}

function getExistingRegisterRows_(ss, sheetName) {
  // data_sync must be read-only: Apps Script / Google Sheets remains the source of truth.
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  return readRegisterRowsFromSheet_(sheet, sheetName);
}

function getRegisterRows_(sheetName, expectedHeaders) {
  const sheet = ensureRegisterSheet_(sheetName, expectedHeaders);
  return readRegisterRowsFromSheet_(sheet, sheetName);
}

function appendMeeting_(payload) {
  const sheet = ensureRegisterSheet_(KAG_CONFIG.meetingsSheetName, getMeetingHeaders_());
  const now = new Date();
  const meeting = {
    meeting_id: payload.meeting_id || nextRegisterId_(sheet, 'MTG'),
    title: payload.title || '',
    date: payload.date || Utilities.formatDate(now, KAG_CONFIG.timezone, 'yyyy-MM-dd'),
    attendees: payload.attendees || '',
    decisions: payload.decisions || '',
    actions: payload.actions || '',
    created_at: now,
    updated_at: now
  };
  sheet.appendRow([meeting.meeting_id, meeting.title, meeting.date, meeting.attendees, meeting.decisions, meeting.actions, meeting.created_at, meeting.updated_at]);
  appendAuditLog_({ action: 'meeting_record', task: meeting.meeting_id, title: meeting.title, updated_by: payload.updated_by || 'PMO', status: 'recorded' });
  return meeting;
}

function nextRegisterId_(sheet, prefix) {
  const nextNumber = Math.max(1, sheet.getLastRow());
  return prefix + '-' + String(nextNumber).padStart(3, '0');
}

function getAssignmentRows_(ss) {
  const sheet = ss ? ss.getSheetByName(KAG_CONFIG.assignmentsSheetName) : ensureAssignmentSheet_();
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function(h) { return normalizeHeader_(h); });
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return String(cell || '').trim() !== ''; });
  }).map(function(row, index) {
    const item = {};
    headers.forEach(function(header, col) {
      item[header || ('col_' + (col + 1))] = normalizeCell_(row[col]);
    });
    item.row_number = index + 2;
    item._source = 'google_sheets';
    item._sheet_name = KAG_CONFIG.assignmentsSheetName;
    return item;
  }).filter(function(item) { return !isTestOrSyntheticRecord_(item); });
}

function appendAssignment_(payload) {
  const sheet = ensureAssignmentSheet_();
  const now = new Date();
  const assignment = {
    assignment_id: payload.assignment_id || nextAssignmentId_(sheet),
    wbs_code: payload.wbs_code || payload.linked_wbs_code || '',
    title: payload.title || payload.task || '',
    path: payload.path || payload.main_path || '',
    owner: payload.owner || payload.assignee || '',
    email: payload.email || payload.assignee_email || '',
    priority: payload.priority || 'متوسط',
    due_date: payload.due_date || '',
    status: payload.status || 'مكلفة',
    deliverable: payload.deliverable || payload.details || payload.description || '',
    details: payload.details || payload.description || '',
    drive_link: payload.drive_link || payload.link || '',
    email_body: payload.email_body || '',
    assigned_by: payload.assigned_by || 'PMO',
    email_sent_at: '',
    created_at: now,
    updated_at: now
  };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return normalizeHeader_(h); });
  const byHeader = {
    assignment_id: assignment.assignment_id,
    wbs_code: assignment.wbs_code,
    title: assignment.title,
    path: assignment.path,
    owner: assignment.owner,
    email: assignment.email,
    deliverable: assignment.deliverable,
    priority: assignment.priority,
    due_date: assignment.due_date,
    drive_link: assignment.drive_link,
    email_body: assignment.email_body,
    status: assignment.status,
    details: assignment.details,
    assigned_by: assignment.assigned_by,
    email_sent_at: assignment.email_sent_at,
    created_at: assignment.created_at,
    updated_at: assignment.updated_at
  };
  sheet.appendRow(headers.map(function(header) { return byHeader.hasOwnProperty(header) ? byHeader[header] : ''; }));

  appendAuditLog_({
    action: 'task_assignment_confirm',
    operation: 'create',
    task: assignment.assignment_id,
    record_ref: assignment.wbs_code || assignment.assignment_id,
    status: assignment.status,
    updated_by: assignment.assigned_by,
    title: assignment.title
  });

  return assignment;
}

function sendAssignmentEmail_(assignment) {
  if (!assignment.email) throw new Error('Missing assignee email');

  const props = PropertiesService.getScriptProperties();
  const pmoEmail = props.getProperty('PMO_EMAIL') || '';
  const subject = `[KAG PMO] تكليف مهمة: ${assignment.title}`;
  const body = [
    `السلام عليكم ${assignment.owner || ''},`,
    '',
    'تم تكليفك بالمهمة التالية من مكتب إدارة المشروع PMO:',
    '',
    `رقم التكليف: ${assignment.assignment_id}`,
    `عنوان المهمة: ${assignment.title}`,
    `الأولوية: ${assignment.priority || '-'}`,
    `تاريخ الاستحقاق: ${assignment.due_date || '-'}`,
    '',
    'التفاصيل والمخرجات المطلوبة:',
    assignment.details || '-',
    '',
    assignment.drive_link ? `رابط الملف/المسار: ${assignment.drive_link}` : '',
    '',
    'يرجى تأكيد الاستلام وتحديث حالة التنفيذ حسب الموعد المحدد.',
    '',
    'تحيات،',
    'PMO'
  ].filter(function(line) { return line !== ''; }).join('\n');

  const mailOptions = {
    to: assignment.email,
    subject: subject,
    body: body,
    name: 'KAG PMO'
  };
  if (pmoEmail) mailOptions.cc = pmoEmail;
  MailApp.sendEmail(mailOptions);

  markAssignmentEmailSent_(assignment.assignment_id);
  assignment.email_sent_at = Utilities.formatDate(new Date(), KAG_CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss');
}

function markAssignmentEmailSent_(assignmentId) {
  const sheet = ensureAssignmentSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(h) { return normalizeHeader_(h); });
  const idCol = headers.indexOf('assignment_id');
  const sentCol = headers.indexOf('email_sent_at');
  const updatedCol = headers.indexOf('updated_at');
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]).trim() === String(assignmentId).trim()) {
      const now = new Date();
      if (sentCol !== -1) sheet.getRange(r + 1, sentCol + 1).setValue(now);
      if (updatedCol !== -1) sheet.getRange(r + 1, updatedCol + 1).setValue(now);
      return;
    }
  }
}

function nextAssignmentId_(sheet) {
  const nextNumber = Math.max(1, sheet.getLastRow());
  return 'ASG-' + String(nextNumber).padStart(3, '0');
}

function getApprovalRows_(ss) {
  const sheet = ss ? ss.getSheetByName(KAG_CONFIG.approvalsSheetName) : ensureApprovalSheet_();
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function(h) { return normalizeHeader_(h); });
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return String(cell || '').trim() !== ''; });
  }).map(function(row, index) {
    const item = {};
    headers.forEach(function(header, col) {
      item[header || ('col_' + (col + 1))] = normalizeCell_(row[col]);
    });
    item.row_number = index + 2;
    item._source = 'google_sheets';
    item._sheet_name = KAG_CONFIG.approvalsSheetName;
    return item;
  }).filter(function(item) { return !isTestOrSyntheticRecord_(item); });
}

function getApprovalHistoryHeaders_() {
  return ['approval_history_id', 'record_type', 'record_id', 'decision', 'approver', 'decision_at', 'notes', 'version'];
}

function ensureApprovalHistorySheet_() {
  return ensureRegisterSheet_(KAG_CONFIG.approvalHistorySheetName, getApprovalHistoryHeaders_());
}


function getAllowedApprovalDecisionMakers_() {
  return [
    { display_name: 'أحمد العامودي', username: 'ahmad.amoudi' },
    { display_name: 'أحمد المحيسن', username: 'ahmad.muhaysin' }
  ].map(function(allowed) {
    const matrixUser = findActiveUser_(allowed.username) || {};
    return Object.assign({}, allowed, { email: String(matrixUser.email || '').trim() });
  });
}

function normalizeApprovalPrincipal_(value) {
  return String(value || '').trim().toLowerCase();
}

function findAllowedApprovalDecisionMaker_(value) {
  const principal = normalizeApprovalPrincipal_(value);
  return getAllowedApprovalDecisionMakers_().find(function(user) {
    return [user.display_name, user.username, user.email].some(function(candidate) {
      return candidate && normalizeApprovalPrincipal_(candidate) === principal;
    });
  });
}

function requireValidApprovalDecisionMaker_(approver) {
  const found = findAllowedApprovalDecisionMaker_(approver);
  if (!found) throw new Error('Invalid approval decision maker');
  return found;
}

function requireAssignedApprovalDecisionMaker_(row, session) {
  const assigned = requireValidApprovalDecisionMaker_(row.approver);
  const currentUsername = normalizeApprovalPrincipal_(session.username);
  const currentEmail = normalizeApprovalPrincipal_(session.email);
  const assignedUsername = normalizeApprovalPrincipal_(assigned.username);
  const assignedEmail = normalizeApprovalPrincipal_(assigned.email);
  const isAssignedUsername = Boolean(assignedUsername) && currentUsername === assignedUsername;
  const isAssignedEmail = Boolean(assignedEmail) && currentEmail === assignedEmail;
  if (!isAssignedUsername && !isAssignedEmail) {
    throw new Error('Forbidden: assigned approver only');
  }
  return assigned;
}

function requireApprovalFields_(approval) {
  ['title', 'type', 'owner', 'follow_up_owner', 'approver', 'version', 'sent_at', 'response_sla_hours', 'status', 'comments_log'].forEach(function(field) {
    if (!String(approval[field] || '').trim()) throw new Error('Missing required approval field: ' + field);
  });
  if ([24, 48].indexOf(Number(approval.response_sla_hours)) === -1) throw new Error('Invalid response SLA hours');
}

function isSuggestionApproval_(row) {
  const marker = String([row.approval_id, row.reference_number, row.record_type, row.type, row.status, row.source, row.is_suggestion].join(' ')).trim();
  return /^SUG/i.test(String(row.approval_id || '')) || /^SUG/i.test(String(row.reference_number || '')) || /(^|\b)SUG/i.test(marker) || String(row.is_suggestion).toUpperCase() === 'TRUE';
}

function isFinalApprovalStatus_(status) {
  return /معتمد نهائيًا من العميل|معتمد نهائيا من العميل|final client approved/i.test(String(status || ''));
}

function hasOfficialApprovalEvidence_(row) {
  return Boolean(String(row.evidence_link || row.official_reference || row.official_evidence || '').trim());
}

function allowedApprovalTransition_(fromStatus, toStatus) {
  if (!toStatus || fromStatus === toStatus) return true;
  const flow = ['مسودة', 'تم إرسال المخرج', 'تحت المراجعة الأولية', 'تحت الاعتماد الداخلي', 'معتمد داخليًا', 'بانتظار الاعتماد النهائي من العميل', 'معتمد نهائيًا من العميل', 'مغلق وموثق'];
  if (toStatus === 'مطلوب تعديل' || toStatus === 'مرفوض') return true;
  if (fromStatus === 'مطلوب تعديل') return toStatus === 'تم إرسال المخرج' || toStatus === 'تحت المراجعة الأولية';
  const fromIndex = flow.indexOf(fromStatus || 'مسودة');
  const toIndex = flow.indexOf(toStatus);
  return fromIndex !== -1 && toIndex === fromIndex + 1;
}

function addBusinessHours_(start, hours) {
  const result = new Date(start);
  var remaining = Number(hours || 24);
  while (remaining > 0) {
    result.setHours(result.getHours() + 1);
    const day = result.getDay();
    const hour = result.getHours();
    if (day !== 5 && day !== 6 && hour >= 9 && hour < 18) remaining--;
  }
  return result;
}

function appendApprovalHistory_(payload) {
  const sheet = ensureApprovalHistorySheet_();
  const nextNumber = Math.max(1, sheet.getLastRow());
  sheet.appendRow([
    'DAH-' + String(nextNumber).padStart(3, '0'),
    payload.record_type || 'اعتماد رسمي',
    payload.record_id || '',
    payload.decision || '',
    payload.approver || '',
    new Date(),
    payload.notes || '',
    payload.version || ''
  ]);
}

function appendApproval_(payload) {
  const sheet = ensureApprovalSheet_();
  const now = new Date();
  const approval = {
    approval_id: payload.approval_id || nextApprovalId_(sheet),
    linked_wbs_code: payload.linked_wbs_code || payload.wbs_code || '',
    type: payload.type || 'اعتماد',
    title: payload.title || payload.approval_title || '',
    requester: payload.requester || payload.requested_by || '',
    approver: payload.approver || '',
    due_date: payload.due_date || '',
    status: payload.status || 'مسودة',
    current_stage: payload.current_stage || payload.stage || 'مسودة',
    sla_hours: payload.sla_hours || payload.response_sla_hours || 24,
    escalation_level: payload.escalation_level || 'L0',
    notes: payload.notes || '',
    created_at: now,
    updated_at: now,
    reference_number: payload.reference_number || payload.approval_id || '',
    owner: payload.owner || payload.approver || '',
    follow_up_owner: payload.follow_up_owner || payload.requester || payload.requested_by || '',
    version: payload.version || 'v1.0',
    comments_log: payload.comments_log || payload.notes || '',
    sent_at: payload.sent_at || '',
    resubmitted_at: payload.resubmitted_at || '',
    response_sla_hours: payload.response_sla_hours || payload.sla_hours || 24,
    response_due_at: payload.response_due_at || '',
    governance_stage: payload.governance_stage || payload.current_stage || payload.stage || 'مسودة',
    client_final_approver: payload.client_final_approver || '',
    evidence_link: payload.evidence_link || '',
    official_reference: payload.official_reference || '',
    closed_at: payload.closed_at || '',
    is_suggestion: payload.is_suggestion || (/^SUG/i.test(String(payload.approval_id || '')) ? 'TRUE' : 'FALSE')
  };
  approval.reference_number = approval.reference_number || approval.approval_id;
  approval.requester = payload.updated_by || payload.requester || payload.requested_by || '';
  approval.approver = requireValidApprovalDecisionMaker_(approval.approver).display_name;
  approval.response_sla_hours = Number(approval.response_sla_hours);
  approval.response_due_at = approval.sent_at ? addBusinessHours_(new Date(approval.sent_at), approval.response_sla_hours) : approval.response_due_at;
  approval.due_date = approval.due_date || approval.response_due_at;
  approval.governance_stage = approval.governance_stage || approval.status;
  if (isFinalApprovalStatus_(approval.status) && !hasOfficialApprovalEvidence_(approval)) throw new Error('Final approval requires official email or meeting minutes evidence');
  requireApprovalFields_(approval);

  sheet.appendRow([
    approval.approval_id, approval.linked_wbs_code, approval.type, approval.title, approval.requester, approval.approver,
    approval.due_date, approval.status, approval.current_stage, approval.sla_hours, approval.escalation_level, approval.notes,
    approval.created_at, approval.updated_at, approval.reference_number, approval.owner, approval.follow_up_owner, approval.version,
    approval.comments_log, approval.sent_at, approval.resubmitted_at, approval.response_sla_hours, approval.response_due_at,
    approval.governance_stage, approval.client_final_approver, approval.evidence_link, approval.official_reference,
    approval.closed_at, approval.is_suggestion
  ]);

  appendAuditLog_({
    action: 'approval_request',
    approval_id: approval.approval_id,
    reference_number: approval.reference_number,
    requester: approval.requester,
    owner: approval.owner,
    follow_up_owner: approval.follow_up_owner,
    approver: approval.approver,
    status: approval.status,
    created_at: approval.created_at,
    title: approval.title,
    updated_by: approval.requester,
    raw_approval_id: approval.approval_id
  });

  appendApprovalHistory_({ record_id: approval.approval_id, decision: approval.status, approver: approval.requester, notes: approval.notes, version: approval.version });

  return approval;
}

function updateApproval_(payload) {
  const sheet = ensureApprovalSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(h) { return normalizeHeader_(h); });
  const idCol = headers.indexOf('approval_id');
  const targetId = String(payload.approval_id || '').trim();
  if (!targetId || idCol === -1) throw new Error('Missing approval_id');

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]).trim() === targetId) {
      const rowNumber = r + 1;
      const current = {};
      headers.forEach(function(header, col) { current[header] = normalizeCell_(values[r][col]); });
      const nextStatus = payload.status || current.status;
      if (!isSuggestionApproval_(current)) requireAssignedApprovalDecisionMaker_(current, payload);
      if (!isSuggestionApproval_(current) && !allowedApprovalTransition_(current.status || 'مسودة', nextStatus)) throw new Error('Invalid approval governance transition');
      const evidenceCandidate = Object.assign({}, current, payload);
      if (!isSuggestionApproval_(current) && isFinalApprovalStatus_(nextStatus) && !hasOfficialApprovalEvidence_(evidenceCandidate)) throw new Error('Final approval requires official email or meeting minutes evidence');
      const now = new Date();
      const isResubmit = nextStatus === 'تم إرسال المخرج' && current.status === 'مطلوب تعديل';
      const sla = payload.response_sla_hours || payload.sla_hours || current.response_sla_hours || current.sla_hours || 24;
      const updates = {
        status: payload.status,
        approver: payload.approver,
        current_stage: payload.current_stage || payload.stage,
        sla_hours: payload.sla_hours,
        escalation_level: payload.escalation_level,
        notes: payload.notes,
        updated_at: now,
        governance_stage: payload.governance_stage || nextStatus,
        evidence_link: payload.evidence_link,
        official_reference: payload.official_reference,
        response_sla_hours: sla,
        response_due_at: (payload.sent_at || payload.resubmitted_at || isResubmit || nextStatus === 'بانتظار الاعتماد النهائي من العميل') ? addBusinessHours_(now, sla) : payload.response_due_at,
        sent_at: payload.sent_at || (nextStatus === 'تم إرسال المخرج' && !current.sent_at ? now : undefined),
        resubmitted_at: payload.resubmitted_at || (isResubmit ? now : undefined),
        version: payload.version || (isResubmit ? 'v' + (Number(String(current.version || 'v1.0').replace(/[^0-9.]/g, '')) + 0.1).toFixed(1) : undefined),
        comments_log: payload.comments_log || payload.notes,
        closed_at: payload.closed_at || (nextStatus === 'مغلق وموثق' ? now : undefined)
      };
      Object.keys(updates).forEach(function(key) {
        if (updates[key] === undefined || updates[key] === '') return;
        const col = headers.indexOf(key);
        if (col !== -1) sheet.getRange(rowNumber, col + 1).setValue(updates[key]);
      });
      appendApprovalHistory_({ record_id: targetId, decision: nextStatus, approver: payload.updated_by || payload.approver || current.approver, notes: payload.notes || '', version: updates.version || current.version });
      appendAuditLog_({
        action: 'approval_update',
        approval_id: targetId,
        previous_status: current.status || '',
        new_status: nextStatus,
        previous_stage: current.governance_stage || current.current_stage || '',
        new_stage: updates.governance_stage || nextStatus,
        decision_by: payload.updated_by || payload.display_name || payload.username || '',
        decision_username: payload.username || '',
        decision_at: now,
        notes: payload.notes || '',
        updated_at: now,
        task: targetId,
        status: nextStatus,
        updated_by: payload.updated_by || payload.username || '',
        title: payload.notes || ''
      });
      return getApprovalRows_().find(function(item) { return item.approval_id === targetId; }) || { approval_id: targetId };
    }
  }

  throw new Error('Approval not found: ' + targetId);
}

function nextApprovalId_(sheet) {
  const nextNumber = Math.max(1, sheet.getLastRow());
  return 'APP-' + String(nextNumber).padStart(3, '0');
}


function getProjectMasterHeaders_() {
  return ['project_id', 'project_name', 'project_prefix', 'prefix_status', 'project_owner', 'opening_date', 'timezone', 'status', 'created_at', 'updated_at', 'approved_by', 'approved_at'];
}

function getProjectSettingsHeaders_() {
  return ['setting_key', 'setting_value', 'status', 'project_id', 'description', 'created_at', 'updated_at', 'approved_by', 'approved_at'];
}

function getCodeSequenceHeaders_() {
  return ['project_id', 'entity_type', 'sequence_key', 'last_sequence', 'updated_at', 'updated_by'];
}

function getCodeRegistryHeaders_() {
  return ['generated_code', 'project_id', 'entity_type', 'wbs_code', 'path_code', 'version', 'code_date', 'sequence', 'created_at', 'created_by', 'source_action', 'notes'];
}

function getCodeMigrationReportHeaders_() {
  return ['detected_at', 'record_type', 'row_number', 'existing_code', 'project_id', 'entity_type', 'compatibility_status', 'issue', 'recommended_action'];
}

function ensureProjectGovernanceSheets_(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureRegisterSheet_(KAG_CONFIG.projectMasterSheetName, getProjectMasterHeaders_());
  ensureRegisterSheet_(KAG_CONFIG.projectSettingsSheetName, getProjectSettingsHeaders_());
  ensureRegisterSheet_(KAG_CONFIG.codeSequencesSheetName, getCodeSequenceHeaders_());
  ensureRegisterSheet_(KAG_CONFIG.codeRegistrySheetName, getCodeRegistryHeaders_());
  ensureRegisterSheet_(KAG_CONFIG.codeMigrationReportSheetName, getCodeMigrationReportHeaders_());
  appendAuditLog_({ action: 'project_governance_ensure', operation: 'sheet_setup', status: 'success', updated_by: payload.updated_by || payload.username || '', result: 'no_email_no_notification' });
  return { sheets: [KAG_CONFIG.projectMasterSheetName, KAG_CONFIG.projectSettingsSheetName, KAG_CONFIG.codeSequencesSheetName, KAG_CONFIG.codeRegistrySheetName, KAG_CONFIG.codeMigrationReportSheetName] };
}

function getProjectMasterRows_(ss) {
  ss = ss || SpreadsheetApp.openById(SPREADSHEET_ID);
  return getExistingRegisterRows_(ss, KAG_CONFIG.projectMasterSheetName);
}

function getProjectSettingsRows_(ss) {
  ss = ss || SpreadsheetApp.openById(SPREADSHEET_ID);
  return getExistingRegisterRows_(ss, KAG_CONFIG.projectSettingsSheetName);
}

function requireCanManageProjectConfig_(session) {
  requireCanManageUsers_(session);
  return true;
}

function upsertProjectMaster_(payload) {
  if (!payload.project_id || !payload.project_name) throw new Error('project_id and project_name are required');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureProjectGovernanceSheets_(payload);
  const sheet = ss.getSheetByName(KAG_CONFIG.projectMasterSheetName);
  const headers = getProjectMasterHeaders_();
  const values = sheet.getDataRange().getValues();
  const id = String(payload.project_id).trim();
  const now = new Date();
  const row = [id, payload.project_name, payload.project_prefix || '', payload.project_prefix ? 'بانتظار اعتماد PMO' : 'غير متاح', payload.project_owner || '', payload.opening_date || '', payload.timezone || KAG_CONFIG.timezone, payload.status || KAG_CONFIG.defaultProjectStatus, now, now, '', ''];
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === id) {
      const previous = JSON.stringify(values[r]);
      headers.forEach(function(header, col) {
        if (col === 8 || col === 10 || col === 11) return;
        sheet.getRange(r + 1, col + 1).setValue(row[col]);
      });
      appendAuditLog_({ action: 'project_master_update', operation: 'write', status: 'success', updated_by: payload.updated_by || payload.username || '', record: id, previous_value: previous, new_value: JSON.stringify(row), result: 'no_email_no_notification' });
      return readProjectById_(ss, id);
    }
  }
  sheet.appendRow(row);
  appendAuditLog_({ action: 'project_master_create', operation: 'write', status: 'success', updated_by: payload.updated_by || payload.username || '', record: id, new_value: JSON.stringify(row), result: 'no_email_no_notification' });
  return readProjectById_(ss, id);
}

function approveProjectPrefix_(payload) {
  if (!payload.project_id || !payload.project_prefix) throw new Error('project_id and approved project_prefix are required; prefix is never inferred');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureProjectGovernanceSheets_(payload);
  const sheet = ss.getSheetByName(KAG_CONFIG.projectMasterSheetName);
  const values = sheet.getDataRange().getValues();
  const id = String(payload.project_id).trim();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === id) {
      const previous = JSON.stringify(values[r]);
      sheet.getRange(r + 1, 3).setValue(String(payload.project_prefix).trim());
      sheet.getRange(r + 1, 4).setValue(KAG_CONFIG.approvedPrefixStatus);
      sheet.getRange(r + 1, 8).setValue(payload.status || 'نشط');
      sheet.getRange(r + 1, 10).setValue(new Date());
      sheet.getRange(r + 1, 11).setValue(payload.updated_by || payload.username || 'PMO');
      sheet.getRange(r + 1, 12).setValue(new Date());
      appendAuditLog_({ action: 'project_prefix_approve', operation: 'write', status: 'success', updated_by: payload.updated_by || payload.username || '', record: id, previous_value: previous, new_value: payload.project_prefix, result: 'no_email_no_notification' });
      return readProjectById_(ss, id);
    }
  }
  throw new Error('Project not found: ' + id);
}

function readProjectById_(ss, projectId) {
  const rows = getProjectMasterRows_(ss);
  return rows.find(function(row) { return String(row.project_id || '').trim() === String(projectId || '').trim(); }) || null;
}

function generateProjectCode_(payload) {
  const entityType = String(payload.entity_type || '').trim();
  if (!entityType) throw new Error('entity_type is required');
  if (KAG_CONFIG.codeEntityTypes.indexOf(entityType) === -1) throw new Error('Unsupported entity_type for central code service');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    ensureProjectGovernanceSheets_(payload);
    const project = readProjectById_(ss, payload.project_id);
    if (!project) throw new Error('Project Master record is required before code generation');
    if (project.prefix_status !== KAG_CONFIG.approvedPrefixStatus || !project.project_prefix) throw new Error('Project prefix is not approved; code generation is blocked');
    const datePart = payload.code_date ? Utilities.formatDate(new Date(payload.code_date), project.timezone || KAG_CONFIG.timezone, 'yyyyMMdd') : Utilities.formatDate(new Date(), project.timezone || KAG_CONFIG.timezone, 'yyyyMMdd');
    const sequenceKey = [project.project_id, entityType, payload.wbs_code || 'NA', payload.path_code || 'NA', payload.version || 'NA', datePart].join('|');
    const seqSheet = ss.getSheetByName(KAG_CONFIG.codeSequencesSheetName);
    const values = seqSheet.getDataRange().getValues();
    var next = 1;
    var targetRow = 0;
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][2]) === sequenceKey) {
        next = Number(values[r][3] || 0) + 1;
        targetRow = r + 1;
        break;
      }
    }
    const seq = String(next).padStart(4, '0');
    const code = [project.project_prefix, entityType.toUpperCase(), payload.wbs_code || '', payload.path_code || '', payload.version || '', datePart, seq].filter(Boolean).join('-');
    if (findExistingGeneratedCode_(ss, code)) throw new Error('Generated code collision detected; no code written');
    if (targetRow) {
      seqSheet.getRange(targetRow, 4).setValue(next);
      seqSheet.getRange(targetRow, 5).setValue(new Date());
      seqSheet.getRange(targetRow, 6).setValue(payload.updated_by || payload.username || '');
    } else {
      seqSheet.appendRow([project.project_id, entityType, sequenceKey, next, new Date(), payload.updated_by || payload.username || '']);
    }
    ss.getSheetByName(KAG_CONFIG.codeRegistrySheetName).appendRow([code, project.project_id, entityType, payload.wbs_code || '', payload.path_code || '', payload.version || '', datePart, next, new Date(), payload.updated_by || payload.username || '', payload.action || 'generate_project_code', payload.notes || '']);
    appendAuditLog_({ action: 'generate_project_code', operation: 'write', status: 'success', updated_by: payload.updated_by || payload.username || '', record: code, new_value: code, result: 'no_email_no_notification' });
    return { generated_code: code, project_id: project.project_id, entity_type: entityType, sequence: next };
  } finally {
    lock.releaseLock();
  }
}

function findExistingGeneratedCode_(ss, code) {
  const sheet = ss.getSheetByName(KAG_CONFIG.codeRegistrySheetName);
  const values = sheet.getDataRange().getValues();
  return values.some(function(row, index) { return index > 0 && String(row[0]).trim() === String(code).trim(); });
}

function buildCodeMigrationReport_(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureProjectGovernanceSheets_(payload);
  const sheet = ss.getSheetByName(KAG_CONFIG.codeMigrationReportSheetName);
  const rows = getTaskRows_(ss);
  const now = new Date();
  const report = rows.map(function(row) {
    const existingCode = getField_(row, WBS_FIELD_ALIASES.taskId);
    const status = existingCode ? 'قابل للمراجعة' : 'غير متاح';
    const issue = existingCode ? 'يتطلب مطابقة مع Project Master قبل أي ترحيل' : 'لا توجد بيانات كافية: كود المهمة مفقود';
    return [now, 'task', row.row_number || '', existingCode || 'غير متاح', payload.project_id || '', payload.entity_type || 'task', status, issue, 'مراجعة يدوية فقط؛ لا يتم تعديل الأكواد الحالية تلقائيًا'];
  });
  if (report.length) sheet.getRange(sheet.getLastRow() + 1, 1, report.length, report[0].length).setValues(report);
  appendAuditLog_({ action: 'code_migration_report', operation: 'read_report', status: 'success', updated_by: payload.updated_by || payload.username || '', result: 'no_email_no_notification', new_value: report.length + ' rows' });
  return { rows_written: report.length, changed_existing_codes: false };
}

function getStaleTasks_() {
  return getTaskRows_().filter(function(row) {
    const status = getField_(row, WBS_FIELD_ALIASES.status);
    const updated = getField_(row, WBS_FIELD_ALIASES.lastUpdate);
    if (String(status).match(/مكتمل|completed|done/i)) return false;
    if (!updated) return true;
    const last = new Date(updated);
    if (isNaN(last.getTime())) return false;
    return daysBetween_(last, new Date()) >= 3;
  }).slice(0, KAG_CONFIG.maxSlackItems);
}

function getCriticalTasks_() {
  return getTaskRows_().filter(function(row) {
    const status = getField_(row, WBS_FIELD_ALIASES.status);
    const priority = getField_(row, WBS_FIELD_ALIASES.priority);
    const risk = getField_(row, WBS_FIELD_ALIASES.risk);
    return String(status + ' ' + priority + ' ' + risk).match(/حرج|متأخر|عالي|critical|late|high|blocked/i);
  }).slice(0, KAG_CONFIG.maxSlackItems);
}

function buildExecutiveSummary_(rows) {
  const total = rows.length;
  const approvals = getApprovalRows_().filter(function(row) { return !isSuggestionApproval_(row); });
  const openApprovals = approvals.filter(function(row) {
    return !String(getField_(row, ['status', 'الحالة'])).match(/معتمد|مرفوض|approved|rejected/i);
  }).length;
  const lateApprovals = approvals.filter(function(row) {
    const status = String(getField_(row, ['status', 'الحالة']));
    const due = new Date(getField_(row, ['due_date', 'due', 'الاستحقاق']));
    return status.match(/متأخر|late|overdue/i) || (!isNaN(due.getTime()) && due < new Date() && !status.match(/معتمد|approved/i));
  }).length;
  const completed = rows.filter(function(row) {
    return String(getField_(row, WBS_FIELD_ALIASES.status)).match(/مكتمل|completed|done/i);
  }).length;
  const late = rows.filter(function(row) {
    return String(getField_(row, WBS_FIELD_ALIASES.status)).match(/متأخر|late|delayed/i);
  }).length;
  const critical = getCriticalTasks_();
  const stale = getStaleTasks_();

  return [
    `إجمالي البنود في مصدر البيانات: ${total}`,
    `المكتمل: ${completed}`,
    `المتأخر/المتعثر حسب البيانات: ${late}`,
    `تحتاج تحديث: ${stale.length}`,
    `الاعتمادات المفتوحة: ${openApprovals}`,
    `الاعتمادات المتأخرة: ${lateApprovals}`,
    '',
    formatTaskList_('أهم البنود الحرجة', critical)
  ].join('\n');
}

function requireSupervisorDashboardAccess_(session) {
  const pages = String((session.allowed_pages || []).join ? session.allowed_pages.join(',') : (session.allowed_pages || '')).split(/[,،]/).map(function(x) { return String(x).trim(); }).filter(Boolean);
  const role = String(session.role || '').toLowerCase();
  const display = String(session.display_name || session.username || '').trim();
  const isPmo = role.indexOf('pmo') !== -1 || pages.indexOf('supervisorDaily') !== -1 || pages.indexOf('*') !== -1 || hasFullAccess_(session);
  const isAhmedAlamoudi = normalizeArabicText_(display).indexOf(normalizeArabicText_('أحمد العامودي')) !== -1;
  if (isPmo || isAhmedAlamoudi) return;
  throw new Error('Forbidden: supervisor dashboard permission required');
}

function normalizeArabicText_(value) {
  return String(value || '').replace(/[\u064B-\u065F\u0670\u200B-\u200F\uFEFF]/g, '').replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildSupervisorDraftPreview_(session) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tasks = getTaskRows_(ss);
  const today = Utilities.formatDate(new Date(), KAG_CONFIG.timezone, 'yyyy-MM-dd');
  const overdue = tasks.filter(function(t) { return isSupervisorOverdueTask_(t, today); });
  const blocked = getDecisionRows_(ss).concat(getApprovalRows_(ss)).filter(function(r) {
    const status = normalizeArabicText_(valueOf_(r, ['status','الحالة','approval_status']));
    return status && ['معتمد','مرفوض','مكتمله','مكتمل','approved','rejected','completed','done'].indexOf(status) === -1;
  });
  const byOwner = {};
  overdue.forEach(function(t) {
    const owner = valueOf_(t, WBS_FIELD_ALIASES.owner) || 'لا توجد بيانات كافية';
    if (!byOwner[owner]) byOwner[owner] = [];
    byOwner[owner].push(t);
  });
  const drafts = Object.keys(byOwner).map(function(owner) {
    const linked = byOwner[owner].map(function(t) { return valueOf_(t, WBS_FIELD_ALIASES.taskId) || ('row_' + t.row_number); });
    return {
      recipient: owner,
      subject: 'مسودة متابعة مهام متأخرة - ' + today,
      body: 'مسودة قابلة للتعديل فقط، ولم يتم إرسالها.\nيرجى تحديث حالة المهام المتأخرة وإرفاق المخرجات المطلوبة.\nالمهام: ' + linked.join(', '),
      linked_tasks: linked
    };
  });
  if (blocked.length) {
    drafts.push({ recipient: 'PMO', subject: 'مسودة تصعيد قرارات واعتمادات معطلة - ' + today, body: 'مسودة قابلة للتعديل فقط، ولم يتم إرسالها.\nتوجد قرارات أو اعتمادات مفتوحة تعطل التنفيذ: ' + blocked.length, linked_tasks: blocked.map(function(r) { return valueOf_(r, ['approval_id','decision_id','linked_wbs_code','id','code']) || ''; }).filter(Boolean) });
  }
  appendAuditLog_({
    action: 'supervisor_draft_preview',
    operation: 'supervisor_draft_preview',
    status: 'success',
    updated_by: session.display_name || session.username,
    record: 'draft_count=' + drafts.length,
    reference: drafts.reduce(function(all, d) { return all.concat(d.linked_tasks || []); }, []).join(','),
    result: 'preview_only_no_email_no_slack',
    riyadh_time: Utilities.formatDate(new Date(), KAG_CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss'),
    draft_count: drafts.length
  });
  return { ok: true, message: 'Draft preview only; no email or Slack sent', drafts: drafts };
}

function isSupervisorOverdueTask_(task, todayKey) {
  const status = normalizeArabicText_(valueOf_(task, WBS_FIELD_ALIASES.status));
  if (['مكتمله','مكتمل','completed','done','ملغاه','ملغي','cancelled','canceled'].indexOf(status) !== -1) return false;
  const end = valueOf_(task, WBS_FIELD_ALIASES.plannedEnd);
  return end && String(end) < todayKey;
}

function valueOf_(obj, names) {
  for (var i = 0; i < names.length; i++) {
    const key = normalizeHeader_(names[i]);
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return '';
}

function appendAuditLog_(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(KAG_CONFIG.auditSheetName) || ss.insertSheet(KAG_CONFIG.auditSheetName);
  const headers = ['timestamp', 'date', 'time', 'user', 'operation', 'record', 'previous_value', 'new_value', 'result', 'reference', 'action', 'status', 'raw_json'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  const now = new Date();
  const safePayload = redactAuditPayload_(payload || {});
  sheet.appendRow([
    now,
    Utilities.formatDate(now, KAG_CONFIG.timezone, 'yyyy-MM-dd'),
    Utilities.formatDate(now, KAG_CONFIG.timezone, 'HH:mm:ss'),
    safePayload.updated_by || safePayload.user || safePayload.username || safePayload.actor_username || '',
    safePayload.operation || safePayload.action || '',
    safePayload.record || safePayload.record_id || safePayload.task || safePayload.approval_id || safePayload.assignment_id || safePayload.title || '',
    safePayload.previous_value || safePayload.previous_status || '',
    safePayload.new_value || safePayload.new_status || safePayload.status || safePayload.percent_complete || safePayload.progress || '',
    safePayload.result || safePayload.status || 'success',
    safePayload.reference || safePayload.record_ref || safePayload.reference_number || safePayload.official_reference || safePayload.evidence_link || '',
    safePayload.action || '',
    safePayload.status || '',
    JSON.stringify(safePayload)
  ]);
}

function redactAuditPayload_(payload) {
  const blocked = /password|secret|token|webhook|key|authorization/i;
  const clean = {};
  Object.keys(payload || {}).forEach(function(key) {
    clean[key] = blocked.test(key) ? '[REDACTED]' : payload[key];
  });
  return clean;
}

function sendSlack_(text) {
  const props = PropertiesService.getScriptProperties();
  const webhook = props.getProperty('SLACK_WEBHOOK_URL');
  if (!webhook) throw new Error('Missing SLACK_WEBHOOK_URL script property');

  const payload = {
    text: text,
    mrkdwn: true
  };

  UrlFetchApp.fetch(webhook, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function getMentions_() {
  const props = PropertiesService.getScriptProperties();
  return {
    pmo: mention_(props.getProperty('PMO_USER_ID')),
    munther: mention_(props.getProperty('MUNTHER_USER_ID')),
    bandar: mention_(props.getProperty('BANDAR_USER_ID')),
    abdulaziz: mention_(props.getProperty('ABDULAZIZ_USER_ID'))
  };
}

function mention_(id) {
  return id ? `<@${id}>` : '';
}

function formatTaskList_(title, rows) {
  if (!rows || rows.length === 0) return `${title}: لا توجد عناصر ظاهرة حاليًا.`;
  const lines = rows.map(function(row, index) {
    const code = getField_(row, WBS_FIELD_ALIASES.taskId) || ('#' + row.row_number);
    const name = getField_(row, WBS_FIELD_ALIASES.taskName) || 'بدون عنوان';
    const owner = getField_(row, WBS_FIELD_ALIASES.owner) || '-';
    const status = getField_(row, WBS_FIELD_ALIASES.status) || '-';
    return `${index + 1}. ${code} - ${name} | المسؤول: ${owner} | الحالة: ${status}`;
  });
  return `${title}:\n${lines.join('\n')}`;
}

function getField_(row, keys) {
  for (var i = 0; i < keys.length; i++) {
    const wanted = normalizeHeader_(keys[i]);
    if (row[wanted] !== undefined && row[wanted] !== '') return row[wanted];
  }
  return '';
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\u0600-\u06FFa-z0-9_]/g, '');
}

function normalizeCell_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, KAG_CONFIG.timezone, 'yyyy-MM-dd');
  }
  return value === null || value === undefined ? '' : String(value).trim();
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function json_(body, statusCode) {
  const output = ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

function isWorkday_() {
  const day = Number(Utilities.formatDate(new Date(), KAG_CONFIG.timezone, 'u'));
  return day === 7 || (day >= 1 && day <= 4);
}

function daysBetween_(from, to) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.floor((to.getTime() - from.getTime()) / ms);
}
