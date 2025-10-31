import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export interface MagazineData {
  category: string;
  title: string;
  description: string;
  content: string;
  tags: string[] | null;
  imageFile: File;
}

export interface UseSubmitMagazineReturn {
  isLoading: boolean;
  error: string | null;
  submitMagazine: (data: MagazineData) => Promise<void>;
}

export const useSubmitMagazine = (): UseSubmitMagazineReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submitMagazine = async (data: MagazineData): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // 이미지 스토리지 업로드 경로 생성 (yyyy/mm/dd/{UUID}.jpg)
      const now = new Date();
      const yyyy = String(now.getFullYear());
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const uuid = crypto.randomUUID();
      const objectPath = `${yyyy}/${mm}/${dd}/${uuid}.jpg`;

      // Supabase Storage 업로드
      const bucket = "vibe-coding-storage";
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(objectPath, data.imageFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: data.imageFile.type,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // 업로드된 파일의 퍼블릭 URL 생성
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(objectPath);

      const imageUrl = publicUrlData.publicUrl;

      // Supabase에 매거진 데이터 등록
      const { data: result, error: insertError } = await supabase
        .from("magazines")
        .insert([
          {
            category: data.category,
            title: data.title,
            description: data.description,
            content: data.content,
            tags: data.tags,
            image_url: imageUrl,
          },
        ])
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      // 등록 성공 후 알림 메시지
      alert("등록에 성공하였습니다.");

      // 등록된 매거진의 ID로 상세 페이지로 이동
      if (result?.id) {
        router.push(`/magazines/${result.id}`);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "등록 중 오류가 발생했습니다.";
      setError(errorMessage);
      console.error("매거진 등록 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    submitMagazine,
  };
};
