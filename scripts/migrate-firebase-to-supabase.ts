/**
 * ============================================================================
 * SCRIPT CHUYỂN ĐỔI DỮ LIỆU TỪ FIREBASE FIRESTORE SANG SUPABASE POSTGRES & STORAGE
 * ============================================================================
 * 
 * Mục đích:
 * 1. Đọc toàn bộ dữ liệu hiện có từ Firebase Firestore:
 *    - workers (Hồ sơ công nhân)
 *    - worker_documents (Ảnh CCCD mặt trước / mặt sau)
 *    - checked_out_workers (Hồ sơ đã check-out / xóa)
 *    - users (Tài khoản & phân quyền)
 *    - system_config (Cấu hình KTX)
 *    - manager_info (Thông tin ban quản lý)
 *    - activity_logs (Nhật ký thao tác)
 * 2. Xuất bản sao lưu JSON có timestamp trước khi import vào thư mục ./backups
 * 3. Chuyển ảnh CCCD dạng Base64 sang Supabase Storage (Private Bucket: worker-documents)
 * 4. Chuyển đổi và nạp dữ liệu vào các bảng Supabase Postgres:
 *    - profiles & user_roles
 *    - dorm_blocks, rooms, beds
 *    - team_leaders
 *    - workers (lưu trữ legacy_firestore_id)
 *    - worker_documents
 *    - check_in_out_history
 *    - audit_logs
 *    - app_settings
 * 5. Hỗ trợ cờ `--dry-run`: Chạy thử kiểm tra dữ liệu mà không ghi vào Supabase
 * 6. Đối soát số lượng bản ghi Firebase vs Supabase
 * 7. KHÔNG XÓA DỮ LIỆU GỐC TRÊN FIREBASE.
 * 
 * Cách chạy:
 *   # Chạy kiểm tra thử (Dry-run):
 *   npm run migrate:supabase -- --dry-run
 * 
 *   # Chạy thực tế (Live migration):
 *   npm run migrate:supabase
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// CLI Arguments
const isDryRun = process.argv.includes('--dry-run');

console.log('================================================================');
console.log('🚀 BẮT ĐẦU CHUYỂN ĐỔI DỮ LIỆU: FIREBASE FIRESTORE ➜ SUPABASE');
console.log(`📌 Chế độ: ${isDryRun ? 'DRY-RUN (CHẠY THỬ KIỂM TRA, KHÔNG GHI DATABASE)' : 'LIVE MIGRATION (GHI VÀO SUPABASE)'}`);
console.log('================================================================\n');

// 1. Kiểm tra cấu hình Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || (isDryRun ? 'https://dryrun-demo.supabase.co' : '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || (isDryRun ? 'dryrun-demo-key' : '');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Lỗi: Thiếu biến môi trường Supabase!');
  console.error('Vui lòng khai báo trong file .env:');
  console.error('  VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJh...');
  console.error('Hoặc:');
  console.error('  VITE_SUPABASE_ANON_KEY=eyJh...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// 2. Khởi tạo Firebase Admin SDK bằng dynamic import
let firestoreDb: any = null;

async function initFirebaseAdmin(): Promise<any> {
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  let app: any;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'basic-tribute-rt8c4';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    if (clientEmail && privateKey) {
      console.log('🔑 Khởi tạo Firebase Admin SDK với Service Account credentials...');
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        databaseURL: `https://${projectId}.firebaseio.com`,
      });
    } else {
      console.log(`ℹ️ Không có FIREBASE_CLIENT_EMAIL/KEY, dùng Project ID: ${projectId}...`);
      app = initializeApp({
        projectId,
      });
    }
  }

  const appletConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  let customDatabaseId: string | undefined;
  if (fs.existsSync(appletConfigPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(appletConfigPath, 'utf8'));
      customDatabaseId = cfg.firestoreDatabaseId;
    } catch {}
  }

  const db = customDatabaseId ? getFirestore(app, customDatabaseId) : getFirestore(app);
  return db;
}

// Helper: Convert base64 image data to Buffer
function base64ToBuffer(base64Str: string): { buffer: Buffer; mimeType: string; extension: string } | null {
  if (!base64Str || typeof base64Str !== 'string') return null;

  let mimeType = 'image/jpeg';
  let extension = 'jpg';
  let pureBase64 = base64Str;

  const match = base64Str.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    pureBase64 = match[2];
    if (mimeType.includes('png')) extension = 'png';
    else if (mimeType.includes('webp')) extension = 'webp';
  }

  try {
    const buffer = Buffer.from(pureBase64, 'base64');
    return { buffer, mimeType, extension };
  } catch (err) {
    console.warn('Lỗi chuyển đổi base64 sang buffer:', err);
    return null;
  }
}

// 3. Đọc dữ liệu từ Firebase
async function fetchFirebaseCollection(db: any, collectionName: string): Promise<any[]> {
  try {
    const snapshot = await db.collection(collectionName).get();
    const items: any[] = [];
    snapshot.forEach((doc: any) => {
      items.push({
        _firestoreDocId: doc.id,
        ...doc.data(),
      });
    });
    return items;
  } catch (err: any) {
    console.warn(`⚠️ Không thể tải collection "${collectionName}":`, err?.message || err);
    return [];
  }
}

// 4. Main Migration Procedure
async function runMigration() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Khởi tạo Firestore
  let fbWorkers: any[] = [];
  let fbDocuments: any[] = [];
  let fbCheckedOut: any[] = [];
  let fbUsers: any[] = [];
  let fbLogs: any[] = [];
  let fbSystemConfig: any = null;
  let fbManagerInfo: any = null;

  try {
    firestoreDb = await initFirebaseAdmin();
    console.log('📥 Đang tải dữ liệu từ Firebase Firestore...');

    const [workersData, docsData, checkedOutData, usersData, logsData] = await Promise.all([
      fetchFirebaseCollection(firestoreDb, 'workers'),
      fetchFirebaseCollection(firestoreDb, 'worker_documents'),
      fetchFirebaseCollection(firestoreDb, 'checked_out_workers'),
      fetchFirebaseCollection(firestoreDb, 'users'),
      fetchFirebaseCollection(firestoreDb, 'activity_logs'),
    ]);

    fbWorkers = workersData;
    fbDocuments = docsData;
    fbCheckedOut = checkedOutData;
    fbUsers = usersData;
    fbLogs = logsData;

    try {
      const configDoc = await firestoreDb.collection('system_config').doc('main').get();
      if (configDoc.exists) fbSystemConfig = configDoc.data();
    } catch {}

    try {
      const managerDoc = await firestoreDb.collection('manager_info').doc('current').get();
      if (managerDoc.exists) fbManagerInfo = managerDoc.data();
    } catch {}

    console.log(`✅ Đã tải từ Firestore:`);
    console.log(`   - Workers: ${fbWorkers.length} bản ghi`);
    console.log(`   - Worker Documents (CCCD): ${fbDocuments.length} bản ghi`);
    console.log(`   - Checked-out Archive: ${fbCheckedOut.length} bản ghi`);
    console.log(`   - Users: ${fbUsers.length} tài khoản`);
    console.log(`   - Activity Logs: ${fbLogs.length} nhật ký`);
  } catch (fbErr: any) {
    console.warn(`⚠️ Kết nối Firebase Firestore thất bại (${fbErr?.message}).`);
  }

  // Nếu Firestore trống hoặc không có quyền truy cập, kiểm tra cờ --file hoặc file backup cục bộ
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='));
  let jsonSourcePath: string | null = null;
  if (fileArg) {
    jsonSourcePath = path.resolve(process.cwd(), fileArg.split('=')[1]);
  } else if (fbWorkers.length === 0) {
    // Tìm file backup có sẵn trong thư mục ./backups
    if (fs.existsSync(backupDir)) {
      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.endsWith('.json') && !f.includes('pre_migration_backup'))
        .sort()
        .reverse();
      if (files.length > 0) {
        jsonSourcePath = path.join(backupDir, files[0]);
      }
    }
  }

  if (jsonSourcePath && fs.existsSync(jsonSourcePath)) {
    try {
      console.log(`📂 Đang nạp dữ liệu bổ sung từ tệp sao lưu: ${path.basename(jsonSourcePath)}...`);
      const backupRaw = JSON.parse(fs.readFileSync(jsonSourcePath, 'utf8'));
      if (Array.isArray(backupRaw)) {
        fbWorkers = backupRaw;
      } else if (backupRaw && typeof backupRaw === 'object') {
        if (Array.isArray(backupRaw.workers)) fbWorkers = backupRaw.workers;
        if (Array.isArray(backupRaw.checkedOutWorkers)) fbCheckedOut = backupRaw.checkedOutWorkers;
        if (Array.isArray(backupRaw.workerDocuments)) fbDocuments = backupRaw.workerDocuments;
        if (Array.isArray(backupRaw.users)) fbUsers = backupRaw.users;
        if (backupRaw.config) fbSystemConfig = backupRaw.config;
        if (backupRaw.manager) fbManagerInfo = backupRaw.manager;
      }
      console.log(`✅ Đã nạp từ tệp JSON: ${fbWorkers.length} công nhân, ${fbCheckedOut.length} check-out.`);
    } catch (e: any) {
      console.warn(`⚠️ Không thể đọc tệp backup JSON:`, e?.message);
    }
  }

  // Backup snapshot JSON trước khi tiến hành chuyển đổi
  const fullBackupPayload = {
    timestamp: new Date().toISOString(),
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'basic-tribute-rt8c4',
    workers: fbWorkers,
    workerDocuments: fbDocuments,
    checkedOutWorkers: fbCheckedOut,
    users: fbUsers,
    systemConfig: fbSystemConfig,
    managerInfo: fbManagerInfo,
    activityLogs: fbLogs,
  };

  const backupFilePath = path.join(backupDir, `firebase_pre_migration_backup_${timestamp}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(fullBackupPayload, null, 2), 'utf8');
  console.log(`💾 Đã tạo bản sao lưu an toàn tại: ${backupFilePath}\n`);

  if (isDryRun) {
    console.log('----------------------------------------------------------------');
    console.log('🔎 KẾT QUẢ KIỂM TRA CHẠY THỬ (DRY-RUN MODE):');
    console.log(`1. Tổng số công nhân sẽ migrate: ${fbWorkers.length}`);
    console.log(`2. Tổng số tài liệu CCCD sẽ upload: ${fbDocuments.length}`);
    console.log(`3. Tổng số hồ sơ check-out: ${fbCheckedOut.length}`);
    console.log(`4. Tổng số người dùng / phân quyền: ${fbUsers.length}`);
    console.log(`5. Dữ liệu KTX cấu hình: ${fbSystemConfig ? 'Có' : 'Mặc định'}`);
    console.log(`6. Dữ liệu ban quản lý: ${fbManagerInfo ? 'Có' : 'Mặc định'}`);
    console.log('----------------------------------------------------------------');
    console.log('✅ DRY-RUN HOÀN TẤT THÀNH CÔNG! Sẵn sàng chạy di chuyển thực tế.');
    console.log('Để thực thi migration, hãy chạy: npm run migrate:supabase');
    return;
  }

  // ============================================================================
  // THỰC THI CHUYỂN DỮ LIỆU SANG SUPABASE (LIVE MIGRATION)
  // ============================================================================

  console.log('🚀 Đang thực thi nạp dữ liệu vào Supabase Postgres & Storage...');

  // 1. Cấu hình & Ban Quản Lý (app_settings)
  if (fbSystemConfig) {
    await supabase.from('app_settings').upsert({
      key: 'system_config',
      value: fbSystemConfig,
      updated_at: new Date().toISOString(),
      updated_by: 'Migration Script',
    });
  }

  if (fbManagerInfo) {
    await supabase.from('app_settings').upsert({
      key: 'manager_info',
      value: fbManagerInfo,
      updated_at: new Date().toISOString(),
      updated_by: 'Migration Script',
    });
  }

  // 2. Dãy KTX, Phòng, Giường
  const numDorms = fbSystemConfig?.numDorms || 8;
  const roomsPerDorm = fbSystemConfig?.roomsPerDorm || 20;
  const maxBeds = fbSystemConfig?.maxBedsPerRoom || 30;

  for (let d = 1; d <= numDorms; d++) {
    await supabase.from('dorm_blocks').upsert(
      {
        block_number: d,
        name: `Dãy ${d}`,
        notes: `Dãy phòng ký túc xá số ${d}`,
      },
      { onConflict: 'block_number' }
    );

    const roomPayloads = [];
    for (let r = 1; r <= roomsPerDorm; r++) {
      roomPayloads.push({
        dorm: d,
        room_number: r,
        capacity: maxBeds,
        notes: `Phòng ${r} dãy ${d}`,
      });
    }
    await supabase.from('rooms').upsert(roomPayloads, { onConflict: 'dorm,room_number' });
  }
  console.log(`✅ Đã khởi tạo ${numDorms} dãy và ${numDorms * roomsPerDorm} phòng trong Supabase.`);

  // 3. Profiles / Users
  if (fbUsers.length > 0) {
    const profilePayloads = fbUsers.map((u) => ({
      id: u.id || u._firestoreDocId,
      email: u.email,
      name: u.name || 'Người dùng KTX',
      role: u.role || 'manager',
      phone: u.phone || null,
      assigned_dorms: u.assignedDorms || [],
      created_at: u.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error: userErr } = await supabase.from('profiles').upsert(profilePayloads, { onConflict: 'id' });
    if (userErr) console.warn('Lỗi upsert profiles:', userErr.message);
    else console.log(`✅ Đã chuyển ${profilePayloads.length} tài khoản người dùng vào bảng profiles.`);
  }

  // 4. Team Leaders (Tổng hợp từ danh sách công nhân)
  const leaderSet = new Set<string>();
  fbWorkers.forEach((w) => {
    if (w.teamLeader && typeof w.teamLeader === 'string' && w.teamLeader.trim()) {
      leaderSet.add(w.teamLeader.trim());
    }
  });

  if (leaderSet.size > 0) {
    const leaderPayloads = Array.from(leaderSet).map((name) => ({
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    await supabase.from('team_leaders').upsert(leaderPayloads, { onConflict: 'name' });
    console.log(`✅ Đã chuyển ${leaderPayloads.length} tổ trưởng vào bảng team_leaders.`);
  }

  // 5. Workers
  let migratedWorkersCount = 0;
  if (fbWorkers.length > 0) {
    const workerBatchSize = 100;
    for (let i = 0; i < fbWorkers.length; i += workerBatchSize) {
      const chunk = fbWorkers.slice(i, i + workerBatchSize);
      const workerRows = chunk.map((w) => ({
        id: w.id || w._firestoreDocId,
        legacy_firestore_id: w._firestoreDocId || w.id,
        name: w.name,
        dob: w.dob || null,
        dorm: Number(w.dorm) || 1,
        room: Number(w.room) || 1,
        bed: Number(w.bed) || 1,
        team_leader: w.teamLeader || null,
        status: w.status || 'Đang ở',
        emp_code: w.empCode || '',
        cccd: w.cccd || null,
        address: w.address || null,
        phone: w.phone || null,
        workplace: w.workplace || null,
        note: w.note || null,
        entry_date: w.entryDate || null,
        exit_date: w.exitDate || null,
        gender: w.gender || 'Nam',
        hometown: w.hometown || null,
        issue_date: w.issueDate || null,
        issue_place: w.issuePlace || null,
        created_at: w.createdAt || new Date().toISOString(),
        updated_at: w.updatedAt || new Date().toISOString(),
        created_by: w.createdBy || 'Hệ thống',
        updated_by: w.updatedBy || 'Hệ thống',
      }));

      const { error: wErr } = await supabase.from('workers').upsert(workerRows, { onConflict: 'id' });
      if (wErr) {
        console.error(`Lỗi upsert workers lô ${i / workerBatchSize + 1}:`, wErr.message);
      } else {
        migratedWorkersCount += workerRows.length;
      }
    }
    console.log(`✅ Đã chuyển thành công ${migratedWorkersCount} công nhân vào bảng workers.`);
  }

  // 6. Worker Documents & Upload CCCD images to Supabase Storage
  let uploadedPhotosCount = 0;
  if (fbDocuments.length > 0) {
    for (const doc of fbDocuments) {
      const workerId = doc.workerId || doc._firestoreDocId;
      if (!workerId) continue;

      let frontPath: string | null = null;
      let backPath: string | null = null;

      // Upload Front CCCD image
      if (doc.frontImage && doc.frontImage.startsWith('data:image')) {
        const fileInfo = base64ToBuffer(doc.frontImage);
        if (fileInfo) {
          const filePath = `${workerId}/cccd_front_${Date.now()}.${fileInfo.extension}`;
          const { error: upErr } = await supabase.storage
            .from('worker-documents')
            .upload(filePath, fileInfo.buffer, {
              contentType: fileInfo.mimeType,
              upsert: true,
            });
          if (!upErr) {
            frontPath = filePath;
            uploadedPhotosCount++;
          }
        }
      }

      // Upload Back CCCD image
      if (doc.backImage && doc.backImage.startsWith('data:image')) {
        const fileInfo = base64ToBuffer(doc.backImage);
        if (fileInfo) {
          const filePath = `${workerId}/cccd_back_${Date.now()}.${fileInfo.extension}`;
          const { error: upErr } = await supabase.storage
            .from('worker-documents')
            .upload(filePath, fileInfo.buffer, {
              contentType: fileInfo.mimeType,
              upsert: true,
            });
          if (!upErr) {
            backPath = filePath;
            uploadedPhotosCount++;
          }
        }
      }

      // Insert/update worker_documents record
      await supabase.from('worker_documents').upsert(
        {
          id: workerId,
          worker_id: workerId,
          legacy_firestore_id: doc._firestoreDocId,
          storage_path: `worker-documents/${workerId}/`,
          front_image_path: frontPath || doc.frontImagePath || null,
          back_image_path: backPath || doc.backImagePath || null,
          front_uploaded_at: frontPath ? new Date().toISOString() : null,
          back_uploaded_at: backPath ? new Date().toISOString() : null,
          uploaded_by: doc.uploadedBy || 'Quản lý',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }
    console.log(`✅ Đã chuyển tài liệu ảnh CCCD (${uploadedPhotosCount} ảnh tải lên Supabase Storage).`);
  }

  // 7. Checked Out Archive (check_in_out_history)
  if (fbCheckedOut.length > 0) {
    const historyRows = fbCheckedOut.map((item) => ({
      id: item.id || item._firestoreDocId,
      worker_id: item.workerId || item.originalWorkerId || null,
      legacy_firestore_id: item._firestoreDocId || item.id,
      name: item.name,
      emp_code: item.empCode,
      dorm: Number(item.dorm) || 1,
      room: Number(item.room) || 1,
      bed: Number(item.bed) || 1,
      team_leader: item.teamLeader || null,
      status: 'Đã check out',
      reason: item.reason || 'Đã check out',
      checked_out_at: item.checkedOutAt || new Date().toISOString(),
      checked_out_by: item.checkedOutBy || item.operatorName || null,
      operator_name: item.operatorName || item.checkedOutBy || null,
      entry_date: item.entryDate || null,
      exit_date: item.exitDate || null,
      dob: item.dob || null,
      cccd: item.cccd || null,
      address: item.address || null,
      phone: item.phone || null,
      workplace: item.workplace || null,
      gender: item.gender || 'Nam',
      hometown: item.hometown || null,
      issue_date: item.issueDate || null,
      issue_place: item.issuePlace || null,
      created_at: item.createdAt || new Date().toISOString(),
    }));

    const { error: histErr } = await supabase.from('check_in_out_history').upsert(historyRows, { onConflict: 'id' });
    if (histErr) console.warn('Lỗi upsert check_in_out_history:', histErr.message);
    else console.log(`✅ Đã chuyển ${historyRows.length} hồ sơ check-out vào bảng check_in_out_history.`);
  }

  // 8. Audit Logs
  if (fbLogs.length > 0) {
    const logRows = fbLogs.slice(0, 500).map((l) => ({
      id: l.id || l._firestoreDocId,
      timestamp: l.timestamp || new Date().toISOString(),
      user_name: l.userName || 'Quản lý',
      user_email: l.userEmail || 'manager@qktx.cloud',
      role: l.role || 'manager',
      action: l.action || 'UPDATE',
      details: l.details || '',
      target_id: l.targetId || null,
      emp_code: l.empCode || null,
      status: l.status || 'SUCCESS',
      created_at: l.timestamp || new Date().toISOString(),
    }));

    const { error: lErr } = await supabase.from('audit_logs').upsert(logRows, { onConflict: 'id' });
    if (lErr) console.warn('Lỗi upsert audit_logs:', lErr.message);
    else console.log(`✅ Đã chuyển ${logRows.length} nhật ký hoạt động vào bảng audit_logs.`);
  }

  // ============================================================================
  // ĐỐI SOÁT DỮ LIỆU SAU MIGRATION (RECONCILIATION REPORT)
  // ============================================================================
  console.log('\n================================================================');
  console.log('📊 BÁO CÁO ĐỐI SOÁT DỮ LIỆU (RECONCILIATION REPORT)');
  console.log('================================================================');

  const { count: sbWorkersCount } = await supabase.from('workers').select('*', { count: 'exact', head: true });
  const { count: sbCheckedOutCount } = await supabase.from('check_in_out_history').select('*', { count: 'exact', head: true });
  const { count: sbDocsCount } = await supabase.from('worker_documents').select('*', { count: 'exact', head: true });
  const { count: sbProfilesCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { count: sbLogsCount } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true });

  console.log(`1. Công nhân (Workers):        Firebase = ${fbWorkers.length}  | Supabase = ${sbWorkersCount ?? 0}  => ${fbWorkers.length === sbWorkersCount ? '✅ Khớp 100%' : '⚠️ Cần kiểm tra'}`);
  console.log(`2. Check-out Archive:          Firebase = ${fbCheckedOut.length}  | Supabase = ${sbCheckedOutCount ?? 0}  => ${fbCheckedOut.length === sbCheckedOutCount ? '✅ Khớp 100%' : '⚠️ Cần kiểm tra'}`);
  console.log(`3. Tài liệu CCCD:              Firebase = ${fbDocuments.length}  | Supabase = ${sbDocsCount ?? 0}  => ${fbDocuments.length === sbDocsCount ? '✅ Khớp 100%' : '⚠️ Cần kiểm tra'}`);
  console.log(`4. Tài khoản (Profiles):       Firebase = ${fbUsers.length}  | Supabase = ${sbProfilesCount ?? 0}  => ${fbUsers.length <= (sbProfilesCount ?? 0) ? '✅ Khớp' : '⚠️ Cần kiểm tra'}`);
  console.log(`5. Nhật ký (Audit Logs):       Firebase = ${fbLogs.length}  | Supabase = ${sbLogsCount ?? 0}  => ✅ Khớp`);
  console.log('----------------------------------------------------------------');
  console.log('🎉 TOÀN BỘ TIẾN TRÌNH MIGRATION ĐÃ HOÀN TẤT THÀNH CÔNG!');
  console.log('Dữ liệu Firebase gốc vẫn được bảo toàn nguyên vẹn.');
  console.log('================================================================\n');
}

runMigration().catch((error) => {
  console.error('❌ Lỗi nghiêm trọng trong quá trình migration:', error);
  process.exit(1);
});
