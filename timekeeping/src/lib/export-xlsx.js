// Xuất Excel — bố cục giống hệt _build_xlsx của bản Python:
// 1 sheet "Bang cong", mọi user xếp nối tiếp, tiêu đề vàng, T7 #CCCCFF,
// CN #FF99CC, header 2 tầng, dòng tổng cộng cuối mỗi user.
import ExcelJS from 'exceljs';

const FILL_TITLE = 'FFFFFF00';
const FILL_T7 = 'FFCCCCFF';
const FILL_CN = 'FFFF99CC';
const FILL_HEAD = 'FFEEEEEE';
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

function styleCell(cell, { bold = false, italic = false, fill = null, align = 'center' } = {}) {
  cell.font = { name: 'Arial', size: 10, bold, italic };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  cell.border = THIN_BORDER;
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
}

function mergeSet(ws, range, value, opts) {
  ws.mergeCells(range);
  const topLeft = range.split(':')[0];
  const cell = ws.getCell(topLeft);
  cell.value = value;
  styleCell(cell, opts);
  // tô + viền cho cả vùng merge
  const [start, end] = range.split(':');
  const sc = ws.getCell(start);
  const ec = ws.getCell(end);
  for (let r = sc.row; r <= ec.row; r += 1) {
    for (let c = sc.col; c <= ec.col; c += 1) {
      const cc = ws.getCell(r, c);
      cc.border = THIN_BORDER;
      if (opts?.fill) cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
    }
  }
  return cell;
}

function writeUserBlock(ws, startRow, uid, userData, info) {
  const { records, summary } = userData;
  const name = info?.name ?? '';
  const dept = info?.dept ?? '';
  let r = startRow;

  mergeSet(ws, `A${r}:D${r}`, `Mã nhân viên: ${uid}`, { bold: true, align: 'left', fill: FILL_TITLE });
  mergeSet(ws, `E${r}:H${r}`, `Tên nhân viên: ${name}`, { bold: true, align: 'left', fill: FILL_TITLE });
  mergeSet(ws, `I${r}:L${r}`, `Bộ phận: ${dept}`, { bold: true, align: 'left', fill: FILL_TITLE });
  r += 1;

  const sumRow = (pairs) => {
    const spans = [
      ['A', 'B', 'C', 'D'],
      ['E', 'F', 'G', 'H'],
      ['I', 'J', 'K', 'L'],
    ];
    pairs.forEach(([label, value], i) => {
      const [lc1, lc2, vc1, vc2] = spans[i];
      mergeSet(ws, `${lc1}${r}:${lc2}${r}`, label, { bold: true, align: 'left' });
      mergeSet(ws, `${vc1}${r}:${vc2}${r}`, value, { italic: true, align: 'center' });
    });
    r += 1;
  };
  // Viết từng dòng tóm tắt (3 cặp label/value mỗi dòng) để giữ
  // đúng vị trí cột như bản Python.
  sumRow([
    ['Công làm', summary['Công làm']],
    ['Số lần trễ', summary['Số lần trễ']],
    ['Tổng Trễ (phút)', summary['Tổng Trễ (phút)']],
  ]);
  sumRow([
    ['Tổng Công Trễ', summary['Tổng Công Trễ'].toFixed(2)],
    ['Tổng TG (hours)', summary['Tổng TG (hours)'].toFixed(2)],
    ['Tổng CôngTG', summary['Tổng CôngTG'].toFixed(2)],
  ]);
  sumRow([
    ['Tổng LT (phút)', summary['Tổng LT (phút)']],
    ['Tổng Công LT', summary['Tổng Công LT'].toFixed(2)],
    ['', ''],
  ]);

  mergeSet(ws, `A${r}:L${r}`, 'Chi tiết', { bold: true, italic: true, align: 'left' });
  ws.getCell(`A${r}`).border = {};
  r += 1;

  const groupRow = r;
  const subRow = r + 1;
  mergeSet(ws, `A${groupRow}:E${groupRow}`, 'Time line', { bold: true });
  mergeSet(ws, `F${groupRow}:G${groupRow}`, 'Ngày làm (hour)', { bold: true });
  mergeSet(ws, `H${groupRow}:I${groupRow}`, 'Đi muộn (min)', { bold: true });
  mergeSet(ws, `J${groupRow}:K${groupRow}`, 'Về muộn (min)', { bold: true });
  mergeSet(ws, `L${groupRow}:L${subRow}`, 'Kí hiệu', { bold: true });

  const subHeaders = ['Ngày', 'Thứ', 'Ca', 'Vào', 'Ra', 'TG', 'Công', 'TG', 'Công', 'TG', 'Công'];
  subHeaders.forEach((h, i) => {
    const cell = ws.getCell(subRow, i + 1);
    cell.value = h;
    styleCell(cell, { bold: true });
  });
  r = subRow + 1;

  for (const rec of records) {
    const values = [
      rec['Ngày'], rec['Thứ'], rec['Ca'], rec['Vào'], rec['Ra'],
      rec['TG (hours)'], rec['CôngTG'],
      rec['Trễ (min)'], rec['Công Trễ'],
      rec['LT'], rec['Công LT'], rec['Kí hiệu'],
    ];
    const fill = rec['Thứ'] === 'T7' ? FILL_T7 : rec['Thứ'] === 'CN' ? FILL_CN : null;
    values.forEach((v, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = v === '' ? '' : v;
      styleCell(cell, { fill, align: i === 11 ? 'left' : 'center' });
    });
    r += 1;
  }

  mergeSet(ws, `A${r}:E${r}`, 'Tổng cộng :', { bold: true, align: 'left' });
  ws.getCell(`A${r}`).border = {};
  const totals = [
    summary['Tổng TG (hours)'],
    summary['Tổng CôngTG'],
    summary['Tổng Trễ (phút)'],
    summary['Tổng Công Trễ'],
    summary['Tổng LT (phút)'],
    summary['Tổng Công LT'],
  ];
  totals.forEach((v, i) => {
    const cell = ws.getCell(r, 6 + i);
    cell.value = v;
    cell.numFmt = '0.00';
    styleCell(cell, { bold: true });
  });
  r += 1;

  return r + 2; // chừa 2 dòng trống trước user tiếp theo
}

export async function buildXlsxBlob(data, employeeInfo) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Bang cong');
  ws.columns = [
    { width: 12 }, { width: 6 }, { width: 6 }, { width: 8 }, { width: 8 },
    { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 },
    { width: 8 }, { width: 22 },
  ];
  let row = 1;
  for (const uid of Object.keys(data).sort((a, b) => Number(a) - Number(b))) {
    row = writeUserBlock(ws, row, uid, data[uid], employeeInfo[uid] ?? {});
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
