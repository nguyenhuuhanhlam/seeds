// Bảng công tháng — trang chính: nạp file log -> tính công -> xem kết quả
// -> xuất Excel / JSON / bản in PDF. Mọi tính toán chạy trên trình duyệt.
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Divider } from '@astryxdesign/core/Divider';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { useRef, useState } from 'react';

import DetailTable from '../components/DetailTable.jsx';
import { PlusIcon } from '../components/icons.jsx';
import { buildXlsxBlob } from '../lib/export-xlsx.js';
import { buildJson, parseMonthArg, parseRawLines, previousMonthString } from '../lib/timekeeping.ts';
import { downloadFile, loadResult, loadUsers, saveResult, saveUsers, usersToMap } from '../lib/users.js';

const SAMPLE_BASE = `${import.meta.env.BASE_URL}sample/`;

export default function ChamCong() {
  const [logText, setLogText] = useState('');
  const [fileName, setFileName] = useState('');
  const [month, setMonth] = useState(previousMonthString());
  const [format, setFormat] = useState('xlsx');
  const [users, setUsers] = useState(loadUsers());
  const [result, setResult] = useState(loadResult());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const infoMap = usersToMap(users);

  const run = (text, monthStr, usersList) => {
    const m = parseMonthArg(monthStr);
    const data = buildJson(parseRawLines(text, m), m);
    const res = { month: monthStr, fileName, data, users: usersToMap(usersList) };
    setResult(res);
    saveResult(res);
    return res;
  };

  const doRun = () => {
    setError('');
    if (!logText.trim()) {
      setError('Chưa có file log — hãy chọn file .txt/.dat hoặc nạp dữ liệu mẫu.');
      return;
    }
    try {
      run(logText, month, users);
    } catch (e) {
      setError(e.message);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      setLogText(text);
      setFileName(file.name);
      setResult(null);
    } catch (err) {
      setError(`Không đọc được file: ${err.message}`);
    }
  };

  const loadSample = async () => {
    setError('');
    setBusy(true);
    try {
      const [logRes, usersRes] = await Promise.all([
        fetch(`${SAMPLE_BASE}2026-07-attlog.txt`),
        fetch(`${SAMPLE_BASE}users.json`),
      ]);
      if (!logRes.ok || !usersRes.ok) throw new Error('Không tải được dữ liệu mẫu.');
      const sampleLog = await logRes.text();
      const sampleUsers = await usersRes.json();
      const merged = [...users];
      for (const su of sampleUsers) {
        if (!merged.some((u) => String(u.member_id) === String(su.member_id))) {
          merged.push(su);
        }
      }
      setUsers(merged);
      saveUsers(merged);
      setLogText(sampleLog);
      setFileName('2026-07-attlog.txt (mẫu)');
      setMonth('2026-07');
      run(sampleLog, '2026-07', merged);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!result) return;
    setError('');
    setBusy(true);
    try {
      const base = result.month;
      if (format === 'json') {
        downloadFile(`${base}.json`, JSON.stringify(result.data, null, 2), 'application/json');
      } else if (format === 'xlsx') {
        const blob = await buildXlsxBlob(result.data, result.users);
        downloadFile(`${base}.xlsx`, blob, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        window.open(`${window.location.origin}${import.meta.env.BASE_URL}#/print`, '_blank');
      }
    } catch (e) {
      setError(`Xuất file lỗi: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const uids = result ? Object.keys(result.data).sort((a, b) => Number(a) - Number(b)) : [];

  return (
    <VStack gap={4}>
      <HStack justify="between" align="center" width="100%">
        <Heading level={4} weight="bold">Bảng công tháng</Heading>
        <HStack gap={3} align="end">
          <input ref={fileRef} type="file" accept=".txt,.dat" hidden onChange={onFile} />
          <Button variant="ghost" label="Nạp dữ liệu mẫu" onClick={loadSample} isDisabled={busy}>
            Nạp dữ liệu mẫu
          </Button>
          <Button variant="primary" label="Chọn file log chấm công" icon={<PlusIcon />} onClick={() => fileRef.current?.click()}>
            Chọn file log
          </Button>
        </HStack>
      </HStack>

      <Text type="supporting">
        File log thô dạng &lt;mã user&gt; &lt;YYYY-MM-DD HH:MM:SS&gt; ... — ca HC
        08:30–12:00 / 13:00–17:30, 8 giờ = 1 công. Dữ liệu chỉ xử lý trên máy
        của bạn, không gửi đi đâu.
      </Text>

      <HStack gap={3} align="end">
        <TextInput label="Tháng (YYYY-MM)" value={month} onChange={setMonth} placeholder="2026-07" width={160} />
        <Selector
          label="Định dạng xuất"
          value={format}
          onChange={setFormat}
          options={[
            { value: 'xlsx', label: 'Excel (.xlsx)' },
            { value: 'json', label: 'JSON' },
            { value: 'pdf', label: 'PDF (bản in)' },
          ]}
          width={180}
        />
        <Button variant="primary" label="Tính công" onClick={doRun} isDisabled={busy}>
          Tính công
        </Button>
        <Button variant="ghost" label="Tải kết quả" onClick={download} isDisabled={!result || busy}>
          Tải kết quả
        </Button>
      </HStack>

      {fileName ? <Text type="supporting">File: {fileName}</Text> : null}
      {error ? (
        <Banner status="error" title="Lỗi" description={error} />
      ) : null}

      {result && uids.length === 0 ? (
        <Banner status="warning" title="Không có dữ liệu" description={`File log không có lượt quẹt nào trong tháng ${result.month}.`} />
      ) : null}

      {result ? (
        <Text weight="bold">
          Đã tính {uids.length} nhân viên — tháng {result.month}
        </Text>
      ) : null}

      {uids.map((uid) => (
        <VStack key={uid} gap={3}>
          <Divider />
          <DetailTable uid={uid} info={result.users[uid]} userData={result.data[uid]} />
        </VStack>
      ))}
    </VStack>
  );
}
