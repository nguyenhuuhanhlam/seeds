// Khối bảng công của 1 user — dùng chung cho trang Bảng công và trang In.
// Bảng chi tiết là <table> thuần để giữ đúng màu nền cuối tuần như bản
// Python (T7 #CCCCFF, CN #FF99CC); phần tóm tắt dùng component Astryx.
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';

function Stat({ label, value }) {
  return (
    <VStack gap={1}>
      <Text type="supporting">{label}</Text>
      <Text weight="bold">{value}</Text>
    </VStack>
  );
}

function fmt(v) {
  if (v === '' || v == null) return '';
  return String(v);
}

function fmt2(v) {
  return typeof v === 'number' ? v.toFixed(2) : fmt(v);
}

export default function DetailTable({ uid, info, userData }) {
  const { records, summary } = userData;
  const singlePunch = records.filter((r) => r['Vào'] && !r['Ra']).length;
  return (
    <VStack gap={3}>
      <Heading level={4}>
        Mã nhân viên: {uid}
        {info?.name ? ` — ${info.name}` : ''}
        {info?.dept ? ` — Bộ phận: ${info.dept}` : ''}
      </Heading>
      <HStack gap={8}>
        <Stat label="Công làm" value={summary['Công làm']} />
        <Stat label="Số lần trễ" value={summary['Số lần trễ']} />
        <Stat label="Tổng Trễ (phút)" value={summary['Tổng Trễ (phút)']} />
        <Stat label="Tổng Công Trễ" value={fmt2(summary['Tổng Công Trễ'])} />
        <Stat label="Tổng TG (giờ)" value={fmt2(summary['Tổng TG (hours)'])} />
        <Stat label="Tổng CôngTG" value={fmt2(summary['Tổng CôngTG'])} />
        <Stat label="Tổng LT (phút)" value={summary['Tổng LT (phút)']} />
        <Stat label="Tổng Công LT" value={fmt2(summary['Tổng Công LT'])} />
      </HStack>
      {singlePunch > 0 ? (
        <Text type="supporting">
          {singlePunch} ngày chỉ có 1 lần chấm — TG hiện &quot;-&quot;, phút Trễ
          vẫn tính vào tổng (theo đúng bản Python gốc).
        </Text>
      ) : null}
      <table className="tk-table">
        <thead>
          <tr>
            <th colSpan={5}>Time line</th>
            <th colSpan={2}>Ngày làm (hour)</th>
            <th colSpan={2}>Đi muộn (min)</th>
            <th colSpan={2}>Về muộn (min)</th>
            <th rowSpan={2}>Kí hiệu</th>
          </tr>
          <tr>
            <th>Ngày</th>
            <th>Thứ</th>
            <th>Ca</th>
            <th>Vào</th>
            <th>Ra</th>
            <th>TG</th>
            <th>Công</th>
            <th>TG</th>
            <th>Công</th>
            <th>TG</th>
            <th>Công</th>
          </tr>
        </thead>
        <tbody>
          {records.map((rec, i) => (
            <tr key={i} className={rec['Thứ'] === 'T7' ? 'tk-sat' : rec['Thứ'] === 'CN' ? 'tk-sun' : undefined}>
              <td>{fmt(rec['Ngày'])}</td>
              <td>{fmt(rec['Thứ'])}</td>
              <td>{fmt(rec['Ca'])}</td>
              <td>{fmt(rec['Vào'])}</td>
              <td>{fmt(rec['Ra'])}</td>
              <td className="tk-num">{fmt(rec['TG (hours)'])}</td>
              <td className="tk-num">{fmt(rec['CôngTG'])}</td>
              <td className="tk-num">{fmt(rec['Trễ (min)'])}</td>
              <td className="tk-num">{fmt(rec['Công Trễ'])}</td>
              <td className="tk-num">{fmt(rec['LT'])}</td>
              <td className="tk-num">{fmt(rec['Công LT'])}</td>
              <td>{fmt(rec['Kí hiệu'])}</td>
            </tr>
          ))}
          <tr className="tk-total">
            <td colSpan={5} style={{ textAlign: 'left' }}>Tổng cộng :</td>
            <td className="tk-num">{fmt2(summary['Tổng TG (hours)'])}</td>
            <td className="tk-num">{fmt2(summary['Tổng CôngTG'])}</td>
            <td className="tk-num">{summary['Tổng Trễ (phút)']}</td>
            <td className="tk-num">{fmt2(summary['Tổng Công Trễ'])}</td>
            <td className="tk-num">{summary['Tổng LT (phút)']}</td>
            <td className="tk-num">{fmt2(summary['Tổng Công LT'])}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </VStack>
  );
}
