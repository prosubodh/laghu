# Modern Design Patterns in TypeScript Reference

Production implementations of essential design patterns in full-stack TypeScript.

---

## 1. Adapter Pattern (Dependency Isolation)

```typescript
// 1. Domain Interface (Owned by the application)
export interface IEmailAdapter {
  send(to: string, subject: string, html: string): Promise<Result<void, Error>>;
}

// 2. Open-Source Infrastructure Implementation (e.g. Mailpit/Nodemailer)
export class NodemailerEmailAdapter implements IEmailAdapter {
  constructor(private readonly transporter: nodemailer.Transporter) {}

  async send(to: string, subject: string, html: string): Promise<Result<void, Error>> {
    try {
      await this.transporter.sendMail({ to, subject, html });
      return { success: true, value: undefined };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }
}
```

---

## 2. Strategy Pattern (Runtime Policy Swapping)

```typescript
// 1. Strategy Contract
export interface ITenantPricingStrategy {
  calculateMonthlyRate(activeSeats: number): number;
}

// 2. Concrete Strategies
export class StandardPricingStrategy implements ITenantPricingStrategy {
  calculateMonthlyRate(activeSeats: number): number {
    return activeSeats * 15;
  }
}

export class EnterprisePricingStrategy implements ITenantPricingStrategy {
  calculateMonthlyRate(activeSeats: number): number {
    return activeSeats * 10 + 500; // Flat base fee
  }
}
```

---

## 3. Result / Either Pattern (Type-Safe Errors)

```typescript
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ success: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ success: false, error });

---

## 4. Option / Maybe Pattern (Null Safety)

```typescript
export type Option<T> =
  | { defined: true; value: T }
  | { defined: false };

export const Some = <T>(value: T): Option<T> => ({ defined: true, value });
export const None = (): Option<never> => ({ defined: false });
```

---

## 5. Factory Method (Encapsulated Instantiation)

```typescript
export interface IPaymentGateway {
  charge(amountCents: number): Promise<Result<string, Error>>;
}

export class PaymentGatewayFactory {
  static create(provider: 'stripe' | 'paddle', config: Record<string, string>): IPaymentGateway {
    switch (provider) {
      case 'stripe':
        return new StripePaymentAdapter(config.apiKey);
      case 'paddle':
        return new PaddlePaymentAdapter(config.vendorId);
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }
}
```

---

## 6. Decorator Pattern (Cross-Cutting Concerns)

```typescript
export interface IOrderService {
  placeOrder(orderId: string): Promise<Result<void, Error>>;
}

// Decorator wrapping order service with metrics and latency telemetry
export class TelemetryOrderServiceDecorator implements IOrderService {
  constructor(
    private readonly inner: IOrderService,
    private readonly metrics: IMetricsClient
  ) {}

  async placeOrder(orderId: string): Promise<Result<void, Error>> {
    const start = performance.now();
    const result = await this.inner.placeOrder(orderId);
    this.metrics.timing('order.place.duration', performance.now() - start);
    return result;
  }
}
```
