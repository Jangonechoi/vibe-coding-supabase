import { useRouter } from "next/navigation";
import * as PortOne from "@portone/browser-sdk/v2";

export const usePayment = () => {
  const router = useRouter();

  /**
   * 빌링키 발급 및 구독 결제 처리
   */
  const handleSubscribe = async () => {
    try {
      // 1. 환경 변수 확인
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
      const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

      if (!storeId || !channelKey) {
        alert("포트원 설정이 누락되었습니다. 환경 변수를 확인해주세요.");
        return;
      }

      // 2. 테스트용 임시 사용자 ID 생성 (로그인 체크 없음)
      const testCustomerId = `test_customer_${Date.now()}`;

      // 3. 빌링키 발급 요청
      let issueResponse;
      try {
        issueResponse = await PortOne.requestIssueBillingKey({
          storeId,
          channelKey,
          billingKeyMethod: "CARD",
          issueId: `issue_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 11)}`,
          issueName: "IT 매거진 월간 구독",
          customer: {
            customerId: testCustomerId,
          },
        });
      } catch (issueError) {
        console.error("빌링키 발급 요청 실패:", issueError);
        alert(
          `빌링키 발급 요청에 실패했습니다: ${
            issueError instanceof Error ? issueError.message : "알 수 없는 오류"
          }`
        );
        return;
      }

      // 4. 빌링키 발급 실패 처리
      if (!issueResponse || issueResponse.code || !issueResponse.billingKey) {
        alert(
          `빌링키 발급에 실패했습니다: ${
            issueResponse?.message || "알 수 없는 오류"
          }`
        );
        return;
      }

      // 5. 빌링키로 결제 API 요청
      let paymentApiResponse: Response;
      try {
        paymentApiResponse = await fetch("/api/payments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            billingKey: issueResponse.billingKey,
            orderName: "IT 매거진 월간 구독",
            amount: 9900,
            customer: {
              id: testCustomerId,
            },
          }),
        });
      } catch (fetchError) {
        console.error("API 요청 실패:", fetchError);
        alert(`결제 API 요청에 실패했습니다. 네트워크 연결을 확인해주세요.`);
        return;
      }

      // 응답이 실패한 경우 처리
      if (!paymentApiResponse.ok) {
        let errorMessage = "알 수 없는 오류";
        try {
          const errorData = await paymentApiResponse.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `서버 오류 (${paymentApiResponse.status})`;
        }
        alert(`결제에 실패했습니다: ${errorMessage}`);
        return;
      }

      const paymentResult = await paymentApiResponse.json();

      // 6. 결제 실패 처리
      if (!paymentResult.success) {
        alert(
          `결제에 실패했습니다: ${paymentResult.error || "알 수 없는 오류"}`
        );
        return;
      }

      // 7. 결제 성공 처리
      alert("구독에 성공하였습니다.");
      router.push("/magazines");
    } catch (error) {
      console.error("구독 처리 중 오류:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.";
      alert(`구독 처리 중 오류가 발생했습니다: ${errorMessage}`);
    }
  };

  return {
    handleSubscribe,
  };
};
