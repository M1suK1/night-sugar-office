import type { DragEvent } from 'react';

/** 只有真的拖进文件时才接管，避免和装备、编队的拖放互相干扰。 */
export function hasDroppedFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

/**
 * 给一个区域挂上「拖进图片就上传」的行为。
 * setOver 负责把高亮状态写进组件，onFiles 拿到的是拖进来的全部文件，过滤交给调用方。
 */
export function fileDropProps(setOver: (over: boolean) => void, onFiles: (files: File[]) => void) {
  return {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!hasDroppedFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      setOver(true);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setOver(false);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (!hasDroppedFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setOver(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length) onFiles(files);
    },
  };
}
