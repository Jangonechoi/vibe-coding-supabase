import { NextRequest, NextResponse } from "next/server";

interface PaymentRequest {
  billingKey: string;
  orderName: string;
  amount: number;
  customer: {
    id: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 데이터 검증
    const body: PaymentRequest = await request.json();

    if (
      !body.billingKey ||
      !body.orderName ||
      !body.amount ||
      !body.customer?.id
    ) {
      return NextResponse.json(
        { success: false, error: "필수 파라미터가 누락되었습니다." },
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

    // 3. 고유한 paymentId 생성 (고객사에서 채번)
    const paymentId = `payment_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;

    // 4. Portone V2 API 호출
    const portoneResponse = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(
        paymentId
      )}/billing-key`,
      {
        method: "POST",
        headers: {
          Authorization: `PortOne ${portoneApiSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billingKey: body.billingKey,
          orderName: body.orderName,
          amount: {
            total: body.amount,
          },
          customer: {
            id: body.customer.id,
          },
          currency: "KRW",
        }),
      }
    );

    // 5. Portone API 응답 처리
    if (!portoneResponse.ok) {
      const errorData = await portoneResponse.json().catch(() => ({}));
      console.error("Portone API 오류:", {
        status: portoneResponse.status,
        error: errorData,
      });
      return NextResponse.json(
        {
          success: false,
          error: errorData.message || "결제 요청에 실패했습니다.",
        },
        { status: portoneResponse.status }
      );
    }

    // 6. 성공 응답 반환
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("결제 처리 중 오류:", error);
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
