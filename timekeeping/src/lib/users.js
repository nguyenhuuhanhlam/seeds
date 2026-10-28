// Lưu trữ cục bộ (localStorage) — app chạy hoàn toàn trên trình duyệt,
// không có server, không gửi dữ liệu đi đâu.
export const USERS_KEY = 'timekeeping-users-v1';
export const RESULT_KEY = 'timekeeping-result-v1';

export function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** users list -> { uid: { name, dept } } (dạng employee_info của bản Python). */
export function usersToMap(users) {
  const map = {};
  for (const u of users) {
    const uid = String(u.member_id ?? '').trim();
    if (!uid) continue;
    map[uid] = {
      name: u.name ?? '',
      dept: u.department ?? '',
    };
  }
  return map;
}

export function saveResult(result) {
  try {
    localStorage.setItem(RESULT_KEY, JSON.stringify(result));
  } catch {
    // localStorage đầy / bị chặn: kết quả vẫn hiển thị trong phiên hiện tại
  }
}

export function loadResult() {
  try {
    const raw = localStorage.getItem(RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function downloadFile(filename, content, mime) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
