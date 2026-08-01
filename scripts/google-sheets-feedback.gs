/**
 * Konneqta → Google Sheets (unified)
 * ==================================
 *
 * A SINGLE Apps Script Web App handles all three inbound flows:
 *   - waitlist  (POST body.sheet = "waitlist")
 *   - contact   (POST body.sheet = "contact")
 *   - feedback  (POST body.sheet = "feedback")
 *
 * The `sheet` field selects the handler. If omitted/unknown it falls back to
 * the waitlist handler (the original behaviour), so keep `sheet` explicit on
 * the contact + feedback routes to avoid mis-routing.
 *
 * DEPLOYMENT (one-time setup):
 *   1. Create a Google Sheet with three tabs named exactly:
 *        "Waitlist", "Contact", "Feedback".
 *   2. Extensions → Apps Script → paste this file.
 *   3. Run `setupFeedbackSheet` once to create the Feedback header row.
 *      Approve the permissions prompt (it needs Spreadsheet access).
 *   4. Deploy → New deployment → Web app.
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   5. Copy the Web App URL (ends in /exec).
 *   6. Paste it into the project's .env.local as:
 *        GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/XXXX/exec
 *
 * Next.js routes that POST here:
 *   - app/api/waitlist/route.ts
 *   - app/api/contact/route.ts   (sends sheet: "Contact")
 *   - app/api/feedback/route.ts  (sends sheet: "feedback" via lib/feedback/google-sheets.ts)
 */

var SHEET_NAMES = {
  waitlist: "Waitlist",
  contact: "Contact",
  feedback: "Feedback"
};

// Column order MUST match FeedbackPayload in lib/feedback/google-sheets.ts.
var FEEDBACK_COLUMNS = [
  "Feedback ID",
  "Timestamp",
  "Sentiment",
  "Category",
  "Context",
  "Comment",
  "Rating",
  "Plan",
  "Engagement Score",
  "Shares",
  "Profile Views",
  "QR Scans",
  "vCard Downloads",
  "Feature Being Used",
  "Session Duration",
  "App Version",
  "Browser / OS",
  "Email"
];

/**
 * Web App entry point — dispatches on body.sheet.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        success: false,
        message: "No POST body received."
      });
    }

    var data = JSON.parse(e.postData.contents);

    switch ((data.sheet || "").toLowerCase()) {
      case "contact":
        return handleContact(data);

      case "feedback":
        return handleFeedback(data);

      case "waitlist":
      default:
        // Unknown/omitted sheet → waitlist (original behaviour).
        return handleWaitlist(data);
    }
  } catch (err) {
    return jsonResponse({
      success: false,
      message: String(err)
    });
  }
}

/**
 * GET handler — simple health check so you can open the Web App URL in a
 * browser to confirm it's live and the URL is correct.
 */
function doGet() {
  return jsonResponse({
    success: true,
    service: "Konneqta Apps Script",
    version: "1.0.0"
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handleWaitlist(data) {
  var sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(SHEET_NAMES.waitlist);

  if (!sheet) {
    return jsonResponse({
      success: false,
      message: 'Sheet "' + SHEET_NAMES.waitlist + '" not found.'
    });
  }

  var name = (data.name || "").trim();
  var email = (data.email || "").trim().toLowerCase();
  var phone = (data.phone || "").trim();

  if (!name || !email) {
    return jsonResponse({
      success: false,
      message: "Name and email are required."
    });
  }

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1] && rows[i][1].toString().toLowerCase() === email) {
      return jsonResponse({
        success: false,
        duplicate: true,
        message: "You're already on the waitlist!"
      });
    }
  }

  sheet.appendRow([name, email, phone, new Date()]);
  return jsonResponse({ success: true });
}

function handleContact(data) {
  var sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(SHEET_NAMES.contact);

  if (!sheet) {
    return jsonResponse({
      success: false,
      message: 'Sheet "' + SHEET_NAMES.contact + '" not found.'
    });
  }

  var name = (data.name || "").trim();
  var email = (data.email || "").trim().toLowerCase();
  var message = (data.message || "").trim();

  if (!name || !email || !message) {
    return jsonResponse({
      success: false,
      message: "Name, email, and message are required."
    });
  }

  sheet.appendRow([name, email, message, new Date()]);
  return jsonResponse({ success: true });
}

function handleFeedback(data) {
  var sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(SHEET_NAMES.feedback);

  if (!sheet) {
    return jsonResponse({
      success: false,
      message: 'Sheet "' + SHEET_NAMES.feedback + '" not found.'
    });
  }

  sheet.appendRow([
    data.feedbackId != null ? data.feedbackId : "",
    data.timestamp != null ? data.timestamp : "",
    data.sentiment != null ? data.sentiment : "",
    data.category != null ? data.category : "",
    data.context != null ? data.context : "",
    data.comment != null ? data.comment : "",
    data.rating != null ? data.rating : "",
    data.plan != null ? data.plan : "",
    data.engagementScore != null ? data.engagementScore : "",
    data.shares != null ? data.shares : "",
    data.profileViews != null ? data.profileViews : "",
    data.qrScans != null ? data.qrScans : "",
    data.vcardDownloads != null ? data.vcardDownloads : "",
    data.featureBeingUsed != null ? data.featureBeingUsed : "",
    data.sessionDuration != null ? data.sessionDuration : "",
    data.appVersion != null ? data.appVersion : "",
    data.browserOs != null ? data.browserOs : "",
    data.email != null ? data.email : ""
  ]);

  sheet.autoResizeColumns(1, FEEDBACK_COLUMNS.length);
  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------------------
// Setup helpers (run manually from the Apps Script editor)
// ---------------------------------------------------------------------------

/**
 * One-time setup for the Feedback tab: header row + bold + freeze + resize.
 */
function setupFeedbackSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_NAMES.feedback);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAMES.feedback);
  }

  sheet.clear();
  sheet.appendRow(FEEDBACK_COLUMNS);
  sheet.getRange(1, 1, 1, FEEDBACK_COLUMNS.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, FEEDBACK_COLUMNS.length);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}