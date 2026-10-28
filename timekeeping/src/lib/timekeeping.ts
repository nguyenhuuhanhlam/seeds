/**
 * Port chính xác của timekeeping_minutes.py (bản Python gốc, Streamlit)
 * sang TypeScript thuần — không import gì từ UI, để test được bằng node.
 *
 * CÔNG THỨC (ca HC):
 *   Sáng 08:30–12:00, chiều 13:00–17:30, 8h = 1 công (480 phút).
 *   Trễ (min) = max(Vào − 08:30, 0); Công Trễ = Trễ / 480 (4 chữ số).
 *   TG (hours) = số phút của [Vào, Ra] nằm trong 2 khung chuẩn / 60 (2 chữ số);
 *   phần đi sớm trước 08:30 / về sau 17:30 KHÔNG tính vào TG.
 *   CôngTG = TG (phút) / 480 (4 chữ số).
 *   LT (min) = max(Ra − 17:30, 0); Công LT = LT / 480.
 *   1 lần chấm duy nhất trong ngày → Ra không xác định, TG/CôngTG = "-".
 *
 * Lưu ý làm tròn: Python round() là round-half-even (làm tròn về số chẵn
 * khi đúng nửa), khác Math.round của JS — hàm pyRound dưới đây mô phỏng
 * đúng hành vi đó để tổng tháng khớp với bản Python.
 */

export const HC_MORNING_START_MIN = 8 * 60 + 30; // 08:30
export const HC_MORNING_END_MIN = 12 * 60; // 12:00
export const HC_AFTERNOON_START_MIN = 13 * 60; // 13:00
export const HC_AFTERNOON_END_MIN = 17 * 60 + 30; // 17:30
export const NGAY_CONG_MINUTES = 8 * 60; // 480 phút = 1 công

const THU_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']; // theo getUTCDay(): CN=0

