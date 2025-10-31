"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface MagazineDetailData {
  id: string;
  image_url: string | null;
  category: string;
  title: string;
  description: string;
  content: string;
  tags: string[] | null;
}

export interface UseMagazineDetailReturn {
  data: MagazineDetailData | null;
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
    // width: 852px, resize: contain
    const thumbnailUrl = new URL(data.publicUrl);
    thumbnailUrl.searchParams.set("width", "852");
    thumbnailUrl.searchParams.set("resize", "contain");

    return thumbnailUrl.toString();
  } catch (err) {
    console.error("썸네일 URL 생성 오류:", err);
    return imageUrl; // 오류 발생시 원본 URL 반환
  }
};

export const useMagazineDetail = (
  id: string | undefined
): UseMagazineDetailReturn => {
  const [data, setData] = useState<MagazineDetailData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: selectError } = await supabase
        .from("magazines")
        .select("id, image_url, category, title, description, content, tags")
        .eq("id", id)
        .single();

      if (selectError) {
        throw new Error(selectError.message);
      }

      if (data) {
        // image_url을 썸네일 URL로 변환
        const thumbnailUrl = generateThumbnailUrl(data.image_url);

        setData({
          ...(data as MagazineDetailData),
          image_url: thumbnailUrl,
        });
      } else {
        setData(null);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "조회 중 오류가 발생했습니다.";
      setError(message);
      console.error("매거진 상세 조회 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchDetail,
  };
};
