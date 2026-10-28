// Bản in / PDF — mỗi user 1 trang A4 dọc, có chỗ ký tên (giống _build_pdf
// của bản Python). PDF tạo bằng cách in từ trình duyệt (Ctrl+P -> "Lưu
// thành PDF") để tiếng Việt luôn đúng dấu với font hệ thống — không nhúng
// font jsPDF (nặng ~3 MB base64) cho một tính năng in.
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import DetailTable from '../components/DetailTable.jsx';
import { loadResult } from '../lib/users.js';

export default function PrintPage() {
  const [result] = useState(loadResult());
  const uids = result ? Object.keys(result.data).sort((a, b) => Number(a) - Number(b)) : [];

  if (!result || uids.length === 0) {
    return (
      <VStack gap={4}>
        <Heading level={4}>Bản in / PDF</Heading>
        <Text>Chưa có kết quả để in — hãy tính công ở trang Bảng công trước.</Text>
        <Link to="/">Về trang Bảng công</Link>
      </VStack>
    );
  }

  return (
    <div id="print-root">
      <div className="print-toolbar">
        <VStack gap={4}>
          <Heading level={4}>Bản in / PDF — tháng {result.month}</Heading>
          <Text type="supporting">
            Bấm &quot;In / Lưu PDF&quot; rồi chọn máy in &quot;Lưu thành PDF&quot;
            trong hộp thoại của trình duyệt. Mỗi nhân viên in trên 1 trang A4.
          </Text>
          <Button variant="primary" label="In / Lưu PDF" onClick={() => window.print()}>
            In / Lưu PDF
          </Button>
        </VStack>
      </div>
      {uids.map((uid) => (
        <div key={uid} className="print-page">
          <DetailTable uid={uid} info={result.users[uid]} userData={result.data[uid]} />
          <div className="print-sign">
            <div className="print-sign-col">
              <div className="print-sign-name">Người lập bảng</div>
              <div style={{ height: 90 }} />
              <div className="print-sign-note">(Ký, ghi rõ họ tên)</div>
            </div>
            <div className="print-sign-col">
              <div className="print-sign-name">Trưởng bộ phận</div>
              <div style={{ height: 90 }} />
              <div className="print-sign-note">(Ký, ghi rõ họ tên)</div>
            </div>
            <div className="print-sign-col">
              <div className="print-sign-name">Người lao động</div>
              <div style={{ height: 90 }} />
              <div className="print-sign-note">(Ký, ghi rõ họ tên)</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
