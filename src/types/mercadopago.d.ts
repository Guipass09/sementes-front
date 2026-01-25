export {};

declare global {
  interface Window {
    MercadoPago?: any;
    cardPaymentBrickController?: { unmount: () => void };
  }
}

