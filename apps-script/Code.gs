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

const EXECUTIVE_BOARD_ACCESS_DENIED = 'ليس لديك صلاحية للوصول إلى لوحة المدير العام';
const EXECUTIVE_BOARD_ALLOWED_USERNAMES = ['atheer', 'ahmad.amoudi', 'abdulaziz.obaid', 'abdulrahman.ceo'];

const KAG_CONFIG = {
  timezone: 'Asia/Riyadh',
  sheetId: SPREADSHEET_ID,
  taskSheetName: PRIMARY_WBS_SHEET_NAME,
  approvalsSheetName: 'Approvals Register',
  approvalChainSheetName: 'Approval Chain Register',
  approvalHistorySheetName: 'Digital Approval History',
  escalationChainSheetName: 'Escalation Chain Register',
  escalationRegisterSheetNames: ['Escalations Log', 'Escalation Register', 'Escalations Register'],
  taskEscalationsSheetName: 'Task Escalations',
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
  assetsGiftsSheetName: 'Assets & Gifts',
  guestJourneySheetName: 'Guest Journey',
  defaultProjectStatus: 'بانتظار اعتماد PMO',
  approvedPrefixStatus: 'معتمد',
  codeEntityTypes: ['path', 'task', 'deliverable', 'file', 'version', 'approval', 'decision', 'risk', 'assignment', 'escalation', 'meeting_minutes', 'change_order'],
  maxSlackItems: 8,
  sessionTtlSeconds: 6 * 60 * 60
};

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const session = requireSession_(params);
    requireExecutiveBoardRequestAccess_(session, params);
    return json_(buildDashboardData_(session));
  } catch (err) {
    return json_({ ok: false, success: false, message: publicError_(err), error: publicError_(err), data: null });
  }
}

