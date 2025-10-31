"use client";

import { ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useMagazineDetail } from "./hooks/index.func.binding";

const getCategoryColor = (category: string) => {
  const colorMap: Record<string, string> = {
    인공지능: "magazine-category-ai",
    웹개발: "magazine-category-web",
    클라우드: "magazine-category-cloud",
    보안: "magazine-category-security",
    모바일: "magazine-category-mobile",
    데이터사이언스: "magazine-category-data",
    블록체인: "magazine-category-blockchain",
    DevOps: "magazine-category-devops",
  };

  return colorMap[category] || "magazine-category-default";
};

export default function GlossaryCardsDetail() {
  const onNavigateToList = () => {
    window.location.href = "/magazines";
  };

  const params = useParams();
  const id = useMemo(() => {
    const raw = params?.id;
    if (!raw) return undefined;
    return Array.isArray(raw) ? raw[0] : String(raw);
  }, [params]);

  const { data, isLoading, error } = useMagazineDetail(id);

  return (
    <div className="magazine-detail-container">
      <button className="magazine-detail-back" onClick={onNavigateToList}>
        <ArrowLeft className="magazine-detail-back-icon" />
        <span>목록으로</span>
      </button>

      <article className="magazine-detail-article">
        <div className="magazine-detail-hero">
          <img
            src={
              data?.image_url ||
              "https://images.unsplash.com/photo-1707989516414-a2394797e0bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNobm9sb2d5JTIwYXJ0aWNsZSUyMG1hZ2F6aW5lfGVufDF8fHx8MTc2MTAzMjYxNHww&ixlib=rb-4.1.0&q=80&w=1080"
            }
            alt={data?.title || "magazines"}
          />
          <div className="magazine-detail-hero-overlay"></div>
          <div
            className={`magazine-detail-category ${getCategoryColor(
              data?.category || ""
            )}`}
          >
            {data?.category || ""}
          </div>
        </div>

        <div className="magazine-detail-content-wrapper">
          {isLoading && <div className="magazine-detail-meta">로딩 중...</div>}
          {error && <div className="magazine-detail-meta">오류: {error}</div>}

          <h1 className="magazine-detail-title">{data?.title || ""}</h1>

          <p className="magazine-detail-summary">{data?.description || ""}</p>

          <div className="magazine-detail-content">
            {(data?.content || "")
              .split(/\n\n+/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index} className="magazine-detail-paragraph">
                  {paragraph}
                </p>
              ))}
          </div>

          <div className="magazine-detail-tags">
            {(data?.tags || []).map((tag, index) => (
              <span key={index} className="magazine-detail-tag">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </article>

      <div className="magazine-detail-footer">
        <button
          className="magazine-detail-back-bottom"
          onClick={onNavigateToList}
        >
          목록으로 돌아가기
        </button>
      </div>
    </div>
  );
}
