"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface MagazineListItem {
  id: string;
  image_url: string | null;
  category: string;
  title: string;
  description: string;
  tags: string[] | null;
}

export interface UseMagazinesReturn {
  magazines: MagazineListItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Supabase Storage URL에서 파일 경로 추출
 */
const extractFilePathFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    // Supabase Storage URL 패턴: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
    const match = urlObj.pathname.match(
      /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/
    );
    return match ? match[1] : null;
  } catch {
    // URL이 아닌 경우 경로로 간주
    return url;
  }
};

/**
 * 이미지 URL을 썸네일 URL로 변환
 * Supabase Storage의 Image Transformation 기능 사용
 */
const generateThumbnailUrl = (imageUrl: string | null): string | null => {
  if (!imageUrl) return null;

  const bucket = "vibe-coding-storage";
  const filePath = extractFilePathFromUrl(imageUrl);

  if (!filePath) return imageUrl;

  try {
    // Supabase Storage의 getPublicUrl을 사용하여 기본 URL 생성
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

    // Image Transformation을 위한 쿼리 파라미터 추가
    // width: 323px, resize: contain
    const thumbnailUrl = new URL(data.publicUrl);
    thumbnailUrl.searchParams.set("width", "323");
    thumbnailUrl.searchParams.set("resize", "contain");

    return thumbnailUrl.toString();
  } catch (err) {
    console.error("썸네일 URL 생성 오류:", err);
    return imageUrl; // 오류 발생시 원본 URL 반환
  }
};

export const useMagazines = (): UseMagazinesReturn => {
  const [magazines, setMagazines] = useState<MagazineListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMagazines = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: selectError } = await supabase
        .from("magazines")
        .select("id, image_url, category, title, description, tags")
        .limit(10);

      if (selectError) {
        throw new Error(selectError.message);
      }

      // 조회된 데이터의 image_url을 썸네일 URL로 변환
      const magazinesWithThumbnails = ((data as MagazineListItem[]) || []).map(
        (magazine) => ({
          ...magazine,
          image_url: generateThumbnailUrl(magazine.image_url),
        })
      );

      setMagazines(magazinesWithThumbnails);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "조회 중 오류가 발생했습니다.";
      setError(message);
      console.error("매거진 목록 조회 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMagazines();
  }, []);

  return {
    magazines,
    isLoading,
    error,
    refresh: fetchMagazines,
  };
};
