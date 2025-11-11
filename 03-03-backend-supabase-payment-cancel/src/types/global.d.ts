declare global {
  interface Window {
    PortOne?: {
      requestIssueBillingKey: (params: {
        storeId: string;
        channelKey: string;
        billingKeyMethod: string;
      }) => Promise<{
        code?: string;
        message?: string;
        billingKey?: string;
      }>;
    };
  }
}

export {};
