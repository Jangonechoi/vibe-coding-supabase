import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface PaymentStatus {
  isSubscribed: boolean;
  transactionKey: string | null;
}

interface UsePaymentStatusReturn {
  paymentStatus: PaymentStatus;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * 결제 상태 조회 훅
 *
 * 1. payment 테이블에서 transaction_key로 그룹화
 * 2. 각 그룹에서 created_at 최신 1건씩 추출
 * 3. status === "Paid"이고 start_at <= 현재시각 <= end_grace_at인 것만 필터링
 * 4. 결과에 따라 구독 상태 반환
 */
export const usePaymentStatus = (): UsePaymentStatusReturn => {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    isSubscribed: false,
    transactionKey: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPaymentStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. payment 테이블에서 status가 'Paid'인 모든 레코드 조회
      const { data: payments, error: fetchError } = await supabase
        .from("payment")
        .select("transaction_key, status, start_at, end_grace_at, created_at")
        .eq("status", "Paid")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw new Error(`결제 정보 조회 실패: ${fetchError.message}`);
      }

      if (!payments || payments.length === 0) {
        setPaymentStatus({
          isSubscribed: false,
          transactionKey: null,
        });
        setIsLoading(false);
        return;
      }

      // 2. transaction_key로 그룹화
      const groupedByTransactionKey = payments.reduce((acc, payment) => {
        const key = payment.transaction_key;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(payment);
        return acc;
      }, {} as Record<string, typeof payments>);

      // 3. 각 그룹에서 created_at 최신 1건씩 추출
      const latestPayments = Object.values(groupedByTransactionKey).map(
        (group) => {
          // created_at 기준으로 내림차순 정렬되어 있으므로 첫 번째 항목이 최신
          return group[0];
        }
      );

      // 4. 현재 시각
      const now = new Date();

      // 5. start_at <= 현재시각 <= end_grace_at 조건 필터링
      const activePayments = latestPayments.filter((payment) => {
        const startAt = new Date(payment.start_at);
        const endGraceAt = new Date(payment.end_grace_at);

        return startAt <= now && now <= endGraceAt;
      });

      // 6. 결과에 따라 상태 설정
      if (activePayments.length > 0) {
        // 1건 이상: 구독중
        setPaymentStatus({
          isSubscribed: true,
          transactionKey: activePayments[0].transaction_key,
        });
      } else {
        // 0건: Free
        setPaymentStatus({
          isSubscribed: false,
          transactionKey: null,
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(errorMessage);
      console.error("결제 상태 조회 중 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentStatus();
  }, []);

  return {
    paymentStatus,
    isLoading,
    error,
    refetch: fetchPaymentStatus,
  };
};