function buildDashboardData_(session) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const taskRead = readOfficialWbsTasks_(spreadsheet);
  const rows = taskRead.rows;
  const taskHeaders = taskRead.headers;
  const approvals = getApprovalRows_(spreadsheet);
  const approvalChain = getExistingRegisterRows_(spreadsheet, KAG_CONFIG.approvalChainSheetName);
  const escalationChain = getExistingRegisterRows_(spreadsheet, KAG_CONFIG.escalationChainSheetName);
  const escalations = deduplicateEscalationsById_(getExistingEscalationRows_(spreadsheet));
  const riskGovernance = getExistingRegisterRows_(spreadsheet, KAG_CONFIG.riskGovernanceSheetName);
  const assignments = getAssignmentRows_(spreadsheet);
  const meetings = getExistingRegisterRows_(spreadsheet, KAG_CONFIG.meetingsSheetName);
  const commitments = getExistingRegisterRows_(spreadsheet, KAG_CONFIG.commitmentsSheetName);
  const files = getExistingRegisterRows_(spreadsheet, KAG_CONFIG.filesSheetName);
  const urgentTasks = getUrgentTaskRows_(spreadsheet);
  const decisions = getDecisionRows_(spreadsheet);
  const projectMaster = getProjectMasterRows_(spreadsheet);
  const projectSettings = getProjectSettingsRows_(spreadsheet);
  const employeeMaster = getEmployeeMasterRows_(spreadsheet);
  const baselineManagement = buildBaselineManagement_(spreadsheet, rows);
  const raci = buildRaciMatrix_(spreadsheet, rows, employeeMaster);
  const workload = buildEmployeeWorkload_(spreadsheet, rows, employeeMaster);
  const criticalPath = buildCriticalPathAnalysis_(spreadsheet, rows);
  const dataQuality = buildDataQualityCenter_(spreadsheet, rows, employeeMaster, criticalPath);
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
      requireExecutiveBoardRequestAccess_(session, payload);
      return json_(buildDashboardData_(session));
    }

    if (String(payload.page_id || payload.page || payload.target_page || '').trim() === 'executiveBoard') {
      requireExecutiveBoardAccess_(session);
    }

    if (payload.action === 'get_event_sites') {
      requireFieldExperiencePermission_(session, 'read');
      return json_({ ok: true, event_sites: getEventSitesData_(), permissions: getFieldExperiencePermissions_(session) });
    }

    if (payload.action === 'get_content_matrix') {
      requireContentMatrixPermission_(session, 'read');
      return json_(contentMatrixResponse_('تم تحميل مصفوفة المحتوى', { items: getContentMatrixData_(), event_sites: getEventSiteLinkOptions_(), permissions: getContentMatrixPermissions_(session), review_statuses: getContentMatrixReviewStatuses_(), approval_statuses: getContentMatrixApprovalStatuses_() }));
    }

    if (payload.action === 'get_content_item_details') {
      requireContentMatrixPermission_(session, 'read');
      return json_(contentMatrixResponse_('تم تحميل تفاصيل المحتوى', getContentItemDetails_(payload)));
    }

    if (payload.action === 'create_content_item') {
      requireContentMatrixPermission_(session, 'create');
      const item = createContentItem_(withActor_(payload, session), session);
      return json_(contentMatrixResponse_('تم إنشاء مادة المحتوى', { item: item, items: getContentMatrixData_() }));
    }

    if (payload.action === 'update_content_item') {
      requireContentMatrixPermission_(session, 'update');
      const item = updateContentItem_(withActor_(payload, session), session);
      return json_(contentMatrixResponse_('تم تحديث مادة المحتوى', { item: item, items: getContentMatrixData_() }));
    }

    if (payload.action === 'delete_content_item') {
      requireContentMatrixPermission_(session, 'delete');
      const item = deleteContentItem_(withActor_(payload, session), session);
      return json_(contentMatrixResponse_('تم حذف مادة المحتوى حذفًا ناعمًا', { item: item, items: getContentMatrixData_() }));
    }

    if (payload.action === 'get_guest_journeys') {
      requireGuestJourneyPermission_(session, 'read');
      return json_(guestJourneyResponse_('تم تحميل رحلات الضيوف', { items: getGuestJourneysData_(), event_sites: getEventSiteLinkOptions_(), permissions: getGuestJourneyPermissions_(session), statuses: getGuestJourneyStatusLists_() }));
    }
    if (payload.action === 'get_guest_journey_details') {
      requireGuestJourneyPermission_(session, 'read');
      return json_(guestJourneyResponse_('تم تحميل تفاصيل رحلة الضيف', getGuestJourneyDetails_(payload)));
    }
    if (payload.action === 'create_guest_journey') {
      requireGuestJourneyPermission_(session, 'create');
      const journey = createGuestJourney_(withActor_(payload, session), session);
      return json_(guestJourneyResponse_('تم إنشاء رحلة الضيف', { item: journey, items: getGuestJourneysData_(), event_sites: getEventSiteLinkOptions_() }));
    }
    if (payload.action === 'update_guest_journey') {
      requireGuestJourneyPermission_(session, 'update');
      const journey = updateGuestJourney_(withActor_(payload, session), session);
      return json_(guestJourneyResponse_('تم تحديث رحلة الضيف', { item: journey, items: getGuestJourneysData_(), event_sites: getEventSiteLinkOptions_() }));
    }
    if (payload.action === 'delete_guest_journey') {
      requireGuestJourneyPermission_(session, 'delete');
      const journey = deleteGuestJourney_(withActor_(payload, session), session);
      return json_(guestJourneyResponse_('تم حذف رحلة الضيف حذفًا ناعمًا', { item: journey, items: getGuestJourneysData_(), event_sites: getEventSiteLinkOptions_() }));
    }


    if (payload.action === 'get_assets_gifts') {
      requireAssetsGiftsPermission_(session, 'read');
      return json_(assetsGiftsResponse_('تم تحميل الأصول والهدايا', { items: getAssetsGiftsData_(), event_sites: getEventSiteLinkOptions_(), guest_journeys: getGuestJourneyLinkOptions_(), permissions: getAssetsGiftsPermissions_(session), lists: getAssetsGiftsLists_() }));
    }
    if (payload.action === 'get_asset_gift_details') {
      requireAssetsGiftsPermission_(session, 'read');
      return json_(assetsGiftsResponse_('تم تحميل تفاصيل الأصل أو الهدية', getAssetGiftDetails_(payload)));
    }
    if (payload.action === 'create_asset_gift') {
      requireAssetsGiftsPermission_(session, 'create');
      const item = createAssetGift_(withActor_(payload, session), session);
      return json_(assetsGiftsResponse_('تم إنشاء عنصر الأصول والهدايا', { item: item, items: getAssetsGiftsData_() }));
    }
    if (payload.action === 'update_asset_gift') {
      requireAssetsGiftsPermission_(session, 'update');
      const item = updateAssetGift_(withActor_(payload, session), session);
      return json_(assetsGiftsResponse_('تم تحديث عنصر الأصول والهدايا', { item: item, items: getAssetsGiftsData_() }));
    }
    if (payload.action === 'delete_asset_gift') {
      requireAssetsGiftsPermission_(session, 'delete');
      const item = deleteAssetGift_(withActor_(payload, session), session);
      return json_(assetsGiftsResponse_('تم حذف عنصر الأصول والهدايا حذفًا ناعمًا', { item: item, items: getAssetsGiftsData_() }));
    }

    if (payload.action === 'create_event_site') {
      requireFieldExperiencePermission_(session, 'create');
      const site = createEventSite_(withActor_(payload, session), session);
      return json_({ ok: true, event_site: site, event_sites: getEventSitesData_() });
    }

    if (payload.action === 'update_event_site') {
      requireFieldExperiencePermission_(session, 'update');
      const site = updateEventSite_(withActor_(payload, session), session);
      return json_({ ok: true, event_site: site, event_sites: getEventSitesData_() });
    }

    if (payload.action === 'delete_event_site') {
      requireFieldExperiencePermission_(session, 'delete');
      const site = deleteEventSite_(withActor_(payload, session), session);
      return json_({ ok: true, event_site: site, event_sites: getEventSitesData_() });
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

    if (payload.action === 'escalate_overdue_task') {
      const item = escalateOverdueTask_(payload, session);
      return json_({ ok: true, message: 'تم تنفيذ التصعيد.', escalation: item });
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
    return json_({ ok: false, success: false, message: publicError_(err), error: publicError_(err), data: null });
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
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(KAG_CONFIG.approvalsSheetName) || spreadsheet.insertSheet(KAG_CONFIG.approvalsSheetName);
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
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(KAG_CONFIG.assignmentsSheetName) || spreadsheet.insertSheet(KAG_CONFIG.assignmentsSheetName);
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
  const pmPages = 'overview,tasks,phases,timeline,risksMgmt,decisions,approvals,assignments,actions,escalationHub,meetingsHub,pmoAssistant,projectHealth,commitmentsHub,smartReminders,fileControl,analytics';
  const eventPages = 'overview,tasks,phases,timeline,assignments,actions,escalationHub,meetingsHub,projectHealth,commitmentsHub,fileControl';
  const coordinatorPages = 'overview,tasks,phases,timeline,decisions,approvals,assignments,actions,escalationHub,meetingsHub,pmoAssistant,commitmentsHub,smartReminders,fileControl';
  const workstreamPages = 'overview,tasks,phases,timeline,approvals,assignments,meetingsHub,commitmentsHub,fileControl,actions';
  return [
    { username: 'abdulrahman.ceo', display_name: 'عبدالرحمن جار الله', email: '', role: 'الرئيس التنفيذي', access_level: 'executive', path_scope: 'all', allowed_pages: all, can_approve: 'TRUE', can_escalate: 'TRUE', can_manage_users: 'TRUE' },
    { username: 'atheer', display_name: 'أثير الثبيتي', email: '', role: 'admin', access_level: 'full', path_scope: 'all', allowed_pages: all, can_approve: 'TRUE', can_escalate: 'TRUE', can_manage_users: 'TRUE' },
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
  if (pageId === 'executiveBoard') {
    requireExecutiveBoardAccess_(session);
    return;
  }
  const pages = normalizeAllowedPages_(session);
  if (hasFullAccess_(session) || pages.indexOf('*') !== -1 || pages.indexOf(pageId) !== -1) return;
  throw new Error('Forbidden: page permission required for ' + pageId);
}

function isExecutiveBoardAllowedUser_(session) {
  const username = String((session && session.username) || '').trim().toLowerCase();
  return EXECUTIVE_BOARD_ALLOWED_USERNAMES.indexOf(username) !== -1;
}

function requireExecutiveBoardAccess_(session) {
  if (isExecutiveBoardAllowedUser_(session)) return;
  throw new Error(EXECUTIVE_BOARD_ACCESS_DENIED);
}

function requireExecutiveBoardRequestAccess_(session, payload) {
  const requestedPage = String((payload && (payload.page_id || payload.page || payload.target_page)) || '').trim();
  const requestedAction = String((payload && (payload.executive_action || payload.executiveBoardAction)) || '').trim();
  if (requestedPage === 'executiveBoard' || requestedAction) requireExecutiveBoardAccess_(session);
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
    { key: 'content_matrix', sheetName: KAG_CONFIG.contentMatrixSheetName, headers: getContentMatrixHeaders_() },
    { key: 'content_versions', sheetName: KAG_CONFIG.contentVersionsSheetName, headers: ['version_id','content_id','version_number','scenario_type','content_type','duration','writing_owner','design_owner','execution_owner','review_status','approval_status','usage_rights','content_source','final_presentation_file_id','operation_manual_file_id','change_summary','submitted_at','reviewed_at','approved_at','approved_by','created_at','created_by','updated_at','updated_by'] },
    { key: 'guest_journey', sheetName: KAG_CONFIG.guestJourneySheetName, headers: getGuestJourneyHeaders_() }
  ];
}

// Manual one-time setup only: run ensureFieldExperienceSheets_ from Apps Script editor when onboarding the Field Experience Center sheets. Do not call from doGet, doPost, or data_sync.
function ensureFieldExperienceSheets_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  getFieldExperienceSheetDefinitions_().forEach(function(def) {
    var created = false;
    var sheet = spreadsheet.getSheetByName(def.sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(def.sheetName);
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




function getGuestJourneyHeaders_() { return ['journey_id','guest_category','journey_title','linked_site_id','linked_site_name','invitation_status','invitation_reference','confirmation_status','confirmation_date','arrival_point','arrival_time','parking_area','transportation_plan','reception_point','reception_owner','movement_route','seating_area','hospitality_plan','entitled_gift','handover_ceremony','departure_point','departure_time','primary_owner','backup_owner','privacy_requirements','protocol_requirements','accessibility_requirements','security_requirements','contingency_plan','journey_status','approval_status','reference_file','evidence_link','notes','created_by','created_at','updated_by','updated_at','is_deleted']; }
function getGuestJourneyWritableFields_() { return getGuestJourneyHeaders_().filter(function(h){ return ['journey_id','created_by','created_at','updated_by','updated_at','is_deleted'].indexOf(h) === -1; }); }
function getGuestCategoryOptions_() { return ['أمير الرياض','كبار الشخصيات','VIP','الإعلام','الضيوف','الموردون','فرق التشغيل']; }
function getGuestInvitationStatuses_() { return ['لم تُرسل','أُرسلت','بحاجة متابعة','ملغاة']; }
function getGuestConfirmationStatuses_() { return ['غير مؤكد','مؤكد','اعتذر','بانتظار الرد']; }
function getGuestJourneyStatuses_() { return ['مسودة','قيد الإعداد','قيد التنسيق','جاهزة للتنفيذ','نُفذت','مغلقة','متعثرة']; }
function getGuestApprovalStatuses_() { return ['غير مرفوعة','بانتظار الاعتماد','معتمدة','مرفوضة','تحتاج تعديل']; }
function getGuestJourneyStatusLists_() { return { guest_categories:getGuestCategoryOptions_().concat(['أخرى']), invitation_statuses:getGuestInvitationStatuses_(), confirmation_statuses:getGuestConfirmationStatuses_(), journey_statuses:getGuestJourneyStatuses_(), approval_statuses:getGuestApprovalStatuses_() }; }
function guestJourneyResponse_(message, data) { return { ok:true, success:true, message:message||'', data:data||null }; }
function getGuestJourneyPermissions_(session) { return { read:canGuestJourney_(session,'read'), create:canGuestJourney_(session,'create'), update:canGuestJourney_(session,'update'), delete:canGuestJourney_(session,'delete') }; }
function canGuestJourney_(session, op) { if (hasFullAccess_(session)) return true; const pages=normalizeAllowedPages_(session); if(op==='read') return pages.indexOf('fieldExperienceCenter')!==-1 || pages.indexOf('*')!==-1; return pages.indexOf('guest_journey_'+op)!==-1 || pages.indexOf('*')!==-1; }
function requireGuestJourneyPermission_(session, op) { if(!canGuestJourney_(session,op)) throw new Error('Forbidden: guest journey '+op+' permission required'); }
function ensureGuestJourneySheet_() { const ss=SpreadsheetApp.openById(SPREADSHEET_ID); let sheet=ss.getSheetByName(KAG_CONFIG.guestJourneySheetName); if(!sheet){ sheet=ss.insertSheet(KAG_CONFIG.guestJourneySheetName); sheet.getRange(1,1,1,getGuestJourneyHeaders_().length).setValues([getGuestJourneyHeaders_()]); sheet.setFrozenRows(1); sheet.getRange(1,1,1,getGuestJourneyHeaders_().length).setFontWeight('bold'); } else { addMissingFieldExperienceHeaders_(sheet,getGuestJourneyHeaders_()); } return sheet; }
function guestJourneyHeaderMap_(sheet) { const headers=sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getValues()[0].map(function(h){return String(h||'').trim();}); const map={}; headers.forEach(function(h,i){if(h) map[h]=i+1;}); return {headers:headers,map:map}; }
function guestJourneyRowsWithHeaders_(sheet,hi) { const lastRow=sheet.getLastRow(); if(lastRow<2) return []; return sheet.getRange(2,1,lastRow-1,hi.headers.length).getValues().map(function(row,i){ const item={rowNumber:i+2}; hi.headers.forEach(function(h,c){ if(h) item[h]=normalizeCell_(row[c]); }); return item; }); }
function getGuestJourneysData_() { const sheet=ensureGuestJourneySheet_(); const hi=guestJourneyHeaderMap_(sheet); return guestJourneyRowsWithHeaders_(sheet,hi).filter(function(r){ return !parseBool_(r.is_deleted)&&Object.keys(r).some(function(k){return k==='rowNumber'?false:String(r[k]||'').trim()!=='';}); }); }
function getGuestJourneyDetails_(payload) { const id=String(payload.journey_id||'').trim(); if(!id) throw new Error('Missing journey_id'); const rec=getGuestJourneysData_().find(function(r){return String(r.journey_id||'')===id;}); if(!rec) throw new Error('Guest journey not found'); return rec; }
function sanitizeGuestJourneyText_(v) { return String(v===undefined||v===null?'':v).replace(/<[^>]*>|javascript:|script/gi,'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim(); }
function validateGuestJourneyUrl_(v,field) { const s=String(v||'').trim(); if(!s) return; if(!/^https?:\/\/[^\s<>'"]+$/i.test(s)) throw new Error('Invalid URL for '+field); }
function validateGuestJourneyDate_(v,field) { const s=String(v||'').trim(); if(!s) return; if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Invalid date for '+field); }
function validateGuestJourneyTime_(v,field) { const s=String(v||'').trim(); if(!s) return; if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new Error('Invalid time for '+field); }
function cleanGuestJourneyPayload_(payload) { const out={}; getGuestJourneyWritableFields_().forEach(function(f){ out[f]=sanitizeGuestJourneyText_(payload[f]); }); if(String(payload.journey_id||'').trim()&&String(payload.action||'')==='create_guest_journey') throw new Error('journey_id is generated automatically'); ['guest_category','journey_title','arrival_point','primary_owner','contingency_plan','journey_status','approval_status'].forEach(function(f){ if(!out[f]) throw new Error('Missing required field: '+f); }); if(out.guest_category==='أخرى') throw new Error('يجب تحديد فئة الضيف عند اختيار أخرى'); validateEnum_(out.invitation_status||'لم تُرسل',getGuestInvitationStatuses_(),'invitation_status'); validateEnum_(out.confirmation_status||'غير مؤكد',getGuestConfirmationStatuses_(),'confirmation_status'); validateEnum_(out.journey_status,getGuestJourneyStatuses_(),'journey_status'); validateEnum_(out.approval_status,getGuestApprovalStatuses_(),'approval_status'); out.invitation_status=out.invitation_status||'لم تُرسل'; out.confirmation_status=out.confirmation_status||'غير مؤكد'; validateGuestJourneyDate_(out.confirmation_date,'confirmation_date'); validateGuestJourneyTime_(out.arrival_time,'arrival_time'); validateGuestJourneyTime_(out.departure_time,'departure_time'); ['invitation_reference','reference_file','evidence_link'].forEach(function(f){validateGuestJourneyUrl_(out[f],f);}); if(out.linked_site_id){ const site=getEventSiteLinkOptions_().find(function(s){return String(s.linked_site_id)===String(out.linked_site_id);}); if(site) out.linked_site_name=site.linked_site_name; else out.linked_site_name=out.linked_site_name||''; } else { out.linked_site_id=''; out.linked_site_name=''; } return out; }
function guestJourneyDuplicateKey_(r) { return [String(r.guest_category||'').toLowerCase(),String(r.journey_title||'').toLowerCase(),String(r.linked_site_id||'NO_SITE').toLowerCase()].join('|'); }
function findDuplicateGuestJourney_(rows,data,excludeId) { const key=guestJourneyDuplicateKey_(data); return rows.some(function(r){ return guestJourneyDuplicateKey_(r)===key && String(r.journey_id||'')!==String(excludeId||'') && !parseBool_(r.is_deleted); }); }
function createGuestJourney_(payload,session) { const lock=LockService.getScriptLock(); lock.waitLock(20000); try{ const sheet=ensureGuestJourneySheet_(); const hi=guestJourneyHeaderMap_(sheet); const data=cleanGuestJourneyPayload_(payload); const rows=guestJourneyRowsWithHeaders_(sheet,hi); if(findDuplicateGuestJourney_(rows,data,'')) throw new Error('توجد رحلة ضيف مطابقة لنفس الفئة والعنوان والموقع'); const now=new Date(); const id='GJ-'+Utilities.getUuid(); const actor=session.display_name||session.username; const rec=Object.assign({},data,{journey_id:id,created_by:actor,created_at:now,updated_by:actor,updated_at:now,is_deleted:false}); sheet.appendRow(hi.headers.map(function(h){return rec[h]!==undefined?rec[h]:'';})); appendGuestJourneyAudit_('CREATE_GUEST_JOURNEY',session,id,{},rec); return rec; } finally{ lock.releaseLock(); } }
function updateGuestJourney_(payload,session) { const lock=LockService.getScriptLock(); lock.waitLock(20000); try{ const id=String(payload.journey_id||'').trim(); if(!id) throw new Error('Missing journey_id'); const sheet=ensureGuestJourneySheet_(); const hi=guestJourneyHeaderMap_(sheet); const rows=guestJourneyRowsWithHeaders_(sheet,hi); const current=rows.find(function(r){return String(r.journey_id||'')===id&&!parseBool_(r.is_deleted);}); if(!current) throw new Error('Guest journey not found'); const data=cleanGuestJourneyPayload_(payload); if(findDuplicateGuestJourney_(rows,data,id)) throw new Error('توجد رحلة ضيف مطابقة لنفس الفئة والعنوان والموقع'); const oldValues={}; const newValues={}; getGuestJourneyWritableFields_().forEach(function(f){ if(!hi.map[f]) return; oldValues[f]=current[f]||''; newValues[f]=data[f]; sheet.getRange(current.rowNumber,hi.map[f]).setValue(data[f]); }); const now=new Date(); if(hi.map.updated_at) sheet.getRange(current.rowNumber,hi.map.updated_at).setValue(now); if(hi.map.updated_by) sheet.getRange(current.rowNumber,hi.map.updated_by).setValue(session.display_name||session.username); const rec=Object.assign({},current,newValues,{updated_at:now,updated_by:session.display_name||session.username}); appendGuestJourneyAudit_('UPDATE_GUEST_JOURNEY',session,id,oldValues,newValues); return rec; } finally{ lock.releaseLock(); } }
function deleteGuestJourney_(payload,session) { const lock=LockService.getScriptLock(); lock.waitLock(20000); try{ const id=String(payload.journey_id||'').trim(); if(!id) throw new Error('Missing journey_id'); const sheet=ensureGuestJourneySheet_(); const hi=guestJourneyHeaderMap_(sheet); const rows=guestJourneyRowsWithHeaders_(sheet,hi); const current=rows.find(function(r){return String(r.journey_id||'')===id&&!parseBool_(r.is_deleted);}); if(!current) throw new Error('Guest journey not found'); const now=new Date(); if(hi.map.is_deleted) sheet.getRange(current.rowNumber,hi.map.is_deleted).setValue(true); if(hi.map.updated_at) sheet.getRange(current.rowNumber,hi.map.updated_at).setValue(now); if(hi.map.updated_by) sheet.getRange(current.rowNumber,hi.map.updated_by).setValue(session.display_name||session.username); const next={is_deleted:true,updated_at:now,updated_by:session.display_name||session.username}; appendGuestJourneyAudit_('DELETE_GUEST_JOURNEY',session,id,current,next); return Object.assign({},current,next); } finally{ lock.releaseLock(); } }
function appendGuestJourneyAudit_(action,session,journeyId,oldValues,newValues) { appendAuditLog_({ user:session.username, updated_by:session.display_name||session.username, action:action, operation:action, record:journeyId, entity_type:'Guest Journey', entity_id:journeyId, timestamp:new Date(), previous_value:JSON.stringify(oldValues||{}), new_value:JSON.stringify(newValues||{}), result:'success', reference:'Guest Journey' }); }

function getContentMatrixHeaders_() {
  return ['content_id','content_name','content_type','linked_site_id','linked_site_name','main_scenario','alternative_scenario_1','alternative_scenario_2','national_identity','mapping_3d','introductory_video','mayor_speech','screens_content','scripts_text','voice_over','music','translation','language','material_duration','writing_owner','design_owner','execution_owner','version_number','review_status','approval_status','usage_rights','content_source','final_presentation_file','operation_guide','notes','created_by','created_at','updated_by','updated_at','is_deleted'];
}
function getContentMatrixWritableFields_() { return getContentMatrixHeaders_().filter(function(h){ return ['content_id','created_by','created_at','updated_by','updated_at','is_deleted'].indexOf(h) === -1; }); }
function getContentMatrixReviewStatuses_() { return ['لم تبدأ','قيد الإعداد','قيد المراجعة','يحتاج تعديل','مكتمل']; }
function getContentMatrixApprovalStatuses_() { return ['غير مرفوع','بانتظار الاعتماد','معتمد','مرفوض']; }
function contentMatrixResponse_(message, data) { return { ok: true, success: true, message: message || '', data: data || null }; }
function getContentMatrixPermissions_(session) { return { read: canContentMatrix_(session,'read'), create: canContentMatrix_(session,'create'), update: canContentMatrix_(session,'update'), delete: canContentMatrix_(session,'delete') }; }
function canContentMatrix_(session, op) {
  if (hasFullAccess_(session)) return true;
  const pages = normalizeAllowedPages_(session);
  if (op === 'read') return pages.indexOf('fieldExperienceCenter') !== -1 || pages.indexOf('*') !== -1;
  return pages.indexOf('field_experience_content_' + op) !== -1 || pages.indexOf('*') !== -1 || canFieldExperience_(session, op);
}
function requireContentMatrixPermission_(session, op) { if (!canContentMatrix_(session, op)) throw new Error('Forbidden: content matrix ' + op + ' permission required'); }
function ensureContentMatrixSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(KAG_CONFIG.contentMatrixSheetName);
  if (!sheet) { sheet = ss.insertSheet(KAG_CONFIG.contentMatrixSheetName); sheet.getRange(1, 1, 1, getContentMatrixHeaders_().length).setValues([getContentMatrixHeaders_()]); sheet.setFrozenRows(1); sheet.getRange(1,1,1,getContentMatrixHeaders_().length).setFontWeight('bold'); }
  else addMissingFieldExperienceHeaders_(sheet, getContentMatrixHeaders_());
  return sheet;
}
function contentMatrixHeaderMap_(sheet) { const headers = sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getValues()[0].map(function(h){return String(h||'').trim();}); const map={}; headers.forEach(function(h,i){if(h) map[h]=i+1;}); return {headers:headers,map:map}; }
function contentMatrixRowsWithHeaders_(sheet, hi) { const lastRow=sheet.getLastRow(); if(lastRow<2) return []; return sheet.getRange(2,1,lastRow-1,hi.headers.length).getValues().map(function(row,i){ const item={rowNumber:i+2}; hi.headers.forEach(function(h,c){ if(h) item[h]=normalizeCell_(row[c]); }); return item; }); }
function getContentMatrixData_() { const sheet=ensureContentMatrixSheet_(); const hi=contentMatrixHeaderMap_(sheet); return contentMatrixRowsWithHeaders_(sheet,hi).filter(function(r){return !parseBool_(r.is_deleted)&&Object.keys(r).some(function(k){return k==='rowNumber'?false:String(r[k]||'').trim()!=='';});}); }
function getContentItemDetails_(payload) { const id=String(payload.content_id||'').trim(); if(!id) throw new Error('Missing content_id'); const rec=getContentMatrixData_().find(function(r){return String(r.content_id||'')===id;}); if(!rec) throw new Error('Content item not found'); return rec; }
function sanitizeContentText_(v) { return String(v===undefined||v===null?'':v).replace(/<[^>]*>|javascript:|script/gi,'').replace(/\s+/g,' ').trim(); }
function validateContentUrl_(v, field) { const s=String(v||'').trim(); if(!s) return; if(!/^https?:\/\/[^\s<>'"]+$/i.test(s)) throw new Error('Invalid URL for '+field); }
function cleanContentPayload_(payload) { const out={}; getContentMatrixWritableFields_().forEach(function(f){ out[f]=sanitizeContentText_(payload[f]); }); ['content_name','content_type','main_scenario','version_number','review_status','approval_status'].forEach(function(f){ if(!out[f]) throw new Error('Missing required field: '+f); }); validateEnum_(out.review_status, getContentMatrixReviewStatuses_(), 'review_status'); validateEnum_(out.approval_status, getContentMatrixApprovalStatuses_(), 'approval_status'); ['introductory_video','mapping_3d','final_presentation_file','operation_guide','content_source'].forEach(function(f){ validateContentUrl_(out[f], f); }); const siteId=out.linked_site_id; if(siteId){ const site=getEventSiteLinkOptions_().find(function(s){return String(s.linked_site_id)===String(siteId);}); if(site) out.linked_site_name=site.linked_site_name; } else { out.linked_site_name=''; } return out; }
function findDuplicateContentItem_(rows, name, version, excludeId) { const n=String(name||'').toLowerCase(); const v=String(version||'').toLowerCase(); return rows.some(function(r){ return String(r.content_name||'').toLowerCase()===n && String(r.version_number||'').toLowerCase()===v && String(r.content_id||'')!==String(excludeId||'') && !parseBool_(r.is_deleted); }); }
function createContentItem_(payload, session) { const lock=LockService.getScriptLock(); lock.waitLock(20000); try{ const sheet=ensureContentMatrixSheet_(); const hi=contentMatrixHeaderMap_(sheet); const data=cleanContentPayload_(payload); const rows=contentMatrixRowsWithHeaders_(sheet,hi); if(findDuplicateContentItem_(rows,data.content_name,data.version_number,'')) throw new Error('يوجد محتوى بنفس الاسم ورقم الإصدار'); const now=new Date(); const id='CONTENT-'+Utilities.getUuid(); const actor=session.display_name||session.username; const rec=Object.assign({},data,{content_id:id,created_by:actor,created_at:now,updated_by:actor,updated_at:now,is_deleted:false}); sheet.appendRow(hi.headers.map(function(h){return rec[h]!==undefined?rec[h]:'';})); appendContentMatrixAudit_('CREATE_CONTENT_ITEM',session,id,{},rec); return rec; } finally{ lock.releaseLock(); } }
function updateContentItem_(payload, session) { const lock=LockService.getScriptLock(); lock.waitLock(20000); try{ const id=String(payload.content_id||'').trim(); if(!id) throw new Error('Missing content_id'); const sheet=ensureContentMatrixSheet_(); const hi=contentMatrixHeaderMap_(sheet); const rows=contentMatrixRowsWithHeaders_(sheet,hi); const current=rows.find(function(r){return String(r.content_id||'')===id&&!parseBool_(r.is_deleted);}); if(!current) throw new Error('Content item not found'); const data=cleanContentPayload_(payload); if(findDuplicateContentItem_(rows,data.content_name,data.version_number,id)) throw new Error('يوجد محتوى بنفس الاسم ورقم الإصدار'); const oldValues={}; getContentMatrixWritableFields_().forEach(function(f){ if(!hi.map[f]) return; oldValues[f]=current[f]||''; sheet.getRange(current.rowNumber,hi.map[f]).setValue(data[f]); }); const now=new Date(); if(hi.map.updated_at) sheet.getRange(current.rowNumber,hi.map.updated_at).setValue(now); if(hi.map.updated_by) sheet.getRange(current.rowNumber,hi.map.updated_by).setValue(session.display_name||session.username); const rec=Object.assign({},current,data,{updated_at:now,updated_by:session.display_name||session.username}); appendContentMatrixAudit_('UPDATE_CONTENT_ITEM',session,id,oldValues,data); return rec; } finally{ lock.releaseLock(); } }
function deleteContentItem_(payload, session) { const lock=LockService.getScriptLock(); lock.waitLock(20000); try{ const id=String(payload.content_id||'').trim(); if(!id) throw new Error('Missing content_id'); const sheet=ensureContentMatrixSheet_(); const hi=contentMatrixHeaderMap_(sheet); const rows=contentMatrixRowsWithHeaders_(sheet,hi); const current=rows.find(function(r){return String(r.content_id||'')===id&&!parseBool_(r.is_deleted);}); if(!current) throw new Error('Content item not found'); const now=new Date(); if(hi.map.is_deleted) sheet.getRange(current.rowNumber,hi.map.is_deleted).setValue(true); if(hi.map.updated_at) sheet.getRange(current.rowNumber,hi.map.updated_at).setValue(now); if(hi.map.updated_by) sheet.getRange(current.rowNumber,hi.map.updated_by).setValue(session.display_name||session.username); const next={is_deleted:true,updated_at:now,updated_by:session.display_name||session.username}; appendContentMatrixAudit_('DELETE_CONTENT_ITEM',session,id,current,next); return Object.assign({},current,next); } finally{ lock.releaseLock(); } }
function getEventSiteLinkOptions_() { return getEventSitesData_().map(function(s){ return { linked_site_id: s.site_id || '', linked_site_name: s.site_name || s.activation_name || s.site_code || '' }; }).filter(function(s){return s.linked_site_id;}); }
function appendContentMatrixAudit_(action, session, contentId, oldValues, newValues) { appendAuditLog_({ user: session.username, updated_by: session.display_name||session.username, action: action, operation: action, record: contentId, entity_type: 'Content Matrix', entity_id: contentId, timestamp: new Date(), previous_value: JSON.stringify(oldValues||{}), new_value: JSON.stringify(newValues||{}), result: 'success', reference: 'Content Matrix' }); }


function getAssetsGiftsHeaders_() { return ['asset_id','asset_type','category','item_name','item_description','sku_or_reference','serial_number','quantity_planned','quantity_received','quantity_prepared','quantity_distributed','quantity_remaining','unit','beneficiary_category','linked_site_id','linked_site_name','linked_journey_id','linked_journey_title','supplier_name','purchase_order_reference','delivery_status','receiving_status','preparation_status','distribution_status','custody_owner','custody_reference','storage_location','storage_condition','distribution_plan','expected_delivery_date','actual_receiving_date','preparation_date','distribution_date','recipient_name','recipient_category','handover_method','handover_evidence','return_required','expected_return_date','actual_return_date','condition_before','condition_after','loss_or_damage_status','loss_or_damage_details','final_status','approval_status','reference_file','evidence_link','notes','created_by','created_at','updated_by','updated_at','is_deleted']; }
function getAssetsGiftsWritableFields_() { return getAssetsGiftsHeaders_().filter(function(h){ return ['asset_id','quantity_remaining','created_by','created_at','updated_by','updated_at','is_deleted'].indexOf(h)===-1; }); }
function getAssetsGiftsLists_(){ return { asset_types:['أصل تشغيلي','هدية'], categories:{'أصل تشغيلي':['أجهزة ومعدات','أثاث وتجهيزات','شاشات وتقنيات عرض','أدوات تشغيل','أجهزة اتصال','تجهيزات استقبال','مواد قابلة للإرجاع','أخرى'], 'هدية':['هدايا كبار الشخصيات','هدايا الضيوف','هدايا الإعلام','هدايا البروتوكول','هدايا تذكارية','مواد توزيع','أخرى']}, beneficiary_categories:['أمير الرياض','كبار الشخصيات','VIP','الإعلام','الضيوف','الموردون','فرق التشغيل','الموظفون','الزوار','غير محدد','أخرى'], delivery_statuses:['غير مطلوب','لم يبدأ','قيد التوريد','متأخر','تم التوريد جزئيًا','تم التوريد بالكامل','ملغى'], receiving_statuses:['غير مستلم','مستلم جزئيًا','مستلم بالكامل','مرفوض','تحت الفحص','غير مطلوب'], preparation_statuses:['لم يبدأ','قيد التجهيز','جاهز','متعثر','غير مطلوب'], distribution_statuses:['لم يبدأ','قيد التوزيع','موزع جزئيًا','موزع بالكامل','متوقف','غير مطلوب'], final_statuses:['مسودة','قيد الإعداد','قيد التوريد','قيد التجهيز','جاهز للتوزيع','قيد الاستخدام','موزع','مسترد','مغلق','متعثر','مفقود','تالف','ملغى'], approval_statuses:['غير مرفوع','بانتظار الاعتماد','معتمد','مرفوض','يحتاج تعديل'], loss_or_damage_statuses:['سليم','مفقود','تالف جزئيًا','تالف بالكامل','تحت الفحص','غير منطبق']}; }
function assetsGiftsResponse_(message,data){ return { ok:true, success:true, message:message||'', data:data||null }; }
function getAssetsGiftsPermissions_(session){ return { read:canAssetsGifts_(session,'read'), create:canAssetsGifts_(session,'create'), update:canAssetsGifts_(session,'update'), delete:canAssetsGifts_(session,'delete') }; }
function canAssetsGifts_(session,op){ if(hasFullAccess_(session)) return true; const pages=normalizeAllowedPages_(session); if(op==='read') return pages.indexOf('fieldExperienceCenter')!==-1 || pages.indexOf('*')!==-1; return pages.indexOf('assets_gifts_'+op)!==-1 || pages.indexOf('*')!==-1; }
function requireAssetsGiftsPermission_(session,op){ if(!canAssetsGifts_(session,op)) throw new Error('Forbidden: assets gifts '+op+' permission required'); }
function ensureAssetsGiftsSheet_(){ const ss=SpreadsheetApp.openById(SPREADSHEET_ID); let sheet=ss.getSheetByName(KAG_CONFIG.assetsGiftsSheetName); const headers=getAssetsGiftsHeaders_(); if(!sheet){ sheet=ss.insertSheet(KAG_CONFIG.assetsGiftsSheetName); sheet.getRange(1,1,1,headers.length).setValues([headers]); sheet.setFrozenRows(1); sheet.getRange(1,1,1,headers.length).setFontWeight('bold'); } else { addMissingFieldExperienceHeaders_(sheet,headers); } return sheet; }
function assetsGiftsHeaderMap_(sheet){ const headers=sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getValues()[0].map(function(h){return String(h||'').trim();}); const map={}; headers.forEach(function(h,i){if(h) map[h]=i+1;}); return {headers:headers,map:map}; }
function assetsGiftsRowsWithHeaders_(sheet,hi){ const lastRow=sheet.getLastRow(); if(lastRow<2) return []; return sheet.getRange(2,1,lastRow-1,hi.headers.length).getValues().map(function(row,i){ const item={rowNumber:i+2}; hi.headers.forEach(function(h,c){ if(h) item[h]=normalizeCell_(row[c]); }); item.quantity_remaining=computeAssetsGiftsRemaining_(item.quantity_received,item.quantity_distributed); return item; }); }
function getAssetsGiftsData_(){ const sheet=ensureAssetsGiftsSheet_(); const hi=assetsGiftsHeaderMap_(sheet); return assetsGiftsRowsWithHeaders_(sheet,hi).filter(function(r){ return !parseBool_(r.is_deleted)&&Object.keys(r).some(function(k){return k==='rowNumber'?false:String(r[k]||'').trim()!=='';}); }); }
function getAssetGiftDetails_(payload){ const id=String(payload.asset_id||'').trim(); if(!id) throw new Error('Missing asset_id'); const rec=getAssetsGiftsData_().find(function(r){return String(r.asset_id||'')===id;}); if(!rec) throw new Error('Asset or gift not found'); return rec; }
function sanitizeAssetsGiftsText_(v){ return String(v===undefined||v===null?'':v).replace(/<[^>]*>|javascript:|data:|script/gi,'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim(); }
function validateAssetsGiftsUrl_(v,field){ const s=String(v||'').trim(); if(!s) return; if(!/^https:\/\/[^\s<>'"]+$/i.test(s)) throw new Error('رابط غير صالح في '+field); }
function validateAssetsGiftsDate_(v,field){ const s=String(v||'').trim(); if(!s) return; if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('تاريخ غير صالح في '+field); }
function assetsGiftsNumber_(v,field,requiredPositive){ const s=String(v===undefined||v===null?'':v).trim(); if(!s) return 0; if(!/^(?:\d+|\d+\.\d+)$/.test(s)) throw new Error('يجب أن تكون '+field+' رقمًا غير سالب'); const n=Number(s); if(!isFinite(n)||isNaN(n)||n<0) throw new Error('يجب أن تكون '+field+' رقمًا غير سالب'); if(requiredPositive&&n<=0) throw new Error('quantity_planned يجب أن تكون أكبر من صفر'); return n; }
function computeAssetsGiftsRemaining_(received,distributed){ return Math.max(0, assetsGiftsNumber_(received,'quantity_received',false)-assetsGiftsNumber_(distributed,'quantity_distributed',false)); }
function cleanAssetGiftPayload_(payload){ if(String(payload.asset_id||'').trim()&&String(payload.action||'')==='create_asset_gift') throw new Error('asset_id يتم توليده تلقائيًا'); const out={}; getAssetsGiftsWritableFields_().forEach(function(f){ out[f]=sanitizeAssetsGiftsText_(payload[f]); }); const lists=getAssetsGiftsLists_(); ['asset_type','category','item_name','quantity_planned','unit','custody_owner','storage_location','delivery_status','receiving_status','preparation_status','distribution_status','final_status','approval_status'].forEach(function(f){ if(!out[f]) throw new Error('الحقل إلزامي: '+f); }); validateEnum_(out.asset_type,lists.asset_types,'asset_type'); if(out.category==='أخرى') throw new Error('يجب إدخال وصف التصنيف عند اختيار أخرى'); if(out.beneficiary_category==='أخرى') throw new Error('يجب إدخال وصف الفئة المستفيدة عند اختيار أخرى'); validateEnum_(out.delivery_status,lists.delivery_statuses,'delivery_status'); validateEnum_(out.receiving_status,lists.receiving_statuses,'receiving_status'); validateEnum_(out.preparation_status,lists.preparation_statuses,'preparation_status'); validateEnum_(out.distribution_status,lists.distribution_statuses,'distribution_status'); validateEnum_(out.final_status,lists.final_statuses,'final_status'); validateEnum_(out.approval_status,lists.approval_statuses,'approval_status'); if(out.loss_or_damage_status) validateEnum_(out.loss_or_damage_status,lists.loss_or_damage_statuses,'loss_or_damage_status'); out.quantity_planned=assetsGiftsNumber_(out.quantity_planned,'quantity_planned',true); out.quantity_received=assetsGiftsNumber_(out.quantity_received,'quantity_received',false); out.quantity_prepared=assetsGiftsNumber_(out.quantity_prepared,'quantity_prepared',false); out.quantity_distributed=assetsGiftsNumber_(out.quantity_distributed,'quantity_distributed',false); if(out.quantity_prepared>out.quantity_received) throw new Error('لا يمكن أن تتجاوز الكمية المجهزة الكمية المستلمة'); if(out.quantity_distributed>out.quantity_received) throw new Error('لا يمكن أن تتجاوز الكمية الموزعة الكمية المستلمة'); out.quantity_remaining=computeAssetsGiftsRemaining_(out.quantity_received,out.quantity_distributed); out.return_required=parseBool_(payload.return_required); ['purchase_order_reference','custody_reference','handover_evidence','reference_file','evidence_link'].forEach(function(f){ validateAssetsGiftsUrl_(out[f],f); }); ['expected_delivery_date','actual_receiving_date','preparation_date','distribution_date','expected_return_date','actual_return_date'].forEach(function(f){ validateAssetsGiftsDate_(out[f],f); }); if(out.linked_site_id){ const site=getEventSiteLinkOptions_().find(function(s){return String(s.linked_site_id)===String(out.linked_site_id);}); if(site) out.linked_site_name=site.linked_site_name; } else { out.linked_site_id=''; out.linked_site_name=''; } if(out.linked_journey_id){ const journey=getGuestJourneyLinkOptions_().find(function(j){return String(j.linked_journey_id)===String(out.linked_journey_id);}); if(journey) out.linked_journey_title=journey.linked_journey_title; } else { out.linked_journey_id=''; out.linked_journey_title=''; } return out; }
function assetGiftDuplicateKey_(r){ return [String(r.asset_type||'').toLowerCase(),String(r.item_name||'').toLowerCase(),String(r.sku_or_reference||'NO_REFERENCE').toLowerCase(),String(r.linked_site_id||'NO_SITE').toLowerCase()].join('|'); }
function findDuplicateAssetGift_(rows,data,excludeId){ const key=assetGiftDuplicateKey_(data); return rows.some(function(r){ return assetGiftDuplicateKey_(r)===key && String(r.asset_id||'')!==String(excludeId||'') && !parseBool_(r.is_deleted); }); }
function findDuplicateAssetSerial_(rows,serial,excludeId){ const s=String(serial||'').trim().toLowerCase(); if(!s) return false; return rows.some(function(r){ return String(r.serial_number||'').trim().toLowerCase()===s && String(r.asset_id||'')!==String(excludeId||'') && !parseBool_(r.is_deleted); }); }
function createAssetGift_(payload,session){ const lock=LockService.getScriptLock(); lock.waitLock(20000); try{ const sheet=ensureAssetsGiftsSheet_(); const hi=assetsGiftsHeaderMap_(sheet); const data=cleanAssetGiftPayload_(payload); const rows=assetsGiftsRowsWithHeaders_(sheet,hi); if(findDuplicateAssetGift_(rows,data,'')) throw new Error('يوجد عنصر مكرر بنفس النوع والاسم والمرجع والموقع'); if(findDuplicateAssetSerial_(rows,data.serial_number,'')) throw new Error('الرقم التسلسلي مستخدم في سجل آخر'); const now=new Date(); const id='AG-'+Utilities.getUuid(); const actor=session.display_name||session.username; const rec=Object.assign({},data,{asset_id:id,created_by:actor,created_at:now,updated_by:actor,updated_at:now,is_deleted:false}); sheet.appendRow(hi.headers.map(function(h){return rec[h]!==undefined?rec[h]:'';})); appendAssetsGiftsAudit_('CREATE_ASSET_GIFT',session,id,{},rec); return rec; } finally{ lock.releaseLock(); } }
function updateAssetGift_(payload,session){ const lock=LockService.getScriptLock(); lock.waitLock(20000); try{ const id=String(payload.asset_id||'').trim(); if(!id) throw new Error('Missing asset_id'); const sheet=ensureAssetsGiftsSheet_(); const hi=assetsGiftsHeaderMap_(sheet); const rows=assetsGiftsRowsWithHeaders_(sheet,hi); const current=rows.find(function(r){return String(r.asset_id||'')===id&&!parseBool_(r.is_deleted);}); if(!current) throw new Error('Asset or gift not found'); const data=cleanAssetGiftPayload_(payload); if(findDuplicateAssetGift_(rows,data,id)) throw new Error('يوجد عنصر مكرر بنفس النوع والاسم والمرجع والموقع'); if(findDuplicateAssetSerial_(rows,data.serial_number,id)) throw new Error('الرقم التسلسلي مستخدم في سجل آخر'); const oldValues={}; getAssetsGiftsWritableFields_().concat(['quantity_remaining']).forEach(function(f){ if(!hi.map[f]) return; oldValues[f]=current[f]||''; sheet.getRange(current.rowNumber,hi.map[f]).setValue(data[f]); }); const now=new Date(); if(hi.map.updated_at) sheet.getRange(current.rowNumber,hi.map.updated_at).setValue(now); if(hi.map.updated_by) sheet.getRange(current.rowNumber,hi.map.updated_by).setValue(session.display_name||session.username); const rec=Object.assign({},current,data,{updated_at:now,updated_by:session.display_name||session.username}); appendAssetsGiftsAudit_('UPDATE_ASSET_GIFT',session,id,oldValues,data); return rec; } finally{ lock.releaseLock(); } }
function deleteAssetGift_(payload,session){ const lock=LockService.getScriptLock(); lock.waitLock(20000); try{ const id=String(payload.asset_id||'').trim(); if(!id) throw new Error('Missing asset_id'); const sheet=ensureAssetsGiftsSheet_(); const hi=assetsGiftsHeaderMap_(sheet); const rows=assetsGiftsRowsWithHeaders_(sheet,hi); const current=rows.find(function(r){return String(r.asset_id||'')===id&&!parseBool_(r.is_deleted);}); if(!current) throw new Error('Asset or gift not found'); const now=new Date(); if(hi.map.is_deleted) sheet.getRange(current.rowNumber,hi.map.is_deleted).setValue(true); if(hi.map.updated_at) sheet.getRange(current.rowNumber,hi.map.updated_at).setValue(now); if(hi.map.updated_by) sheet.getRange(current.rowNumber,hi.map.updated_by).setValue(session.display_name||session.username); const next={is_deleted:true,updated_at:now,updated_by:session.display_name||session.username}; appendAssetsGiftsAudit_('DELETE_ASSET_GIFT',session,id,current,next); return Object.assign({},current,next); } finally{ lock.releaseLock(); } }
function getGuestJourneyLinkOptions_(){ return getGuestJourneysData_().map(function(j){ return { linked_journey_id:j.journey_id||'', linked_journey_title:j.journey_title||'' }; }).filter(function(j){return j.linked_journey_id;}); }
function appendAssetsGiftsAudit_(action,session,assetId,oldValues,newValues){ appendAuditLog_({ user:session.username, updated_by:session.display_name||session.username, action:action, operation:action, record:assetId, entity_type:'Assets & Gifts', entity_id:assetId, timestamp:new Date(), previous_value:JSON.stringify(oldValues||{}), new_value:JSON.stringify(newValues||{}), result:'success', reference:'Assets & Gifts' }); }

function getEventSiteHeaders_() {
  return ['site_id','site_code','garden_name','zone_number','site_name','activation_name','track_id','latitude','longitude','exact_location','area_sqm','capacity','site_image_file_id','layout_file_id','model_3d_file_id','activation_content_summary','installation_method','dismantling_method','electricity_requirement','electrical_load','internet_requirement','lighting_requirement','guest_route','entry_points','exit_points','nearest_emergency_exit','site_owner','vendor_ref','bad_weather_alternative_plan','site_approval_status','content_approval_status','operational_status','criticality','created_at','created_by','updated_at','updated_by','audit_ref'];
}

function getEventSiteWritableFields_() {
  return ['site_code','garden_name','zone_number','site_name','activation_name','track_id','latitude','longitude','exact_location','area_sqm','capacity','site_image_file_id','layout_file_id','model_3d_file_id','activation_content_summary','installation_method','dismantling_method','electricity_requirement','electrical_load','internet_requirement','lighting_requirement','guest_route','entry_points','exit_points','nearest_emergency_exit','site_owner','vendor_ref','bad_weather_alternative_plan','site_approval_status','content_approval_status','operational_status','criticality'];
}

function getFieldExperiencePermissions_(session) {
  return {
    read: canFieldExperience_(session, 'read'),
    create: canFieldExperience_(session, 'create'),
    update: canFieldExperience_(session, 'update'),
    delete: canFieldExperience_(session, 'delete')
  };
}

function canFieldExperience_(session, op) {
  if (hasFullAccess_(session)) return true;
  const pages = normalizeAllowedPages_(session);
  if (op === 'read') return pages.indexOf('fieldExperienceCenter') !== -1 || pages.indexOf('*') !== -1;
  return pages.indexOf('field_experience_sites_' + op) !== -1 || pages.indexOf('*') !== -1;
}

function requireFieldExperiencePermission_(session, op) {
  if (canFieldExperience_(session, op)) return;
  throw new Error('Forbidden: field experience ' + op + ' permission required');
}

function getEventSitesData_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(KAG_CONFIG.eventSitesSheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(h) { return String(h || '').trim(); });
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  return values.filter(function(row) {
    if (!row.some(function(cell) { return String(cell || '').trim() !== ''; })) return false;
    const deletedIndex = headers.indexOf('is_deleted');
    return deletedIndex === -1 || !parseBool_(row[deletedIndex]);
  }).map(function(row, index) {
    const item = {};
    headers.forEach(function(header, col) { if (header) item[header] = normalizeCell_(row[col]); });
    item.row_number = index + 2;
    return item;
  });
}

function ensureEventSitesSoftDeleteColumns_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(KAG_CONFIG.eventSitesSheetName);
  if (!sheet) throw new Error('Event Sites sheet not found');
  addMissingFieldExperienceHeaders_(sheet, ['is_deleted','deleted_at','deleted_by']);
  return sheet;
}

function getEventSitesSheetForWrite_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(KAG_CONFIG.eventSitesSheetName);
  if (!sheet) throw new Error('Event Sites sheet not found');
  return sheet;
}

function eventSiteHeaderMap_(sheet) {
  const lastColumn = sheet.getLastColumn();
  const headers = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(h) { return String(h || '').trim(); }) : [];
  const map = {};
  headers.forEach(function(h, i) { if (h) map[h] = i + 1; });
  return { headers: headers, map: map };
}

function cleanEventSitePayload_(payload, isCreate) {
  const allowed = getEventSiteWritableFields_();
  const out = {};
  allowed.forEach(function(field) {
    var v = payload[field];
    if (v === undefined || v === null) v = '';
    if (typeof v === 'string') v = v.replace(/<[^>]*>|javascript:|script/gi, '').replace(/\s+/g, ' ').trim();
    out[field] = v;
  });
  ['site_code','garden_name','zone_number','site_name','site_owner','operational_status'].forEach(function(field) { if (!String(out[field] || '').trim()) throw new Error('Missing required field: ' + field); });
  validateEnum_(out.operational_status, ['Not Started','In Progress','Ready','Blocked','Completed','Cancelled'], 'operational_status');
  validateEnum_(out.site_approval_status, ['','Draft','Under Review','Approved','Rejected','Needs Update'], 'site_approval_status');
  validateEnum_(out.content_approval_status, ['','Not Started','Under Review','Approved','Rejected','Needs Update'], 'content_approval_status');
  validateEnum_(out.criticality, ['','Low','Medium','High','Critical'], 'criticality');
  validateEnum_(out.electricity_requirement, ['','Not Required','Required','TBD'], 'electricity_requirement');
  validateEnum_(out.internet_requirement, ['','Not Required','Required','TBD'], 'internet_requirement');
  validateEnum_(out.lighting_requirement, ['','Not Required','Required','TBD'], 'lighting_requirement');
  validateNumberRange_(out.latitude, -90, 90, 'latitude');
  validateNumberRange_(out.longitude, -180, 180, 'longitude');
  validateNonNegativeNumber_(out.area_sqm, 'area_sqm');
  validateNonNegativeInteger_(out.capacity, 'capacity');
  return out;
}
function validateEnum_(value, allowed, field) { if (allowed.indexOf(String(value || '')) === -1) throw new Error('Invalid value for ' + field); }
function validateNumberRange_(value, min, max, field) { if (value === '') return; const n = Number(value); if (!isFinite(n) || n < min || n > max) throw new Error('Invalid value for ' + field); }
function validateNonNegativeNumber_(value, field) { if (value === '') return; const n = Number(value); if (!isFinite(n) || n < 0) throw new Error('Invalid value for ' + field); }
function validateNonNegativeInteger_(value, field) { if (value === '') return; const n = Number(value); if (!isFinite(n) || n < 0 || Math.floor(n) !== n) throw new Error('Invalid value for ' + field); }

function eventSiteRowsWithHeaders_(sheet, headerInfo) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headerInfo.headers.length).getValues();
  return values.map(function(row, i) {
    const item = { rowNumber: i + 2, row: row };
    headerInfo.headers.forEach(function(h, c) { if (h) item[h] = normalizeCell_(row[c]); });
    return item;
  });
}

function findDuplicateEventSiteCode_(rows, code, excludeId) {
  const wanted = String(code || '').trim().toLowerCase();
  return rows.some(function(r) { return String(r.site_code || '').trim().toLowerCase() === wanted && String(r.site_id || '') !== String(excludeId || '') && !parseBool_(r.is_deleted); });
}

function createEventSite_(payload, session) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sheet = getEventSitesSheetForWrite_();
    const hi = eventSiteHeaderMap_(sheet);
    const data = cleanEventSitePayload_(payload, true);
    const rows = eventSiteRowsWithHeaders_(sheet, hi);
    if (findDuplicateEventSiteCode_(rows, data.site_code, '')) throw new Error('Duplicate site_code');
    const now = new Date();
    const siteId = 'SITE-' + Utilities.getUuid();
    const row = hi.headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
    if (hi.map.site_id) row[hi.map.site_id - 1] = siteId;
    if (hi.map.created_at) row[hi.map.created_at - 1] = now;
    if (hi.map.created_by) row[hi.map.created_by - 1] = session.display_name || session.username;
    if (hi.map.updated_at) row[hi.map.updated_at - 1] = now;
    if (hi.map.updated_by) row[hi.map.updated_by - 1] = session.display_name || session.username;
    sheet.appendRow(row);
    const rec = Object.assign({}, data, { site_id: siteId, created_at: now, created_by: session.display_name || session.username, updated_at: now, updated_by: session.display_name || session.username });
    appendEventSiteAudit_('CREATE_EVENT_SITE', session, siteId, {}, rec);
    return rec;
  } finally { lock.releaseLock(); }
}

function updateEventSite_(payload, session) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const siteId = String(payload.site_id || '').trim(); if (!siteId) throw new Error('Missing site_id');
    const sheet = getEventSitesSheetForWrite_(); const hi = eventSiteHeaderMap_(sheet);
    const rows = eventSiteRowsWithHeaders_(sheet, hi); const current = rows.find(function(r) { return String(r.site_id || '') === siteId && !parseBool_(r.is_deleted); });
    if (!current) throw new Error('Event site not found');
    const data = cleanEventSitePayload_(payload, false);
    if (findDuplicateEventSiteCode_(rows, data.site_code, siteId)) throw new Error('Duplicate site_code');
    const oldValues = {}; const newValues = {};
    getEventSiteWritableFields_().forEach(function(f) { if (!hi.map[f]) return; oldValues[f] = current[f] || ''; newValues[f] = data[f]; sheet.getRange(current.rowNumber, hi.map[f]).setValue(data[f]); });
    const now = new Date();
    if (hi.map.updated_at) sheet.getRange(current.rowNumber, hi.map.updated_at).setValue(now);
    if (hi.map.updated_by) sheet.getRange(current.rowNumber, hi.map.updated_by).setValue(session.display_name || session.username);
    appendEventSiteAudit_('UPDATE_EVENT_SITE', session, siteId, oldValues, newValues);
    return Object.assign({}, current, newValues, { updated_at: now, updated_by: session.display_name || session.username });
  } finally { lock.releaseLock(); }
}

function deleteEventSite_(payload, session) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const siteId = String(payload.site_id || '').trim(); if (!siteId) throw new Error('Missing site_id');
    const sheet = ensureEventSitesSoftDeleteColumns_(); const hi = eventSiteHeaderMap_(sheet);
    const rows = eventSiteRowsWithHeaders_(sheet, hi); const current = rows.find(function(r) { return String(r.site_id || '') === siteId && !parseBool_(r.is_deleted); });
    if (!current) throw new Error('Event site not found');
    const now = new Date();
    sheet.getRange(current.rowNumber, hi.map.is_deleted).setValue(true);
    sheet.getRange(current.rowNumber, hi.map.deleted_at).setValue(now);
    sheet.getRange(current.rowNumber, hi.map.deleted_by).setValue(session.display_name || session.username);
    appendEventSiteAudit_('DELETE_EVENT_SITE', session, siteId, current, { is_deleted: true, deleted_at: now, deleted_by: session.display_name || session.username });
    return { site_id: siteId, is_deleted: true };
  } finally { lock.releaseLock(); }
}

function appendEventSiteAudit_(action, session, siteId, oldValues, newValues) {
  appendAuditLog_({ user: session.username, updated_by: session.display_name || session.username, action: action, operation: action, record: siteId, entity_type: 'Event Site', entity_id: siteId, timestamp: new Date(), old_values: oldValues, new_values: newValues, source: 'Dashboard', previous_value: JSON.stringify(oldValues || {}), new_value: JSON.stringify(newValues || {}), result: 'success' });
}


function getTaskEscalationHeaders_() {
  return ['Escalation ID', 'Task ID', 'Task Name', 'Current Owner', 'Escalated By', 'Escalated To', 'Escalation Date', 'Reason', 'Status', 'Created At'];
}

function isOverdueTaskEscalationUser_(session) {
  const username = String((session && session.username) || '').trim().toLowerCase();
  return ['ahmad.amoudi', 'atheer'].indexOf(username) !== -1;
}

function requireOverdueTaskEscalationUser_(session) {
  if (isOverdueTaskEscalationUser_(session)) return;
  throw new Error('ليس لديك صلاحية تنفيذ التصعيد.');
}

function isTaskOverdueForEscalation_(task) {
  const status = String(getField_(task, WBS_FIELD_ALIASES.status) || getField_(task, WBS_FIELD_ALIASES.computedStatus) || '').toLowerCase();
  if (status.match(/مكتمل|completed|done|closed/)) return false;
  if (status.match(/متأخر|متاخر|overdue|late|delayed/)) return true;
  const dueRaw = getField_(task, WBS_FIELD_ALIASES.plannedEnd);
  if (!dueRaw) return false;
  const due = new Date(dueRaw);
  if (isNaN(due.getTime())) return false;
  const todayKey = Utilities.formatDate(new Date(), KAG_CONFIG.timezone, 'yyyy-MM-dd');
  const dueKey = Utilities.formatDate(due, KAG_CONFIG.timezone, 'yyyy-MM-dd');
  return dueKey < todayKey;
}

function findOfficialTaskForEscalation_(taskId) {
  const wanted = String(taskId || '').trim();
  if (!wanted) throw new Error('Missing task_id');
  const taskRead = readOfficialWbsTasks_(SpreadsheetApp.openById(SPREADSHEET_ID));
  const task = taskRead.rows.find(function(row) {
    return String(getField_(row, WBS_FIELD_ALIASES.taskId) || row.row_number || '').trim() === wanted;
  });
  if (!task) throw new Error('Task not found');
  return task;
}

function sendOverdueTaskEscalationEmail_(item) {
  const to = 'A.alobed@mayadeen.sa';
  if (!to) return;
  const body = [
    'السلام عليكم عبدالعزيز العبيد،',
    '',
    'تم تصعيد مهمة متأخرة إليكم من منصة Mayadeen Project Command Center:',
    '',
    'اسم المهمة: ' + (item.task_name || '-'),
    'رقم المهمة: ' + (item.task_id || '-'),
    'المسؤول الحالي: ' + (item.current_owner || '-'),
    'تاريخ الاستحقاق: ' + (item.due_date || '-'),
    'قام بالتصعيد: ' + (item.escalated_by || '-'),
    'سبب التصعيد: ' + (item.reason || '-'),
    item.notes ? ('ملاحظات إضافية: ' + item.notes) : '',
    '',
    'مع التحية'
  ].join('\n');
  MailApp.sendEmail({ to: to, subject: '[Mayadeen] تصعيد مهمة متأخرة: ' + (item.task_id || ''), body: body, name: 'Mayadeen Command Center' });
}

function escalateOverdueTask_(payload, session) {
  requireOverdueTaskEscalationUser_(session);
  const task = findOfficialTaskForEscalation_(payload.task_id || payload.taskId);
  if (!isTaskOverdueForEscalation_(task)) throw new Error('لا يمكن تصعيد مهمة غير متأخرة.');
  const sheet = ensureRegisterSheet_(KAG_CONFIG.taskEscalationsSheetName, getTaskEscalationHeaders_());
  const now = new Date();
  const escalationId = 'TES-' + Utilities.getUuid();
  const taskId = String(getField_(task, WBS_FIELD_ALIASES.taskId) || '').trim();
  const taskName = String(getField_(task, WBS_FIELD_ALIASES.taskName) || '').trim();
  const currentOwner = String(getField_(task, WBS_FIELD_ALIASES.owner) || '').trim();
  const actor = session.display_name || session.username;
  const item = {
    escalation_id: escalationId,
    task_id: taskId,
    task_name: taskName,
    current_owner: currentOwner,
    escalated_by: actor,
    escalated_to: 'عبدالعزيز العبيد',
    escalated_to_username: 'abdulaziz.obaid',
    escalation_date: Utilities.formatDate(now, KAG_CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss'),
    reason: String(payload.reason || '').trim() || 'تصعيد مهمة متأخرة إلى عبدالعزيز العبيد',
    notes: String(payload.notes || '').trim(),
    status: 'Open',
    created_at: now,
    due_date: getField_(task, WBS_FIELD_ALIASES.plannedEnd) || ''
  };
  sheet.appendRow([item.escalation_id, item.task_id, item.task_name, item.current_owner, item.escalated_by, item.escalated_to, item.escalation_date, item.reason, item.status, item.created_at]);
  appendAuditLog_({ action: 'ESCALATE_OVERDUE_TASK', operation: 'escalate', record: item.task_id, title: item.task_name, updated_by: actor, escalated_to: item.escalated_to, reference: item.escalation_id, status: 'success' });
  try { sendOverdueTaskEscalationEmail_(item); } catch (mailErr) { Logger.log('Overdue task escalation email skipped/failed: ' + mailErr); }
  return item;
}

function ensureRegisterSheet_(sheetName, headers) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
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
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureProjectGovernanceSheets_(payload);
  const sheet = spreadsheet.getSheetByName(KAG_CONFIG.projectMasterSheetName);
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
      return readProjectById_(spreadsheet, id);
    }
  }
  sheet.appendRow(row);
  appendAuditLog_({ action: 'project_master_create', operation: 'write', status: 'success', updated_by: payload.updated_by || payload.username || '', record: id, new_value: JSON.stringify(row), result: 'no_email_no_notification' });
  return readProjectById_(spreadsheet, id);
}

function approveProjectPrefix_(payload) {
  if (!payload.project_id || !payload.project_prefix) throw new Error('project_id and approved project_prefix are required; prefix is never inferred');
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureProjectGovernanceSheets_(payload);
  const sheet = spreadsheet.getSheetByName(KAG_CONFIG.projectMasterSheetName);
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
      return readProjectById_(spreadsheet, id);
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
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    ensureProjectGovernanceSheets_(payload);
    const project = readProjectById_(spreadsheet, payload.project_id);
    if (!project) throw new Error('Project Master record is required before code generation');
    if (project.prefix_status !== KAG_CONFIG.approvedPrefixStatus || !project.project_prefix) throw new Error('Project prefix is not approved; code generation is blocked');
    const datePart = payload.code_date ? Utilities.formatDate(new Date(payload.code_date), project.timezone || KAG_CONFIG.timezone, 'yyyyMMdd') : Utilities.formatDate(new Date(), project.timezone || KAG_CONFIG.timezone, 'yyyyMMdd');
    const sequenceKey = [project.project_id, entityType, payload.wbs_code || 'NA', payload.path_code || 'NA', payload.version || 'NA', datePart].join('|');
    const seqSheet = spreadsheet.getSheetByName(KAG_CONFIG.codeSequencesSheetName);
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
    if (findExistingGeneratedCode_(spreadsheet, code)) throw new Error('Generated code collision detected; no code written');
    if (targetRow) {
      seqSheet.getRange(targetRow, 4).setValue(next);
      seqSheet.getRange(targetRow, 5).setValue(new Date());
      seqSheet.getRange(targetRow, 6).setValue(payload.updated_by || payload.username || '');
    } else {
      seqSheet.appendRow([project.project_id, entityType, sequenceKey, next, new Date(), payload.updated_by || payload.username || '']);
    }
    spreadsheet.getSheetByName(KAG_CONFIG.codeRegistrySheetName).appendRow([code, project.project_id, entityType, payload.wbs_code || '', payload.path_code || '', payload.version || '', datePart, next, new Date(), payload.updated_by || payload.username || '', payload.action || 'generate_project_code', payload.notes || '']);
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
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureProjectGovernanceSheets_(payload);
  const sheet = spreadsheet.getSheetByName(KAG_CONFIG.codeMigrationReportSheetName);
  const rows = getTaskRows_(spreadsheet);
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
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tasks = getTaskRows_(spreadsheet);
  const today = Utilities.formatDate(new Date(), KAG_CONFIG.timezone, 'yyyy-MM-dd');
  const overdue = tasks.filter(function(t) { return isSupervisorOverdueTask_(t, today); });
  const blocked = getDecisionRows_(spreadsheet).concat(getApprovalRows_(spreadsheet)).filter(function(r) {
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
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(KAG_CONFIG.auditSheetName) || spreadsheet.insertSheet(KAG_CONFIG.auditSheetName);
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
