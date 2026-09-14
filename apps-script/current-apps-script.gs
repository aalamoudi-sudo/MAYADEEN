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
  phase:['المرحلة','مرحلة المشروع','المراحل','phase','project_phase','stage','PMBOK','مرحلة المهمة حسب PMBOK','مرحلة PMBOK'],
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
  executionOwner:['مسؤول المسار','path_owner','track_owner','workstream_owner','جهة التنفيذ أو المالك','جهة التنفيذ','execution_owner','implementing_party','owner_entity','المالك'],
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
  const syncStartedAt = new Date();
  const syncVersion = Utilities.getUuid();
  const profile = { spreadsheet_open_ms: 0, datasets: [] };
  const spreadsheetOpenStartedAt = new Date().getTime();
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  profile.spreadsheet_open_ms = new Date().getTime() - spreadsheetOpenStartedAt;
  const taskRead = timedDashboardOperation_(profile, 'wbs', function() { return readOfficialWbsTasks_(spreadsheet); });
  const rows = taskRead.rows;
  const taskHeaders = taskRead.headers;
  const approvals = timedDashboardOperation_(profile, 'approvals', function() { return getApprovalRows_(spreadsheet); });
  const approvalChain = timedDashboardOperation_(profile, 'approval_chain', function() { return getExistingRegisterRows_(spreadsheet, KAG_CONFIG.approvalChainSheetName); });
  const escalationChain = timedDashboardOperation_(profile, 'escalation_chain', function() { return getExistingRegisterRows_(spreadsheet, KAG_CONFIG.escalationChainSheetName); });
  const escalations = timedDashboardOperation_(profile, 'escalations', function() { return deduplicateEscalationsById_(getExistingEscalationRows_(spreadsheet)); });
  const riskGovernance = timedDashboardOperation_(profile, 'risk_governance', function() { return getExistingRegisterRows_(spreadsheet, KAG_CONFIG.riskGovernanceSheetName); });
  const assignments = timedDashboardOperation_(profile, 'assignments', function() { return getAssignmentRows_(spreadsheet); });
  const meetings = timedDashboardOperation_(profile, 'meetings', function() { return getExistingRegisterRows_(spreadsheet, KAG_CONFIG.meetingsSheetName); });
  const commitments = timedDashboardOperation_(profile, 'commitments', function() { return getExistingRegisterRows_(spreadsheet, KAG_CONFIG.commitmentsSheetName); });
  const files = timedDashboardOperation_(profile, 'files', function() { return getExistingRegisterRows_(spreadsheet, KAG_CONFIG.filesSheetName); });
  const urgentTasks = timedDashboardOperation_(profile, 'urgent_tasks', function() { return getUrgentTaskRows_(spreadsheet); });
  const decisions = timedDashboardOperation_(profile, 'decisions', function() { return getDecisionRows_(spreadsheet); });
  const projectMaster = timedDashboardOperation_(profile, 'project_master', function() { return getProjectMasterRows_(spreadsheet); });
  const projectSettings = timedDashboardOperation_(profile, 'project_settings', function() { return getProjectSettingsRows_(spreadsheet); });
  const employeeMaster = timedDashboardOperation_(profile, 'employee_master', function() { return getEmployeeMasterRows_(spreadsheet); });
  const baselineManagement = timedDashboardOperation_(profile, 'baseline_management', function() { return buildBaselineManagement_(spreadsheet, rows); });
  const raci = timedDashboardOperation_(profile, 'raci_matrix', function() { return buildRaciMatrix_(spreadsheet, rows, employeeMaster); });
  const criticalPath = timedDashboardOperation_(profile, 'critical_path', function() { return buildCriticalPathAnalysis_(spreadsheet, rows); });
  const workload = timedDashboardOperation_(profile, 'employee_workload', function() { return buildEmployeeWorkload_(spreadsheet, rows, employeeMaster, criticalPath); });
  const dataQuality = timedDashboardOperation_(profile, 'data_quality', function() { return buildDataQualityCenter_(spreadsheet, rows, employeeMaster, criticalPath); });
  const response = {
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
      sync_version: syncVersion,
      sync_started_at: syncStartedAt.toISOString(),
      sync_finished_at: new Date().toISOString(),
      duration_ms: new Date().getTime() - syncStartedAt.getTime(),
      last_sync_at: Utilities.formatDate(new Date(), KAG_CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss'),
      rows_read: rows.length,
      risk_rows_read: riskGovernance.length,
      connection_status: 'connected',
      performance: profile
    })
  };
  const serializationStartedAt = new Date().getTime();
  // Measure the real UTF-8 payload (Arabic text is not one byte per JS character).
  response.sync_meta.response_bytes = Utilities.newBlob(JSON.stringify(response)).getBytes().length;
  profile.serialization_ms = new Date().getTime() - serializationStartedAt;
  response.sync_meta.sync_finished_at = new Date().toISOString();
  response.sync_meta.duration_ms = new Date().getTime() - syncStartedAt.getTime();
  // Include the newly attached measurement fields in the final payload estimate.
  response.sync_meta.response_bytes = Utilities.newBlob(JSON.stringify(response)).getBytes().length;
  Logger.log('[data_sync_profile] ' + JSON.stringify(profile));
  Logger.log('[data_sync] version=' + syncVersion + ' sheet=' + taskRead.diagnostics.sheet_name +
    ' raw=' + taskRead.diagnostics.raw_row_count + ' filtered=' + taskRead.diagnostics.valid_task_count +
    ' sent=' + rows.length + ' duration_ms=' + response.sync_meta.duration_ms);
  return response;
}

