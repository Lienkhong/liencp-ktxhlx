import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables for client-side
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Kiểm tra xem khóa API có phải là service_role key hay không.
 * QUY TẮC BẢO MẬT: service_role key có quyền quản trị tối cao, bypass toàn bộ Row Level Security (RLS).
 * TUYỆT ĐỐI KHÔNG ĐƯỢC ĐỂ HOẶC SỬ DỤNG SERVICE_ROLE KEY TRONG FRONTEND / CLIENT-SIDE.
 */
export function isServiceRoleKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);
      return payload?.role === 'service_role';
    }
  } catch {
    // Không giải mã được định dạng JWT
  }
  return false;
}

// Kiểm tra bảo mật: Phát hiện nhầm lẫn service_role key trong frontend
export const isServiceRoleDetected = isServiceRoleKey(supabaseAnonKey);

if (isServiceRoleDetected) {
  console.error(
    '🚨 [CẢNH BÁO NGUY HIỂM BẢO MẬT]: Phát hiện Supabase service_role key trong cấu hình Frontend!\n' +
    'Khóa service_role key có quyền quản trị tối cao và bypass toàn bộ Row Level Security (RLS).\n' +
    'Hệ thống đã tự động CHẶN kết nối này trên trình duyệt để bảo vệ an toàn dữ liệu.\n' +
    'Vui lòng chỉ sử dụng VITE_SUPABASE_ANON_KEY (anon public key) cho frontend.'
  );
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('placeholder') &&
  !isServiceRoleDetected // CHẶN HOÀN TOÀN NẾU PHÁT HIỆN SERVICE_ROLE KEY TRONG FRONTEND
);

// Fallback dummy URL to prevent SDK initialization crash when env is not yet filled
const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackKey = 'placeholder-anon-key';

// Client Supabase cho Frontend: CHỈ SỬ DỤNG ANON KEY (TUÂN THỦ RLS)
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? supabaseUrl : fallbackUrl,
  isSupabaseConfigured ? supabaseAnonKey : fallbackKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

export const SUPABASE_BUCKET_CCCD = 'worker-documents';

export interface SupabaseTestResult {
  connected: boolean;
  isConfigured: boolean;
  tableCount?: number;
  errorMessage?: string;
  url?: string;
}

/**
 * Kiểm tra kết nối tới Supabase Postgres
 */
export async function testSupabaseConnection(): Promise<SupabaseTestResult> {
  if (isServiceRoleDetected) {
    return {
      connected: false,
      isConfigured: false,
      errorMessage: 'CẢNH BÁO NGUY HIỂM: Phát hiện Service Role Key trong frontend! Service Role key có quyền bypass RLS và tuyệt đối không được để trong code trình duyệt. Vui lòng thay bằng VITE_SUPABASE_ANON_KEY (anon public key).',
      url: supabaseUrl || undefined,
    };
  }

  if (!isSupabaseConfigured) {
    return {
      connected: false,
      isConfigured: false,
      errorMessage: 'Chưa cấu hình VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong file .env',
      url: supabaseUrl || undefined,
    };
  }

  try {
    const { data, error, count } = await supabase
      .from('workers')
      .select('id', { count: 'exact', head: true });

    if (error) {
      // Check if table not found or auth error
      return {
        connected: false,
        isConfigured: true,
        errorMessage: error.message || 'Không thể truy vấn bảng workers từ Supabase',
        url: supabaseUrl,
      };
    }

    return {
      connected: true,
      isConfigured: true,
      tableCount: count ?? 0,
      url: supabaseUrl,
    };
  } catch (err: any) {
    return {
      connected: false,
      isConfigured: true,
      errorMessage: err?.message || 'Lỗi mạng khi kết nối tới Supabase',
      url: supabaseUrl,
    };
  }
}

/**
 * Upload ảnh CCCD (Base64 hoặc File) lên Supabase Storage Private Bucket
 */
export async function uploadCccdImageToSupabase(
  workerId: string,
  side: 'front' | 'back',
  base64OrFile: string
): Promise<{ path: string; signedUrl?: string } | null> {
  if (!isSupabaseConfigured) return null;

  try {
    let blob: Blob;
    let extension = 'jpg';
    let mimeType = 'image/jpeg';

    if (base64OrFile.startsWith('data:')) {
      const match = base64OrFile.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        if (mimeType.includes('png')) extension = 'png';
        else if (mimeType.includes('webp')) extension = 'webp';
        const byteCharacters = atob(match[2]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: mimeType });
      } else {
        return null;
      }
    } else {
      return null;
    }

    const filePath = `${workerId}/cccd_${side}_${Date.now()}.${extension}`;
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET_CCCD)
      .upload(filePath, blob, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.warn('Lỗi upload ảnh CCCD lên Supabase Storage:', error);
      return null;
    }

    // Generate a short-lived signed URL for immediate preview (valid for 1 hour)
    const { data: signedData } = await supabase.storage
      .from(SUPABASE_BUCKET_CCCD)
      .createSignedUrl(filePath, 3600);

    return {
      path: filePath,
      signedUrl: signedData?.signedUrl,
    };
  } catch (err) {
    console.warn('Lỗi xử lý upload ảnh CCCD:', err);
    return null;
  }
}

/**
 * Tạo signed URL bảo mật ngắn hạn (thời hạn 1 giờ) để xem ảnh CCCD
 */
export async function getCccdSignedUrl(storagePath: string): Promise<string | null> {
  if (!isSupabaseConfigured || !storagePath) return null;

  try {
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET_CCCD)
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.warn('Lỗi lấy signed URL CCCD:', err);
    return null;
  }
}
