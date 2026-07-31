/**
 * Konneqta Feedback -> Google Sheets
 * ==================================
 *
 * DEPLOYMENT (one-time setup):
 *   1. Create a new Google Sheet.
 *   2. Extensions -> Apps Script.
 *   3. Delete any boilerplate, paste this entire file.
 *   4. Run `setupSheet` once (creates the header row + formatting).
 *      Approve the permissions prompt (it needs Spreadsheet access).
 *   5. Deploy -> New deployment -> Web app.
 *        - Description: "Konneqta Feedback Receiver"
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   6. Copy the Web App URL (ends in /exec).
 *   7. Paste it into the project's .env.local as:
 *        FEEDBACK_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/XXXX/exec
 *
 * The sheet auto-appends a row each time POST /api/feedback fires.
 */

// Column order MUST match FeedbackPayload in lib/feedback/google-sheets.ts.
var COLUMNS = [
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
 * One-time setup: write the header row + freeze it + bold-format.
 * Run this manually from the Apps Script editor after pasting this file.
 */
function setupSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Feedback");
  sheet.clear();
  sheet.appendRow(COLUMNS);
  sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, COLUMNS.length);
}

/**
 * Web App entry point — receives POST from /api/feedback.
 * Body: JSON matching FeedbackPayload.
 */
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Feedback");
    var data = JSON.parse(e.postData.contents);

    // Ensure headers exist (in case setupSheet wasn't run).
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(COLUMNS);
      sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    var row = [
      data.feedbackId || "",
      data.timestamp || "",
      data.sentiment || "",
      data.category || "",
      data.context || "",
      data.comment || "",
      data.rating !== null && data.rating !== undefined ? data.rating : "",
      data.plan || "",
      data.engagementScore !== undefined ? data.engagementScore : "",
      data.shares !== undefined ? data.shares : "",
      data.profileViews !== undefined ? data.profileViews : "",
      data.qrScans !== undefined ? data.qrScans : "",
      data.vcardDownloads !== undefined ? data.vcardDownloads : "",
      data.featureBeingUsed || "",
      data.sessionDuration || "",
      data.appVersion || "",
      data.browserOs || "",
      data.email || ""
    ];

    sheet.appendRow(row);
    autoSizeIfNeeded(sheet);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Keep rows from getting too wide without a manual resize after each append.
function autoSizeIfNeeded(sheet) {
  try {
    sheet.autoResizeColumns(1, COLUMNS.length);
  } catch (e) {
    // Non-fatal — some columns may be too large to resize.
  }
}

/**
 * GET handler — returns a simple health-check so you can verify the Web App
 * URL is correct by opening it in a browser.
 */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: "konneqta-feedback" }))
    .setMimeType(ContentService.MimeType.JSON);
}