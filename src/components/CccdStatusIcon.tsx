import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Worker } from '../types';
import { getCccdPhotoStatus, CccdPhotoStatusInfo } from '../utils/helpers';

interface CccdStatusIconProps {
  worker?: {
    id?: string;
    name?: string;
    cccdFrontImage?: string;
    cccdBackImage?: string;
    cccdDocument?: { hasFront?: boolean; hasBack?: boolean };
  } | null;
  onClick?: (e: React.MouseEvent) => void;
  size?: 'xs' | 'sm' | 'md';
  showDot?: boolean;
  showBadge?: boolean;
  className?: string;
  title?: string;
}

export const CccdStatusIcon: React.FC<CccdStatusIconProps> = ({
  worker,
  onClick,
  size = 'sm',
  showDot = true,
  showBadge = false,
  className = '',
  title,
}) => {
  const statusInfo: CccdPhotoStatusInfo = getCccdPhotoStatus(worker);

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  };

  const containerSizes = {
    xs: 'p-1',
    sm: 'p-1.5',
    md: 'p-2',
  };

  const dotSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2 h-2',
  };

  const displayTitle = title || statusInfo.tooltip;

  const content = (
    <span className="relative inline-flex items-center justify-center">
      <ImageIcon className={`${iconSizes[size]} ${statusInfo.iconClass} transition-colors`} />
      {showDot && (
        <span
          className={`absolute -top-1 -right-1 ${dotSizes[size]} rounded-full ${statusInfo.dotClass} ring-1`}
        />
      )}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        title={displayTitle}
        className={`inline-flex items-center justify-center gap-1 rounded-md ${containerSizes[size]} ${statusInfo.btnClass} transition-all duration-150 cursor-pointer focus:outline-hidden ${className}`}
      >
        {content}
        {showBadge && (
          <span className="text-[10px] font-bold tracking-tight">
            {statusInfo.count}/2
          </span>
        )}
      </button>
    );
  }

  return (
    <span
      title={displayTitle}
      className={`inline-flex items-center justify-center gap-1 rounded-md ${containerSizes[size]} ${statusInfo.btnClass} ${className}`}
    >
      {content}
      {showBadge && (
        <span className="text-[10px] font-bold tracking-tight">
          {statusInfo.count}/2
        </span>
      )}
    </span>
  );
};