function timedDashboardOperation_(profile, name, operation) {
  const startedAt = new Date().getTime();
  const result = operation();
  const elapsed = new Date().getTime() - startedAt;
  const rows = Array.isArray(result) ? result.length : (result && Array.isArray(result.rows) ? result.rows.length : (result && Array.isArray(result.tasks) ? result.tasks.length : 0));
  profile.datasets.push({ name: name, duration_ms: elapsed, rows_returned: rows });
  return result;
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

    // Inquiry requests use the existing authenticated session.
    if (String(payload.action || '').indexOf('inquiry_') === 0) {
      return json_(handleAuthenticatedInquiryAction_(payload));
    }

    const session = requireSession_(payload);

    // Lightweight authoritative bootstrap: refreshes user roles from the access
    // matrix without loading dashboard data or exposing it before auth resolves.
    if (payload.action === 'auth_session') {
      return json_({ ok: true, api_version: '2026-07-auth-session-v1', user: safeUser_(session) });
    }

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
    home_task_total: 0,
    sheet_read_calls: 1,
    cells_read: values.length * Math.max(headers.length, 1),
    cells_read_before_optimization: values.length * Math.max(headers.length, 1)
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
    if (!name && !code) reason = 'missing_task_code_and_name';
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
  const duplicateCodes = {};
  codes.filter(Boolean).forEach(function(code) { duplicateCodes[code] = (duplicateCodes[code] || 0) + 1; });
  const duplicateCodeCount = Object.keys(duplicateCodes).filter(function(code) { return duplicateCodes[code] > 1; }).length;
  if (duplicateCodeCount) Logger.log('[data_quality] duplicate task codes detected: ' + duplicateCodeCount + ' (details available in Data Quality Center)');
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
  Logger.log('[data_sync] Sheet: ' + diagnostics.sheet_name);
  Logger.log('[data_sync] Raw rows: ' + diagnostics.raw_row_count);
  Logger.log('[data_sync] Non-empty rows: ' + diagnostics.non_empty_row_count);
  Logger.log('[data_sync] Valid tasks: ' + diagnostics.valid_task_count);
  Logger.log('[data_sync] Excluded rows: ' + diagnostics.excluded_row_count);
  Logger.log('[data_sync] Sent rows: ' + diagnostics.payload_task_total);
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
function getDataQualityHeaders_() { return ['issue_key','issue_type','data_source','sheet_name','field_name','record_reference','row_number','description','severity','status','current_value','expected_rule','suggested_resolution','first_detected_at','last_seen_at','last_updated_at','occurrence_count','original_record_url']; }

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

function buildEmployeeWorkload_(ss, rows, employees, criticalPath) {
  const idx=employeeByNameOrEmail_(employees), today=dayNumber_(Utilities.formatDate(new Date(), KAG_CONFIG.timezone, 'yyyy-MM-dd')), critical=criticalPath || buildCriticalPathAnalysis_(ss, rows); const crit={}; (critical.tasks||[]).forEach(function(t){ if(t.is_critical) crit[normKey_(t.task_code)]=true; }); const agg={}; rows.forEach(function(r){ const emp=findEmployee_(idx, taskOwner_(r), taskField_(r,'ownerEmail')); if(!emp) return; const key=employeeField_(emp,['email','البريد الإلكتروني','employee_email'])||employeeField_(emp,['name','employee_name','اسم الموظف']); if(!agg[key]) agg[key]={employee:employeeField_(emp,['name','employee_name','اسم الموظف'])||taskOwner_(r),email:employeeField_(emp,['email','البريد الإلكتروني','employee_email'])||'',task_count:0,overdue_task_count:0,critical_task_count:0,total_duration_days:0,workload_limit_days:Number(employeeField_(emp,['workload_limit_days','capacity_days','حد العبء'])||0)}; agg[key].task_count++; agg[key].total_duration_days+=durationDays_(r); if(!isCompleteTask_(r)&&dayNumber_(taskEnd_(r))!==null&&dayNumber_(taskEnd_(r))<today) agg[key].overdue_task_count++; if(crit[normKey_(taskCode_(r))]) agg[key].critical_task_count++; }); return Object.keys(agg).map(function(k){ const a=agg[k]; a.alert=a.workload_limit_days&&a.total_duration_days>a.workload_limit_days?'تجاوز الحد':'ضمن الحد'; a.source='Employee Master + WBS'; return a; });
}

function buildCriticalPathAnalysis_(ss, rows) {
  const nodes={}, missing=[]; rows.forEach(function(r){ const c=taskCode_(r); if(c&&taskStart_(r)&&taskEnd_(r)) nodes[c]={row:r,code:c,dur:durationDays_(r),preds:[]}; }); rows.forEach(function(r){ const c=taskCode_(r); if(!nodes[c]) return; String(taskField_(r,'predecessor')||'').split(/[,;،]/).map(function(x){return x.trim();}).filter(Boolean).forEach(function(p){ if(!nodes[p]) missing.push(p+' -> '+c); else nodes[c].preds.push({code:p,type:String(taskField_(r,'dependencyType')||'FS').trim().toUpperCase(),lag:Number(taskField_(r,'lag')||0)||0}); }); }); if(!Object.keys(nodes).length || missing.length) return { ok:false, message:'لا توجد بيانات كافية لاحتساب المسار الحرج', missing_dependencies:missing, tasks:[] }; const order=[], temp={}, perm={}, cycle=false; function visit(c){ if(temp[c]){cycle=true;return;} if(perm[c])return; temp[c]=true; nodes[c].preds.forEach(function(p){visit(p.code);}); perm[c]=true; temp[c]=false; order.push(c);} Object.keys(nodes).forEach(visit); if(cycle) return { ok:false, message:'لا توجد بيانات كافية لاحتساب المسار الحرج', circular_dependencies:true, tasks:[] }; order.forEach(function(c){ const n=nodes[c]; n.es=0; n.preds.forEach(function(p){ const pn=nodes[p.code], rel=(p.type==='SS'?pn.es:pn.ef)+p.lag; n.es=Math.max(n.es,rel); }); n.ef=n.es+n.dur; }); const projectFinish=Math.max.apply(null, order.map(function(c){return nodes[c].ef;})); order.slice().reverse().forEach(function(c){ const n=nodes[c]; n.lf=projectFinish; Object.keys(nodes).forEach(function(s){ nodes[s].preds.forEach(function(p){ if(p.code===c){ const succ=nodes[s], rel=(p.type==='SS'?succ.ls:succ.es)-p.lag; n.lf=Math.min(n.lf, rel+(p.type==='SS'?n.dur:0)); } }); }); n.ls=n.lf-n.dur; n.total_float=n.ls-n.es; let minFree=projectFinish-n.ef; Object.keys(nodes).forEach(function(s){ nodes[s].preds.forEach(function(p){ if(p.code===c) minFree=Math.min(minFree,(p.type==='SS'?nodes[s].es:nodes[s].es)-p.lag-n.ef); }); }); n.free_float=Math.max(0,minFree); }); return { ok:true, message:'ok', project_duration_days:projectFinish, tasks:order.map(function(c){ const n=nodes[c]; return {task_code:c,task_name:taskName_(n.row),early_start:n.es,early_finish:n.ef,late_start:n.ls,late_finish:n.lf,total_float:n.total_float,free_float:n.free_float,is_critical:n.total_float===0,directly_impacts_opening:n.ef===projectFinish||n.total_float===0,dependency_type:String(taskField_(n.row,'dependencyType')||'FS'),lag:Number(taskField_(n.row,'lag')||0)||0,data_status:'ok'}; }) };
}

function buildDataQualityCenter_(ss, rows, employees, criticalPath) {
  const detectedAt=new Date().toISOString(), sourceSheet=KAG_CONFIG.taskSheetName;
  const candidates=[], codes={}, names={}, taskCodes={}, employeeIndex=employeeByNameOrEmail_(employees);
  const severityLabels={critical:'حرج',high:'مرتفع',medium:'متوسط',low:'منخفض'};
  function add(type,row,field,description,severity,currentValue,rule,suggestion){
    const reference=row?(taskCode_(row)||('صف '+String(row.row_number||''))):'المصدر';
    candidates.push({issue_type:type,data_source:'Google Sheets',sheet_name:row&&row._sheet_name||sourceSheet,field_name:field||'',record_reference:reference,row_number:row&&row.row_number||'',description:description,severity:severityLabels[severity]||severityLabels.medium,status:'مفتوحة',current_value:String(currentValue===undefined?'':currentValue),expected_rule:rule||'',suggested_resolution:suggestion||'',first_detected_at:detectedAt,last_seen_at:detectedAt,detected_at:detectedAt,last_updated_at:detectedAt,occurrence_count:1,original_record_url:row&&row.row_number?'https://docs.google.com/spreadsheets/d/'+KAG_CONFIG.sheetId+'/edit#range=A'+row.row_number:''});
  }
  rows.forEach(function(r){ const code=taskCode_(r), name=taskName_(r); if(code){(codes[normKey_(code)]=codes[normKey_(code)]||[]).push(r);taskCodes[normKey_(code)]=true;} if(name)(names[normKey_(name)]=names[normKey_(name)]||[]).push(r); });
  Object.keys(codes).forEach(function(key){const group=codes[key];if(group.length>1)add('كود مكرر',group[0],'كود المهمة','الكود مستخدم في '+group.length+' صفوف.','critical',taskCode_(group[0]),'يجب أن يكون الكود فريدًا داخل الشيت.','مراجعة الصفوف المتكررة والإبقاء على مرجع واحد صحيح.');});
  Object.keys(names).forEach(function(key){const group=names[key];if(group.length>1)add('اسم مهمة مكرر',group[0],'اسم المهمة','الاسم مستخدم في '+group.length+' صفوف.','medium',taskName_(group[0]),'يجب ألا يتكرر اسم المهمة للسجل نفسه دون تمييز.','مراجعة الأسماء المتطابقة وتأكيد ما إذا كانت سجلات مستقلة.');});
  rows.forEach(function(r){
    const rawStart=taskField_(r,'plannedStart'), rawEnd=taskField_(r,'plannedEnd'), progressRaw=taskField_(r,'progress'), progress=Number(String(progressRaw).replace('%',''));
    if(!taskCode_(r)) add('حقل إلزامي مفقود',r,'كود المهمة','لا يوجد كود مرجعي للسجل.','critical','', 'كود المهمة حقل إلزامي وفريد.','إضافة كود رسمي فريد.');
    if(!taskName_(r)) add('حقل إلزامي مفقود',r,'اسم المهمة','اسم السجل مفقود.','high','', 'اسم المهمة حقل إلزامي.','إضافة الاسم من المصدر الرسمي.');
    if(!taskOwner_(r)) add('مسؤول غير محدد',r,'المسؤول','لم يُحدد مسؤول للسجل.','high','', 'كل سجل تشغيلي يجب أن يرتبط بمسؤول.','تحديد المسؤول المعتمد في WBS.');
    if(rawStart&&!parseDateKey_(rawStart)) add('تاريخ بداية غير صالح',r,'تاريخ البداية المخطط','تعذر تفسير تاريخ البداية.','high',rawStart,'تاريخ صالح وفق تنسيق الشيت.','تصحيح قيمة التاريخ في المصدر.');
    if(rawEnd&&!parseDateKey_(rawEnd)) add('تاريخ نهاية غير صالح',r,'تاريخ النهاية المخطط','تعذر تفسير تاريخ النهاية.','high',rawEnd,'تاريخ صالح وفق تنسيق الشيت.','تصحيح قيمة التاريخ في المصدر.');
    if(taskStart_(r)&&taskEnd_(r)&&dayNumber_(taskStart_(r))>dayNumber_(taskEnd_(r))) add('تاريخ نهاية أقدم من تاريخ البداية',r,'تاريخ النهاية المخطط','النهاية تسبق البداية.','critical',taskEnd_(r),'تاريخ النهاية يساوي أو يلي تاريخ البداية.','مراجعة تاريخي البداية والنهاية.');
    if(progressRaw!==''&&progressRaw!==null&&progressRaw!==undefined&&(isNaN(progress)||progress<0||progress>100)) add('نسبة إنجاز خارج النطاق',r,'نسبة الإنجاز','النسبة ليست بين 0 و100.','high',progressRaw,'نسبة الإنجاز رقم من 0 إلى 100.','تصحيح النسبة في المصدر.');
    if(isCompleteTask_(r)&&!taskField_(r,'actualEnd')) add('مهمة مكتملة دون تاريخ إغلاق',r,'تاريخ النهاية الفعلي','السجل مكتمل دون تاريخ نهاية فعلي.','high','', 'السجل المكتمل يتطلب تاريخ إغلاق فعلي.','إضافة تاريخ الإغلاق المعتمد.');
    String(taskField_(r,'predecessor')||'').split(/[,;،]/).map(function(x){return x.trim();}).filter(Boolean).forEach(function(p){if(!taskCodes[normKey_(p)])add('مرجع مفقود أو علاقة غير صالحة',r,'المهمة السابقة','المرجع '+p+' غير موجود.','critical',p,'كل اعتماد يجب أن يشير إلى كود موجود.','تصحيح المرجع أو إضافة السجل المرجعي.');});
    const email=taskField_(r,'ownerEmail'); if(email&&!findEmployee_(employeeIndex,taskOwner_(r),email)) add('مرجع مسؤول غير صالح',r,'البريد الإلكتروني للمسؤول','المسؤول غير مطابق لـ Employee Master.','critical',email,'المسؤول يجب أن يطابق سجل الموظفين الرسمي.','مراجعة البريد أو سجل الموظف.');
  });
  if(criticalPath&&criticalPath.circular_dependencies)add('مرجع مفقود أو علاقة غير صالحة',null,'المهمة السابقة','توجد حلقة دائرية في الاعتماديات.','critical','اعتمادية دائرية','شبكة الاعتماديات يجب أن تكون بلا حلقات.','تصحيح تسلسل الاعتماديات.');
  const issues=deduplicateDataQualityIssues_(candidates,getExistingRegisterRows_(ss,KAG_CONFIG.dataQualitySheetName));
  const openIssues=issues.filter(function(i){return i.status!=='تم الحل'&&i.status!=='مستبعدة بعد المراجعة';});
  return {issues:issues,summary:{issue_count:openIssues.length,critical_count:openIssues.filter(function(i){return i.severity==='حرج';}).length,warning_count:openIssues.filter(function(i){return i.severity!=='حرج';}).length,checked_record_count:rows.length,last_scan_at:detectedAt}};
}

function dataQualityIssueKey_(issue){return [issue.issue_type,issue.sheet_name||issue.data_source,issue.field_name,issue.record_reference].map(normKey_).join('|');}
function deduplicateDataQualityIssues_(candidates,stored){
  const existing={}; (stored||[]).forEach(function(r){const key=String(r.issue_key||dataQualityIssueKey_(r));if(key)existing[key]=r;});
  const unique={}; (candidates||[]).forEach(function(issue){const key=dataQualityIssueKey_(issue),prev=unique[key],history=existing[key]||{};if(prev){prev.occurrence_count++;prev.last_seen_at=issue.last_seen_at;return;} issue.issue_key=key;issue.first_detected_at=history.first_detected_at||history.detected_at||issue.first_detected_at;issue.status=history.status||issue.status;issue.last_updated_at=history.last_updated_at||history.updated_at||issue.last_updated_at;issue.occurrence_count=Number(history.occurrence_count||0)+1;unique[key]=issue;});
  Object.keys(existing).forEach(function(key){const old=existing[key];if(!unique[key]&&old.status&&old.status!=='تم الحل'&&old.status!=='مستبعدة بعد المراجعة')unique[key]=Object.assign({},old,{issue_key:key,occurrence_count:Number(old.occurrence_count||1)});});
  return Object.keys(unique).map(function(key){return unique[key];});
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
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('[urgent_task_email] Another notification run is already active; skipped.');
    return;
  }

  try {
    const sheet = getUrgentTaskSheet_();
    if (!sheet) {
      Logger.log('[urgent_task_email] Sheet not found: ' + KAG_CONFIG.urgentTasksSheetName);
      return;
    }

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return;

    const headers = values[0].map(function(h) { return normalizeHeader_(h); });
    const notifyCol = headers.indexOf(normalizeHeader_('إرسال الإشعار'));
    const emailCol = headers.indexOf(normalizeHeader_('البريد الإلكتروني'));
    const statusCol = headers.indexOf(normalizeHeader_('الحالة'));
    const completionDateCol = headers.indexOf(normalizeHeader_('تاريخ الإكمال'));
    const completionNotifyCol = headers.indexOf(normalizeHeader_('إشعار الإكمال'));

    if (notifyCol === -1 || emailCol === -1) {
      Logger.log('[urgent_task_email] Required columns are missing: إرسال الإشعار / البريد الإلكتروني');
      return;
    }

    if (statusCol === -1 || completionDateCol === -1 || completionNotifyCol === -1) {
      Logger.log('[urgent_task_email] Completion columns are missing: الحالة / تاريخ الإكمال / إشعار الإكمال');
      return;
    }

    requireSupportSender_();

    for (var r = 1; r < values.length; r++) {
      const task = urgentTaskFromRow_(headers, values[r], r + 1);

      // إرسال إشعار التكليف عند كتابة «نعم» فقط.
      const notifyValue = String(values[r][notifyCol] || '').trim();
      if (notifyValue === 'نعم') {
        try {
          task.email = normalizeUrgentTaskRecipients_(task.email);
          sendUrgentTaskEmail_(task);
          sheet.getRange(r + 1, notifyCol + 1).setValue('تم الإرسال');
          SpreadsheetApp.flush();
          Logger.log('[urgent_task_email] Assignment sent successfully to ' + task.email + ' for row ' + (r + 1));
        } catch (assignmentErr) {
          Logger.log('[urgent_task_email] Assignment failed at row ' + (r + 1) + ': ' + assignmentErr);
        }
      }

      // إرسال إشعار الإكمال تلقائيًا عند تغيير الحالة إلى «مكتملة».
      const statusValue = normalizeHeader_(values[r][statusCol]);
      const completionNotifyValue = String(values[r][completionNotifyCol] || '').trim();

      if (statusValue === normalizeHeader_('مكتملة') && completionNotifyValue !== 'تم الإرسال') {
        try {
          task.email = normalizeUrgentTaskRecipients_(task.email);

          let completionDate = values[r][completionDateCol];
          if (!completionDate) {
            completionDate = new Date();
            sheet.getRange(r + 1, completionDateCol + 1).setValue(completionDate);
            sheet.getRange(r + 1, completionDateCol + 1).setNumberFormat('yyyy-MM-dd hh:mm AM/PM');
          }

          task.completion_date = completionDate;
          task.status = 'مكتملة';

          sendUrgentTaskCompletionEmail_(task);
          sheet.getRange(r + 1, completionNotifyCol + 1).setValue('تم الإرسال');
          SpreadsheetApp.flush();
          Logger.log('[urgent_task_email] Completion sent successfully to ' + task.email + ' for row ' + (r + 1));
        } catch (completionErr) {
          Logger.log('[urgent_task_email] Completion failed at row ' + (r + 1) + ': ' + completionErr);
        }
      }
    }
  } finally {
    lock.releaseLock();
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
    due_time: item[normalizeHeader_('وقت الاستحقاق')] || '',
    status: item[normalizeHeader_('الحالة')] || '',
    notify: item[normalizeHeader_('إرسال الإشعار')] || '',
    completion_date: item[normalizeHeader_('تاريخ الإكمال')] || '',
    completion_notify: item[normalizeHeader_('إشعار الإكمال')] || '',
    row_number: rowNumber
  };
}

