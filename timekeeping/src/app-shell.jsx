import { AppShell } from '@astryxdesign/core/AppShell';
import { Button } from '@astryxdesign/core/Button';
import { CommandPalette } from '@astryxdesign/core/CommandPalette';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { SideNav } from '@astryxdesign/core/SideNav';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TopNav } from '@astryxdesign/core/TopNav';
import { TreeList } from '@astryxdesign/core/TreeList';
import { createStaticSource } from '@astryxdesign/core/Typeahead';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { FolderIcon } from './components/icons.jsx';

const NAV = [
  {
    section: 'Chấm công',
    items: [
      { label: 'Bảng công tháng', href: '#/' },
      { label: 'Danh sách nhân viên', href: '#/users' },
      { label: 'Bản in / PDF', href: '#/print' },
    ],
  },
];

const PALETTE_COMMANDS = [
  { id: 'cham-cong', label: 'Bảng công tháng', auxiliaryData: { path: '/', keywords: ['bang cong', 'cham cong', 'tinh cong'] } },
  { id: 'users', label: 'Danh sách nhân viên', auxiliaryData: { path: '/users', keywords: ['nhan vien', 'danh sach', 'users'] } },
  { id: 'print', label: 'Bản in / PDF', auxiliaryData: { path: '/print', keywords: ['in', 'pdf', 'ky ten'] } },
];

function TopBar({ onOpenPalette }) {
  return (
    <TopNav
      label="Thanh điều hướng chính"
      heading={<Heading level={4}>Timekeeping</Heading>}
      endContent={
        <HStack gap={2} align="center">
          <Stack onClick={onOpenPalette}>
            <TextInput
              label="Tìm kiếm"
              isLabelHidden
              placeholder="Tìm kiếm (Ctrl+K)"
              value=""
              onChange={() => {}}
              isReadOnly
              startIcon="search"
              width={240}
            />
          </Stack>
        </HStack>
      }
    />
  );
}

function Rail() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const path = hash.replace(/^#/, '') || '/';

  const items = useMemo(
    () =>
      NAV.map((group) => ({
        id: `group-${group.section}`,
        label: <Text maxLines={1}>{group.section}</Text>,
        startContent: <FolderIcon width={14} height={14} />,
        isExpanded: true,
        children: group.items.map((item) => ({
          id: `nav-${item.label}`,
          label: <Text maxLines={1}>{item.label}</Text>,
          isSelected: item.href === `#${path}`,
          onClick: () => navigate(item.href.replace(/^#/, '')),
        })),
      })),
    [path, navigate],
  );

  return (
    <SideNav
      label="Điều hướng chính"
      resizable={{ defaultWidth: 240, minWidth: 180, maxWidth: 400 }}
    >
      <TreeList items={items} density="compact" />
    </SideNav>
  );
}

export default function AppShellFrame({ children }) {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const searchSource = useMemo(
    () =>
      createStaticSource(PALETTE_COMMANDS, {
        keywords: (item) => item.auxiliaryData?.keywords ?? [],
      }),
    [],
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelect = (id) => {
    const cmd = PALETTE_COMMANDS.find((c) => c.id === id);
    if (cmd) navigate(cmd.auxiliaryData.path);
    setIsPaletteOpen(false);
  };

  return (
    <>
      <AppShell
        height="fill"
        contentPadding={4}
        topNav={<TopBar onOpenPalette={() => setIsPaletteOpen(true)} />}
        sideNav={<Rail />}
      >
        {children}
      </AppShell>
      <CommandPalette
        isOpen={isPaletteOpen}
        onOpenChange={setIsPaletteOpen}
        searchSource={searchSource}
        label="Điều hướng nhanh"
        emptySearchText="Không tìm thấy màn hình nào"
        onValueChange={handleSelect}
      />
    </>
  );
}