const LINE_RE = /^\s*(\d+)\s+(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/;

export interface PunchDay {
  vaoMs: number; // epoch ms (UTC) của lần chấm sớm nhất
  raMs: number; // epoch ms (UTC) của lần chấm muộn nhất
  count: number;
}

export type Punches = Map<string, Map<string, PunchDay>>; // uid -> "YYYY-MM-DD" -> PunchDay

export type DayRecord = {
  'Ngày': string;
  'Thứ': string;
  'Ca': string;
  'Vào': string;
  'Ra': string;
  'Trễ (min)': number | string;
  'Công Trễ': number | string;
  'TG (hours)': number | string;
  'CôngTG': number | string;
  'LT': number | string;
  'Công LT': number | string;
  'Kí hiệu': string;
};

export type Summary = {
  'Công làm': number;
  'Số lần trễ': number;
  'Tổng Trễ (phút)': number;
  'Tổng Công Trễ': number;
  'Tổng TG (hours)': number;
  'Tổng CôngTG': number;
  'Tổng LT (phút)': number;
  'Tổng Công LT': number;
};

export type UserResult = { records: DayRecord[]; summary: Summary };
export type TimekeepingData = Record<string, UserResult>;

/** Làm tròn kiểu Python round(x, digits): half-even, trên giá trị nhị phân
 * chính xác của số double (không phải trên x*10**digits — phép nhân đó
 * tự nó đã làm tròn sai nửa đơn vị, gây lệch 0.0001 ở các giá trị như
 * 441/480 = 0.91875). Dùng toPrecision(17) để lấy khai triển thập phân
 * chính xác của double rồi làm tròn half-even trên chuỗi đó. */
export function pyRound(x: number, digits: number): number {
  if (!Number.isFinite(x)) return x;
  const neg = x < 0;
  let s = Math.abs(x).toPrecision(17);
  if (s.includes('e') || s.includes('E')) s = Math.abs(x).toFixed(20);
  const [intRaw, fracRaw = ''] = s.split('.');
  const keep = fracRaw.slice(0, digits).padEnd(digits, '0');
  const nextDigit = fracRaw[digits] ?? '0';
  const rest = fracRaw.slice(digits + 1);
  const lastKept = digits === 0 ? Number(intRaw.slice(-1)) : Number(keep[digits - 1]);
  const exactlyHalf = nextDigit === '5' && rest.replace(/0/g, '') === '';
  const roundUp =
    nextDigit > '5' || (exactlyHalf ? lastKept % 2 === 1 : nextDigit === '5');
  let intPart = intRaw;
  let fracPart = keep;
  if (roundUp) {
    if (digits === 0) {
      intPart = String(BigInt(intPart) + 1n);
    } else {
      const bumped = (BigInt(keep || '0') + 1n).toString().padStart(digits, '0');
      if (bumped.length > digits) {
        intPart = String(BigInt(intPart) + 1n);
        fracPart = '0'.repeat(digits);
      } else {
        fracPart = bumped;
      }
    }
  }
  const out = digits === 0 ? intPart : `${intPart}.${fracPart}`;
  const val = Number(out);
  return neg ? -val : val;
}

function dayKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseDayKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

function weekdayLabel(y: number, m: number, d: number): string {
  return THU_VN[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Số phút t2 − t1 (cùng ngày), làm tròn xuống như Python // 60. */
function calcMinutesDiff(t1Sec: number, t2Sec: number): number {
  return Math.floor((t2Sec - t1Sec) / 60);
}

/** Số phút giao nhau giữa [vao, ra] và khung [startMin, endMin]; bỏ phần giây. */
function overlapMinutes(vaoMs: number, raMs: number, startMin: number, endMin: number): number {
  const dayStartMs = Date.UTC(
    new Date(vaoMs).getUTCFullYear(),
    new Date(vaoMs).getUTCMonth(),
    new Date(vaoMs).getUTCDate(),
  );
  const winStart = dayStartMs + startMin * 60000;
  const winEnd = dayStartMs + endMin * 60000;
  const lo = Math.max(Math.floor(vaoMs / 60000) * 60000, winStart);
  const hi = Math.min(Math.floor(raMs / 60000) * 60000, winEnd);
  if (hi <= lo) return 0;
  return Math.floor((hi - lo) / 60000);
}

function timeOfDaySec(ms: number): number {
  const d = new Date(ms);
  return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
}

function hhmm(ms: number | null): string {
  if (ms == null) return '';
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function parseRawLines(
  text: string,
  monthFilter: { year: number; month: number } | null = null,
): Punches {
  const punches: Punches = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = LINE_RE.exec(line);
    if (!m) continue;
    const uid = m[1];
    const y = Number(m[2]);
    const mo = Number(m[3]);
    const d = Number(m[4]);
    const dtMs = Date.UTC(y, mo - 1, d, Number(m[5]), Number(m[6]), Number(m[7]));
    if (Number.isNaN(dtMs)) continue;
    if (monthFilter && (y !== monthFilter.year || mo !== monthFilter.month)) continue;
    const key = dayKey(y, mo, d);
    let dayMap = punches.get(uid);
    if (!dayMap) {
      dayMap = new Map();
      punches.set(uid, dayMap);
    }
    const entry = dayMap.get(key);
    if (!entry) {
      dayMap.set(key, { vaoMs: dtMs, raMs: dtMs, count: 1 });
    } else {
      if (dtMs < entry.vaoMs) entry.vaoMs = dtMs;
      if (dtMs > entry.raMs) entry.raMs = dtMs;
      entry.count += 1;
    }
  }
  return punches;
}

export function buildDayRecord(
  day: { y: number; m: number; d: number },
  vaoMs: number | null,
  raMs: number | null,
): DayRecord {
  const record: DayRecord = {
    'Ngày': `${day.m}/${day.d}/${day.y}`,
    'Thứ': weekdayLabel(day.y, day.m, day.d),
    'Ca': 'HC',
    'Vào': hhmm(vaoMs),
    'Ra': hhmm(raMs),
    'Trễ (min)': 0,
    'Công Trễ': 0,
    'TG (hours)': '-',
    'CôngTG': '-',
    'LT': 0,
    'Công LT': 0,
    'Kí hiệu': '',
  };

  if (vaoMs != null) {
    const treMin = Math.max(
      calcMinutesDiff(HC_MORNING_START_MIN * 60, timeOfDaySec(vaoMs)),
      0,
    );
    record['Trễ (min)'] = treMin;
    record['Công Trễ'] = pyRound(treMin / NGAY_CONG_MINUTES, 4);
  }

  if (raMs != null) {
    const ltMin = Math.max(
      calcMinutesDiff(HC_AFTERNOON_END_MIN * 60, timeOfDaySec(raMs)),
      0,
    );
    record['LT'] = ltMin;
    record['Công LT'] = pyRound(ltMin / NGAY_CONG_MINUTES, 4);
  }

  if (vaoMs != null && raMs != null && raMs > vaoMs) {
    const tgMinutes =
      overlapMinutes(vaoMs, raMs, HC_MORNING_START_MIN, HC_MORNING_END_MIN) +
      overlapMinutes(vaoMs, raMs, HC_AFTERNOON_START_MIN, HC_AFTERNOON_END_MIN);
    record['TG (hours)'] = pyRound(tgMinutes / 60, 2);
    record['CôngTG'] = pyRound(tgMinutes / NGAY_CONG_MINUTES, 4);
  } else if (vaoMs == null && raMs == null) {
    // Không chấm công cả ngày: T7/CN -> 0 ; ngày thường (vắng) -> "-"
    const wd = new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
    if (wd === 0 || wd === 6) {
      record['TG (hours)'] = 0;
      record['CôngTG'] = 0;
    }
  }
  // else: chỉ có 1 trong 2 (Vào hoặc Ra) -> giữ "-" (thiếu dữ liệu)

  return record;
}

export function buildBlankDayRecord(day: { y: number; m: number; d: number }): DayRecord {
  return {
    'Ngày': `${day.m}/${day.d}/${day.y}`,
    'Thứ': weekdayLabel(day.y, day.m, day.d),
    'Ca': '',
    'Vào': '',
    'Ra': '',
    'Trễ (min)': '',
    'Công Trễ': '',
    'TG (hours)': '',
    'CôngTG': '',
    'LT': '',
    'Công LT': '',
    'Kí hiệu': '',
  };
}

export function computeSummary(rows: DayRecord[]): Summary {
  const isNum = (v: unknown): v is number => typeof v === 'number';
  const sum = (key: keyof DayRecord): number =>
    rows.reduce((acc, r) => acc + (isNum(r[key]) ? (r[key] as number) : 0), 0);
  return {
    'Công làm': rows.filter((r) => r['Vào']).length,
    'Số lần trễ': rows.filter((r) => isNum(r['Trễ (min)']) && (r['Trễ (min)'] as number) > 0).length,
    'Tổng Trễ (phút)': sum('Trễ (min)'),
    'Tổng Công Trễ': pyRound(sum('Công Trễ'), 2),
    'Tổng TG (hours)': pyRound(sum('TG (hours)'), 2),
    'Tổng CôngTG': pyRound(sum('CôngTG'), 2),
    'Tổng LT (phút)': sum('LT'),
    'Tổng Công LT': pyRound(sum('Công LT'), 2),
  };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function buildJson(
  punches: Punches,
  month: { year: number; month: number } | null = null,
): TimekeepingData {
  const result: TimekeepingData = {};
  let allDays: { y: number; m: number; d: number }[] | null = null;
  if (month) {
    const n = daysInMonth(month.year, month.month);
    allDays = Array.from({ length: n }, (_, i) => ({
      y: month.year,
      m: month.month,
      d: i + 1,
    }));
  }
  for (const [uid, days] of punches) {
    const rows: DayRecord[] = [];
    const dayList = allDays ?? [...days.keys()].sort().map(parseDayKey);
    for (const day of dayList) {
      const key = dayKey(day.y, day.m, day.d);
      const entry = days.get(key);
      if (entry) {
        // Chỉ có 1 lần chấm -> không xác định được giờ ra
        rows.push(buildDayRecord(day, entry.vaoMs, entry.count === 1 ? null : entry.raMs));
      } else {
        rows.push(buildBlankDayRecord(day));
      }
    }
    result[uid] = { records: rows, summary: computeSummary(rows) };
  }
  return result;
}

export function parseMonthArg(value: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{1,2})$/.exec(value.trim());
  if (!m) throw new Error('Định dạng phải là YYYY-MM, ví dụ 2026-07');
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error('Tháng phải từ 1-12');
  return { year, month };
}

/** Tháng trước so với hôm nay, dạng YYYY-MM (mặc định của bản Streamlit). */
export function previousMonthString(now = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based; tháng trước = m (vì tháng hiện tại là m+1)
  const d = new Date(y, m, 0); // ngày cuối tháng trước
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
