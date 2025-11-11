import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase 클라이언트 생성 함수 (지연 초기화)
let supabaseInstance: SupabaseClient<any> | null = null;

function getSupabaseClient(): SupabaseClient<any> {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // 빌드 타임에 환경 변수가 없을 경우 더미 클라이언트 생성
    // 런타임에는 환경 변수가 있을 것이므로 실제 사용 시 오류가 발생하지 않음
    // createClient는 URL과 키가 유효하지 않아도 생성은 가능하므로, 빌드 타임 오류를 방지
    supabaseInstance = createClient(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseAnonKey || "placeholder-key"
    );
    return supabaseInstance;
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

// 클라이언트 생성 (지연 초기화)
export const supabase = getSupabaseClient();

export interface Magazine {
  id?: string;
  category: string;
  title: string;
  description: string;
  content: string;
  tags: string[] | null;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}
