// simplePages calendar — Google Apps Script ウェブアプリ
// デプロイ: 種類「ウェブアプリ」/ 次のユーザーとして実行「自分」/ アクセスできるユーザー「全員」
// 設定を変えたら「デプロイを管理」から同じデプロイを新バージョンで更新する(URL は変わらない)。

const TOKEN = ''; // 空なら認証なし。値を入れたら calendar ページの「トークン」にも同じ値を入れる
const MAX_DAYS = 120;

// CalendarEvent.getColor() は色番号("1"〜"11")を返すので 16 進に変換する
const EVENT_COLORS = {
  '1': '#a4bdfc', '2': '#7ae7bf', '3': '#dbadff', '4': '#ff887c', '5': '#fbd75b', '6': '#ffb878',
  '7': '#46d6db', '8': '#e1e1e1', '9': '#5484ed', '10': '#51b749', '11': '#dc2127',
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (TOKEN && p.token !== TOKEN) return json({ ok: false, error: 'unauthorized' });
    const tz = Session.getScriptTimeZone();
    if (p.action === 'list') return json({ ok: true, tz: tz, generatedAt: iso(new Date(), tz), calendars: listCalendars() });
    const from = parseYmd(p.from), to = parseYmd(p.to);
    if (!from || !to || to <= from) return json({ ok: false, error: 'bad_request' });
    if (Math.round((to - from) / 86400000) > MAX_DAYS) return json({ ok: false, error: 'range_too_large' });
    const wanted = p.cal ? String(p.cal).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : null;
    const calendars = wanted
      ? wanted.map(function (id) {
          try { return CalendarApp.getCalendarById(id) || { missing: id }; } catch (err) { return { missing: id }; }
        })
      : CalendarApp.getAllCalendars();
    const outCals = [], events = [], errors = [];
    calendars.forEach(function (c) {
      if (c.missing) { errors.push({ calendarId: c.missing, error: 'not_found' }); return; }
      const id = c.getId(), calColor = hex(c.getColor());
      outCals.push({ id: id, name: c.getName(), color: calColor });
      try {
        c.getEvents(from, to).forEach(function (ev) {
          const allDay = ev.isAllDayEvent();
          events.push({
            id: ev.getId() + '_' + Utilities.formatDate(ev.getStartTime(), 'UTC', "yyyyMMdd'T'HHmmss'Z'"), calendarId: id, title: ev.getTitle(),
            start: allDay ? ymd(ev.getAllDayStartDate(), tz) : iso(ev.getStartTime(), tz),
            end: allDay ? ymd(ev.getAllDayEndDate(), tz) : iso(ev.getEndTime(), tz),
            allDay: allDay,
            location: ev.getLocation() || '',
            description: plainText(ev.getDescription() || ''),
            color: EVENT_COLORS[ev.getColor()] || calColor,
          });
        });
      } catch (err) {
        errors.push({ calendarId: id, error: String((err && err.message) || err) });
      }
    });
    return json({ ok: true, tz: tz, generatedAt: iso(new Date(), tz), calendars: outCals, events: events, errors: errors });
  } catch (err) {
    return json({ ok: false, error: 'internal', detail: String((err && err.message) || err) });
  }
}

function listCalendars() {
  return CalendarApp.getAllCalendars().map(function (c) { return { id: c.getId(), name: c.getName(), color: hex(c.getColor()) }; });
}
function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function iso(d, tz) { return Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function ymd(d, tz) { return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); }
function hex(c) { const m = /^#?([0-9a-fA-F]{6})$/.exec(String(c || '')); return m ? '#' + m[1].toLowerCase() : ''; }
// 説明は HTML で返ることがあるのでタグを落として改行だけ残す
function plainText(s) {
  return String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); }).replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n').trim();
}
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
