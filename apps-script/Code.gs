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

const KAG_CONFIG = {
  timezone: 'Asia/Riyadh',
  sheetId: '1hymTfPLDR7QX1Rq9e3I4OyZJBpmnHNp4SxEUfjXnBGU',
  defaultTaskSheetNames: ['Tasks', 'WBS', 'Sheet1', 'المهام', 'متابعة الملفات', 'Index'],
  approvalsSheetName: 'Approvals Register',
  approvalChainSheetName: 'Approval Chain Register',
  approvalHistorySheetName: 'Digital Approval History',
  escalationChainSheetName: 'Escalation Chain Register',
  riskGovernanceSheetName: 'Risk Governance Register',
  usersSheetName: 'User Access Matrix',
  assignmentsSheetName: 'PMO Task Distribution',
  meetingsSheetName: 'Meetings Register',
  commitmentsSheetName: 'Commitments Log',
  filesSheetName: 'File Control Register',
  urgentTasksSheetName: 'Urgent Task',
  auditSheetName: 'Audit Log',
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
  const rows = getTaskRows_();
  const approvals = getApprovalRows_();
  const approvalChain = getRegisterRows_(KAG_CONFIG.approvalChainSheetName, getApprovalChainHeaders_());
  const escalationChain = getRegisterRows_(KAG_CONFIG.escalationChainSheetName, getEscalationChainHeaders_());
  const riskGovernance = getRegisterRows_(KAG_CONFIG.riskGovernanceSheetName, getRiskGovernanceHeaders_());
  const assignments = getAssignmentRows_();
  const meetings = getRegisterRows_(KAG_CONFIG.meetingsSheetName, getMeetingHeaders_());
  const commitments = getRegisterRows_(KAG_CONFIG.commitmentsSheetName, getCommitmentHeaders_());
  const files = getRegisterRows_(KAG_CONFIG.filesSheetName, getFileHeaders_());
  const urgentTasks = getUrgentTaskRows_();
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    user: session ? safeUser_(session) : null,
    rows: rows,
    approvals: approvals,
    approval_chain: approvalChain,
    escalation_chain: escalationChain,
    risk_governance: riskGovernance,
    assignments: assignments,
    meetings: meetings,
    commitments: commitments,
    files: files,
    urgent_tasks: urgentTasks
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

    if (payload.action === 'slack_test') {
      requireCanManageUsers_(session);
      sendSlack_('اختبار ربط Slack مع لوحة KAG تم بنجاح.');
      appendAuditLog_({ action: 'slack_test', status: 'sent', updated_by: session.display_name || session.username });
      return json_({ ok: true, message: 'Slack test sent' });
    }

    if (payload.action === 'daily_update') {
      const actorPayload = withActor_(payload, session);
      appendAuditLog_(actorPayload);
      notifyDailyUpdate_(actorPayload);
      return json_({ ok: true, message: 'Update logged and notification sent' });
    }

    if (payload.action === 'approval_request') {
      const item = appendApproval_(withActor_(payload, session));
      return json_({ ok: true, message: 'Approval request logged', approval: item, approvals: getApprovalRows_() });
    }

    if (payload.action === 'approval_update') {
      const item = updateApproval_(withActor_(payload, session));
      return json_({ ok: true, message: 'Approval updated', approval: item, approvals: getApprovalRows_() });
    }

    if (payload.action === 'task_assignment') {
      requireCanManageUsers_(session);
      const item = appendAssignment_(withActor_(payload, session));
      sendAssignmentEmail_(item);
      notifyAssignment_(item);
      return json_({ ok: true, message: 'Assignment logged and email sent', assignment: item });
    }

    if (payload.action === 'meeting_record') {
      requireCanEscalate_(session);
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

function getTaskRows_() {
  const ss = SpreadsheetApp.openById(KAG_CONFIG.sheetId);
  const sheet = findTaskSheet_(ss);
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
    item._sheet_name = sheet.getName();
    return item;
  }).filter(function(item) { return !isTestOrSyntheticRecord_(item); });
}

function findTaskSheet_(ss) {
  const sheets = ss.getSheets();
  for (var i = 0; i < KAG_CONFIG.defaultTaskSheetNames.length; i++) {
    const name = KAG_CONFIG.defaultTaskSheetNames[i];
    const found = sheets.find(function(sheet) { return sheet.getName() === name; });
    if (found) return found;
  }
  return sheets[0];
}