function sendUrgentTaskEmail_(task) {
  const sender = 'support.services@mayadeen.sa';
  const senderName = 'إدارة الخدمات المساندة | ميادين';
  const subject = 'تكليف عاجل | ' + (task.task || 'مهمة جديدة');
  const props = PropertiesService.getScriptProperties();
  const platformUrl = String(props.getProperty('MAYADEEN_PLATFORM_URL') || '').trim();

  const safe = {
    id: escapeHtml_(task.id || '-'),
    task: escapeHtml_(task.task || '-'),
    description: escapeHtml_(task.description || '-').replace(/\n/g, '<br>'),
    owner: escapeHtml_(task.owner || '-'),
    assignedDate: escapeHtml_(formatUrgentTaskDate_(task.assigned_date)),
    dueDate: escapeHtml_(formatUrgentTaskDate_(task.due_date)),
    dueTime: escapeHtml_(formatUrgentTaskTime_(task.due_time)),
    status: escapeHtml_(task.status || 'جديدة')
  };

  const sentAt = Utilities.formatDate(new Date(), KAG_CONFIG.timezone, 'yyyy-MM-dd HH:mm');
  const reference = safe.id !== '-' ? safe.id : ('UT-' + String(task.row_number || ''));

  const logoBase64 = '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J40dm7BOlmBd2X7/PyZMOjRvQnrS0++u3WmUlzfzxERbus0WJ4VCWqTXYFCLFIf7H+OFJDFQFA6yzMBikaG2tqHLZufN11w1n9XXdX3lhhtmH2QMa7/7XYCVK3PlnJwTJ0S0j603Yt9NRDSuqyu0kHMe9UJQVekLRKwfSIW+ns0YDofP1jSRRgSaJPVtETQMgzHGNatVfu94X7yrK7yMdC2FGD/qd/byEEy1qe8e6wDuGQ8ikru6Qpcf692ORNcNQOSyzSZVI+KW4VoMPcIKEU3t6grNVzjvMqIMaY7MEYWsVuu6AVjZesaMaZp2jhCYqOuGEd24gWyzqaWIWHoc3x/f0dF1kcJ4AKR+ej90gwwEi82m7kXEouGqWOn1Enc60SCieV1doWmcINjvZ+4+A3TdoNhYy7v90V+OGKNxXV36Es6hC4Y/7F0YBthsNqkAEQ8e7R86HF7+ve85cKitgUeMy5ldXXo6kRHduXICYBgGs9nUQkSsPtr6PeJdLV1d+mUn3bvqBoWFYY2NtZUiYnF/9yoRLQiF9EmgG6F+7rGedboFEQ8Nx5mgadrF4bBh4ZxHJeRyABE2DJvNpu5AxLJIb180i5QMIwNZH0TEzNxBk5OZ7r6eBvTi+qusav5B9aHwJcW7D4uW1i62taAKJIn/V5SGIIK0UTGQMSUZxk9IgLlzRkF6uv33iqJ88j8SLiNy44l+ruEJ8P0jaIMjHEDoFv7HNjA8B+/Ifc+AxmeEn/mkXVenwHcP/ZydWO0ZCP/z2P95/J4LY3if86Sd96jXwanSoiMKZfB433eIz8Oe6JPBmJMRX8cIJ2AXjYi3dMjHJYp3R4AhHqjIuj8hjyg69l4YmbnsPiv6MTXYE2pKIz1/w7S2+/msR97nx7O+/yMbnAjvd1Jdil6vlxMRG8AHB+H7mddLx/z+nmccpHdmA3lnr9cbtSl8YN9Dg/auA1kPRDSg9TBYc3Q883O8azKyH2hAc+ZyuUZkzlyu/u2hwZqv41kjg/ThQ9GXc7jOshPxM5C9c/K+a/TrZ4BzO6zrdKDn5om8p0xMTE5b3YR7vUWKy+VVXC6v4nD08en+e6+3SCkqKlJGSnY2MTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEx+f/twSEBAAAAgKD/ry3OAAAAgAX8Ki3F18CQGgAAAABJRU5ErkJggg==';
  const logoBlob = Utilities.newBlob(Utilities.base64Decode(logoBase64), 'image/png', 'mayadeen-events-logo-purple-transparent.png');

  const navy = '#5F5DB2';
  const petrol = '#124D70';
  const turquoise = '#5EC3BE';
  const pale = '#F4F7F8';
  const border = '#E2E7EA';
  const textColor = '#1F2933';
  const muted = '#65717C';
  const urgent = '#A43D36';

  const actionButton = platformUrl
    ? '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 30px;">' +
        '<tr><td bgcolor="' + navy + '" style="border-radius:8px;text-align:center;">' +
          '<a href="' + escapeHtml_(platformUrl) + '" target="_blank" style="display:inline-block;padding:14px 28px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;">فتح منصة إدارة المشاريع</a>' +
        '</td></tr></table>'
    : '';

  const htmlBody = '<!doctype html>' +
    '<html lang="ar" dir="rtl"><head>' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">' +
    '</head>' +
    '<body bgcolor="#F4F7F8" style="margin:0;padding:0;background-color:#F4F7F8;font-family:Tahoma,Arial,sans-serif;direction:rtl;">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F4F7F8" style="width:100%;background-color:#F4F7F8;">' +
        '<tr><td align="center" style="padding:24px 10px;">' +
          '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:620px;background-color:#FFFFFF;border:1px solid ' + border + ';border-radius:14px;overflow:hidden;">' +

            '<tr><td bgcolor="#FFFFFF" align="center" style="padding:24px 24px 20px;background-color:#FFFFFF;">' +
              '<img src="cid:mayadeenLogo" width="320" alt="Mayadeen Events - ميادين" style="display:block;width:320px;max-width:88%;height:auto;border:0;margin:0 auto;background:transparent;">' +
            '</td></tr>' +

            '<tr><td style="padding:0 24px;background:#FFFFFF;">' +
              '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>' +
                '<td bgcolor="' + navy + '" style="height:4px;width:100%;font-size:0;line-height:0;">&nbsp;</td>' +
              '</tr></table>' +
            '</td></tr>' +

            '<tr><td bgcolor="#FFFFFF" style="padding:30px 30px 18px;background-color:#FFFFFF;text-align:right;">' +
              '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="right"><tr><td bgcolor="#FCEFED" style="border:1px solid #EAC7C3;border-radius:999px;padding:7px 13px;color:' + urgent + ';font-size:12px;font-weight:700;">تكليف عاجل</td></tr></table>' +
              '<div style="clear:both;height:16px;font-size:0;line-height:0;">&nbsp;</div>' +
              '<div style="font-size:26px;line-height:1.55;font-weight:800;color:' + navy + ';margin:0 0 10px;">تم إسناد مهمة عاجلة إليك</div>' +
              '<div style="font-size:14px;line-height:2;color:' + muted + ';">السلام عليكم ' + safe.owner + '،<br>تم تكليفكم بالمهمة الموضحة أدناه. يرجى البدء في التنفيذ وفق الموعد المحدد وتحديث الحالة عند أي مستجد.</div>' +
            '</td></tr>' +

            '<tr><td bgcolor="#FFFFFF" style="padding:0 30px 20px;background-color:#FFFFFF;">' +
              '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0 10px;">' +
                urgentTaskCardHtml_('اسم المهمة', safe.task, navy, pale, border, textColor) +
                urgentTaskCardHtml_('المسؤول', safe.owner, navy, pale, border, textColor) +
                urgentTaskCardHtml_('تاريخ الاستحقاق', safe.dueDate, navy, pale, border, textColor) +
                urgentTaskCardHtml_('وقت الاستحقاق', safe.dueTime, navy, pale, border, textColor) +
                urgentTaskCardHtml_('الحالة', safe.status, navy, pale, border, textColor) +
              '</table>' +
            '</td></tr>' +

            '<tr><td bgcolor="#FFFFFF" style="padding:0 30px 24px;background-color:#FFFFFF;">' +
              '<div style="font-size:13px;font-weight:700;color:' + navy + ';margin:0 0 9px;">تفاصيل المهمة</div>' +
              '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F8FAFA" style="width:100%;background-color:#F8FAFA;border:1px solid ' + border + ';border-right:4px solid ' + turquoise + ';border-radius:9px;">' +
                '<tr><td style="padding:16px 18px;color:' + textColor + ';font-size:14px;line-height:2;text-align:right;">' + safe.description + '</td></tr>' +
              '</table>' +
            '</td></tr>' +

            '<tr><td bgcolor="#FFFFFF" style="padding:0 30px 24px;background-color:#FFFFFF;">' +
              '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F0F8F7" style="width:100%;background-color:#F0F8F7;border:1px solid #CDE5E2;border-radius:9px;">' +
                '<tr><td style="padding:15px 17px;color:' + petrol + ';font-size:13px;line-height:1.9;text-align:right;">يرجى تحديث حالة المهمة ضمن آلية المتابعة المعتمدة، والإفادة فورًا عند وجود عائق يؤثر على التنفيذ أو الموعد.</td></tr>' +
              '</table>' +
            '</td></tr>' +

            '<tr><td bgcolor="#FFFFFF" style="padding:0 30px;background-color:#FFFFFF;">' + actionButton + '</td></tr>' +

            '<tr><td bgcolor="#F7F7FA" style="padding:22px 30px;background-color:#F7F7FA;border-top:1px solid ' + border + ';text-align:center;">' +
              '<div style="font-size:14px;font-weight:700;color:' + navy + ';">إدارة الخدمات المساندة</div>' +
              '<div style="font-size:12px;color:' + muted + ';margin-top:5px;">شركة ميادين</div>' +
              '<div style="font-size:10px;color:#8A949D;margin-top:14px;line-height:1.8;">مرجع الإشعار: ' + reference + ' &nbsp; | &nbsp; وقت الإرسال: ' + sentAt + '<br>هذه رسالة آلية صادرة عن نظام المتابعة الداخلي.</div>' +
            '</td></tr>' +

          '</table>' +
        '</td></tr>' +
      '</table>' +
    '</body></html>';

  const plainBody = [
    'السلام عليكم ' + (task.owner || '') + '،',
    '',
    'تم إسناد مهمة عاجلة إليك.',
    'اسم المهمة: ' + (task.task || '-'),
    'المسؤول: ' + (task.owner || '-'),
    'تاريخ الاستحقاق: ' + formatUrgentTaskDate_(task.due_date),
    'وقت الاستحقاق: ' + formatUrgentTaskTime_(task.due_time),
    'الحالة: ' + (task.status || 'جديدة'),
    'التفاصيل: ' + (task.description || '-'),
    '',
    'إدارة الخدمات المساندة - شركة ميادين'
  ].join('\n');

  GmailApp.sendEmail(normalizeUrgentTaskRecipients_(task.email), subject, plainBody, {
    from: sender,
    name: senderName,
    cc: 'a.jarallah@mayadeen.sa,a.alamoudi@mayadeen.sa,a.alobed@mayadeen.sa,a.almarhum@mayadeen.sa,m.alansari@mayadeen.sa,s.alkozaim@mayadeen.sa',
    bcc: 'a.althobiti@mayadeen.sa',
    htmlBody: htmlBody,
    inlineImages: { mayadeenLogo: logoBlob }
  });
}

