import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// 포트원 API 설정
const PORTONE_API_BASE = "https://api.portone.io";

// Supabase 클라이언트 생성 함수
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 환경 변수가 설정되지 않았습니다."
    );
  }

  if (!supabaseServiceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 환경 변수가 설정되지 않았습니다."
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// 타입 정의
interface WebhookPayload {
  payment_id: string;
  status: "Paid" | "Cancelled";
}

interface PortonePayment {
  id: string;
  paymentId?: string;
  amount: {
    total: number;
  };
  orderName: string;
  billingKey?: string;
  customer: {
    id: string;
  };
}

interface PaymentSchedule {
  id: string;
  paymentId: string;
}

interface PaymentScheduleResponse {
  items: PaymentSchedule[];
}

export async function POST(request: NextRequest) {
  try {
    // 환경 변수 검증
    const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
    if (!PORTONE_API_SECRET) {
      return NextResponse.json(
        { success: false, error: "PORTONE_API_SECRET이 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = getSupabaseClient();

    // 1. 웹훅 페이로드 파싱
    const payload: WebhookPayload = await request.json();
    console.log("포트원 웹훅 수신:", payload);

    const paymentId = payload.payment_id;

    // 2. Paid 시나리오 처리
    if (payload.status === "Paid") {
      return await handlePaidScenario(paymentId, supabase);
    }

    // 3. Cancelled 시나리오 처리
    if (payload.status === "Cancelled") {
      return await handleCancelledScenario(paymentId, supabase);
    }

    // 4. 알 수 없는 상태
    console.log("알 수 없는 상태:", payload.status);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("웹훅 처리 중 오류 발생:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}

// Paid 시나리오 처리 함수
async function handlePaidScenario(
  paymentId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
) {
  // 환경 변수 확인
  const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
  if (!PORTONE_API_SECRET) {
    throw new Error("PORTONE_API_SECRET이 설정되지 않았습니다.");
  }

  // 2-1) paymentId의 결제정보를 조회
  console.log("결제 정보 조회 중:", paymentId);
  const paymentResponse = await fetch(
    `${PORTONE_API_BASE}/payments/${paymentId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `PortOne ${PORTONE_API_SECRET}`,
      },
    }
  );

  if (!paymentResponse.ok) {
    const errorText = await paymentResponse.text();
    console.error("포트원 결제 정보 조회 실패:", errorText);
    throw new Error(`포트원 결제 정보 조회 실패: ${paymentResponse.status}`);
  }

  const paymentData: PortonePayment = await paymentResponse.json();
  console.log("결제 정보 조회 성공:", paymentData);

  // 2-1-2) supabase의 테이블에 다음을 등록
  const now = new Date();
  const startAt = now.toISOString();

  const endAt = new Date(now);
  endAt.setDate(endAt.getDate() + 30);

  const endGraceAt = new Date(now);
  endGraceAt.setDate(endGraceAt.getDate() + 31);

  // next_schedule_at: end_at + 1일 오전 10시~11시 사이 임의 시각
  const nextScheduleAt = new Date(endAt);
  nextScheduleAt.setDate(nextScheduleAt.getDate() + 1);
  nextScheduleAt.setHours(10, Math.floor(Math.random() * 60), 0, 0); // 10시 00분 ~ 10시 59분

  const nextScheduleId = randomUUID();

  console.log("Supabase에 결제 정보 저장 중...");
  const { data: paymentRecord, error: insertError } = await supabase
    .from("payment")
    .insert({
      transaction_key: paymentId,
      amount: paymentData.amount.total,
      status: "Paid",
      start_at: startAt,
      end_at: endAt.toISOString(),
      end_grace_at: endGraceAt.toISOString(),
      next_schedule_at: nextScheduleAt.toISOString(),
      next_schedule_id: nextScheduleId,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Supabase 저장 실패:", insertError);
    throw new Error(`Supabase 저장 실패: ${insertError.message}`);
  }

  console.log("Supabase 저장 성공:", paymentRecord);

  // 2-2) 다음달구독예약시나리오
  // 2-2-1) 포트원에 다음달 구독결제를 예약
  if (paymentData.billingKey) {
    console.log("다음 달 구독 예약 중...");

    const scheduleResponse = await fetch(
      `${PORTONE_API_BASE}/payments/${nextScheduleId}/schedule`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `PortOne ${PORTONE_API_SECRET}`,
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
            currency: "KRW",
          },
          timeToPay: nextScheduleAt.toISOString(),
        }),
      }
    );

    if (!scheduleResponse.ok) {
      const errorText = await scheduleResponse.text();
      console.error("포트원 스케줄 등록 실패:", errorText);
      // 스케줄 등록 실패는 로그만 남기고 성공 응답 반환 (결제 저장은 성공했으므로)
    } else {
      console.log("다음 달 구독 예약 성공");
    }
  } else {
    console.log("billingKey가 없어 구독 예약을 건너뜁니다.");
  }

  // 성공 응답
  return NextResponse.json({
    success: true,
    message: "웹훅 처리 완료",
    payment: paymentRecord,
  });
}

// Cancelled 시나리오 처리 함수
async function handleCancelledScenario(
  paymentId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
) {
  // 환경 변수 확인
  const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
  if (!PORTONE_API_SECRET) {
    throw new Error("PORTONE_API_SECRET이 설정되지 않았습니다.");
  }

  // 3-1) 구독결제취소시나리오
  // 3-1-1) paymentId의 결제정보를 조회
  console.log("결제 정보 조회 중:", paymentId);
  const paymentResponse = await fetch(
    `${PORTONE_API_BASE}/payments/${paymentId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `PortOne ${PORTONE_API_SECRET}`,
      },
    }
  );

  if (!paymentResponse.ok) {
    const errorText = await paymentResponse.text();
    console.error("포트원 결제 정보 조회 실패:", errorText);
    throw new Error(`포트원 결제 정보 조회 실패: ${paymentResponse.status}`);
  }

  const paymentData: PortonePayment = await paymentResponse.json();
  console.log("결제 정보 조회 성공:", paymentData);

  // 3-1-2) supabase의 테이블에서 다음을 조회
  // 조건: transaction_key === 결제정보.paymentId
  const paymentIdToSearch = paymentData.paymentId || paymentData.id;
  console.log("Supabase에서 payment 조회 중:", paymentIdToSearch);
  const { data: existingPayment, error: selectError } = await supabase
    .from("payment")
    .select("*")
    .eq("transaction_key", paymentIdToSearch)
    .eq("status", "Paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (selectError || !existingPayment) {
    console.error("Supabase payment 조회 실패:", selectError);
    throw new Error(
      `Supabase payment 조회 실패: ${
        selectError?.message || "결제 정보를 찾을 수 없습니다"
      }`
    );
  }

  console.log("Supabase payment 조회 성공:", existingPayment);

  // 3-1-3) supabase의 테이블에 다음을 등록
  console.log("Supabase에 취소 payment 등록 중...");
  const { data: cancelPaymentRecord, error: insertError } = await supabase
    .from("payment")
    .insert({
      transaction_key: existingPayment.transaction_key,
      amount: -existingPayment.amount,
      status: "Cancel",
      start_at: existingPayment.start_at,
      end_at: existingPayment.end_at,
      end_grace_at: existingPayment.end_grace_at,
      next_schedule_at: existingPayment.next_schedule_at,
      next_schedule_id: existingPayment.next_schedule_id,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Supabase 취소 payment 저장 실패:", insertError);
    throw new Error(`Supabase 취소 payment 저장 실패: ${insertError.message}`);
  }

  console.log("Supabase 취소 payment 저장 성공:", cancelPaymentRecord);

  // 3-2) 다음달구독예약취소시나리오
  if (paymentData.billingKey && existingPayment.next_schedule_id) {
    // 3-2-1) 예약된 결제정보를 조회
    const nextScheduleAt = new Date(existingPayment.next_schedule_at);
    const fromDate = new Date(nextScheduleAt);
    fromDate.setDate(fromDate.getDate() - 1);
    const untilDate = new Date(nextScheduleAt);
    untilDate.setDate(untilDate.getDate() + 1);

    console.log("예약된 결제정보 조회 중...");
    try {
      // 쿼리 파라미터 생성
      const queryParams = new URLSearchParams({
        "filter.billingKey": paymentData.billingKey,
        "filter.from": fromDate.toISOString(),
        "filter.until": untilDate.toISOString(),
      });

      const scheduleResponse = await fetch(
        `${PORTONE_API_BASE}/payment-schedules?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `PortOne ${PORTONE_API_SECRET}`,
          },
        }
      );

      if (!scheduleResponse.ok) {
        const errorText = await scheduleResponse.text();
        console.error("포트원 스케줄 조회 실패:", errorText);
        throw new Error(`포트원 스케줄 조회 실패: ${scheduleResponse.status}`);
      }

      const scheduleData: PaymentScheduleResponse =
        await scheduleResponse.json();

      // 3-2-2) 예약된 결제정보의 조회결과 items를 순회하여 schedule객체의 id를 추출
      // 조건: items.paymentId === 조회결과.next_schedule_id
      const targetSchedule = scheduleData.items.find(
        (item) => item.paymentId === existingPayment.next_schedule_id
      );

      if (targetSchedule) {
        // 3-2-3) 포트원에 다음달 구독예약을 취소
        console.log("예약된 결제 취소 중...", targetSchedule.id);
        const deleteResponse = await fetch(
          `${PORTONE_API_BASE}/payment-schedules`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `PortOne ${PORTONE_API_SECRET}`,
            },
            body: JSON.stringify({
              scheduleIds: [targetSchedule.id],
            }),
          }
        );

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          console.error("포트원 스케줄 취소 실패:", errorText);
          // 스케줄 취소 실패는 로그만 남기고 성공 응답 반환 (취소 payment 저장은 성공했으므로)
        } else {
          console.log("예약된 결제 취소 성공");
        }
      } else {
        console.log("취소할 예약된 결제를 찾을 수 없습니다.");
      }
    } catch (error) {
      console.error("예약된 결제정보 조회 실패:", error);
      // 조회 실패는 로그만 남기고 성공 응답 반환 (취소 payment 저장은 성공했으므로)
    }
  } else {
    console.log(
      "billingKey 또는 next_schedule_id가 없어 예약 취소를 건너뜁니다."
    );
  }

  // 성공 응답
  return NextResponse.json({
    success: true,
    message: "취소 처리 완료",
    payment: cancelPaymentRecord,
  });
}
