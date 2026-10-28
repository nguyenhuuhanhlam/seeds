// Danh sách nhân viên (users.json) — sửa trực tiếp, lưu vào localStorage.
// Theo quy ước: không có nút xóa trong cột thao tác; xóa nằm trong dialog
// sửa (bấm 2 lần để xác nhận).
import { Button } from '@astryxdesign/core/Button';
import { Dialog } from '@astryxdesign/core/Dialog';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Table, pixel, proportional } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { useRef, useState } from 'react';

import DialogTitle from '../components/dialog-title.jsx';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons.jsx';
import { downloadFile, loadUsers, saveUsers } from '../lib/users.js';

const SAMPLE_BASE = `${import.meta.env.BASE_URL}sample/`;

export default function Users() {
  const [rows, setRows] = useState(loadUsers());
  const [dialog, setDialog] = useState(null); // { mode: 'add' | 'edit', memberId? }
  const [form, setForm] = useState({ member_id: '', department: '', name: '' });
  const [formError, setFormError] = useState('');
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);

  const openAdd = () => {
    setForm({ member_id: '', department: '', name: '' });
    setFormError('');
    setDeleteArmed(false);
    setDialog({ mode: 'add' });
  };

  const openEdit = (user) => {
    setForm({
      member_id: String(user.member_id),
      department: user.department ?? '',
      name: user.name ?? '',
    });
    setFormError('');
    setDeleteArmed(false);
    setDialog({ mode: 'edit', memberId: String(user.member_id) });
  };

  const closeDialog = () => {
    setDialog(null);
    setDeleteArmed(false);
  };

  const saveForm = () => {
    const mid = form.member_id.trim();
    if (!mid) {
      setFormError('Mã nhân viên không được để trống.');
      return;
    }
    const entry = {
      member_id: /^\d+$/.test(mid) ? Number(mid) : mid,
      department: form.department.trim(),
      name: form.name.trim(),
    };
    if (dialog.mode === 'add') {
      if (rows.some((u) => String(u.member_id) === mid)) {
        setFormError(`Mã ${mid} đã có trong danh sách.`);
        return;
      }
      setRows([...rows, entry]);
    } else {
      setRows(rows.map((u) => (String(u.member_id) === dialog.memberId ? entry : u)));
    }
    setMessage('Đã cập nhật trong bảng — bấm "Lưu danh sách" để ghi vào trình duyệt.');
    closeDialog();
  };

  const deleteUser = () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setRows(rows.filter((u) => String(u.member_id) !== dialog.memberId));
    setMessage('Đã xóa khỏi bảng — bấm "Lưu danh sách" để ghi vào trình duyệt.');
    closeDialog();
  };

  const saveList = () => {
    saveUsers(rows);
    setMessage(`Đã lưu ${rows.length} nhân viên vào trình duyệt.`);
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error('File phải là danh sách [...]');
      setRows(parsed.filter((u) => u && u.member_id != null));
      setMessage('Đã nạp file vào bảng — bấm "Lưu danh sách" để ghi vào trình duyệt.');
    } catch (err) {
      setMessage(`Không đọc được file: ${err.message}`);
    }
  };

  const loadSample = async () => {
    try {
      const res = await fetch(`${SAMPLE_BASE}users.json`);
      if (!res.ok) throw new Error('Không tải được dữ liệu mẫu.');
      const sample = await res.json();
      const merged = [...rows];
      for (const su of sample) {
        if (!merged.some((u) => String(u.member_id) === String(su.member_id))) merged.push(su);
      }
      setRows(merged);
      setMessage('Đã thêm danh sách mẫu vào bảng — bấm "Lưu danh sách" để ghi vào trình duyệt.');
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <VStack gap={4}>
      <HStack justify="between" align="center" width="100%">
        <Heading level={4} weight="bold">Danh sách nhân viên</Heading>
        <HStack gap={3} align="end">
          <input ref={fileRef} type="file" accept=".json" hidden onChange={onImport} />
          <Button variant="ghost" label="Nhập users.json" onClick={() => fileRef.current?.click()}>
            Nhập users.json
          </Button>
          <Button
            variant="ghost"
            label="Xuất users.json"
            onClick={() => downloadFile('users.json', JSON.stringify(rows, null, 2), 'application/json')}
          >
            Xuất users.json
          </Button>
          <Button variant="ghost" label="Nạp danh sách mẫu" onClick={loadSample}>
            Nạp danh sách mẫu
          </Button>
          <Button variant="primary" label="Lưu danh sách" onClick={saveList}>
            Lưu danh sách
          </Button>
          <Button variant="primary" label="Thêm nhân viên" icon={<PlusIcon />} onClick={openAdd}>
            Thêm
          </Button>
        </HStack>
      </HStack>

      <Text type="supporting">
        Mã nhân viên là mã user trong file log máy chấm công. Nhân viên không
        có trong danh sách vẫn được tính công, chỉ để trống tên và bộ phận.
      </Text>
      {message ? <Text>{message}</Text> : null}

      {rows.length === 0 ? (
        <Text type="supporting">
          Chưa có nhân viên nào — bấm &quot;Thêm&quot;, &quot;Nhập users.json&quot;
          hoặc &quot;Nạp danh sách mẫu&quot;.
        </Text>
      ) : (
        <Table
          data={rows}
          columns={[
            { key: 'member_id', header: 'Mã nhân viên', width: pixel(140), renderCell: (r) => r.member_id },
            { key: 'department', header: 'Bộ phận', width: proportional(1), renderCell: (r) => r.department ?? '' },
            { key: 'name', header: 'Tên nhân viên', width: proportional(2), renderCell: (r) => r.name ?? '' },
            {
              key: 'edit',
              header: 'Sửa',
              width: pixel(80),
              align: 'center',
              renderCell: (r) => (
                <IconButton
                  icon={<EditIcon />}
                  label={`Sửa nhân viên ${r.member_id}`}
                  tooltip="Sửa"
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(r)}
                />
              ),
            },
          ]}
          idKey="member_id"
          density="balanced"
          verticalAlign="middle"
          hasHover
        />
      )}

      {dialog ? (
        <Dialog isOpen onOpenChange={(o) => !o && closeDialog()} width={480} maxHeight="85dvh">
          <DialogTitle onClose={closeDialog}>
            {dialog.mode === 'add' ? 'Thêm nhân viên' : `Sửa nhân viên ${dialog.memberId}`}
          </DialogTitle>
          <VStack gap={3}>
            <TextInput
              label="Mã nhân viên"
              value={form.member_id}
              onChange={(v) => setForm({ ...form, member_id: v })}
              isDisabled={dialog.mode === 'edit'}
              isRequired
              width="100%"
            />
            <TextInput
              label="Bộ phận"
              value={form.department}
              onChange={(v) => setForm({ ...form, department: v })}
              width="100%"
            />
            <TextInput
              label="Tên nhân viên"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              width="100%"
            />
            {formError ? <Text>{formError}</Text> : null}
            <HStack gap={2} justify="end">
              {dialog.mode === 'edit' ? (
                <Button
                  variant="ghost"
                  label={deleteArmed ? 'Bấm lại để xóa' : 'Xóa nhân viên'}
                  icon={<TrashIcon />}
                  onClick={deleteUser}
                >
                  {deleteArmed ? 'Bấm lại để xóa' : 'Xóa'}
                </Button>
              ) : null}
              <Button variant="ghost" label="Hủy" onClick={closeDialog}>
                Hủy
              </Button>
              <Button variant="primary" label="Lưu" onClick={saveForm}>
                Lưu
              </Button>
            </HStack>
          </VStack>
        </Dialog>
      ) : null}
    </VStack>
  );
}