function sendUrgentTaskCompletionEmail_(task) {
  const sender = 'support.services@mayadeen.sa';
  const senderName = 'إدارة الخدمات المساندة | ميادين';
  const subject = 'تم إكمال المهمة المستعجلة | ' + (task.task || 'مهمة');
  const props = PropertiesService.getScriptProperties();
  const platformUrl = String(props.getProperty('MAYADEEN_PLATFORM_URL') || '').trim();

  const safe = {
    id: escapeHtml_(task.id || '-'),
    task: escapeHtml_(task.task || '-'),
    description: escapeHtml_(task.description || '-').replace(/\n/g, '<br>'),
    owner: escapeHtml_(task.owner || '-'),
    assignedDate: escapeHtml_(formatUrgentTaskDate_(task.assigned_date)),
    dueDate: escapeHtml_(formatUrgentTaskDate_(task.due_date)),
    dueTime: escapeHtml_(formatUrgentTaskTime_(task.due_time)),
    status: 'مكتملة',
    completionDate: escapeHtml_(formatUrgentTaskCompletionDateTime_(task.completion_date))
  };

  const sentAt = Utilities.formatDate(new Date(), KAG_CONFIG.timezone, 'yyyy-MM-dd HH:mm');
  const reference = safe.id !== '-' ? safe.id : ('UT-' + String(task.row_number || ''));

  const logoBase64 = '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J40dm7BOlmBd2X7/PyZMOjRvQnrS0++u3WmUlzfzxERbus0WJ4VCWqTXYFCLFIf7H+OFJDFQFA6yzMBikaG2tqHLZufN11w1n9XXdX3lhhtmH2QMa7/7XYCVK3PlnJwTJ0S0j603Yt9NRDSuqyu0kHMe9UJQVekLRKwfSIW+ns0YDofP1jSRRgSaJPVtETQMgzHGNatVfu94X7yrK7yMdC2FGD/qd/byEEy1qe8e6wDuGQ8ikru6Qpcf692ORNcNQOSyzSZVI+KW4VoMPcIKEU3t6grNVzjvMqIMaY7MEYWsVuu6AVjZesaMaZp2jhCYqOuGEd24gWyzqaWIWHoc3x/f0dF1kcJ4AKR+ej90gwwEi82m7kXEouGqWOn1Enc60SCieV1doWmcINjvZ+4+A3TdoNhYy7v90V+OGKNxXV36Es6hC4Y/7F0YBthsNqkAEQ8e7R86HF7+ve85cKitgUeMy5ldXXo6kRHduXICYBgGs9nUQkSsPtr6PeJdLV1d+mUn3bvqBoWFYY2NtZUiYnF/9yoRLQiF9EmgG6F+7rGedboFEQ8Nx5mgadrF4bBh4ZxHJeRyABE2DJvNpu5AxLJIb180i5QMIwNZH0TEzNxBk5OZ7r6eBvTi+qusav5B9aHwJcW7D4uW1i62taAKJIn/V5SGIIK0UTGQMSUZxk9IgLlzRkF6uv33iqJ88j8SLiNy44l+ruEJ8P0jaIMjHEDoFv7HNjA8B+/Ifc+AxmeEn/mkXVenwHcP/ZydWO0ZCP/z2P95/J4LY3if86Sd96jXwanSoiMKZfB433eIz8Oe6JPBmJMRX8cIJ2AXjYi3dMjHJYp3R4AhHqjIuj8hjyg69l4YmbnsPiv6MTXYE2pKIz1/w7S2+/msR97nx7O+/yMbnAjvd1Jdil6vlxMRG8AHB+H7mddLx/z+nmccpHdmA3lnr9cbtSl8YN9Dg/auA1kPRDSg9TBYc3Q883O8azKyH2hAc+ZyuUZkzlyu/u2hwZqv41kjg/ThQ9GXc7jOshPxM5C9c/K+a/TrZ4BzO6zrdKDn5om8p0xMTE5b3YR7vUWKy+VVXC6v4nD08en+e6+3SCkqKlJGSnY2MTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEx+f/twSEBAAAAgKD/ry3OAAAAgAX8Ki3F18CQGgAAAABJRU5ErkJggg==';
  const logoBlob = Utilities.newBlob(Utilities.base64Decode(logoBase64), 'image/png', 'mayadeen-events-logo-purple-transparent.png');

  const navy = '#5F5DB2';
  const petrol = '#124D70';
  const turquoise = '#5EC3BE';
  const pale = '#F4F7F8';
  const border = '#E2E7EA';
  const textColor = '#1F2933';
  const muted = '#65717C';
  const urgent = '#A43D36';

  const actionButton = platformUrl
    ? '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 30px;">' +
        '<tr><td bgcolor="' + navy + '" style="border-radius:8px;text-align:center;">' +
          '<a href="' + escapeHtml_(platformUrl) + '" target="_blank" style="display:inline-block;padding:14px 28px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;">فتح منصة إدارة المشاريع</a>' +
        '</td></tr></table>'
    : '';

  const htmlBody = '<!doctype html>' +
    '<html lang="ar" dir="rtl"><head>' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">' +
    '</head>' +
    '<body bgcolor="#F4F7F8" style="margin:0;padding:0;background-color:#F4F7F8;font-family:Tahoma,Arial,sans-serif;direction:rtl;">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F4F7F8" style="width:100%;background-color:#F4F7F8;">' +
        '<tr><td align="center" style="padding:24px 10px;">' +
          '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:620px;background-color:#FFFFFF;border:1px solid ' + border + ';border-radius:14px;overflow:hidden;">' +

            '<tr><td bgcolor="#FFFFFF" align="center" style="padding:24px 24px 20px;background-color:#FFFFFF;">' +
              '<img src="cid:mayadeenLogo" width="320" alt="Mayadeen Events - ميادين" style="display:block;width:320px;max-width:88%;height:auto;border:0;margin:0 auto;background:transparent;">' +
            '</td></tr>' +

            '<tr><td style="padding:0 24px;background:#FFFFFF;">' +
              '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>' +
                '<td bgcolor="' + navy + '" style="height:4px;width:100%;font-size:0;line-height:0;">&nbsp;</td>' +
              '</tr></table>' +
            '</td></tr>' +

            '<tr><td bgcolor="#FFFFFF" style="padding:30px 30px 18px;background-color:#FFFFFF;text-align:right;">' +
              '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="right"><tr><td bgcolor="#FCEFED" style="border:1px solid #EAC7C3;border-radius:999px;padding:7px 13px;color:' + urgent + ';font-size:12px;font-weight:700;">إشعار إكمال</td></tr></table>' +
              '<div style="clear:both;height:16px;font-size:0;line-height:0;">&nbsp;</div>' +
              '<div style="font-size:26px;line-height:1.55;font-weight:800;color:' + navy + ';margin:0 0 10px;">تم إكمال المهمة المستعجلة</div>' +
              '<div style="font-size:14px;line-height:2;color:' + muted + ';">السلام عليكم ورحمة الله وبركاته،<br>نفيدكم بأنه تم إكمال المهمة المستعجلة الموضحة أدناه، وتم تحديث حالتها إلى (مكتملة) في منصة ميادين.</div>' +
            '</td></tr>' +

            '<tr><td bgcolor="#FFFFFF" style="padding:0 30px 20px;background-color:#FFFFFF;">' +
              '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0 10px;">' +
                urgentTaskCardHtml_('اسم المهمة', safe.task, navy, pale, border, textColor) +
                urgentTaskCardHtml_('المسؤول', safe.owner, navy, pale, border, textColor) +
                urgentTaskCardHtml_('تاريخ الاستحقاق', safe.dueDate, navy, pale, border, textColor) +
                urgentTaskCardHtml_('وقت الاستحقاق', safe.dueTime, navy, pale, border, textColor) +
                urgentTaskCardHtml_('تاريخ ووقت الإكمال', safe.completionDate, navy, pale, border, textColor) +
                urgentTaskCardHtml_('الحالة', safe.status, '#257A55', '#EEF8F2', '#CDE8D8', '#257A55') +
              '</table>' +
            '</td></tr>' +

            '<tr><td bgcolor="#FFFFFF" style="padding:0 30px 24px;background-color:#FFFFFF;">' +
              '<div style="font-size:13px;font-weight:700;color:' + navy + ';margin:0 0 9px;">تفاصيل المهمة</div>' +
              '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F8FAFA" style="width:100%;background-color:#F8FAFA;border:1px solid ' + border + ';border-right:4px solid ' + turquoise + ';border-radius:9px;">' +
                '<tr><td style="padding:16px 18px;color:' + textColor + ';font-size:14px;line-height:2;text-align:right;">' + safe.description + '</td></tr>' +
              '</table>' +
            '</td></tr>' +

            '<tr><td bgcolor="#FFFFFF" style="padding:0 30px 24px;background-color:#FFFFFF;">' +
              '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F0F8F7" style="width:100%;background-color:#F0F8F7;border:1px solid #CDE5E2;border-radius:9px;">' +
                '<tr><td style="padding:15px 17px;color:' + petrol + ';font-size:13px;line-height:1.9;text-align:right;">نشكر لكم سرعة التجاوب والتعاون، ونثمّن جهودكم في إنجاز المهمة.</td></tr>' +
              '</table>' +
            '</td></tr>' +

            '<tr><td bgcolor="#FFFFFF" style="padding:0 30px;background-color:#FFFFFF;">' + actionButton + '</td></tr>' +

            '<tr><td bgcolor="#F7F7FA" style="padding:22px 30px;background-color:#F7F7FA;border-top:1px solid ' + border + ';text-align:center;">' +
              '<div style="font-size:14px;font-weight:700;color:' + navy + ';">إدارة الخدمات المساندة</div>' +
              '<div style="font-size:12px;color:' + muted + ';margin-top:5px;">شركة ميادين</div>' +
              '<div style="font-size:10px;color:#8A949D;margin-top:14px;line-height:1.8;">مرجع الإشعار: ' + reference + ' &nbsp; | &nbsp; وقت الإرسال: ' + sentAt + '<br>هذه رسالة آلية صادرة عن نظام المتابعة الداخلي.</div>' +
            '</td></tr>' +

          '</table>' +
        '</td></tr>' +
      '</table>' +
    '</body></html>';

  const plainBody = [
    'السلام عليكم ' + (task.owner || '') + '،',
    '',
    'تم إكمال المهمة المستعجلة.',
    'اسم المهمة: ' + (task.task || '-'),
    'المسؤول: ' + (task.owner || '-'),
    'تاريخ الاستحقاق: ' + formatUrgentTaskDate_(task.due_date),
    'وقت الاستحقاق: ' + formatUrgentTaskTime_(task.due_time),
    'تاريخ ووقت الإكمال: ' + formatUrgentTaskCompletionDateTime_(task.completion_date),
    'الحالة: مكتملة',
    'التفاصيل: ' + (task.description || '-'),
    '',
    'إدارة الخدمات المساندة - شركة ميادين'
  ].join('\n');

  GmailApp.sendEmail(normalizeUrgentTaskRecipients_(task.email), subject, plainBody, {
    from: sender,
    name: senderName,
    cc: 'a.jarallah@mayadeen.sa,a.alamoudi@mayadeen.sa,a.alobed@mayadeen.sa,a.almarhum@mayadeen.sa,m.alansari@mayadeen.sa,s.alkozaim@mayadeen.sa',
    bcc: 'a.althobiti@mayadeen.sa',
    htmlBody: htmlBody,
    inlineImages: { mayadeenLogo: logoBlob }
  });
}

