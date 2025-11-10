import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

interface SubscriptionRequest {
  payment_id: string;
  status: "Paid" | "Cancelled";
}

interface PortOnePaymentResponse {
  paymentId: string;
  amount: {
    total: number;
  };
  billingKey?: string;
  orderName: string;
  customer: {
    id: string;
  };
  currency: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 데이터 검증
    const body: SubscriptionRequest = await request.json();

    if (!body.payment_id || !body.status) {
      return NextResponse.json(
        { success: false, error: "필수 파라미터가 누락되었습니다." },
        { status: 400 }
      );
    }

    if (body.status !== "Paid" && body.status !== "Cancelled") {
      return NextResponse.json(
        {
          success: false,
          error: "status는 'Paid' 또는 'Cancelled'여야 합니다.",
        },
        { status: 400 }
      );
    }

    // 2. 환경 변수 확인
    const portoneApiSecret = process.env.PORTONE_API_SECRET;
    if (!portoneApiSecret) {
      console.error("PORTONE_API_SECRET 환경 변수가 설정되지 않았습니다.");
      return NextResponse.json(
        { success: false, error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    // Supabase 클라이언트 생성 (API 라우트에서만 사용)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Supabase 환경 변수가 설정되지 않았습니다.");
      return NextResponse.json(
        { success: false, error: "서버 설정 오류" },
        { status: 500 }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 3. 구독결제완료시나리오 (status가 "Paid"인 경우)
    if (body.status === "Paid") {
      // 3-1) paymentId의 결제정보를 조회
      const paymentResponse = await fetch(
        `https://api.portone.io/payments/${encodeURIComponent(
          body.payment_id
        )}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `PortOne ${portoneApiSecret}`,
          },
        }
      );

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json().catch(() => ({}));
        console.error("포트원 결제 정보 조회 실패:", {
          status: paymentResponse.status,
          error: errorData,
        });
        return NextResponse.json(
          {
            success: false,
            error: errorData.message || "결제 정보 조회에 실패했습니다.",
          },
          { status: paymentResponse.status }
        );
      }

      const paymentData: PortOnePaymentResponse = await paymentResponse.json();

      // 3-2) 날짜 계산
      const now = new Date();
      const endAt = new Date(now);
      endAt.setDate(endAt.getDate() + 30);

      const endGraceAt = new Date(now);
      endGraceAt.setDate(endGraceAt.getDate() + 31);

      // next_schedule_at: end_at + 1일 오전 10시~11시 사이 임의 시각
      const nextScheduleAt = new Date(endAt);
      nextScheduleAt.setDate(nextScheduleAt.getDate() + 1);
      nextScheduleAt.setHours(10, Math.floor(Math.random() * 60), 0, 0); // 10시~10시59분 사이

      const nextScheduleId = randomUUID();

      // 3-3) Supabase의 payment 테이블에 등록
      const { error: supabaseError } = await supabase.from("payment").insert({
        transaction_key: paymentData.paymentId,
        amount: paymentData.amount.total,
        status: "Paid",
        start_at: now.toISOString(),
        end_at: endAt.toISOString(),
        end_grace_at: endGraceAt.toISOString(),
        next_schedule_at: nextScheduleAt.toISOString(),
        next_schedule_id: nextScheduleId,
      });

      if (supabaseError) {
        console.error("Supabase 저장 실패:", supabaseError);
        return NextResponse.json(
          {
            success: false,
            error: "결제 정보 저장에 실패했습니다.",
          },
          { status: 500 }
        );
      }

      // 3-4) 다음달구독예약시나리오
      // billingKey가 있는 경우에만 예약
      if (paymentData.billingKey) {
        const scheduleResponse = await fetch(
          `https://api.portone.io/payments/${encodeURIComponent(
            nextScheduleId
          )}/schedule`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `PortOne ${portoneApiSecret}`,
            },
            body: JSON.stringify({
              payment: {
                billingKey: paymentData.billingKey,
                orderName: paymentData.orderName,
                customer: {
                  id: paymentData.customer.id,
                },
                amount: {
                  total: paymentData.amount.total,
                },
                currency: paymentData.currency || "KRW",
              },
              timeToPay: nextScheduleAt.toISOString(),
            }),
          }
        );

        if (!scheduleResponse.ok) {
          const scheduleErrorData = await scheduleResponse
            .json()
            .catch(() => ({}));
          console.error("포트원 구독 예약 실패:", {
            status: scheduleResponse.status,
            error: scheduleErrorData,
          });
          // 예약 실패해도 성공으로 처리 (이미 payment 테이블에 저장됨)
          console.warn("구독 예약은 실패했지만 결제 정보는 저장되었습니다.");
        }
      } else {
        console.warn("billingKey가 없어 구독 예약을 건너뜁니다.");
      }
    }

    // 4. 성공 응답 반환
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("구독 결제 처리 중 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