function ensureApprovalSheet_() {
  const ss = SpreadsheetApp.openById(KAG_CONFIG.sheetId);
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
  const ss = SpreadsheetApp.openById(KAG_CONFIG.sheetId);
  const sheet = ss.getSheetByName(KAG_CONFIG.assignmentsSheetName) || ss.insertSheet(KAG_CONFIG.assignmentsSheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'assignment_id',
      'title',
      'owner',
      'email',
      'priority',
      'due_date',
      'status',
      'details',
      'drive_link',
      'assigned_by',
      'email_sent_at',
      'created_at',
      'updated_at'
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
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
    { username: 'ahmad.amoudi', display_name: 'أحمد العمودي', email: 'a.alamoudi@mayadeen.sa', role: 'PMO', access_level: 'full', path_scope: 'all', allowed_pages: all, can_approve: 'TRUE', can_escalate: 'TRUE', can_manage_users: 'TRUE' },
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

function getUrgentTaskSheet_() {
  const ss = SpreadsheetApp.openById(KAG_CONFIG.sheetId);
  return ss.getSheetByName(KAG_CONFIG.urgentTasksSheetName);
}

function getUrgentTaskRows_() {
  const sheet = getUrgentTaskSheet_();
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

function getCommitmentHeaders_() {
  return ['commitment_id', 'owner', 'commitment', 'due_date', 'status', 'source', 'created_at', 'updated_at'];
}

function getFileHeaders_() {
  return ['file_id', 'name', 'owner', 'version', 'link', 'approval_status', 'updated_at', 'notes'];
}

function ensureRegisterSheet_(sheetName, headers) {
  const ss = SpreadsheetApp.openById(KAG_CONFIG.sheetId);
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

function getRegisterRows_(sheetName, expectedHeaders) {
  const sheet = ensureRegisterSheet_(sheetName, expectedHeaders);
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

function getAssignmentRows_() {
  const sheet = ensureAssignmentSheet_();
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
    title: payload.title || payload.task || '',
    owner: payload.owner || payload.assignee || '',
    email: payload.email || payload.assignee_email || '',
    priority: payload.priority || 'متوسط',
    due_date: payload.due_date || '',
    status: payload.status || 'مكلفة',
    details: payload.details || payload.description || '',
    drive_link: payload.drive_link || payload.link || '',
    assigned_by: payload.assigned_by || 'PMO',
    email_sent_at: '',
    created_at: now,
    updated_at: now
  };
  sheet.appendRow([
    assignment.assignment_id,
    assignment.title,
    assignment.owner,
    assignment.email,
    assignment.priority,
    assignment.due_date,
    assignment.status,
    assignment.details,
    assignment.drive_link,
    assignment.assigned_by,
    assignment.email_sent_at,
    assignment.created_at,
    assignment.updated_at
  ]);

  appendAuditLog_({
    action: 'task_assignment',
    task: assignment.assignment_id,
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

function getApprovalRows_() {
  const sheet = ensureApprovalSheet_();
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
    { display_name: 'أحمد العمودي', username: 'ahmad.amoudi' },
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

function getStaleTasks_() {
  return getTaskRows_().filter(function(row) {
    const status = getField_(row, ['status', 'الحالة', 'progress_status']);
    const updated = getField_(row, ['last_update', 'updated', 'آخر تحديث', 'تاريخ التحديث']);
    if (String(status).match(/مكتمل|completed|done/i)) return false;
    if (!updated) return true;
    const last = new Date(updated);
    if (isNaN(last.getTime())) return false;
    return daysBetween_(last, new Date()) >= 3;
  }).slice(0, KAG_CONFIG.maxSlackItems);
}

function getCriticalTasks_() {
  return getTaskRows_().filter(function(row) {
    const status = getField_(row, ['status', 'الحالة', 'schedule_status']);
    const priority = getField_(row, ['priority', 'الأولوية']);
    const risk = getField_(row, ['risk', 'المخاطر', 'blocker', 'المعوقات']);
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
    return String(getField_(row, ['status', 'الحالة', 'progress_status'])).match(/مكتمل|completed|done/i);
  }).length;
  const late = rows.filter(function(row) {
    return String(getField_(row, ['status', 'الحالة', 'schedule_status'])).match(/متأخر|late|delayed/i);
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

function appendAuditLog_(payload) {
  const ss = SpreadsheetApp.openById(KAG_CONFIG.sheetId);
  const sheet = ss.getSheetByName(KAG_CONFIG.auditSheetName) || ss.insertSheet(KAG_CONFIG.auditSheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['timestamp', 'action', 'task', 'status', 'percent_complete', 'blocker', 'updated_by', 'raw_json']);
  }
  sheet.appendRow([
    new Date(),
    payload.action || '',
    payload.task || payload.title || '',
    payload.status || '',
    payload.percent_complete || payload.progress || '',
    payload.blocker || payload.risk || '',
    payload.updated_by || '',
    JSON.stringify(payload)
  ]);
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
    const code = getField_(row, ['code', 'id', 'task_id', 'الكود', 'رقم المهمة']) || ('#' + row.row_number);
    const name = getField_(row, ['name', 'task', 'title', 'المهمة', 'العنوان', 'اسم المهمة']) || 'بدون عنوان';
    const owner = getField_(row, ['owner', 'responsible', 'المسؤول', 'المالك']) || '-';
    const status = getField_(row, ['status', 'الحالة', 'progress_status']) || '-';
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