function normalizeUrgentTaskRecipients_(value) {
  const emails = String(value || '')
    .split(/[\n,;،]+/)
    .map(function(email) {
      return String(email || '').trim().toLowerCase();
    })
    .filter(function(email) {
      return email !== '';
    });

  const uniqueEmails = [];
  const seen = {};

  emails.forEach(function(email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('بريد إلكتروني غير صالح في المهمة المستعجلة: ' + email);
    }

    if (!seen[email]) {
      seen[email] = true;
      uniqueEmails.push(email);
    }
  });

  if (!uniqueEmails.length) {
    throw new Error('لم يتم إدخال بريد إلكتروني صالح للمسؤول.');
  }

  return uniqueEmails.join(',');
}

function urgentTaskCardHtml_(label, value, navy, background, border, textColor) {
  return '<tr><td style="padding:0;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="' + background + '" style="width:100%;background-color:' + background + ';border:1px solid ' + border + ';border-radius:9px;">' +
      '<tr>' +
        '<td width="36%" style="width:36%;padding:14px 16px;color:' + navy + ';font-size:12px;font-weight:700;text-align:right;vertical-align:top;">' + label + '</td>' +
        '<td style="padding:14px 16px;color:' + textColor + ';font-size:14px;font-weight:600;line-height:1.7;text-align:right;vertical-align:top;border-right:1px solid ' + border + ';">' + value + '</td>' +
      '</tr>' +
    '</table>' +
  '</td></tr>';
}


function formatUrgentTaskDate_(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return Utilities.formatDate(date, KAG_CONFIG.timezone, 'yyyy-MM-dd');
}

function formatUrgentTaskTime_(value) {
  if (value === null || value === undefined || value === '') return '-';

  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, KAG_CONFIG.timezone, 'hh:mm a')
      .replace('AM', 'ص')
      .replace('PM', 'م');
  }

  let raw = String(value).trim();
  if (!raw) return '-';

  raw = raw
    .replace(/\./g, ':')
    .replace(/\s+/g, ' ')
    .trim();

  // يدعم: 2:30 am / am 2:30 / 14:30 / 2:30 ص / 2:30 م
  raw = raw
    .replace(/^am\s+/i, '')
    .replace(/^pm\s+/i, '')
    .replace(/ص/gi, ' AM')
    .replace(/م/gi, ' PM')
    .replace(/\s+/g, ' ')
    .trim();

  const originalLower = String(value).toLowerCase();
  if (/^am\s+/.test(originalLower) && !/am$/i.test(raw)) raw += ' AM';
  if (/^pm\s+/.test(originalLower) && !/pm$/i.test(raw)) raw += ' PM';

  const parsed = new Date('1970-01-01 ' + raw);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, KAG_CONFIG.timezone, 'hh:mm a')
      .replace('AM', 'ص')
      .replace('PM', 'م');
  }

  return String(value);
}

function formatUrgentTaskCompletionDateTime_(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);

  return Utilities.formatDate(date, KAG_CONFIG.timezone, 'yyyy-MM-dd hh:mm a')
    .replace('AM', 'ص')
    .replace('PM', 'م');
}

function escapeHtml_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
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

// ===== Updated inquiry center =====
/* مركز الاستفسارات: استبدل القسم القديم كاملًا بهذا القسم داخل Code.gs المنشور. */
const INQUIRY_PROJECT_ID = "KAG";
const KAG_INQUIRY_CONFIG = Object.freeze({
  inquiriesSheetName: "Inquiries",
  inquiryRepliesSheetName: "Inquiry Replies",
  inquiryEventsSheetName: "Inquiry Events",
  inquiryReadsSheetName: "Inquiry Reads",
  inquiryNotificationsSheetName: "Inquiry Notifications",
});
let kagInquiryContext = null;
const INQUIRY_DETAIL_PAGE_SIZE = 100;
const INQUIRY_DETAIL_CHUNK_SIZE = 100;
const INQUIRY_SCHEMA_CACHE_KEY = "kag-inquiry-schema-v1";
const INQUIRY_SCHEMA_CACHE_TTL_SECONDS = 21600;
const INQUIRY_LIST_CACHE_TTL_SECONDS = 300;
const INQUIRY_GENERATION_PROPERTY_PREFIX = "kag-inquiry-generation-v1:";
const inquiryFallbackGenerations_ = {};
const INQUIRY_STATUS = ["جديد", "قيد المعالجة", "تمت الإجابة", "مغلق"];
const INQUIRY_PRIORITY = ["عادي", "عاجل"];

function inquiryPerfStart_(action) {
  return {
    action: String(action || "inquiry"),
    started_at_ms: Date.now(),
    spreadsheet_accesses: 0,
    sheet_reads: 0,
    rows_read: 0,
    response_size_chars: 0,
    cache_hits: 0,
    cache_misses: 0,
    timings_ms: {},
  };
}
function inquiryPerfTimed_(name, callback) {
  const started = Date.now();
  try {
    return callback();
  } finally {
    const perf = kagInquiryContext && kagInquiryContext.perf;
    if (perf)
      perf.timings_ms[name] =
        (perf.timings_ms[name] || 0) + (Date.now() - started);
  }
}
function inquiryPerfCache_(hit) {
  const perf = kagInquiryContext && kagInquiryContext.perf;
  if (!perf) return;
  if (hit) perf.cache_hits++;
  else perf.cache_misses++;
}
function inquiryPerfRead_(range, sheetName) {
  const values = range.getValues();
  const perf = kagInquiryContext && kagInquiryContext.perf;
  if (perf) {
    perf.sheet_reads++;
    perf.rows_read += values.length;
  }
  return values;
}
function inquiryPerfFinish_() {
  const perf = kagInquiryContext && kagInquiryContext.perf;
  if (!perf || perf.logged) return;
  perf.logged = true;
  if (typeof Logger === "undefined" || !Logger.log) return;
  Logger.log(
    "[inquiry_perf] " +
      JSON.stringify({
        action: perf.action,
        duration_ms: Date.now() - perf.started_at_ms,
        rows_read: perf.rows_read,
        spreadsheet_accesses: perf.spreadsheet_accesses,
        sheet_reads: perf.sheet_reads,
        response_size_chars: perf.response_size_chars,
        cache_hits: perf.cache_hits,
        cache_misses: perf.cache_misses,
        timings_ms: perf.timings_ms,
      }),
  );
}
function inquiryPerfResponse_(response) {
  const perf = kagInquiryContext && kagInquiryContext.perf;
  if (perf) perf.response_size_chars = JSON.stringify(response).length;
  return response;
}
function inquirySpreadsheet_() {
  if (!kagInquiryContext) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  if (kagInquiryContext.spreadsheet) {
    inquiryPerfCache_(true);
    return kagInquiryContext.spreadsheet;
  }
  inquiryPerfCache_(false);
  kagInquiryContext.perf.spreadsheet_accesses++;
  kagInquiryContext.spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return kagInquiryContext.spreadsheet;
}
function inquiryRequestCacheGet_(key) {
  if (!kagInquiryContext || !kagInquiryContext.rows[key]) {
    inquiryPerfCache_(false);
    return null;
  }
  inquiryPerfCache_(true);
  return kagInquiryContext.rows[key];
}
function inquiryCache_() {
  try {
    return typeof CacheService !== "undefined" && CacheService.getScriptCache
      ? CacheService.getScriptCache()
      : null;
  } catch (error) {
    return null;
  }
}
function inquiryCacheGet_(key) {
  try {
    const cache = inquiryCache_();
    return cache ? cache.get(key) : null;
  } catch (error) {
    return null;
  }
}
function inquiryCachePut_(key, value, ttl) {
  try {
    const cache = inquiryCache_();
    if (cache) cache.put(key, value, ttl);
  } catch (error) {}
}
function inquiryCacheRemove_(key) {
  try {
    const cache = inquiryCache_();
    if (cache) cache.remove(key);
  } catch (error) {}
}
function inquiryGenerationStore_() {
  return typeof PropertiesService !== "undefined" &&
    PropertiesService.getScriptProperties
    ? PropertiesService.getScriptProperties()
    : null;
}
function inquiryGeneration_(name) {
  const key = INQUIRY_GENERATION_PROPERTY_PREFIX + name,
    store = inquiryGenerationStore_();
  if (store) return String(store.getProperty(key) || "0");
  return String(inquiryFallbackGenerations_[key] || "0");
}
function inquiryGenerationSnapshot_(username) {
  return {
    global: inquiryGeneration_("global"),
    user: inquiryGeneration_("user:" + username),
  };
}
function inquirySameGeneration_(left, right) {
  return left.global === right.global && left.user === right.user;
}
function inquiryBumpGeneration_(name) {
  const key = INQUIRY_GENERATION_PROPERTY_PREFIX + name,
    value = inquiryNow_() + ":" + Utilities.getUuid(),
    store = inquiryGenerationStore_();
  if (store) store.setProperty(key, value);
  else inquiryFallbackGenerations_[key] = value;
  return value;
}
function inquiryInvalidateGlobal_() {
  inquiryBumpGeneration_("global");
}
function inquiryInvalidateUser_(username) {
  inquiryBumpGeneration_("user:" + username);
}

