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
