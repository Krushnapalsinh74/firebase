export interface RazorpayCheckoutOptions {
  key: string;
  amount: number; // Amount in paise (e.g., 50000 for ₹500)
  currency: string;
  name?: string;
  description?: string;
  image?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss?: () => void;
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !(window as any).Razorpay) {
    throw new Error("Could not load Razorpay SDK. Please check your internet connection.");
  }

  const rzpOptions = {
    key: options.key,
    amount: options.amount,
    currency: options.currency || "INR",
    name: options.name || "KPark Education",
    description: options.description || "Plan Subscription",
    image: options.image || undefined,
    order_id: options.order_id,
    handler: options.handler,
    prefill: options.prefill || {},
    notes: options.notes || {},
    theme: {
      color: options.theme?.color || "#3b82f6",
    },
    modal: {
      ondismiss: () => {
        if (options.onDismiss) {
          options.onDismiss();
        }
      },
    },
  };

  const razorpayInstance = new (window as any).Razorpay(rzpOptions);
  razorpayInstance.on("payment.failed", (response: any) => {
    console.error("Payment failed:", response.error);
    if (options.onDismiss) {
      options.onDismiss();
    }
  });
  razorpayInstance.open();
}