function inquiryHeaders_() {
  return [
    "inquiry_id",
    "project_id",
    "title",
    "details",
    "sender_username",
    "recipient_username",
    "task_id",
    "task_title",
    "priority",
    "status",
    "created_at",
    "updated_at",
    "request_id",
  ];
}
function inquiryReplyHeaders_() {
  return [
    "reply_id",
    "inquiry_id",
    "project_id",
    "author_username",
    "body",
    "created_at",
    "request_id",
  ];
}
function inquiryEventHeaders_() {
  return [
    "event_id",
    "inquiry_id",
    "project_id",
    "event_type",
    "actor_username",
    "from_value",
    "to_value",
    "created_at",
    "request_id",
  ];
}
function inquiryReadHeaders_() {
  return ["inquiry_id", "project_id", "username", "last_read_at"];
}
function inquiryNotificationHeaders_() {
  return [
    "notification_id",
    "project_id",
    "inquiry_id",
    "username",
    "kind",
    "created_at",
    "read_at",
    "request_key",
  ];
}
function inquirySheet_(name, headers) {
  const ss = inquirySpreadsheet_(),
    s = ss.getSheetByName(name);
  if (!s) throw new Error("تبويب الاستفسارات غير موجود: " + name);
  if (kagInquiryContext && kagInquiryContext.schemaValidated) return s;
  const actual = inquiryPerfRead_(
    s.getRange(1, 1, 1, headers.length),
    name,
  )[0];
  headers.forEach(function (h, i) {
    if (String(actual[i] || "").trim() !== h)
      throw new Error(
        "عنوان غير مطابق في " + name + "، العمود " + (i + 1) + ": المطلوب " + h,
      );
  });
  return s;
}
function inquiryRows_(name, headers) {
  const cached = inquiryRequestCacheGet_(name);
  if (cached) return cached;
  const s = inquirySheet_(name, headers),
    n = s.getLastRow(),
    values =
      n < 2
        ? []
        : inquiryPerfRead_(
            s.getRange(2, 1, n - 1, headers.length),
            name,
          ),
    rows = values
            .map(function (v, i) {
              const o = { _row: i + 2 };
              headers.forEach(function (h, j) {
                o[h] =
                  v[j] instanceof Date
                    ? v[j].toISOString()
                    : String(v[j] === undefined ? "" : v[j]);
              });
              return o;
            })
            .filter(function (r) {
              return r.project_id === INQUIRY_PROJECT_ID;
            });
  if (kagInquiryContext) kagInquiryContext.rows[name] = rows;
  return rows;
}
// Detail reads are deliberately independent of inquiryRows_: they walk append-only
// history sheets from the newest rows backwards and never populate the full-sheet
// request cache.
function inquiryTailRows_(name, headers, inquiryId, limit) {
  const s = inquirySheet_(name, headers),
    lastRow = s.getLastRow(),
    wanted = Math.max(1, Math.min(Number(limit) || INQUIRY_DETAIL_PAGE_SIZE, 1000)),
    chunkSize = Math.max(INQUIRY_DETAIL_CHUNK_SIZE, wanted);
  let endRow = lastRow,
    rows = [],
    stoppedEarly = false;
  while (endRow >= 2 && rows.length < wanted) {
    const startRow = Math.max(2, endRow - chunkSize + 1),
      values = inquiryPerfRead_(
        s.getRange(startRow, 1, endRow - startRow + 1, headers.length),
        name,
      );
    for (let i = values.length - 1; i >= 0 && rows.length < wanted; i--) {
      const value = values[i],
        row = { _row: startRow + i };
      headers.forEach(function (header, column) {
        row[header] =
          value[column] instanceof Date
            ? value[column].toISOString()
            : String(value[column] === undefined ? "" : value[column]);
      });
      if (
        row.project_id === INQUIRY_PROJECT_ID &&
        row.inquiry_id === String(inquiryId)
      )
        rows.push(row);
    }
    endRow = startRow - 1;
    stoppedEarly = rows.length >= wanted && endRow >= 2;
  }
  rows.reverse();
  return { rows: rows, has_older: stoppedEarly };
}
function inquirySafeCell_(v) {
  return typeof v === "string" && /^[=+@-]/.test(v) ? "'" + v : v;
}
function inquiryGroupBy_(name, headers, key) {
  const cache = kagInquiryContext && kagInquiryContext.indexes;
  const cacheKey = name + ":" + key;
  if (cache && cache[cacheKey]) return cache[cacheKey];
  const grouped = {};
  inquiryRows_(name, headers).forEach(function (row) {
    const value = String(row[key] || "");
    (grouped[value] || (grouped[value] = [])).push(row);
  });
  if (cache) cache[cacheKey] = grouped;
  return grouped;
}
function inquiryUserReadMap_(username) {
  const cache = kagInquiryContext && kagInquiryContext.indexes;
  const cacheKey = "reads:" + username;
  if (cache && cache[cacheKey]) return cache[cacheKey];
  const result = {};
  inquiryRows_(KAG_INQUIRY_CONFIG.inquiryReadsSheetName, inquiryReadHeaders_())
    .forEach(function (row) {
      if (row.username === username) result[row.inquiry_id] = row;
    });
  if (cache) cache[cacheKey] = result;
  return result;
}
function inquiryAppend_(name, headers, obj) {
  inquirySheet_(name, headers).appendRow(
    headers.map(function (h) {
      return inquirySafeCell_(obj[h] === undefined ? "" : obj[h]);
    }),
  );
  if (kagInquiryContext) {
    delete kagInquiryContext.rows[name];
    kagInquiryContext.indexes = {};
  }
  return obj;
}
function inquiryNow_() {
  return new Date().toISOString();
}
function inquiryText_(v, max, label) {
  const s = String(v === undefined ? "" : v).trim();
  if (!s) throw new Error(label + " مطلوب");
  if (s.length > max) throw new Error(label + " يتجاوز الحد المسموح");
  return s;
}
function inquiryIsAdmin_(u) {
  return hasFullAccess_(u) || parseBool_(u.can_manage_users);
}
function inquiryCanUse_(u) {
  return !!u && !!u.username;
}
function inquiryCanViewTask_(u) {
  const p = normalizeAllowedPages_(u);
  return (
    hasFullAccess_(u) || p.indexOf("*") !== -1 || p.indexOf("tasks") !== -1
  );
}
function inquiryUsers_() {
  if (kagInquiryContext && kagInquiryContext.users) {
    inquiryPerfCache_(true);
    return kagInquiryContext.users;
  }
  inquiryPerfCache_(false);
  const sheet = inquirySpreadsheet_().getSheetByName(
    KAG_CONFIG.usersSheetName,
  );
  if (!sheet) throw new Error("جدول حسابات المستخدمين غير موجود");
  const values = inquiryPerfRead_(sheet.getDataRange(), KAG_CONFIG.usersSheetName),
    headers = values.shift() || [],
    seen = {};
  ["username", "status", "allowed_pages", "access_level"].forEach(function (h) {
    if (headers.indexOf(h) < 0) throw new Error("عنوان حسابات مفقود: " + h);
  });
  const users = values
    .map(function (row) {
      const user = {};
      headers.forEach(function (h, i) {
        user[String(h)] = row[i];
      });
      user.username = String(user.username || "")
        .trim()
        .toLowerCase();
      return user;
    })
    .filter(function (user) {
      if (
        !user.username ||
        String(user.status || "active")
          .trim()
          .toLowerCase() !== "active"
      )
        return false;
      if (seen[user.username])
        throw new Error("حساب مكرر في جدول المستخدمين: " + user.username);
      seen[user.username] = true;
      return true;
    });
  if (kagInquiryContext) kagInquiryContext.users = users;
  return users;
}
function inquiryPublicUser_(u) {
  return {
    username: String(u.username || ""),
    display_name: String(u.display_name || u.username || ""),
    role: String(u.role || ""),
  };
}
function inquiryFindUser_(username) {
  const key = String(username || "")
    .trim()
    .toLowerCase();
  return (
    inquiryUsers_().find(function (u) {
      return (
        String(u.username || "")
          .trim()
          .toLowerCase() === key
      );
    }) || null
  );
}
function inquiryTasks_() {
  if (kagInquiryContext && kagInquiryContext.tasks) {
    inquiryPerfCache_(true);
    return kagInquiryContext.tasks;
  }
  inquiryPerfCache_(false);
  const rows = readOfficialWbsTasks_(
    inquirySpreadsheet_(),
  ).rows;
  const perf = kagInquiryContext && kagInquiryContext.perf;
  if (perf) {
    perf.sheet_reads++;
    perf.rows_read += rows.length + 1;
  }
  if (!Array.isArray(rows)) throw new Error("تعذر قراءة المهام الرسمية");
  if (kagInquiryContext) kagInquiryContext.tasks = rows;
  return rows;
}
function inquiryTask_(taskId) {
  if (!taskId) return null;
  return (
    inquiryTasks_().find(function (r) {
      return taskCode_(r) === String(taskId);
    }) || null
  );
}
function inquiryEligibleRecipient_(username, task) {
  const u = inquiryFindUser_(username);
  if (!u) throw new Error("المستلم غير نشط أو غير موجود");
  if (task && !inquiryCanViewTask_(u))
    throw new Error("المستلم لا يملك صلاحية الاطلاع على المهمة");
  return u;
}
function inquiryFind_(id) {
  return (
    inquiryRows_(KAG_INQUIRY_CONFIG.inquiriesSheetName, inquiryHeaders_()).find(
      function (x) {
        return (
          x.inquiry_id === String(id) && x.project_id === INQUIRY_PROJECT_ID
        );
      },
    ) || null
  );
}
function inquiryCanAccess_(q, u) {
  return (
    inquiryIsAdmin_(u) ||
    q.sender_username === u.username ||
    q.recipient_username === u.username
  );
}
function inquiryRequire_(id, u) {
  const q = inquiryFind_(id);
  if (!q) throw new Error("الاستفسار غير موجود");
  if (!inquiryCanAccess_(q, u))
    throw new Error("Forbidden: inquiry access denied");
  return q;
}
function inquiryDisplayNameMap_() {
  if (kagInquiryContext && kagInquiryContext.indexes.displayNames)
    return kagInquiryContext.indexes.displayNames;
  const m = {};
  inquiryUsers_().forEach(function (u) {
    m[u.username] = u.display_name || u.username;
  });
  if (kagInquiryContext) kagInquiryContext.indexes.displayNames = m;
  return m;
}
function inquiryUpdateRow_(q, changes) {
  const h = inquiryHeaders_(),
    s = inquirySheet_(KAG_INQUIRY_CONFIG.inquiriesSheetName, h);
  Object.keys(changes).forEach(function (k) {
    q[k] = changes[k];
  });
  s.getRange(q._row, 1, 1, h.length).setValues([
    h.map(function (k) {
      return inquirySafeCell_(q[k] === undefined ? "" : q[k]);
    }),
  ]);
  if (kagInquiryContext)
    delete kagInquiryContext.rows[KAG_INQUIRY_CONFIG.inquiriesSheetName];
  if (kagInquiryContext) kagInquiryContext.indexes = {};
  return q;
}
function inquiryEvent_(q, type, actor, from, to, requestId) {
  return inquiryAppend_(
    KAG_INQUIRY_CONFIG.inquiryEventsSheetName,
    inquiryEventHeaders_(),
    {
      event_id: Utilities.getUuid(),
      inquiry_id: q.inquiry_id,
      project_id: INQUIRY_PROJECT_ID,
      event_type: type,
      actor_username: actor.username,
      from_value: from || "",
      to_value: to || "",
      created_at: inquiryNow_(),
      request_id: requestId || "",
    },
  );
}
function inquiryNotify_(q, username, kind, key) {
  if (!username) return;
  const h = inquiryNotificationHeaders_(),
    rows = inquiryRows_(KAG_INQUIRY_CONFIG.inquiryNotificationsSheetName, h);
  if (
    rows.some(function (n) {
      return n.request_key === key && n.username === username;
    })
  )
    return;
  inquiryAppend_(KAG_INQUIRY_CONFIG.inquiryNotificationsSheetName, h, {
    notification_id: Utilities.getUuid(),
    project_id: INQUIRY_PROJECT_ID,
    inquiry_id: q.inquiry_id,
    username: username,
    kind: kind,
    created_at: inquiryNow_(),
    read_at: "",
    request_key: key,
  });
}
function inquiryReadCursor_(q, u, replies) {
  replies = replies || inquiryTailRows_(
    KAG_INQUIRY_CONFIG.inquiryRepliesSheetName,
    inquiryReplyHeaders_(),
    q.inquiry_id,
    1,
  ).rows;
  const notifications = inquiryRows_(
    KAG_INQUIRY_CONFIG.inquiryNotificationsSheetName,
    inquiryNotificationHeaders_(),
  ).filter(function (n) {
    return (
      n.inquiry_id === q.inquiry_id && n.username === u.username && !n.read_at
    );
  });
  const boundaries = [q.created_at]
    .concat(
      replies.map(function (r) {
        return r.created_at;
      }),
    )
    .filter(Boolean)
    .sort();
  return {
    through_at: boundaries.length ? boundaries[boundaries.length - 1] : "",
    notification_ids: notifications.map(function (n) {
      return n.notification_id;
    }),
  };
}
function inquiryReplyBoundaryExists_(inquiryId, through) {
  const headers = inquiryReplyHeaders_(),
    sheet = inquirySheet_(KAG_INQUIRY_CONFIG.inquiryRepliesSheetName, headers),
    createdAtColumn = headers.indexOf("created_at"),
    inquiryIdColumn = headers.indexOf("inquiry_id"),
    projectIdColumn = headers.indexOf("project_id");
  let endRow = sheet.getLastRow();
  while (endRow >= 2) {
    const startRow = Math.max(2, endRow - INQUIRY_DETAIL_CHUNK_SIZE + 1),
      values = inquiryPerfRead_(
        sheet.getRange(startRow, 1, endRow - startRow + 1, headers.length),
        KAG_INQUIRY_CONFIG.inquiryRepliesSheetName,
      );
    if (values.some(function (row) {
      const createdAt = row[createdAtColumn] instanceof Date
        ? row[createdAtColumn].toISOString()
        : String(row[createdAtColumn] === undefined ? "" : row[createdAtColumn]);
      return (
        String(row[inquiryIdColumn] || "") === String(inquiryId) &&
        String(row[projectIdColumn] || "") === INQUIRY_PROJECT_ID &&
        createdAt === through
      );
    })) return true;
    endRow = startRow - 1;
  }
  return false;
}
function inquiryMarkRead_(q, u, cursor) {
  const through = String((cursor && cursor.through_at) || ""),
    ids = Array.isArray(cursor && cursor.notification_ids)
      ? cursor.notification_ids.map(String)
      : [];
  const parsed = Date.parse(through),
    nowMs = Date.now();
  if (!through || !isFinite(parsed) || parsed > nowMs)
    throw new Error("حد القراءة غير صالح");
  if (through !== q.created_at && !inquiryReplyBoundaryExists_(q.inquiry_id, through))
    throw new Error("حد القراءة لم يعد صالحًا");
  const h = inquiryReadHeaders_(),
    s = inquirySheet_(KAG_INQUIRY_CONFIG.inquiryReadsSheetName, h),
    rows = inquiryRows_(KAG_INQUIRY_CONFIG.inquiryReadsSheetName, h),
    r = rows.find(function (x) {
      return x.inquiry_id === q.inquiry_id && x.username === u.username;
    });
  const current = r ? r.last_read_at : "",
    next = !current || through > current ? through : current,
    vals = {
      inquiry_id: q.inquiry_id,
      project_id: INQUIRY_PROJECT_ID,
      username: u.username,
      last_read_at: next,
    };
  if (!r)
    s.appendRow(
      h.map(function (k) {
        return vals[k];
      }),
    );
  else if (next !== current)
    s.getRange(r._row, 1, 1, h.length).setValues([
      h.map(function (k) {
        return vals[k];
      }),
    ]);
  const nh = inquiryNotificationHeaders_(),
    ns = inquirySheet_(KAG_INQUIRY_CONFIG.inquiryNotificationsSheetName, nh),
    allowed = {};
  ids.forEach(function (id) {
    allowed[id] = true;
  });
  const notificationRows = inquiryRows_(KAG_INQUIRY_CONFIG.inquiryNotificationsSheetName, nh)
    .filter(function (n) {
      return (
        allowed[n.notification_id] &&
        n.inquiry_id === q.inquiry_id &&
        n.username === u.username &&
        !n.read_at &&
        Date.parse(n.created_at) <= nowMs
      );
    })
    .map(function (n) {
      return "G" + n._row;
    });
  if (notificationRows.length)
    ns.getRangeList(notificationRows).setValue(inquiryNow_());
  if (kagInquiryContext) {
    delete kagInquiryContext.rows[KAG_INQUIRY_CONFIG.inquiryReadsSheetName];
    delete kagInquiryContext.rows[
      KAG_INQUIRY_CONFIG.inquiryNotificationsSheetName
    ];
    kagInquiryContext.indexes = {};
  }
  return { last_read_at: next };
}
function inquirySerializeImpl_(q, u, detail, detailLimit) {
  const names = inquiryDisplayNameMap_(),
    read = inquiryUserReadMap_(u.username)[q.inquiry_id],
    limit = Math.max(1, Math.min(Number(detailLimit) || INQUIRY_DETAIL_PAGE_SIZE, 1000)),
    replyPage = detail
      ? inquiryTailRows_(KAG_INQUIRY_CONFIG.inquiryRepliesSheetName, inquiryReplyHeaders_(), q.inquiry_id, limit)
      : null,
    eventPage = detail
      ? inquiryTailRows_(KAG_INQUIRY_CONFIG.inquiryEventsSheetName, inquiryEventHeaders_(), q.inquiry_id, limit)
      : null,
    replies = detail
      ? replyPage.rows
      : (inquiryGroupBy_(KAG_INQUIRY_CONFIG.inquiryRepliesSheetName, inquiryReplyHeaders_(), "inquiry_id")[q.inquiry_id] || []),
    events = detail ? eventPage.rows : [],
    notifications = inquiryGroupBy_(
      KAG_INQUIRY_CONFIG.inquiryNotificationsSheetName,
      inquiryNotificationHeaders_(),
      "inquiry_id",
    )[q.inquiry_id] || [],
    hasUnreadNotification = notifications.some(function (n) {
      return n.username === u.username && !n.read_at;
    });
  const last = read ? read.last_read_at : "",
    out = Object.assign({}, q, {
      sender_name: names[q.sender_username] || q.sender_username,
      recipient_name: names[q.recipient_username] || q.recipient_username,
      unread:
        hasUnreadNotification ||
        replies.some(function (r) {
          return (
            r.author_username !== u.username && (!last || r.created_at > last)
          );
        }),
    });
  if (q.task_id && !inquiryCanViewTask_(u)) {
    out.task_id = "";
    out.task_title = "";
  }
  delete out._row;
  if (detail) {
    out.replies = replies.map(function (r) {
      return Object.assign({}, r, {
        author_name: names[r.author_username] || r.author_username,
      });
    });
    out.events = events.map(function (e) {
      return Object.assign({}, e, {
        actor_name: names[e.actor_username] || e.actor_username,
      });
    });
    out.can_admin = inquiryIsAdmin_(u);
    out.can_reply = q.status !== "مغلق";
    out.read_cursor = inquiryReadCursor_(q, u, replies);
    out.reply_count = replies.length;
    out.event_count = events.length;
    out.has_older_replies = replyPage.has_older;
    out.has_older_events = eventPage.has_older;
  }
  return out;
}
function inquirySerialize_(q, u, detail, detailLimit) {
  return inquiryPerfTimed_("serialization", function () {
    return inquirySerializeImpl_(q, u, detail, detailLimit);
  });
}
function inquiryList_(u, scope) {
  if (scope === "all" && !inquiryIsAdmin_(u))
    throw new Error("Forbidden: administration required");
  return inquiryRows_(KAG_INQUIRY_CONFIG.inquiriesSheetName, inquiryHeaders_())
    .filter(function (q) {
      if (q.project_id !== INQUIRY_PROJECT_ID || !inquiryCanAccess_(q, u))
        return false;
      if (scope === "mine") return q.sender_username === u.username;
      if (scope === "assigned") return q.recipient_username === u.username;
      return true;
    })
    .map(function (q) {
      const item = inquirySerialize_(q, u, false);
      return {
        inquiry_id: item.inquiry_id,
        project_id: item.project_id,
        title: item.title,
        sender_username: item.sender_username,
        sender_name: item.sender_name,
        recipient_username: item.recipient_username,
        recipient_name: item.recipient_name,
        task_id: item.task_id,
        task_title: item.task_title,
        priority: item.priority,
        status: item.status,
        updated_at: item.updated_at,
        unread: item.unread,
      };
    })
    .sort(function (a, b) {
      return b.updated_at.localeCompare(a.updated_at);
    });
}
function inquirySummary_(u) {
  const all = inquiryRows_(KAG_INQUIRY_CONFIG.inquiriesSheetName, inquiryHeaders_())
      .filter(function (q) { return inquiryCanAccess_(q, u); }),
    reads = inquiryUserReadMap_(u.username),
    replies = inquiryGroupBy_(
      KAG_INQUIRY_CONFIG.inquiryRepliesSheetName,
      inquiryReplyHeaders_(),
      "inquiry_id",
    );
  return {
    needs_reply: all.filter(function (q) {
      return (
        q.recipient_username === u.username &&
        (q.status === "جديد" || q.status === "قيد المعالجة")
      );
    }).length,
    new_replies: all.filter(function (q) {
      if (q.sender_username !== u.username) return false;
      const read = reads[q.inquiry_id],
        last = read ? read.last_read_at : "";
      return (replies[q.inquiry_id] || []).some(function (r) {
        return (
          r.author_username !== u.username &&
          (!last || r.created_at > last)
        );
      });
    }).length,
  };
}
function inquiryListCacheKey_(u, generation) {
  return [
    "kag-inquiry-list-v1",
    u.username,
    inquiryIsAdmin_(u) ? "admin" : "user",
    inquiryCanViewTask_(u) ? "tasks" : "no-tasks",
    generation.global,
    generation.user,
  ].join(":");
}
function inquiryBuildListState_(u) {
  return { items: inquiryList_(u, "accessible"), summary: inquirySummary_(u) };
}
function inquiryResetListBuild_() {
  if (kagInquiryContext) {
    kagInquiryContext.rows = {};
    kagInquiryContext.indexes = {};
  }
}
function inquiryListState_(u) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = inquiryGenerationSnapshot_(u.username),
      key = inquiryListCacheKey_(u, before),
      cached = inquiryCacheGet_(key),
      afterGet = inquiryGenerationSnapshot_(u.username);
    if (cached && inquirySameGeneration_(before, afterGet)) {
      try {
        inquiryPerfCache_(true);
        return JSON.parse(cached);
      } catch (error) {
        inquiryCacheRemove_(key);
      }
    }
    inquiryPerfCache_(false);
    const state = inquiryBuildListState_(u),
      beforePut = inquiryGenerationSnapshot_(u.username);
    if (!inquirySameGeneration_(before, beforePut)) {
      inquiryResetListBuild_();
      if (attempt === 0) continue;
      return inquiryBuildListState_(u);
    }
    inquiryCachePut_(key, JSON.stringify(state), INQUIRY_LIST_CACHE_TTL_SECONDS);
    const afterPut = inquiryGenerationSnapshot_(u.username);
    if (!inquirySameGeneration_(before, afterPut)) {
      // A mutation raced cache publication. The versioned key is unreachable,
      // and best-effort removal avoids retaining even that obsolete copy.
      inquiryCacheRemove_(key);
      if (attempt === 0) {
        inquiryResetListBuild_();
        continue;
      }
      inquiryResetListBuild_();
      return inquiryBuildListState_(u);
    }
    return state;
  }
}
function inquiryListForScope_(state, u, scope) {
  if (scope === "mine")
    return state.items.filter(function (q) {
      return q.sender_username === u.username;
    });
  if (scope === "assigned")
    return state.items.filter(function (q) {
      return q.recipient_username === u.username;
    });
  return state.items;
}
function inquiryBootstrap_(u) {
  const active = inquiryUsers_(),
    eligible = active.filter(inquiryCanViewTask_),
    users = active
      .filter(function (x) {
        return x.username !== u.username;
      })
      .map(inquiryPublicUser_),
    tasks = inquiryCanViewTask_(u)
      ? inquiryTasks_()
          .map(function (t) {
            const email = String(taskField_(t, "ownerEmail") || "")
                .trim()
                .toLowerCase(),
              matches = email
                ? eligible.filter(function (x) {
                    return (
                      String(x.email || "")
                        .trim()
                        .toLowerCase() === email && x.username !== u.username
                    );
                  })
                : [];
            return {
              id: taskCode_(t),
              title: taskName_(t),
              eligible_recipients: eligible.map(function (x) {
                return x.username;
              }),
              suggested_recipient:
                matches.length === 1 ? matches[0].username : "",
            };
          })
          .filter(function (t) {
            return t.id;
          })
      : [];
  return {
    ok: true,
    users: users,
    tasks: tasks,
    can_admin: inquiryIsAdmin_(u),
    summary: inquirySummary_(u),
    notifications: inquiryRows_(
      KAG_INQUIRY_CONFIG.inquiryNotificationsSheetName,
      inquiryNotificationHeaders_(),
    )
      .filter(function (n) {
        return n.username === u.username && !n.read_at;
      })
      .filter(function (n) {
        const q = inquiryFind_(n.inquiry_id);
        return q && inquiryCanAccess_(q, u);
      }),
  };
}
function inquiryCreate_(p, u) {
  const requestId = inquiryText_(p.request_id, 100, "معرف الطلب"),
    existing = inquiryRows_(
      KAG_INQUIRY_CONFIG.inquiriesSheetName,
      inquiryHeaders_(),
    ).find(function (q) {
      return q.sender_username === u.username && q.request_id === requestId;
    });
  if (existing)
    return {
      ok: true,
      inquiry: inquirySerialize_(existing, u, true),
      deduplicated: true,
    };
  const title = inquiryText_(p.title, 150, "العنوان"),
    details = inquiryText_(p.details, 5000, "التفاصيل"),
    priority = String(p.priority || "عادي");
  if (INQUIRY_PRIORITY.indexOf(priority) < 0)
    throw new Error("أولوية غير صالحة");
  const task = inquiryTask_(String(p.task_id || "").trim());
  if (p.task_id && !task) throw new Error("المهمة غير موجودة");
  if (task && !inquiryCanViewTask_(u))
    throw new Error("لا تملك صلاحية الاطلاع على المهمة");
  const recipient = inquiryEligibleRecipient_(p.recipient_username, task),
    now = inquiryNow_(),
    q = {
      inquiry_id: Utilities.getUuid(),
      project_id: INQUIRY_PROJECT_ID,
      title: title,
      details: details,
      sender_username: u.username,
      recipient_username: recipient.username,
      task_id: task ? taskCode_(task) : "",
      task_title: task ? taskName_(task) : "",
      priority: priority,
      status: "جديد",
      created_at: now,
      updated_at: now,
      request_id: requestId,
    };
  inquiryAppend_(KAG_INQUIRY_CONFIG.inquiriesSheetName, inquiryHeaders_(), q);
  inquiryEvent_(q, "إنشاء", u, "", "جديد", requestId);
  inquiryNotify_(
    q,
    recipient.username,
    "استفسار جديد",
    "create:" + q.inquiry_id,
  );
  return { ok: true, inquiry: inquirySerialize_(q, u, true) };
}
function inquiryReply_(p, u, answer, deferSerialization) {
  const q = inquiryRequire_(p.inquiry_id, u);
  const body = inquiryText_(p.body, 5000, "الرد"),
    requestId = inquiryText_(p.request_id, 100, "معرف الطلب"),
    all = inquiryRows_(
      KAG_INQUIRY_CONFIG.inquiryRepliesSheetName,
      inquiryReplyHeaders_(),
    ),
    old = all.find(function (r) {
      return r.author_username === u.username && r.request_id === requestId;
    });
  if (old) {
    if (old.inquiry_id !== q.inquiry_id || old.body !== body)
      throw new Error("معرف طلب مستخدم لرد مختلف");
    return {
      ok: true,
      inquiry: deferSerialization ? q : inquirySerialize_(q, u, true),
      deduplicated: true,
    };
  }
  if (q.status === "مغلق") throw new Error("أعد فتح الاستفسار قبل الرد");
  if (answer && !(q.recipient_username === u.username || inquiryIsAdmin_(u)))
    throw new Error("Forbidden: current recipient required");
  const now = inquiryNow_();
  inquiryAppend_(
    KAG_INQUIRY_CONFIG.inquiryRepliesSheetName,
    inquiryReplyHeaders_(),
    {
      reply_id: Utilities.getUuid(),
      inquiry_id: q.inquiry_id,
      project_id: INQUIRY_PROJECT_ID,
      author_username: u.username,
      body: body,
      created_at: now,
      request_id: requestId,
    },
  );
  let status = q.status;
  if (answer) status = "تمت الإجابة";
  else if (u.username === q.sender_username && q.status === "تمت الإجابة")
    status = "قيد المعالجة";
  inquiryUpdateRow_(q, { status: status, updated_at: now });
  inquiryEvent_(q, "رد", u, "", status, requestId);
  const other =
    u.username === q.sender_username ? q.recipient_username : q.sender_username;
  inquiryNotify_(q, other, "رد جديد", "reply:" + requestId);
  return {
    ok: true,
    inquiry: deferSerialization ? q : inquirySerialize_(q, u, true),
  };
}
function inquiryStatus_(p, u) {
  const q = inquiryRequire_(p.inquiry_id, u),
    to = String(p.status || ""),
    from = q.status,
    req = inquiryText_(p.request_id, 100, "معرف الطلب");
  if (
    inquiryRows_(
      KAG_INQUIRY_CONFIG.inquiryEventsSheetName,
      inquiryEventHeaders_(),
    ).some(function (e) {
      return (
        e.actor_username === u.username &&
        e.request_id === req &&
        e.inquiry_id === q.inquiry_id
      );
    })
  )
    return {
      ok: true,
      inquiry: inquirySerialize_(q, u, true),
      deduplicated: true,
    };
  if (INQUIRY_STATUS.indexOf(to) < 0) throw new Error("حالة غير صالحة");
  const admin = inquiryIsAdmin_(u),
    sender = q.sender_username === u.username,
    recipient = q.recipient_username === u.username;
  let ok = false;
  if (to === "قيد المعالجة")
    ok =
      (from === "جديد" && (recipient || admin)) ||
      (from === "مغلق" && (sender || admin));
  if (to === "مغلق") ok = from !== "مغلق" && (sender || admin);
  if (!ok) throw new Error("انتقال الحالة غير مسموح");
  inquiryUpdateRow_(q, { status: to, updated_at: inquiryNow_() });
  inquiryEvent_(
    q,
    to === "مغلق" ? "إغلاق" : "إعادة فتح/بدء معالجة",
    u,
    from,
    to,
    req,
  );
  [q.sender_username, q.recipient_username]
    .filter(function (x, i, a) {
      return x !== u.username && a.indexOf(x) === i;
    })
    .forEach(function (x) {
      inquiryNotify_(q, x, to, "status:" + req + ":" + x);
    });
  return { ok: true, inquiry: inquirySerialize_(q, u, true) };
}
function inquiryRedirect_(p, u) {
  if (!inquiryIsAdmin_(u))
    throw new Error("Forbidden: administration required");
  const q = inquiryRequire_(p.inquiry_id, u),
    req = inquiryText_(p.request_id, 100, "معرف الطلب");
  if (
    inquiryRows_(
      KAG_INQUIRY_CONFIG.inquiryEventsSheetName,
      inquiryEventHeaders_(),
    ).some(function (e) {
      return (
        e.actor_username === u.username &&
        e.request_id === req &&
        e.inquiry_id === q.inquiry_id
      );
    })
  )
    return {
      ok: true,
      inquiry: inquirySerialize_(q, u, true),
      deduplicated: true,
    };
  if (q.status === "مغلق")
    throw new Error("أعد فتح الاستفسار قبل إعادة التوجيه");
  const task = q.task_id ? inquiryTask_(q.task_id) : null,
    next = inquiryEligibleRecipient_(p.recipient_username, task);
  if (next.username === q.recipient_username)
    throw new Error("المستلم الجديد مطابق للحالي");
  const from = q.recipient_username;
  inquiryUpdateRow_(q, {
    recipient_username: next.username,
    status: "جديد",
    updated_at: inquiryNow_(),
  });
  inquiryEvent_(q, "إعادة توجيه", u, from, next.username, req);
  inquiryNotify_(q, next.username, "إعادة توجيه", "redirect:" + req);
  return { ok: true, inquiry: inquirySerialize_(q, u, true) };
}
function inquiryValidateTables_() {
  if (inquiryCacheGet_(INQUIRY_SCHEMA_CACHE_KEY) === "valid") {
    inquiryPerfCache_(true);
    if (kagInquiryContext) kagInquiryContext.schemaValidated = true;
    return;
  }
  inquiryPerfCache_(false);
  inquirySheet_(KAG_INQUIRY_CONFIG.inquiriesSheetName, inquiryHeaders_());
  inquirySheet_(
    KAG_INQUIRY_CONFIG.inquiryRepliesSheetName,
    inquiryReplyHeaders_(),
  );
  inquirySheet_(
    KAG_INQUIRY_CONFIG.inquiryEventsSheetName,
    inquiryEventHeaders_(),
  );
  inquirySheet_(
    KAG_INQUIRY_CONFIG.inquiryReadsSheetName,
    inquiryReadHeaders_(),
  );
  inquirySheet_(
    KAG_INQUIRY_CONFIG.inquiryNotificationsSheetName,
    inquiryNotificationHeaders_(),
  );
  inquiryCachePut_(
    INQUIRY_SCHEMA_CACHE_KEY,
    "valid",
    INQUIRY_SCHEMA_CACHE_TTL_SECONDS,
  );
  if (kagInquiryContext) kagInquiryContext.schemaValidated = true;
}
function handleAuthenticatedInquiryAction_(payload) {
  kagInquiryContext = {
    rows: {},
    indexes: {},
    users: null,
    tasks: null,
    spreadsheet: null,
    schemaValidated: false,
    perf: inquiryPerfStart_(payload.action),
  };
  try {
    // Session validation remains authoritative; only its result is reused below.
    kagInquiryContext.perf.spreadsheet_accesses++;
    const session = inquiryPerfTimed_("requireSession", function () {
      return requireSession_(payload);
    });
    return handleInquiryAction_(payload, session);
  } finally {
    inquiryPerfFinish_();
    kagInquiryContext = null;
  }
}
function handleInquiryAction_(payload, session) {
  if (!session || !session.username) throw new Error("Unauthorized");
  const actions = [
    "inquiry_bootstrap",
    "inquiry_list",
    "inquiry_detail",
    "inquiry_mark_read",
    "inquiry_create",
    "inquiry_reply",
    "inquiry_answer",
    "inquiry_status",
    "inquiry_redirect",
  ];
  if (actions.indexOf(payload.action) < 0)
    throw new Error("Unsupported inquiry action");
  const ownsContext = !kagInquiryContext;
  if (ownsContext)
    kagInquiryContext = {
      rows: {},
      indexes: {},
      users: null,
      tasks: null,
      spreadsheet: null,
      schemaValidated: false,
      perf: inquiryPerfStart_(payload.action),
    };
  let lock = null;
  try {
    inquiryPerfTimed_("inquiryValidateTables", inquiryValidateTables_);
    // requireSession_ already resolved the current active user from the
    // authoritative Users sheet. Reuse that verified snapshot in this request.
    const user = typeof safeUser_ === "function" ? safeUser_(session) : session;
    user.username = String(session.username || "").trim().toLowerCase();
    if (payload.action === "inquiry_bootstrap")
      return inquiryPerfTimed_("inquiryBootstrap", function () {
        return inquiryBootstrap_(user);
      });
    if (payload.action === "inquiry_list") {
      const scope = String(payload.scope || "mine");
      if (["mine", "assigned", "all"].indexOf(scope) < 0)
        throw new Error("نطاق استفسارات غير صالح");
      if (scope === "all" && !inquiryIsAdmin_(user))
        throw new Error("Forbidden: administration required");
      return inquiryPerfResponse_(inquiryPerfTimed_("inquiryList", function () {
        const state = inquiryListState_(user);
        return {
          ok: true,
          items: inquiryListForScope_(state, user, scope),
          summary: state.summary,
        };
      }));
    }
    if (payload.action === "inquiry_detail") {
      return inquiryPerfResponse_(inquiryPerfTimed_("inquiryDetail", function () {
        const q = inquiryRequire_(payload.inquiry_id, user);
        return {
          ok: true,
          inquiry: inquirySerialize_(q, user, true, payload.message_limit),
        };
      }));
    }
    lock = LockService.getScriptLock();
    if (!lock.tryLock(1000))
      throw new Error("الخدمة مشغولة الآن، أعد المحاولة بعد قليل");
    kagInquiryContext.rows = {};
    kagInquiryContext.indexes = {};
    if (payload.action === "inquiry_mark_read") {
      const result = inquiryPerfTimed_("inquiryMarkRead", function () {
        const q = inquiryRequire_(payload.inquiry_id, user);
        return inquiryMarkRead_(q, user, payload.read_cursor);
      });
      inquiryInvalidateUser_(user.username);
      lock.releaseLock();
      lock = null;
      return inquiryPerfResponse_({
        ok: true,
        last_read_at: result.last_read_at,
        summary: inquirySummary_(user),
      });
    }
    if (payload.action === "inquiry_create") {
      const result = inquiryCreate_(payload, user);
      if (!result.deduplicated) inquiryInvalidateGlobal_();
      return result;
    }
    if (
      payload.action === "inquiry_reply" ||
      payload.action === "inquiry_answer"
    ) {
      const result = inquiryPerfTimed_("inquiryReply", function () {
        return inquiryReply_(
          payload,
          user,
          payload.action === "inquiry_answer",
          true,
        );
      });
      if (!result.deduplicated) inquiryInvalidateGlobal_();
      lock.releaseLock();
      lock = null;
      kagInquiryContext.rows = {};
      kagInquiryContext.indexes = {};
      result.inquiry = inquirySerialize_(
        inquiryRequire_(payload.inquiry_id, user),
        user,
        true,
      );
      return result;
    }
    if (payload.action === "inquiry_status") {
      const result = inquiryPerfTimed_("inquiryStatus", function () {
        return inquiryStatus_(payload, user);
      });
      if (!result.deduplicated) inquiryInvalidateGlobal_();
      return result;
    }
    const result = inquiryPerfTimed_("inquiryRedirect", function () {
      return inquiryRedirect_(payload, user);
    });
    if (!result.deduplicated) inquiryInvalidateGlobal_();
    return result;
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
    if (ownsContext) {
      inquiryPerfFinish_();
      kagInquiryContext = null;
    }
  }
}
