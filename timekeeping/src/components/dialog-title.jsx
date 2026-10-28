import { DialogHeader } from '@astryxdesign/core/Dialog';
import { Heading } from '@astryxdesign/core/Heading';

/**
 * Tiêu đề dialog dùng chung — theo quy ước dự án: heading level 4 (14px).
 * (Astryx DialogHeader render cứng h2; bọc lại để giữ cỡ chữ thống nhất.)
 * Sao chép từ nsdt-nextgen/frontend/src/components/dialog-title.jsx.
 */
export default function DialogTitle({ children, subtitle, onClose }) {
  return (
    <DialogHeader
      title={<Heading level={4}>{children}</Heading>}
      subtitle={subtitle}
      onOpenChange={onClose ? () => onClose(false) : undefined}
    />
  );
}
