/**
 * Module Giám sát và Đếm lượng truy vấn Read/Write tới Cloud Database (Developer Monitoring)
 * Giúp kiểm tra chi tiết số lượng READs/WRITEs, thời gian đồng bộ, và trạng thái quota.
 * Thông tin này chỉ dành cho nhà phát triển (Console), không hiển thị cho người dùng cuối.
 */

export interface SyncLogEntry {
  timestamp: string;
  type: 'READ' | 'WRITE' | 'CHECK';
  collection: string;
  count: number;
  reason: string;
}

export interface SyncStats {
  sessionStartTime: string;
  totalReads: number;
  totalWrites: number;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastSyncResult: 'NO_CHANGE' | 'DELTA_SYNCED' | 'FULL_SYNCED' | 'ERROR' | 'IDLE';
  recentLogs: SyncLogEntry[];
}

class SyncMonitor {
  private totalReads = 0;
  private totalWrites = 0;
  private lastSyncAt: string | null = null;
  private nextSyncAt: string | null = null;
  private lastSyncResult: 'NO_CHANGE' | 'DELTA_SYNCED' | 'FULL_SYNCED' | 'ERROR' | 'IDLE' = 'IDLE';
  private recentLogs: SyncLogEntry[] = [];
  private sessionStartTime = new Date().toISOString();

  public recordRead(collection: string, count: number, reason: string): void {
    this.totalReads += count;
    const entry: SyncLogEntry = {
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      type: 'READ',
      collection,
      count,
      reason,
    };
    this.addLog(entry);
  }

  public recordWrite(collection: string, count: number, reason: string): void {
    this.totalWrites += count;
    const entry: SyncLogEntry = {
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      type: 'WRITE',
      collection,
      count,
      reason,
    };
    this.addLog(entry);
  }

  public recordSyncEvent(params: {
    lastSyncAt: string;
    nextSyncAt: string;
    result: 'NO_CHANGE' | 'DELTA_SYNCED' | 'FULL_SYNCED' | 'ERROR';
    readsUsed: number;
    details?: string;
  }): void {
    this.lastSyncAt = params.lastSyncAt;
    this.nextSyncAt = params.nextSyncAt;
    this.lastSyncResult = params.result;

    if (process.env.NODE_ENV !== 'production' || typeof window !== 'undefined') {
      const changedText = params.result === 'NO_CHANGE' ? 'NO (Cache up-to-date)' : `YES (${params.result})`;
      console.log(
        `%c[KTX SYNC MONITOR]%c Last: ${params.lastSyncAt} | Next: ${params.nextSyncAt} | Changed: ${changedText} | Reads: ${params.readsUsed} (Total Session Reads: ${this.totalReads})`,
        'background: #1e3a8a; color: #60a5fa; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
        'color: #0284c7; font-weight: 500;'
      );
    }
  }

  private addLog(entry: SyncLogEntry): void {
    this.recentLogs.unshift(entry);
    if (this.recentLogs.length > 50) {
      this.recentLogs.pop();
    }
  }

  public getStats(): SyncStats {
    return {
      sessionStartTime: this.sessionStartTime,
      totalReads: this.totalReads,
      totalWrites: this.totalWrites,
      lastSyncAt: this.lastSyncAt,
      nextSyncAt: this.nextSyncAt,
      lastSyncResult: this.lastSyncResult,
      recentLogs: [...this.recentLogs],
    };
  }

  public printReport(): void {
    console.table({
      'Session Start': this.sessionStartTime,
      'Total Cloud Reads': this.totalReads,
      'Total Cloud Writes': this.totalWrites,
      'Last Sync At': this.lastSyncAt || 'N/A',
      'Next Sync At': this.nextSyncAt || 'N/A',
      'Last Sync Status': this.lastSyncResult,
    });
    console.log('Recent 10 operations:', this.recentLogs.slice(0, 10));
  }
}

export const syncMonitor = new SyncMonitor();

// Expose to window for developer inspection
if (typeof window !== 'undefined') {
  (window as any).__KTX_SYNC_METRICS__ = {
    getStats: () => syncMonitor.getStats(),
    printReport: () => syncMonitor.printReport(),
  };
}
